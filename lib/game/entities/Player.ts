import { Entity } from './Entity';
import { Projectile } from './Projectile';
import { Vector2 } from '../utils/Vector2';
import { PLAYER, COLORS, COLLISION_LAYER, GAME, PROJECTILE } from '../utils/constants';
import { resolveCircleObstacles } from '../utils/obstacleCollision';
import { AudioManager } from '../audio/AudioManager';
import type { Game } from '../engine/Game';

export class Player extends Entity {
  public health: number;
  public maxHealth: number;
  public speed: number;
  public fireRate: number;
  public damage: number;
  public piercing: number = 0;
  /** Extra seconds of invulnerability after taking a hit (from upgrades). */
  public hitInvulnBonus: number = 0;
  public projectileSpeedMult: number = 1;
  /** Added to base projectile diameter. */
  public projectileSizeBonus: number = 0;
  /** Multiplier on incoming damage (below 1 = tankier). */
  public damageTakenMult: number = 1;
  /** Subtracted after the multiplier; helps vs 2-damage hits when you only have a few hearts. */
  public flatDamageMitigation: number = 0;
  /** Added after the multiplier (extra pain per hit). */
  public flatDamagePenalty: number = 0;
  /** Chance 0–1 to heal on kill. */
  public killHealChance: number = 0;
  /** Every N kills, heal `amount` HP. */
  public everyNthKillHeal: { n: number; amount: number } | null = null;
  private killTally: number = 0;
  /** Seconds of frenzy after a kill; fire rate uses `frenzyFireRateMult` (<1 = faster). */
  public frenzyOnKillDuration: number = 0;
  public frenzyFireRateMult: number = 1;
  private frenzyTimer: number = 0;
  public critChance: number = 0;
  public critDamageMult: number = 2;
  /** Speed multiplier while below half health. */
  public lowHpSpeedMult: number = 1;
  /** Speed multiplier while at exactly 1 HP. */
  public lastLegSpeedMult: number = 1;

  private game: Game;
  private fireCooldown: number = 0;
  private invulnerableTime: number = 0;
  private isInvulnerable: boolean = false;
  /** Brief grace after entering a combat room — no damage from hits. */
  private spawnProtectionTime: number = 0;
  
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
      let moveSpeed = this.speed;
      const hpFrac = this.maxHealth > 0 ? this.health / this.maxHealth : 1;
      if (hpFrac <= 0.5 && this.lowHpSpeedMult > 1) moveSpeed *= this.lowHpSpeedMult;
      if (this.health === 1 && this.lastLegSpeedMult > 1) moveSpeed *= this.lastLegSpeedMult;
      this.velocity = moveDir.mul(moveSpeed);
      
      // Animate legs only on intentional input; clamp so feet cannot drift apart visually
      this.legOffset += deltaTime * 15 * this.legDirection;
      if (Math.abs(this.legOffset) > 2) {
        this.legDirection *= -1;
      }
    } else {
      // Slow down
      this.velocity.mulMut(1 - PLAYER.FRICTION * deltaTime);
      this.legOffset *= 0.85;
    }
    this.legOffset = Math.max(-2, Math.min(2, this.legOffset));
    
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
      const obs = room.getObstacleRects();
      if (obs.length > 0) {
        resolveCircleObstacles(this.position, halfSize, obs);
        this.position.x = Math.max(minX, Math.min(maxX, this.position.x));
        this.position.y = Math.max(minY, Math.min(maxY, this.position.y));
      }
    }
    
    // Update facing angle toward mouse
    const mousePos = input.getMousePosition();
    this.facingAngle = this.position.angleTo(mousePos);
    
    // Shooting
    this.fireCooldown -= deltaTime;
    if (input.isMouseDown() && this.fireCooldown <= 0) {
      this.shoot();
      this.fireCooldown = this.effectiveFireRate();
    }
    
    // Invulnerability timer
    if (this.isInvulnerable) {
      this.invulnerableTime -= deltaTime;
      if (this.invulnerableTime <= 0) {
        this.isInvulnerable = false;
      }
    }

    if (this.spawnProtectionTime > 0) {
      this.spawnProtectionTime = Math.max(0, this.spawnProtectionTime - deltaTime);
    }

    if (this.frenzyTimer > 0) {
      this.frenzyTimer = Math.max(0, this.frenzyTimer - deltaTime);
    }
  }

  private shoot(): void {
    AudioManager.play('SFX_SHOOT');
    const aimDir = this.game.input.getAimDirection(this.position);
    this.spawnBullet(aimDir);
  }

  private effectiveFireRate(): number {
    return this.frenzyTimer > 0 ? this.fireRate * this.frenzyFireRateMult : this.fireRate;
  }

  private spawnBullet(direction: Vector2): void {
    const projectile = new Projectile({
      position: this.position.clone(),
      direction,
      isPlayerProjectile: true,
      damage: this.damage,
      piercing: this.piercing,
      speed: PROJECTILE.PLAYER_SPEED * this.projectileSpeedMult,
      size: PROJECTILE.SIZE + this.projectileSizeBonus,
    });
    this.game.spawnProjectile(projectile);
  }

  /** Called from `CollisionSystem` for player shots. */
  rollProjectileDamage(baseDamage: number): number {
    if (this.critChance > 0 && Math.random() < this.critChance) {
      return Math.max(1, Math.floor(baseDamage * this.critDamageMult));
    }
    return baseDamage;
  }

  onEnemyKilled(): void {
    if (this.killHealChance > 0 && Math.random() < this.killHealChance) {
      this.heal(1);
    }
    if (this.everyNthKillHeal) {
      this.killTally += 1;
      if (this.killTally >= this.everyNthKillHeal.n) {
        this.killTally = 0;
        this.heal(this.everyNthKillHeal.amount);
      }
    }
    if (this.frenzyOnKillDuration > 0) {
      this.frenzyTimer = this.frenzyOnKillDuration;
    }
  }

  takeDamage(amount: number): void {
    if (this.spawnProtectionTime > 0) return;
    if (this.isInvulnerable) return;

    let dealt = Math.max(1, Math.round(amount * this.damageTakenMult));
    dealt = Math.max(1, dealt + this.flatDamagePenalty - this.flatDamageMitigation);
    this.health -= dealt;
    this.isInvulnerable = true;
    this.invulnerableTime = Math.max(
      0.35,
      PLAYER.INVULN_TIME + this.hitInvulnBonus
    );
    
    AudioManager.play('SFX_PLAYER_HURT');
    this.game.shake(11);
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
    
    const spawnBlink = this.spawnProtectionTime > 0 && Math.floor(this.spawnProtectionTime * 12) % 2 === 0;
    const hurtBlink = this.isInvulnerable && Math.floor(this.invulnerableTime * 10) % 2 === 0;
    if (spawnBlink || hurtBlink) {
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
    this.legOffset = 0;
    this.legDirection = 1;
  }

  grantSpawnProtection(seconds: number): void {
    this.spawnProtectionTime = Math.max(this.spawnProtectionTime, seconds);
  }

  isSpawnProtected(): boolean {
    return this.spawnProtectionTime > 0;
  }
}
