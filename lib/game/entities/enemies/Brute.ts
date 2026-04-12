import { Enemy } from './Enemy';
import { Vector2 } from '../../utils/Vector2';
import { ENEMY, COLORS } from '../../utils/constants';
import type { Game } from '../../engine/Game';

/** Slow tank that soaks damage and tries to corner the player. */
export class Brute extends Enemy {
  private legAnimation: number = 0;
  private wanderDirection: Vector2;
  private wanderTimer: number;

  constructor(position: Vector2, game: Game) {
    super(position, ENEMY.BRUTE, game);
    this.wanderDirection = new Vector2(Math.random() - 0.5, Math.random() - 0.5).normalize();
    this.wanderTimer = Math.random() * 2 + 1;
  }

  protected updateBehavior(deltaTime: number): void {
    this.legAnimation += deltaTime * 6;
    const distToPlayer = this.getDistanceToPlayer();

    if (distToPlayer < ENEMY.BRUTE.chaseRange) {
      const dirToPlayer = this.getDirectionToPlayer();
      let v = dirToPlayer.mul(this.speed);
      v = this.blendVelocityWithHiveMind(v, 'chase', this.hiveChaseBlend());
      this.velocity = v;
    } else {
      this.wanderTimer -= deltaTime;
      if (this.wanderTimer <= 0) {
        this.wanderDirection = new Vector2(Math.random() - 0.5, Math.random() - 0.5).normalize();
        this.wanderTimer = Math.random() * 2.5 + 1.2;
      }
      let v = this.wanderDirection.mul(this.speed * 0.45);
      v = this.blendVelocityWithHiveMind(v, 'wander', this.hiveWanderBlend());
      this.velocity = v;
    }
  }

  protected renderEnemy(ctx: CanvasRenderingContext2D): void {
    const legOffset = Math.sin(this.legAnimation) * 2;

    ctx.strokeStyle = COLORS.BRUTE_LEGS;
    ctx.lineWidth = 2;

    for (let i = 0; i < 4; i++) {
      const y = (i - 1.5) * 4;
      const offset = i % 2 === 0 ? legOffset : -legOffset;
      ctx.beginPath();
      ctx.moveTo(-5, y);
      ctx.lineTo(-11 + offset, y + 5);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(5, y);
      ctx.lineTo(11 - offset, y + 5);
      ctx.stroke();
    }

    ctx.fillStyle = this.flashTimer > 0 ? '#ffffff' : COLORS.BRUTE_BODY;
    ctx.beginPath();
    ctx.ellipse(0, -1, 7, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = this.flashTimer > 0 ? '#ffffff' : COLORS.BRUTE_SHELL;
    ctx.beginPath();
    ctx.ellipse(0, 7, 8, 9, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#2a1810';
    ctx.beginPath();
    ctx.arc(-2.5, -4, 1.5, 0, Math.PI * 2);
    ctx.arc(2.5, -4, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }
}
