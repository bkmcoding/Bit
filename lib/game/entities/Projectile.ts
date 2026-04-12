import { Entity } from './Entity';
import { Vector2 } from '../utils/Vector2';
import { PROJECTILE, COLORS, COLLISION_LAYER, GAME } from '../utils/constants';

export interface ProjectileOptions {
  position: Vector2;
  direction: Vector2;
  isPlayerProjectile: boolean;
  damage?: number;
  speed?: number;
  piercing?: number;
  /** Hitbox / render diameter in pixels (default `PROJECTILE.SIZE`). */
  size?: number;
}

export class Projectile extends Entity {
  public damage: number;
  public isPlayerProjectile: boolean;
  public piercing: number;
  
  private lifetime: number;
  private hitEntities: Set<string> = new Set();

  constructor(options: ProjectileOptions) {
    const isPlayer = options.isPlayerProjectile;
    
    super({
      position: options.position,
      size: options.size ?? PROJECTILE.SIZE,
      collisionLayer: isPlayer ? COLLISION_LAYER.PLAYER_PROJECTILE : COLLISION_LAYER.ENEMY_PROJECTILE,
      collisionMask: isPlayer 
        ? COLLISION_LAYER.ENEMY | COLLISION_LAYER.WALL
        : COLLISION_LAYER.PLAYER | COLLISION_LAYER.WALL,
    });
    
    this.isPlayerProjectile = isPlayer;
    this.damage = options.damage ?? 1;
    this.piercing = options.piercing ?? 0;
    this.lifetime = PROJECTILE.LIFETIME;
    
    const speed = options.speed ?? (isPlayer ? PROJECTILE.PLAYER_SPEED : PROJECTILE.ENEMY_SPEED);
    this.velocity = options.direction.normalize().mul(speed);
  }

  update(deltaTime: number): void {
    // Move
    this.position.addMut(this.velocity.mul(deltaTime));
    
    // Lifetime
    this.lifetime -= deltaTime;
    if (this.lifetime <= 0) {
      this.destroy();
      return;
    }
    
    // Check bounds
    if (
      this.position.x < 0 ||
      this.position.x > GAME.NATIVE_WIDTH ||
      this.position.y < 0 ||
      this.position.y > GAME.NATIVE_HEIGHT
    ) {
      this.destroy();
    }
  }

  // Check if this projectile has already hit an entity
  hasHit(entityId: string): boolean {
    return this.hitEntities.has(entityId);
  }

  // Register a hit on an entity
  registerHit(entityId: string): void {
    this.hitEntities.add(entityId);
    
    // Reduce piercing count
    if (this.piercing > 0) {
      this.piercing--;
    } else {
      this.destroy();
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    const x = Math.round(this.position.x);
    const y = Math.round(this.position.y);
    
    ctx.fillStyle = this.isPlayerProjectile ? COLORS.PLAYER_BULLET : COLORS.ENEMY_BULLET;
    
    // Draw as a small circle
    ctx.beginPath();
    ctx.arc(x, y, this.size / 2, 0, Math.PI * 2);
    ctx.fill();
    
    // Glow effect
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.arc(x, y, this.size / 2 + 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}
