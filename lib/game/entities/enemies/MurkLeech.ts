import { Enemy } from './Enemy';
import { Vector2 } from '../../utils/Vector2';
import { ENEMY, COLORS, HIVE_MIND_HARD } from '../../utils/constants';
import type { Game } from '../../engine/Game';

const M = ENEMY.MURK_LEECH;

/** Fast glassy chaser for flooded sectors. */
export class MurkLeech extends Enemy {
  private legAnimation: number = 0;
  private jitterTimer: number = 0;

  constructor(position: Vector2, game: Game) {
    super(position, M, game);
    this.jitterTimer = Math.random() * 0.4;
  }

  protected updateBehavior(deltaTime: number): void {
    this.legAnimation += deltaTime * 22;
    this.jitterTimer -= deltaTime;

    const distToPlayer = this.getDistanceToPlayer();
    const dirToPlayer = this.getDirectionToPlayer();

    if (distToPlayer < M.chaseRange) {
      let dir = dirToPlayer;
      const jitterMax =
        this.game.difficulty === 'hard' ? HIVE_MIND_HARD.SKITTER_JITTER : 0.35;
      if (this.jitterTimer <= 0) {
        const jitter = (Math.random() - 0.5) * jitterMax;
        dir = dir.rotate(jitter);
        this.jitterTimer = 0.12 + Math.random() * 0.1;
      }
      let v = dir.normalize().mul(this.speed);
      v = this.blendVelocityWithHiveMind(v, 'chase', this.hiveChaseBlend());
      this.velocity = v;
    } else {
      const tangent = new Vector2(-dirToPlayer.y, dirToPlayer.x).normalize();
      let v = tangent.mul(this.speed * 0.55).add(dirToPlayer.mul(this.speed * 0.25));
      v = this.blendVelocityWithHiveMind(v, 'wander', this.hiveWanderBlend() * 0.82);
      this.velocity = v;
    }
  }

  protected renderEnemy(ctx: CanvasRenderingContext2D): void {
    const legOffset = Math.sin(this.legAnimation) * 1.2;
    ctx.strokeStyle = '#1a4030';
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
    ctx.fillStyle = this.flashTimer > 0 ? '#ffffff' : COLORS.MURK_LEECH_BODY;
    ctx.beginPath();
    ctx.ellipse(0, 0, 3.2, 2.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = this.flashTimer > 0 ? '#ffffff' : '#3d7a62';
    ctx.beginPath();
    ctx.ellipse(0, 3, 2.6, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLORS.MURK_LEECH_EYES;
    ctx.beginPath();
    ctx.arc(-1, -1.2, 0.7, 0, Math.PI * 2);
    ctx.arc(1, -1.2, 0.7, 0, Math.PI * 2);
    ctx.fill();
  }
}
