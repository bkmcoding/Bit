import { Enemy } from './Enemy';
import { Vector2 } from '../../utils/Vector2';
import { ENEMY, COLORS } from '../../utils/constants';
import type { Game } from '../../engine/Game';

export class TideCrawler extends Enemy {
  private wanderDirection: Vector2;
  private wanderTimer: number;
  private legAnimation: number = 0;
  private surgeCooldown: number = ENEMY.TIDECRAWLER.surgeCooldown;
  private surgeTimer: number = 0;
  private surgeDirection: Vector2 = new Vector2(1, 0);

  constructor(position: Vector2, game: Game) {
    super(position, ENEMY.TIDECRAWLER, game);
    this.wanderDirection = new Vector2(Math.random() - 0.5, Math.random() - 0.5).normalize();
    this.wanderTimer = Math.random() * 1.6 + 0.8;
    this.surgeCooldown = Math.random() * ENEMY.TIDECRAWLER.surgeCooldown;
  }

  protected updateBehavior(deltaTime: number): void {
    this.legAnimation += deltaTime * 12;
    this.surgeCooldown -= deltaTime;

    if (this.surgeTimer > 0) {
      this.surgeTimer -= deltaTime;
      this.velocity = this.surgeDirection.mul(ENEMY.TIDECRAWLER.burstSpeed);
      return;
    }

    const distToPlayer = this.getDistanceToPlayer();
    if (distToPlayer < ENEMY.TIDECRAWLER.chaseRange) {
      const toPlayer = this.getDirectionToPlayer();
      this.velocity = this.blendVelocityWithHiveMind(
        toPlayer.mul(this.speed),
        'chase',
        this.hiveChaseBlend()
      );
      if (this.surgeCooldown <= 0 && distToPlayer > 26) {
        this.surgeDirection = toPlayer;
        this.surgeTimer = ENEMY.TIDECRAWLER.surgeDuration;
        this.surgeCooldown = ENEMY.TIDECRAWLER.surgeCooldown;
      }
      return;
    }

    this.wanderTimer -= deltaTime;
    if (this.wanderTimer <= 0) {
      this.wanderDirection = new Vector2(Math.random() - 0.5, Math.random() - 0.5).normalize();
      this.wanderTimer = Math.random() * 1.7 + 0.9;
    }
    this.velocity = this.blendVelocityWithHiveMind(
      this.wanderDirection.mul(this.speed * 0.72),
      'wander',
      this.hiveWanderBlend()
    );
  }

  protected renderEnemy(ctx: CanvasRenderingContext2D): void {
    const legOffset = Math.sin(this.legAnimation) * 1.5;
    ctx.strokeStyle = '#143743';
    ctx.lineWidth = 1;

    for (let i = 0; i < 4; i++) {
      const l = i % 2 === 0 ? legOffset : -legOffset;
      ctx.beginPath();
      ctx.moveTo(-2, (i - 1.5) * 2);
      ctx.lineTo(-6 + l, (i - 1.5) * 3.4);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(2, (i - 1.5) * 2);
      ctx.lineTo(6 - l, (i - 1.5) * 3.4);
      ctx.stroke();
    }

    ctx.fillStyle = this.flashTimer > 0 ? '#ffffff' : COLORS.TIDECRAWLER_BODY;
    ctx.beginPath();
    ctx.ellipse(0, 0, 4, 3, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = this.flashTimer > 0 ? '#ffffff' : COLORS.TIDECRAWLER_ABDOMEN;
    ctx.beginPath();
    ctx.ellipse(0, 4, 3.5, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = COLORS.TIDECRAWLER_EYES;
    ctx.beginPath();
    ctx.arc(-1.4, -2, 0.9, 0, Math.PI * 2);
    ctx.arc(1.4, -2, 0.9, 0, Math.PI * 2);
    ctx.fill();
  }
}
