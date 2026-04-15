import { Enemy } from './Enemy';
import { Vector2 } from '../../utils/Vector2';
import { ENEMY, COLORS, HIVE_MIND_HARD } from '../../utils/constants';
import { AudioManager } from '../../audio/AudioManager';
import type { Game } from '../../engine/Game';

type StalkerState = 'wander' | 'charging' | 'dashing' | 'recovery';

const G = ENEMY.GILL_STALKER;

/** Chapter-2 shoreline dasher — teal, slightly faster cadence than cellar dasher. */
export class GillStalker extends Enemy {
  private state: StalkerState = 'wander';
  private stateTimer: number = 0;
  private dashDirection: Vector2 = new Vector2();
  private legAnimation: number = 0;
  private chargeIndicator: number = 0;

  constructor(position: Vector2, game: Game) {
    super(position, G, game);
    this.stateTimer = Math.random() * 2 + 1;
  }

  protected updateBehavior(deltaTime: number): void {
    this.stateTimer -= deltaTime;
    this.legAnimation += deltaTime * 15;

    switch (this.state) {
      case 'wander':
        this.updateWander(deltaTime);
        break;
      case 'charging':
        this.updateCharging(deltaTime);
        break;
      case 'dashing':
        this.updateDashing(deltaTime);
        break;
      case 'recovery':
        this.updateRecovery(deltaTime);
        break;
    }
  }

  private aimDashDirection(): Vector2 {
    if (this.game.difficulty === 'hard') {
      const lead = this.game.player.velocity.mul(HIVE_MIND_HARD.DASHER_LEAD_SEC);
      const aim = this.game.player.position.add(lead).sub(this.position);
      const m = aim.magnitude();
      if (m > 0.15) return aim.div(m);
    }
    return this.getDirectionToPlayer();
  }

  private updateWander(deltaTime: number): void {
    if (this.stateTimer <= 0) {
      const distToPlayer = this.getDistanceToPlayer();
      if (distToPlayer < 100) {
        this.state = 'charging';
        this.stateTimer = G.chargeTime;
        this.chargeIndicator = 0;
        this.velocity.set(0, 0);
        return;
      }

      let v = new Vector2(Math.random() - 0.5, Math.random() - 0.5)
        .normalize()
        .mul(this.speed);
      v = this.blendVelocityWithHiveMind(v, 'wander', this.hiveWanderBlend());
      this.velocity = v;
      this.stateTimer = Math.random() * 2 + 1;
    }
  }

  private updateCharging(deltaTime: number): void {
    this.velocity.set(0, 0);
    this.chargeIndicator = 1 - this.stateTimer / G.chargeTime;
    this.dashDirection = this.aimDashDirection();
    if (this.stateTimer <= 0) {
      AudioManager.play('SFX_DASH');
      this.state = 'dashing';
      this.stateTimer = G.dashDuration;
    }
  }

  private updateDashing(deltaTime: number): void {
    this.velocity = this.dashDirection.mul(G.dashSpeed);
    if (this.stateTimer <= 0) {
      this.state = 'recovery';
      this.stateTimer = 0.5;
      this.velocity.set(0, 0);
    }
  }

  private updateRecovery(deltaTime: number): void {
    this.velocity.mulMut(0.9);
    if (this.stateTimer <= 0) {
      this.state = 'wander';
      this.stateTimer = Math.random() + 0.5;
    }
  }

  protected renderEnemy(ctx: CanvasRenderingContext2D): void {
    const legOffset = Math.sin(this.legAnimation) * 2;
    ctx.strokeStyle = '#063838';
    ctx.lineWidth = 1;
    for (let i = 0; i < 3; i++) {
      const offset = (i % 2 === 0 ? legOffset : -legOffset);
      ctx.beginPath();
      ctx.moveTo(-2, (i - 1) * 2);
      ctx.lineTo(-5 + offset, (i - 1) * 3);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(2, (i - 1) * 2);
      ctx.lineTo(5 - offset, (i - 1) * 3);
      ctx.stroke();
    }
    ctx.fillStyle = this.flashTimer > 0 ? '#ffffff' : COLORS.GILL_STALKER_BODY;
    ctx.beginPath();
    ctx.ellipse(0, 0, 3, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    if (this.state === 'charging') {
      ctx.strokeStyle = '#4ae8e8';
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.5 + this.chargeIndicator * 0.5;
      ctx.beginPath();
      ctx.arc(0, 0, 6 + this.chargeIndicator * 4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
      const indicatorEnd = this.dashDirection.mul(10 + this.chargeIndicator * 5);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(indicatorEnd.x, indicatorEnd.y);
      ctx.stroke();
    }
    if (this.state === 'dashing') {
      ctx.fillStyle = '#4ae8e8';
      ctx.globalAlpha = 0.28;
      const trailDir = this.dashDirection.mul(-6);
      ctx.beginPath();
      ctx.ellipse(trailDir.x, trailDir.y, 2, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = '#9af0ff';
    ctx.beginPath();
    ctx.arc(-1, -2, 1, 0, Math.PI * 2);
    ctx.arc(1, -2, 1, 0, Math.PI * 2);
    ctx.fill();
  }
}
