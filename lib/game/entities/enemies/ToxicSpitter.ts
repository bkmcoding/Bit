import { Enemy } from './Enemy';
import { Projectile } from '../Projectile';
import { Vector2 } from '../../utils/Vector2';
import { ENEMY, COLORS } from '../../utils/constants';
import { AudioManager } from '../../audio/AudioManager';
import type { Game } from '../../engine/Game';

export class ToxicSpitter extends Enemy {
  private fireCooldown: number;
  private legAnimation: number = 0;

  constructor(position: Vector2, game: Game) {
    super(position, ENEMY.TOXIC_SPITTER, game);
    this.fireCooldown = Math.random() * ENEMY.TOXIC_SPITTER.fireRate;
  }

  protected updateBehavior(deltaTime: number): void {
    const distToPlayer = this.getDistanceToPlayer();
    const dirToPlayer = this.getDirectionToPlayer();
    const preferredDist = ENEMY.TOXIC_SPITTER.preferredDistance;

    this.legAnimation += deltaTime * 9;

    if (distToPlayer < preferredDist - 12) {
      this.velocity = dirToPlayer.mul(-this.speed);
    } else if (
      distToPlayer > preferredDist + 10 &&
      distToPlayer < ENEMY.TOXIC_SPITTER.range * 1.6
    ) {
      this.velocity = dirToPlayer.mul(this.speed);
    } else {
      this.velocity.mulMut(0.88);
    }

    this.fireCooldown -= deltaTime;
    if (this.fireCooldown <= 0 && distToPlayer < ENEMY.TOXIC_SPITTER.range) {
      this.shootBurst();
      this.fireCooldown = ENEMY.TOXIC_SPITTER.fireRate;
    }

    this.velocity = this.blendVelocityWithHiveMind(
      this.velocity,
      'kite',
      this.hiveKiteBlend(),
      ENEMY.TOXIC_SPITTER.preferredDistance
    );
  }

  private shootBurst(): void {
    const base = this.getDirectionToPlayer();
    AudioManager.play('SFX_ENEMY_SPIT', 0.44);
    const spread = 0.2;
    const dirs = [
      base,
      base.rotate(spread).normalize(),
      base.rotate(-spread).normalize(),
    ];
    for (const dir of dirs) {
      this.game.spawnProjectile(
        new Projectile({
          position: this.position.clone(),
          direction: dir,
          isPlayerProjectile: false,
          damage: this.damage,
          speed: 88,
          playerHitKind: 'acid',
        })
      );
    }
  }

  protected renderEnemy(ctx: CanvasRenderingContext2D): void {
    const legOffset = Math.sin(this.legAnimation) * 1.2;
    ctx.strokeStyle = '#22451d';
    ctx.lineWidth = 1;

    for (let i = 0; i < 4; i++) {
      const l = i % 2 === 0 ? legOffset : -legOffset;
      ctx.beginPath();
      ctx.moveTo(-3, (i - 1.5) * 2.5);
      ctx.lineTo(-7 + l, (i - 1.5) * 4.2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(3, (i - 1.5) * 2.5);
      ctx.lineTo(7 - l, (i - 1.5) * 4.2);
      ctx.stroke();
    }

    ctx.fillStyle = this.flashTimer > 0 ? '#ffffff' : COLORS.TOXIC_SPITTER_BODY;
    ctx.beginPath();
    ctx.ellipse(0, 0, 5, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = this.flashTimer > 0 ? '#ffffff' : COLORS.TOXIC_SPITTER_GLAND;
    ctx.beginPath();
    ctx.ellipse(0, 5, 4.5, 5.2, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(170,255,130,0.35)';
    ctx.beginPath();
    ctx.ellipse(0, 5, 3, 4, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}
