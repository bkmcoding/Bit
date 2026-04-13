import { Entity } from '../Entity';
import { Vector2 } from '../../utils/Vector2';
import { COLLISION_LAYER, COLORS, HIVE_MIND_HARD } from '../../utils/constants';
import type { HiveRole } from '../../systems/HiveMind';
import { resolveCircleObstacles } from '../../utils/obstacleCollision';
import { AudioManager } from '../../audio/AudioManager';
import type { Game } from '../../engine/Game';

export interface EnemyConfig {
  size: number;
  speed: number;
  health: number;
  damage: number;
}

export abstract class Enemy extends Entity {
  public health: number;
  public maxHealth: number;
  public speed: number;
  public damage: number;
  
  protected game: Game;
  protected flashTimer: number = 0;

  constructor(position: Vector2, config: EnemyConfig, game: Game) {
    super({
      position,
      size: config.size,
      collisionLayer: COLLISION_LAYER.ENEMY,
      collisionMask: COLLISION_LAYER.PLAYER_PROJECTILE | COLLISION_LAYER.WALL | COLLISION_LAYER.PLAYER,
    });
    
    this.game = game;
    this.health = config.health;
    this.maxHealth = config.health;
    this.speed = config.speed;
    this.damage = config.damage;
  }

  update(deltaTime: number): void {
    // Update flash timer
    if (this.flashTimer > 0) {
      this.flashTimer -= deltaTime;
    }
    
    // Apply velocity
    this.position.addMut(this.velocity.mul(deltaTime));
    
    // Clamp to room bounds
    const room = this.game.getCurrentRoom();
    if (room) {
      const halfSize = this.size / 2;
      const minX = room.wallThickness + halfSize;
      const maxX = room.width - room.wallThickness - halfSize;
      const minY = room.wallThickness + halfSize;
      const maxY = room.height - room.wallThickness - halfSize;
      
      this.position.x = Math.max(minX, Math.min(maxX, this.position.x));
      this.position.y = Math.max(minY, Math.min(maxY, this.position.y));
      const obs = room.getObstacleRects();
      if (obs.length > 0) {
        resolveCircleObstacles(this.position, halfSize, obs);
        this.position.x = Math.max(minX, Math.min(maxX, this.position.x));
        this.position.y = Math.max(minY, Math.min(maxY, this.position.y));
      }
    }
    
    // Subclass-specific behavior
    this.updateBehavior(deltaTime);
  }

  protected abstract updateBehavior(deltaTime: number): void;
  protected abstract renderEnemy(ctx: CanvasRenderingContext2D): void;

  takeDamage(amount: number): void {
    this.health -= amount;
    this.flashTimer = 0.1;
    
    // Play hit sound
    AudioManager.play('SFX_ENEMY_HIT');
    
    // Emit hit particles
    this.game.particles.emit(this.position, '#ffff00', 3, 40);
    
    if (this.health <= 0) {
      this.die();
    }
  }

  protected die(): void {
    // Play death sound
    AudioManager.play('SFX_ENEMY_DEATH');
    // Death particles
    this.game.particles.emitDeath(this.position, '#ff4444');
    this.game.shake(3);
    this.game.onEnemyKilled();
    this.destroy();
  }

  render(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.translate(Math.round(this.position.x), Math.round(this.position.y));
    
    // Flash white when hit
    if (this.flashTimer > 0) {
      ctx.globalAlpha = 0.7;
    }
    
    this.renderEnemy(ctx);
    
    ctx.restore();
  }

  // Helper to get direction to player
  protected getDirectionToPlayer(): Vector2 {
    return this.directionTo(this.game.player);
  }

  // Helper to get distance to player
  protected getDistanceToPlayer(): number {
    return this.distanceTo(this.game.player);
  }

  // Helper to check if player is in line of sight (simple)
  protected canSeePlayer(): boolean {
    // For now, always true. Could add wall checking later
    return true;
  }

  /**
   * Hard mode: hive nudges *bearing spread* without replacing the drive to close for melee.
   * Chase uses tangential-only hive (radial intent stays toward the player) so circular
   * player movement does not turn into a mirrored merry-go-round.
   */
  protected blendVelocityWithHiveMind(
    velocity: Vector2,
    role: HiveRole,
    blend: number,
    kiteRadius?: number
  ): Vector2 {
    if (this.game.difficulty !== 'hard') return velocity;
    const steer = this.game.getHiveMindSteer(this, role, kiteRadius);
    if (!steer) return velocity;
    const speed = velocity.magnitude();
    if (speed < 1e-4) return velocity;
    const w = Math.max(0, Math.min(1, blend));

    if (role === 'chase') {
      const toP = this.getDirectionToPlayer();
      const radialPart = toP.mul(toP.dot(steer));
      let tang = steer.sub(radialPart);
      if (tang.magnitudeSq() < 1e-6) {
        tang = new Vector2(-toP.y, toP.x);
      } else {
        tang.normalizeMut();
      }
      const newDir = toP.mul(1 - w).add(tang.mul(w)).normalize();
      return newDir.mul(speed);
    }

    const baseDir = velocity.normalize();
    const newDir = baseDir.mul(1 - w).add(steer.mul(w)).normalize();
    return newDir.mul(speed);
  }

  protected hiveChaseBlend(): number {
    return HIVE_MIND_HARD.CHASE_BLEND;
  }

  protected hiveKiteBlend(): number {
    return HIVE_MIND_HARD.KITE_BLEND;
  }

  protected hiveWanderBlend(): number {
    return HIVE_MIND_HARD.WANDER_BLEND;
  }
}
