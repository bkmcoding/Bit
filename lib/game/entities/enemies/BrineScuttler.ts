import { Enemy } from './Enemy';
import { Vector2 } from '../../utils/Vector2';
import { ENEMY, COLORS, HIVE_MIND_HARD } from '../../utils/constants';
import type { Game } from '../../engine/Game';

/** Shoreline crab — sidesteps and surges in short bursts. */
export class BrineScuttler extends Enemy {
  private legAnim = 0;
  private surgeCd: number;
  private surgeT = 0;
  private strafeSign: 1 | -1 = Math.random() < 0.5 ? 1 : -1;

  constructor(position: Vector2, game: Game) {
    super(position, ENEMY.BRINE_SCUTTLER, game);
    this.surgeCd = Math.random() * ENEMY.BRINE_SCUTTLER.surgeCooldown;
  }

  protected updateBehavior(deltaTime: number): void {
    this.legAnim += deltaTime * 18;
    const dist = this.getDistanceToPlayer();
    const toP = this.getDirectionToPlayer();
    const tangent = new Vector2(-toP.y, toP.x).mul(this.strafeSign);

    if (this.surgeT > 0) {
      this.surgeT -= deltaTime;
      this.velocity = toP.mul(ENEMY.BRINE_SCUTTLER.burstSpeed);
      return;
    }

    this.surgeCd -= deltaTime;
    if (
      this.surgeCd <= 0 &&
      dist < ENEMY.BRINE_SCUTTLER.chaseRange &&
      dist > 28
    ) {
      this.surgeT = ENEMY.BRINE_SCUTTLER.surgeDuration;
      this.surgeCd =
        ENEMY.BRINE_SCUTTLER.surgeCooldown * (0.85 + Math.random() * 0.35);
      return;
    }

    if (dist < ENEMY.BRINE_SCUTTLER.chaseRange) {
      const jitter =
        this.game.difficulty === 'hard' ? HIVE_MIND_HARD.SKITTER_JITTER * 0.9 : 0.28;
      const j = (Math.random() - 0.5) * jitter;
      const blend = toP.mul(0.42).add(tangent.mul(0.58)).rotate(j).normalize();
      this.velocity = this.blendVelocityWithHiveMind(
        blend.mul(this.speed),
        'chase',
        this.hiveChaseBlend()
      );
    } else {
      this.velocity = this.blendVelocityWithHiveMind(
        toP.mul(this.speed * 0.55),
        'wander',
        this.hiveWanderBlend()
      );
    }

    if (Math.random() < 0.012 * deltaTime * 60) this.strafeSign *= -1;
  }

  protected renderEnemy(ctx: CanvasRenderingContext2D): void {
    const lo = Math.sin(this.legAnim) * 1.1;
    ctx.strokeStyle = COLORS.BRINE_SCUTTLER_LEGS;
    ctx.lineWidth = 1;
    for (let i = 0; i < 4; i++) {
      const y = (i - 1.5) * 2.4;
      const o = i % 2 === 0 ? lo : -lo;
      ctx.beginPath();
      ctx.moveTo(-3, y);
      ctx.lineTo(-6 + o, y + 3);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(3, y);
      ctx.lineTo(6 - o, y + 3);
      ctx.stroke();
    }

    ctx.fillStyle = this.flashTimer > 0 ? '#ffffff' : COLORS.BRINE_SCUTTLER_SHELL;
    ctx.beginPath();
    ctx.ellipse(0, 1, 4.5, 3.8, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = COLORS.BRINE_SCUTTLER_CARAPACE;
    ctx.beginPath();
    ctx.ellipse(-1, 0, 2.2, 2, -0.2, 0, Math.PI * 2);
    ctx.ellipse(2, 0.5, 2, 1.8, 0.15, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = COLORS.BRINE_SCUTTLER_EYE;
    ctx.beginPath();
    ctx.arc(2.4, -1.2, 0.65, 0, Math.PI * 2);
    ctx.fill();
  }
}
