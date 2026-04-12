import { Enemy } from './Enemy';
import { Spider } from './Spider';
import { Projectile } from '../Projectile';
import { Vector2 } from '../../utils/Vector2';
import { ENEMY, COLORS, GAME } from '../../utils/constants';
import { resolveCircleObstacles } from '../../utils/obstacleCollision';
import { AudioManager } from '../../audio/AudioManager';
import type { Game } from '../../engine/Game';

type BossPhase = 'idle' | 'spawning' | 'shooting' | 'charging';

/** Health fraction at which Broodmother enrages (second life stage). */
const STAGE2_THRESHOLD = 0.5;

export class Broodmother extends Enemy {
  private phase: BossPhase = 'idle';
  private phaseTimer: number = 2;
  private spawnCooldown: number = 0;
  private shootCooldown: number = 0;
  private legAnimation: number = 0;
  private spawnedChildren: number = 0;
  private prevLifeStage: 1 | 2 = 1;
  private enragePulse: number = 0;

  constructor(position: Vector2, game: Game) {
    super(position, ENEMY.BROODMOTHER, game);
    AudioManager.play('SFX_BOSS_ROAR');
  }

  private getLifeStage(): 1 | 2 {
    return this.health <= this.maxHealth * STAGE2_THRESHOLD ? 2 : 1;
  }

  private broodCap(): number {
    return this.getLifeStage() === 2 ? 8 : 5;
  }

  private spawnInterval(): number {
    return this.getLifeStage() === 2 ? 0.36 : 0.72;
  }

  private shootInterval(): number {
    return this.getLifeStage() === 2 ? 0.24 : 0.52;
  }

  private spreadCount(): number {
    return this.getLifeStage() === 2 ? 7 : 5;
  }

  private spreadArc(): number {
    return this.getLifeStage() === 2 ? Math.PI * 0.45 : Math.PI / 3;
  }

  private projSpeed(): number {
    return this.getLifeStage() === 2 ? 86 : 70;
  }

  private chargeSpeedMult(): number {
    return this.getLifeStage() === 2 ? 2.85 : 2;
  }

  protected updateBehavior(deltaTime: number): void {
    this.legAnimation += deltaTime * 4;
    const stage = this.getLifeStage();
    if (stage === 2 && this.prevLifeStage === 1) {
      AudioManager.play('SFX_BOSS_ROAR');
      this.game.shake(12);
      this.phase = 'charging';
      this.phaseTimer = 0.35;
      this.spawnedChildren = 0;
    }
    this.prevLifeStage = stage;
    if (stage === 2) {
      this.enragePulse += deltaTime * 5;
    }

    this.phaseTimer -= deltaTime;

    const currentChildren = this.game.enemies.filter(
      e => e instanceof Spider && e.isActive && !e.markedForDeletion
    ).length;

    if (this.phaseTimer <= 0) {
      this.nextPhase(currentChildren);
    }

    switch (this.phase) {
      case 'idle':
        this.velocity.mulMut(0.95);
        break;

      case 'spawning':
        this.velocity.mulMut(0.95);
        this.spawnCooldown -= deltaTime;
        if (this.spawnCooldown <= 0 && currentChildren < this.broodCap()) {
          this.spawnChild();
          this.spawnCooldown = this.spawnInterval();
          this.spawnedChildren++;
        }
        break;

      case 'shooting':
        this.velocity.mulMut(0.95);
        this.shootCooldown -= deltaTime;
        if (this.shootCooldown <= 0) {
          this.shootSpread();
          this.shootCooldown = this.shootInterval();
        }
        break;

      case 'charging': {
        const dirToPlayer = this.getDirectionToPlayer();
        this.velocity = dirToPlayer.mul(this.speed * this.chargeSpeedMult());
        break;
      }
    }

    const room = this.game.getCurrentRoom();
    if (room) {
      const halfSize = this.size / 2;
      const minX = room.wallThickness + halfSize;
      const maxX = GAME.NATIVE_WIDTH - room.wallThickness - halfSize;
      const minY = room.wallThickness + halfSize;
      const maxY = GAME.NATIVE_HEIGHT - room.wallThickness - halfSize;

      this.position.x = Math.max(minX, Math.min(maxX, this.position.x));
      this.position.y = Math.max(minY, Math.min(maxY, this.position.y));
      const obs = room.getObstacleRects();
      if (obs.length > 0) {
        resolveCircleObstacles(this.position, halfSize, obs);
        this.position.x = Math.max(minX, Math.min(maxX, this.position.x));
        this.position.y = Math.max(minY, Math.min(maxY, this.position.y));
      }
    }
  }

  private nextPhase(currentChildren: number): void {
    const stage = this.getLifeStage();
    const cap = this.broodCap();

    if (stage === 2) {
      const r = Math.random();
      if (r < 0.38) {
        this.phase = 'charging';
        this.phaseTimer = 2.1 + Math.random() * 0.5;
      } else if (r < 0.82) {
        this.phase = 'shooting';
        this.phaseTimer = 3.4 + Math.random() * 0.6;
      } else if (currentChildren < cap - 1) {
        this.phase = 'spawning';
        this.phaseTimer = 2.8;
        this.spawnedChildren = 0;
        this.spawnCooldown = 0.2;
      } else {
        this.phase = Math.random() < 0.55 ? 'shooting' : 'charging';
        this.phaseTimer = this.phase === 'shooting' ? 2.8 : 1.9;
      }
      return;
    }

    const healthPercent = this.health / this.maxHealth;
    if (healthPercent < 0.35) {
      this.phase = Math.random() < 0.55 ? 'charging' : 'shooting';
      this.phaseTimer = this.phase === 'charging' ? 1.85 : 2.6;
    } else if (currentChildren < 2 && Math.random() < 0.42) {
      this.phase = 'spawning';
      this.phaseTimer = 3;
      this.spawnedChildren = 0;
      this.spawnCooldown = 0.35;
    } else {
      const rand = Math.random();
      if (rand < 0.28) {
        this.phase = 'idle';
        this.phaseTimer = 1.4;
      } else if (rand < 0.58) {
        this.phase = 'shooting';
        this.phaseTimer = 2.4;
      } else {
        this.phase = 'charging';
        this.phaseTimer = 1.85;
      }
    }
  }

  private spawnChild(): void {
    const angle = Math.random() * Math.PI * 2;
    const distance = this.size / 2 + 10;
    const spawnPos = this.position.add(
      new Vector2(Math.cos(angle) * distance, Math.sin(angle) * distance)
    );

    const spider = new Spider(spawnPos, this.game);
    this.game.spawnEnemy(spider);
  }

  private shootSpread(): void {
    const baseAngle = this.position.angleTo(this.game.player.position);
    const n = this.spreadCount();
    const spread = this.spreadArc();
    const half = (n - 1) / 2;

    for (let i = 0; i < n; i++) {
      const angle = baseAngle + (i - half) * (spread / Math.max(1, n - 1));
      const direction = new Vector2(Math.cos(angle), Math.sin(angle));

      const projectile = new Projectile({
        position: this.position.clone(),
        direction,
        isPlayerProjectile: false,
        damage: this.damage,
        speed: this.projSpeed(),
      });

      this.game.spawnProjectile(projectile);
    }
  }

  protected die(): void {
    this.game.shake(15);
    super.die();
  }

  protected renderEnemy(ctx: CanvasRenderingContext2D): void {
    const legOffset = Math.sin(this.legAnimation) * 2;
    const stage = this.getLifeStage();

    ctx.strokeStyle = '#0a0202';
    ctx.lineWidth = 2;

    for (let i = 0; i < 4; i++) {
      const offset = i % 2 === 0 ? legOffset : -legOffset;
      const yPos = (i - 1.5) * 6;

      ctx.beginPath();
      ctx.moveTo(-8, yPos);
      ctx.lineTo(-16, yPos - 4 + offset);
      ctx.lineTo(-20 + offset, yPos + 2);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(8, yPos);
      ctx.lineTo(16, yPos - 4 - offset);
      ctx.lineTo(20 - offset, yPos + 2);
      ctx.stroke();
    }

    ctx.fillStyle = this.flashTimer > 0 ? '#ffffff' : COLORS.BROODMOTHER_BODY;
    ctx.beginPath();
    ctx.ellipse(0, -4, 10, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = this.flashTimer > 0 ? '#ffffff' : '#2a0808';
    ctx.beginPath();
    ctx.ellipse(0, 10, 12, 14, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#400a0a';
    ctx.beginPath();
    ctx.ellipse(0, 8, 6, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    if (stage === 2) {
      const pulse = 0.35 + Math.sin(this.enragePulse) * 0.2;
      ctx.strokeStyle = `rgba(255,60,40,${pulse})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 4, 18 + Math.sin(this.enragePulse * 1.3) * 2, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.fillStyle = COLORS.SPIDER_EYES;
    ctx.beginPath();
    ctx.arc(-4, -8, 2, 0, Math.PI * 2);
    ctx.arc(4, -8, 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(-6, -5, 1.5, 0, Math.PI * 2);
    ctx.arc(6, -5, 1.5, 0, Math.PI * 2);
    ctx.arc(-2, -6, 1, 0, Math.PI * 2);
    ctx.arc(2, -6, 1, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#330000';
    ctx.beginPath();
    ctx.moveTo(-3, -2);
    ctx.lineTo(-4, 4);
    ctx.lineTo(-2, 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(3, -2);
    ctx.lineTo(4, 4);
    ctx.lineTo(2, 2);
    ctx.fill();

    if (this.phase === 'charging') {
      ctx.strokeStyle = '#ff0000';
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.arc(0, 0, this.size / 2 + 5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    } else if (this.phase === 'spawning') {
      ctx.fillStyle = '#ff00ff';
      ctx.globalAlpha = 0.3;
      ctx.beginPath();
      ctx.ellipse(0, 10, 14, 16, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    const barWidth = 44;
    const barHeight = 5;
    const barY = -this.size / 2 - 11;
    const hx = -barWidth / 2;
    const healthPercent = this.health / this.maxHealth;
    const midX = hx + barWidth * STAGE2_THRESHOLD;

    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(hx, barY, barWidth, barHeight);

    ctx.fillStyle = 'rgba(80,40,40,0.85)';
    ctx.fillRect(hx, barY, barWidth * STAGE2_THRESHOLD, barHeight);
    ctx.fillStyle = 'rgba(100,35,25,0.9)';
    ctx.fillRect(midX, barY, barWidth * (1 - STAGE2_THRESHOLD), barHeight);

    ctx.fillStyle = stage === 2 ? '#ff3a18' : '#dd1111';
    ctx.fillRect(hx, barY, barWidth * healthPercent, barHeight);

    ctx.strokeStyle = '#ffee88';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(Math.round(midX) + 0.5, barY - 1);
    ctx.lineTo(Math.round(midX) + 0.5, barY + barHeight + 1);
    ctx.stroke();
  }
}
