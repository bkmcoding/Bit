import { Entity } from './Entity';
import { Projectile } from './Projectile';
import { Vector2 } from '../utils/Vector2';
import { PLAYER, COLORS, COLLISION_LAYER, GAME } from '../utils/constants';
import { AudioManager } from '../audio/AudioManager';
import type { Game } from '../engine/Game';

export class Player extends Entity {
  public health: number;
  public maxHealth: number;
  public speed: number;
  public fireRate: number;
  public damage: number;
  public piercing: number = 0;
  public bulletCount: number = 1;
  public bulletSpread: number = 0.2;
  
  private game: Game;
  private fireCooldown: number = 0;
  private invulnerableTime: number = 0;
  private isInvulnerable: boolean = false;
  
  // Animation
  private legOffset: number = 0;
  private legDirection: number = 1;
  private facingAngle: number = 0;

  constructor(position: Vector2, game: Game) {
    super({
      position,
      size: PLAYER.SIZE,
      collisionLayer: COLLISION_LAYER.PLAYER,
      collisionMask: COLLISION_LAYER.ENEMY | COLLISION_LAYER.ENEMY_PROJECTILE | COLLISION_LAYER.WALL | COLLISION_LAYER.DOOR,
    });
    
    this.game = game;
    this.health = PLAYER.MAX_HEALTH;
    this.maxHealth = PLAYER.MAX_HEALTH;
    this.speed = PLAYER.SPEED;
    this.fireRate = PLAYER.FIRE_RATE;
    this.damage = PLAYER.DAMAGE;
  }

  update(deltaTime: number): void {
    const input = this.game.input;
    
    // Movement
    const moveDir = input.getMovementDirection();
    if (moveDir.magnitudeSq() > 0) {
      // Apply movement with acceleration
      this.velocity = moveDir.mul(this.speed);
      
      // Animate legs when moving
      this.legOffset += deltaTime * 15 * this.legDirection;
      if (Math.abs(this.legOffset) > 2) {
        this.legDirection *= -1;
      }
    } else {
      // Slow down
      this.velocity.mulMut(1 - PLAYER.FRICTION * deltaTime);
      this.legOffset *= 0.9;
    }
    
    // Apply velocity
    this.position.addMut(this.velocity.mul(deltaTime));
    
    // Clamp to room bounds (with wall thickness)
    const room = this.game.getCurrentRoom();
    if (room) {
      const halfSize = this.size / 2;
      const minX = room.wallThickness + halfSize;
      const maxX = GAME.NATIVE_WIDTH - room.wallThickness - halfSize;
      const minY = room.wallThickness + halfSize;
      const maxY = GAME.NATIVE_HEIGHT - room.wallThickness - halfSize;
      
      this.position.x = Math.max(minX, Math.min(maxX, this.position.x));
      this.position.y = Math.max(minY, Math.min(maxY, this.position.y));
    }
    
    // Update facing angle toward mouse
    const mousePos = input.getMousePosition();
    this.facingAngle = this.position.angleTo(mousePos);
    
    // Shooting
    this.fireCooldown -= deltaTime;
    if (input.isMouseDown() && this.fireCooldown <= 0) {
      this.shoot();
      this.fireCooldown = this.fireRate;
    }
    
    // Invulnerability timer
    if (this.isInvulnerable) {
      this.invulnerableTime -= deltaTime;
      if (this.invulnerableTime <= 0) {
        this.isInvulnerable = false;
      }
    }
  }

  private shoot(): void {
    AudioManager.play('SFX_SHOOT');
    const aimDir = this.game.input.getAimDirection(this.position);
    
    if (this.bulletCount === 1) {
      // Single shot
      this.spawnBullet(aimDir);
    } else {
      // Multiple shots with spread
      const totalSpread = this.bulletSpread * (this.bulletCount - 1);
      const startAngle = -totalSpread / 2;
      
      for (let i = 0; i < this.bulletCount; i++) {
        const angle = startAngle + (this.bulletSpread * i);
        const dir = aimDir.rotate(angle);
        this.spawnBullet(dir);
      }
    }
  }

  private spawnBullet(direction: Vector2): void {
    const projectile = new Projectile({
      position: this.position.clone(),
      direction,
      isPlayerProjectile: true,
      damage: this.damage,
      piercing: this.piercing,
    });
    this.game.spawnProjectile(projectile);
  }

  takeDamage(amount: number): void {
    if (this.isInvulnerable) return;
    
    this.health -= amount;
    this.isInvulnerable = true;
    this.invulnerableTime = PLAYER.INVULN_TIME;
    
    AudioManager.play('SFX_PLAYER_HURT');
    this.game.shake(8);
    this.game.particles.emit(this.position, '#ff6666', 8, 60);
    this.game.notifyHealthChange();
    
    if (this.health <= 0) {
      this.die();
    }
  }

  heal(amount: number): void {
    this.health = Math.min(this.maxHealth, this.health + amount);
    this.game.notifyHealthChange();
  }

  private die(): void {
    this.game.particles.emitDeath(this.position, '#ffffff');
    this.game.shake(15);
    this.game.setState('GAME_OVER');
  }

  render(ctx: CanvasRenderingContext2D): void {
    const x = Math.round(this.position.x);
    const y = Math.round(this.position.y);
    
    // Flash when invulnerable
    if (this.isInvulnerable && Math.floor(this.invulnerableTime * 10) % 2 === 0) {
      ctx.globalAlpha = 0.5;
    }
    
    ctx.save();
    ctx.translate(x, y);
    
    // Body (white circle)
    ctx.fillStyle = this.isInvulnerable ? COLORS.PLAYER_HURT : COLORS.PLAYER_BODY;
    ctx.beginPath();
    ctx.arc(0, 0, 3, 0, Math.PI * 2);
    ctx.fill();
    
    // Outline
    ctx.strokeStyle = COLORS.PLAYER_OUTLINE;
    ctx.lineWidth = 1;
    ctx.stroke();
    
    // Legs
    ctx.strokeStyle = COLORS.PLAYER_OUTLINE;
    ctx.lineWidth = 1;
    
    // Left leg
    ctx.beginPath();
    ctx.moveTo(-1, 2);
    ctx.lineTo(-2 + this.legOffset * 0.5, 5);
    ctx.stroke();
    
    // Right leg
    ctx.beginPath();
    ctx.moveTo(1, 2);
    ctx.lineTo(2 - this.legOffset * 0.5, 5);
    ctx.stroke();
    
    // Eyes (looking at mouse direction)
    const eyeOffsetX = Math.cos(this.facingAngle) * 1;
    const eyeOffsetY = Math.sin(this.facingAngle) * 1;
    
    ctx.fillStyle = COLORS.PLAYER_OUTLINE;
    ctx.beginPath();
    ctx.arc(-1 + eyeOffsetX * 0.5, -1 + eyeOffsetY * 0.5, 0.5, 0, Math.PI * 2);
    ctx.arc(1 + eyeOffsetX * 0.5, -1 + eyeOffsetY * 0.5, 0.5, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  // Reset position for room transition
  setPosition(pos: Vector2): void {
    this.position = pos.clone();
    this.velocity.set(0, 0);
  }
}
