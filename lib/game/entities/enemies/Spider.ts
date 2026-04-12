import { Enemy } from './Enemy';
import { Vector2 } from '../../utils/Vector2';
import { ENEMY, COLORS } from '../../utils/constants';
import type { Game } from '../../engine/Game';

export class Spider extends Enemy {
  private wanderDirection: Vector2;
  private wanderTimer: number;
  private legAnimation: number = 0;

  constructor(position: Vector2, game: Game) {
    super(position, ENEMY.SPIDER, game);
    
    this.wanderDirection = new Vector2(Math.random() - 0.5, Math.random() - 0.5).normalize();
    this.wanderTimer = Math.random() * 2 + 1;
  }

  protected updateBehavior(deltaTime: number): void {
    const distToPlayer = this.getDistanceToPlayer();
    
    // Animate legs
    this.legAnimation += deltaTime * 10;
    
    if (distToPlayer < ENEMY.SPIDER.chaseRange) {
      // Chase player
      const dirToPlayer = this.getDirectionToPlayer();
      this.velocity = dirToPlayer.mul(this.speed);
    } else {
      // Wander
      this.wanderTimer -= deltaTime;
      if (this.wanderTimer <= 0) {
        this.wanderDirection = new Vector2(Math.random() - 0.5, Math.random() - 0.5).normalize();
        this.wanderTimer = Math.random() * 2 + 1;
      }
      this.velocity = this.wanderDirection.mul(this.speed * 0.5);
    }
  }

  protected renderEnemy(ctx: CanvasRenderingContext2D): void {
    const legOffset = Math.sin(this.legAnimation) * 1.5;
    
    // Draw legs (8 total, 4 on each side)
    ctx.strokeStyle = COLORS.SPIDER_LEGS;
    ctx.lineWidth = 1;
    
    // Left legs
    for (let i = 0; i < 4; i++) {
      const angle = -Math.PI / 2 - (i - 1.5) * 0.3;
      const offset = (i % 2 === 0 ? legOffset : -legOffset);
      ctx.beginPath();
      ctx.moveTo(-2, (i - 1.5) * 2);
      ctx.lineTo(-5 + offset, (i - 1.5) * 3);
      ctx.stroke();
    }
    
    // Right legs
    for (let i = 0; i < 4; i++) {
      const offset = (i % 2 === 0 ? -legOffset : legOffset);
      ctx.beginPath();
      ctx.moveTo(2, (i - 1.5) * 2);
      ctx.lineTo(5 + offset, (i - 1.5) * 3);
      ctx.stroke();
    }
    
    // Body
    ctx.fillStyle = this.flashTimer > 0 ? '#ffffff' : COLORS.SPIDER_BODY;
    ctx.beginPath();
    ctx.ellipse(0, 0, 4, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Abdomen
    ctx.beginPath();
    ctx.ellipse(0, 4, 3, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Eyes
    ctx.fillStyle = COLORS.SPIDER_EYES;
    ctx.beginPath();
    ctx.arc(-1.5, -2, 1, 0, Math.PI * 2);
    ctx.arc(1.5, -2, 1, 0, Math.PI * 2);
    ctx.fill();
  }
}
