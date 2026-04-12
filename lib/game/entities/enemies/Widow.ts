import { Enemy } from './Enemy';
import { Projectile } from '../Projectile';
import { Vector2 } from '../../utils/Vector2';
import { ENEMY, COLORS } from '../../utils/constants';
import type { Game } from '../../engine/Game';

/** Kites at range and fires short bursts of venom shots. */
export class Widow extends Enemy {
  private legAnimation: number = 0;
  /** Countdown before a new burst can begin (only used when not mid-burst). */
  private betweenBurstTimer: number;
  private shotsRemaining: number = 0;
  private timeToNextShotInBurst: number = 0;

  constructor(position: Vector2, game: Game) {
    super(position, ENEMY.WIDOW, game);
    this.betweenBurstTimer = Math.random() * ENEMY.WIDOW.burstCooldown;
  }

  protected updateBehavior(deltaTime: number): void {
    this.legAnimation += deltaTime * 7;
    const distToPlayer = this.getDistanceToPlayer();
    const dirToPlayer = this.getDirectionToPlayer();
    const preferred = ENEMY.WIDOW.preferredDistance;

    if (distToPlayer < preferred - 12) {
      this.velocity = dirToPlayer.mul(-this.speed);
    } else if (distToPlayer > preferred + 18 && distToPlayer < ENEMY.WIDOW.range * 1.35) {
      this.velocity = dirToPlayer.mul(this.speed * 0.85);
    } else {
      this.velocity.mulMut(0.88);
    }

    if (this.shotsRemaining > 0) {
      this.timeToNextShotInBurst -= deltaTime;
      if (this.timeToNextShotInBurst <= 0) {
        this.fireShot();
        this.shotsRemaining -= 1;
        if (this.shotsRemaining > 0) {
          this.timeToNextShotInBurst = ENEMY.WIDOW.burstSpacing;
        } else {
          this.betweenBurstTimer = ENEMY.WIDOW.burstCooldown;
        }
      }
    } else {
      this.betweenBurstTimer -= deltaTime;
      if (this.betweenBurstTimer <= 0 && distToPlayer < ENEMY.WIDOW.range) {
        this.shotsRemaining = ENEMY.WIDOW.burstCount;
        this.timeToNextShotInBurst = 0;
      }
    }
  }

  private fireShot(): void {
    const spread = (Math.random() - 0.5) * 0.12;
    const dir = this.getDirectionToPlayer().rotate(spread);
    const projectile = new Projectile({
      position: this.position.clone(),
      direction: dir,
      isPlayerProjectile: false,
      damage: this.damage,
      speed: ENEMY.WIDOW.projectileSpeed,
    });
    this.game.spawnProjectile(projectile);
  }

  protected renderEnemy(ctx: CanvasRenderingContext2D): void {
    const legOffset = Math.sin(this.legAnimation) * 1;

    ctx.strokeStyle = COLORS.WIDOW_LEGS;
    ctx.lineWidth = 1;

    for (let i = 0; i < 4; i++) {
      const y = (i - 1.5) * 2.4;
      const o = i % 2 === 0 ? legOffset : -legOffset;
      ctx.beginPath();
      ctx.moveTo(-3, y);
      ctx.lineTo(-7 + o, y + 3.5);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(3, y);
      ctx.lineTo(7 - o, y + 3.5);
      ctx.stroke();
    }

    ctx.fillStyle = this.flashTimer > 0 ? '#ffffff' : COLORS.WIDOW_BODY;
    ctx.beginPath();
    ctx.ellipse(0, 0, 5, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = this.flashTimer > 0 ? '#ffffff' : COLORS.WIDOW_ABDOMEN;
    ctx.beginPath();
    ctx.ellipse(0, 5.5, 5, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#6600aa';
    ctx.lineWidth = 0.5;
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    ctx.moveTo(-2, 3);
    ctx.lineTo(0, 6);
    ctx.lineTo(2, 3);
    ctx.stroke();
    ctx.globalAlpha = 1;

    ctx.fillStyle = COLORS.WIDOW_EYES;
    ctx.beginPath();
    ctx.arc(-2, -2, 1.2, 0, Math.PI * 2);
    ctx.arc(2, -2, 1.2, 0, Math.PI * 2);
    ctx.fill();
  }
}
