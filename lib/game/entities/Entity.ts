import { Vector2 } from '../utils/Vector2';
import { COLLISION_LAYER } from '../utils/constants';

export interface EntityOptions {
  position?: Vector2;
  size?: number;
  collisionLayer?: number;
  collisionMask?: number;
}

export abstract class Entity {
  public id: string;
  public position: Vector2;
  public velocity: Vector2;
  public size: number;
  public collisionLayer: number;
  public collisionMask: number;
  public isActive: boolean = true;
  public markedForDeletion: boolean = false;

  constructor(options: EntityOptions = {}) {
    this.id = Math.random().toString(36).substring(2, 9);
    this.position = options.position?.clone() ?? new Vector2();
    this.velocity = new Vector2();
    this.size = options.size ?? 8;
    this.collisionLayer = options.collisionLayer ?? COLLISION_LAYER.NONE;
    this.collisionMask = options.collisionMask ?? COLLISION_LAYER.NONE;
  }

  abstract update(deltaTime: number): void;
  abstract render(ctx: CanvasRenderingContext2D): void;

  // AABB bounds for collision detection
  getBounds(): { x: number; y: number; width: number; height: number } {
    const halfSize = this.size / 2;
    return {
      x: this.position.x - halfSize,
      y: this.position.y - halfSize,
      width: this.size,
      height: this.size,
    };
  }

  // Check if this entity overlaps with another
  overlaps(other: Entity): boolean {
    const a = this.getBounds();
    const b = other.getBounds();
    
    return (
      a.x < b.x + b.width &&
      a.x + a.width > b.x &&
      a.y < b.y + b.height &&
      a.y + a.height > b.y
    );
  }

  // Check if this entity should collide with another based on layers
  canCollideWith(other: Entity): boolean {
    return (this.collisionMask & other.collisionLayer) !== 0;
  }

  // Called when collision occurs
  onCollision(other: Entity): void {
    // Override in subclasses
  }

  // Mark entity for removal
  destroy(): void {
    this.markedForDeletion = true;
    this.isActive = false;
  }

  // Get center position
  getCenter(): Vector2 {
    return this.position.clone();
  }

  // Distance to another entity
  distanceTo(other: Entity): number {
    return this.position.distanceTo(other.position);
  }

  // Direction to another entity
  directionTo(other: Entity): Vector2 {
    return other.position.sub(this.position).normalize();
  }
}
