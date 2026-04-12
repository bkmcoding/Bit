import { Enemy } from './Enemy';
import { Vector2 } from '../../utils/Vector2';
import { ENEMY, COLORS } from '../../utils/constants';
import type { Game } from '../../engine/Game';

/** Fast, fragile chaser that swarms the player. */
export class Skitter extends Enemy {
  private legAnimation: number = 0;
  private jitterTimer: number = 0;

  constructor(position: Vector2, game: Game) {
    super(position, ENEMY.SKITTER, game);
    this.jitterTimer = Math.random() * 0.4;
  }

  protected updateBehavior(deltaTime: number): void {
    this.legAnimation += deltaTime * 22;
    this.jitterTimer -= deltaTime;

    const distToPlayer = this.getDistanceToPlayer();
    const dirToPlayer = this.getDirectionToPlayer();

    if (distToPlayer < ENEMY.SKITTER.chaseRange) {
      let dir = dirToPlayer;
      if (this.jitterTimer <= 0) {
        const jitter = (Math.random() - 0.5) * 0.35;
        dir = dir.rotate(jitter);
        this.jitterTimer = 0.12 + Math.random() * 0.1;
      }
      this.velocity = dir.normalize().mul(this.speed);
    } else {
      const tangent = new Vector2(-dirToPlayer.y, dirToPlayer.x).normalize();
      this.velocity = tangent.mul(this.speed * 0.55).add(dirToPlayer.mul(this.speed * 0.25));
    }
  }

  protected renderEnemy(ctx: CanvasRenderingContext2D): void {
    const legOffset = Math.sin(this.legAnimation) * 1.2;

    ctx.strokeStyle = COLORS.SKITTER_LEGS;
    ctx.lineWidth = 1;

    for (let i = 0; i < 3; i++) {
      const y = (i - 1) * 2.2;
      const o = i % 2 === 0 ? legOffset : -legOffset;
      ctx.beginPath();
      ctx.moveTo(-2, y);
      ctx.lineTo(-4 + o, y + 2.5);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(2, y);
      ctx.lineTo(4 - o, y + 2.5);
      ctx.stroke();
    }

    ctx.fillStyle = this.flashTimer > 0 ? '#ffffff' : COLORS.SKITTER_BODY;
    ctx.beginPath();
    ctx.ellipse(0, 0, 3.2, 2.6, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = this.flashTimer > 0 ? '#ffffff' : COLORS.SKITTER_ABDOMEN;
    ctx.beginPath();
    ctx.ellipse(0, 3, 2.8, 3.2, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = COLORS.SKITTER_EYES;
    ctx.beginPath();
    ctx.arc(-1, -1.2, 0.7, 0, Math.PI * 2);
    ctx.arc(1, -1.2, 0.7, 0, Math.PI * 2);
    ctx.fill();
  }
}
