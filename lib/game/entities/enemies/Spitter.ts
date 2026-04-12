import { Enemy } from './Enemy';
import { Projectile } from '../Projectile';
import { Vector2 } from '../../utils/Vector2';
import { ENEMY, COLORS } from '../../utils/constants';
import type { Game } from '../../engine/Game';

export class Spitter extends Enemy {
  private fireCooldown: number;
  private legAnimation: number = 0;

  constructor(position: Vector2, game: Game) {
    super(position, ENEMY.SPITTER, game);
    this.fireCooldown = Math.random() * ENEMY.SPITTER.fireRate;
  }

  protected updateBehavior(deltaTime: number): void {
    const distToPlayer = this.getDistanceToPlayer();
    const dirToPlayer = this.getDirectionToPlayer();
    
    // Animate legs
    this.legAnimation += deltaTime * 8;
    
    // Try to maintain preferred distance from player
    const preferredDist = ENEMY.SPITTER.preferredDistance;
    
    if (distToPlayer < preferredDist - 10) {
      // Too close, back away
      this.velocity = dirToPlayer.mul(-this.speed);
    } else if (distToPlayer > preferredDist + 10 && distToPlayer < ENEMY.SPITTER.range * 1.5) {
      // Too far but in range, approach
      this.velocity = dirToPlayer.mul(this.speed);
    } else {
      // In sweet spot, slow down
      this.velocity.mulMut(0.9);
    }
    
    // Shooting
    this.fireCooldown -= deltaTime;
    if (this.fireCooldown <= 0 && distToPlayer < ENEMY.SPITTER.range) {
      this.shoot();
      this.fireCooldown = ENEMY.SPITTER.fireRate;
    }

    this.velocity = this.blendVelocityWithHiveMind(
      this.velocity,
      'kite',
      this.hiveKiteBlend(),
      ENEMY.SPITTER.preferredDistance
    );
  }

  private shoot(): void {
    const dirToPlayer = this.getDirectionToPlayer();
    
    const projectile = new Projectile({
      position: this.position.clone(),
      direction: dirToPlayer,
      isPlayerProjectile: false,
      damage: this.damage,
    });
    
    this.game.spawnProjectile(projectile);
  }

  protected renderEnemy(ctx: CanvasRenderingContext2D): void {
    const legOffset = Math.sin(this.legAnimation) * 1;
    
    // Draw legs (8 total)
    ctx.strokeStyle = '#1a3d07';
    ctx.lineWidth = 1;
    
    // Left legs
    for (let i = 0; i < 4; i++) {
      const offset = (i % 2 === 0 ? legOffset : -legOffset);
      ctx.beginPath();
      ctx.moveTo(-3, (i - 1.5) * 2.5);
      ctx.lineTo(-7 + offset, (i - 1.5) * 4);
      ctx.stroke();
    }
    
    // Right legs
    for (let i = 0; i < 4; i++) {
      const offset = (i % 2 === 0 ? -legOffset : legOffset);
      ctx.beginPath();
      ctx.moveTo(3, (i - 1.5) * 2.5);
      ctx.lineTo(7 + offset, (i - 1.5) * 4);
      ctx.stroke();
    }
    
    // Body (greenish)
    ctx.fillStyle = this.flashTimer > 0 ? '#ffffff' : COLORS.SPITTER_BODY;
    ctx.beginPath();
    ctx.ellipse(0, 0, 5, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Abdomen (larger, holds the acid)
    ctx.fillStyle = this.flashTimer > 0 ? '#ffffff' : '#4a7a1a';
    ctx.beginPath();
    ctx.ellipse(0, 5, 4, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Acid glow on abdomen
    ctx.fillStyle = COLORS.ENEMY_BULLET;
    ctx.globalAlpha = 0.3;
    ctx.beginPath();
    ctx.ellipse(0, 5, 3, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    
    // Eyes
    ctx.fillStyle = '#ffff00';
    ctx.beginPath();
    ctx.arc(-2, -2, 1.5, 0, Math.PI * 2);
    ctx.arc(2, -2, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }
}
