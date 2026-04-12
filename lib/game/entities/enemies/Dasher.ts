import { Enemy } from './Enemy';
import { Vector2 } from '../../utils/Vector2';
import { ENEMY, COLORS, HIVE_MIND_HARD } from '../../utils/constants';
import { AudioManager } from '../../audio/AudioManager';
import type { Game } from '../../engine/Game';

type DasherState = 'wander' | 'charging' | 'dashing' | 'recovery';

export class Dasher extends Enemy {
  private state: DasherState = 'wander';
  private stateTimer: number = 0;
  private dashDirection: Vector2 = new Vector2();
  private legAnimation: number = 0;
  private chargeIndicator: number = 0;

  constructor(position: Vector2, game: Game) {
    super(position, ENEMY.DASHER, game);
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
    // Random movement
    if (this.stateTimer <= 0) {
      // Check if player is close enough to start charging
      const distToPlayer = this.getDistanceToPlayer();
      if (distToPlayer < 100) {
        this.state = 'charging';
        this.stateTimer = ENEMY.DASHER.chargeTime;
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
    // Stop and charge up
    this.velocity.set(0, 0);
    this.chargeIndicator = 1 - (this.stateTimer / ENEMY.DASHER.chargeTime);
    
    this.dashDirection = this.aimDashDirection();
    
    if (this.stateTimer <= 0) {
      AudioManager.play('SFX_DASH');
      this.state = 'dashing';
      this.stateTimer = ENEMY.DASHER.dashDuration;
    }
  }

  private updateDashing(deltaTime: number): void {
    // Fast dash in locked direction
    this.velocity = this.dashDirection.mul(ENEMY.DASHER.dashSpeed);
    
    if (this.stateTimer <= 0) {
      this.state = 'recovery';
      this.stateTimer = 0.5;
      this.velocity.set(0, 0);
    }
  }

  private updateRecovery(deltaTime: number): void {
    // Brief pause after dash
    this.velocity.mulMut(0.9);
    
    if (this.stateTimer <= 0) {
      this.state = 'wander';
      this.stateTimer = Math.random() + 0.5;
    }
  }

  protected renderEnemy(ctx: CanvasRenderingContext2D): void {
    const legOffset = Math.sin(this.legAnimation) * 2;
    
    // Draw legs (6 legs for variety)
    ctx.strokeStyle = '#2d082d';
    ctx.lineWidth = 1;
    
    for (let i = 0; i < 3; i++) {
      const offset = (i % 2 === 0 ? legOffset : -legOffset);
      // Left
      ctx.beginPath();
      ctx.moveTo(-2, (i - 1) * 2);
      ctx.lineTo(-5 + offset, (i - 1) * 3);
      ctx.stroke();
      // Right
      ctx.beginPath();
      ctx.moveTo(2, (i - 1) * 2);
      ctx.lineTo(5 - offset, (i - 1) * 3);
      ctx.stroke();
    }
    
    // Body
    ctx.fillStyle = this.flashTimer > 0 ? '#ffffff' : COLORS.DASHER_BODY;
    ctx.beginPath();
    ctx.ellipse(0, 0, 3, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Charge indicator (grows when charging)
    if (this.state === 'charging') {
      ctx.strokeStyle = '#ff00ff';
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.5 + this.chargeIndicator * 0.5;
      ctx.beginPath();
      ctx.arc(0, 0, 6 + this.chargeIndicator * 4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
      
      // Draw dash direction indicator
      const indicatorEnd = this.dashDirection.mul(10 + this.chargeIndicator * 5);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(indicatorEnd.x, indicatorEnd.y);
      ctx.stroke();
    }
    
    // Dashing effect - stretched body
    if (this.state === 'dashing') {
      ctx.fillStyle = '#ff00ff';
      ctx.globalAlpha = 0.3;
      // Trail effect
      const trailDir = this.dashDirection.mul(-6);
      ctx.beginPath();
      ctx.ellipse(trailDir.x, trailDir.y, 2, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    
    // Eyes
    ctx.fillStyle = '#ff00ff';
    ctx.beginPath();
    ctx.arc(-1, -2, 1, 0, Math.PI * 2);
    ctx.arc(1, -2, 1, 0, Math.PI * 2);
    ctx.fill();
  }
}
