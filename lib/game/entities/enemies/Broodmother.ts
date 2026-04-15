import { Enemy } from './Enemy';
import { Spider } from './Spider';
import { Projectile } from '../Projectile';
import { Vector2 } from '../../utils/Vector2';
import { ENEMY, COLORS } from '../../utils/constants';
import { resolveCircleObstacles } from '../../utils/obstacleCollision';
import { AudioManager } from '../../audio/AudioManager';
import type { Game } from '../../engine/Game';
import { CHAPTER_1_LAST_ROOM_INDEX } from '../../rooms/chapterConfig';

type BossPhase = 'idle' | 'spawning' | 'shooting' | 'charging' | 'sweeping';

/** Health fraction at which Broodmother enrages (second life stage). */
const STAGE2_THRESHOLD = 0.5;

export type BroodmotherVariant = 'standard' | 'flooded';

export class Broodmother extends Enemy {
  private phase: BossPhase = 'idle';
  private phaseTimer: number = 2;
  private spawnCooldown: number = 0;
  private shootCooldown: number = 0;
  private sweepAngle: number = 0;
  private sweepDir: 1 | -1 = 1;
  private legAnimation: number = 0;
  private spawnedChildren: number = 0;
  private prevLifeStage: 1 | 2 = 1;
  private enragePulse: number = 0;
  public readonly variant: BroodmotherVariant;

  constructor(position: Vector2, game: Game, variant: BroodmotherVariant = 'standard') {
    super(position, ENEMY.BROODMOTHER, game);
    this.variant = variant;
    AudioManager.play('SFX_BOSS_ROAR');
  }

  /** Sector 12 (chapter 1) Broodmother — slower patterns on easy/medium. */
  private isChapter1Finale(): boolean {
    return this.game.roomManager.currentRoomIndex === CHAPTER_1_LAST_ROOM_INDEX;
  }

  /** Longer phases = easier (chapter 1 only). */
  private chapter1PaceMult(): number {
    const d = this.game.difficulty;
    if (!this.isChapter1Finale()) return 1;
    if (d === 'easy') return 1.42;
    if (d === 'hard') return 0.92;
    return 1.12;
  }

  /** Flooded abyss variant: slightly more oppressive cadence. */
  private floodedPaceMult(): number {
    return this.variant === 'flooded' ? 0.93 : 1;
  }

  private patternPace(): number {
    return this.chapter1PaceMult() * this.floodedPaceMult();
  }

  /**
   * Brood shield: originally full invulnerability while any brood spider lived.
   * This felt like "invulnerable most of the time", so we now *mitigate* damage
   * while the brood is up instead of nullifying it.
   */
  private broodSpiderCount(): number {
    return this.game.enemies.filter(
      (e) => e instanceof Spider && e.isActive && !e.markedForDeletion
    ).length;
  }

  takeDamage(amount: number): void {
    const brood = this.broodSpiderCount();
    if (brood > 0) {
      this.flashTimer = 0.12;
      AudioManager.play('SFX_ENEMY_HIT');
      this.game.particles.emit(this.position, '#7ae8ff', 7, 52);
      this.game.shake(2);
      // Still allow progress: shield reduces damage instead of blocking it.
      // Stronger shield when there are more brood spiders alive.
      const shield = Math.min(0.78, 0.35 + brood * 0.12);
      super.takeDamage(Math.max(1, Math.round(amount * (1 - shield))));
      return;
    }
    super.takeDamage(amount);
  }

  private getLifeStage(): 1 | 2 {
    return this.health <= this.maxHealth * STAGE2_THRESHOLD ? 2 : 1;
  }

  private broodCap(): number {
    let cap = this.getLifeStage() === 2 ? 5 : 3;
    if (this.isChapter1Finale() && this.game.difficulty === 'easy') {
      cap = Math.max(2, cap - 1);
    }
    return cap;
  }

  private ph(phaseSeconds: number): number {
    return phaseSeconds * this.patternPace();
  }

  private spawnInterval(): number {
    const base = this.getLifeStage() === 2 ? 0.75 : 1.25;
    return base * this.patternPace();
  }

  private shootInterval(): number {
    const base = this.getLifeStage() === 2 ? 0.24 : 0.52;
    return base * this.patternPace();
  }

  private spreadCount(): number {
    return this.getLifeStage() === 2 ? 7 : 5;
  }

  private spreadArc(): number {
    // Slightly tighter cone: harder to slip through the same safe gap every time.
    return this.getLifeStage() === 2 ? Math.PI * 0.4 : Math.PI * 0.3;
  }

  private projSpeed(): number {
    return this.getLifeStage() === 2 ? 92 : 74;
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

    const currentChildren = this.broodSpiderCount();

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

      case 'sweeping': {
        // New pattern: a "sweep" that tracks the player with lag and advances
        // in a consistent direction. Creates an arc you must reposition around.
        this.velocity.mulMut(0.94);
        const target = this.position.angleTo(this.game.player.position);
        const maxTurn = (stage === 2 ? 1.45 : 1.05) * deltaTime;
        const diff = Math.atan2(Math.sin(target - this.sweepAngle), Math.cos(target - this.sweepAngle));
        this.sweepAngle += Math.max(-maxTurn, Math.min(maxTurn, diff));
        // Slow continuous sweep so it doesn't "lock on".
        this.sweepAngle += this.sweepDir * (stage === 2 ? 0.65 : 0.48) * deltaTime;

        this.shootCooldown -= deltaTime;
        if (this.shootCooldown <= 0) {
          this.shootSweepVolley(this.sweepAngle);
          this.shootCooldown = stage === 2 ? 0.18 : 0.28;
        }
        break;
      }

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
      const maxX = room.width - room.wallThickness - halfSize;
      const minY = room.wallThickness + halfSize;
      const maxY = room.height - room.wallThickness - halfSize;

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

  private broodAnticipationShake(): void {
    switch (this.phase) {
      case 'shooting':
        this.game.shake(3.2);
        break;
      case 'sweeping':
        this.game.shake(4);
        AudioManager.play('SFX_WEB', 0.22);
        break;
      case 'charging':
        this.game.shake(5);
        break;
      case 'spawning':
        this.game.shake(3);
        break;
      default:
        break;
    }
  }

  private nextPhase(currentChildren: number): void {
    const stage = this.getLifeStage();
    const cap = this.broodCap();

    if (stage === 2) {
      const r = Math.random();
      if (r < 0.28) {
        this.phase = 'charging';
        this.phaseTimer = this.ph(2.1 + Math.random() * 0.5);
      } else if (r < 0.66) {
        this.phase = 'shooting';
        this.phaseTimer = this.ph(3.4 + Math.random() * 0.6);
      } else if (r < 0.88) {
        this.phase = 'sweeping';
        this.phaseTimer = this.ph(2.8 + Math.random() * 0.5);
        this.sweepAngle = this.position.angleTo(this.game.player.position);
        this.sweepDir = Math.random() < 0.5 ? 1 : -1;
        this.shootCooldown = 0.1;
      } else if (currentChildren < cap && Math.random() < 0.6) {
        this.phase = 'spawning';
        this.phaseTimer = this.ph(2.4);
        this.spawnedChildren = 0;
        this.spawnCooldown = 0.35;
      } else {
        this.phase = Math.random() < 0.6 ? 'shooting' : 'charging';
        this.phaseTimer = this.ph(this.phase === 'shooting' ? 2.6 : 1.85);
      }
      this.broodAnticipationShake();
      return;
    }

    const healthPercent = this.health / this.maxHealth;
    if (healthPercent < 0.35) {
      const rr = Math.random();
      if (rr < 0.25) {
        this.phase = 'charging';
        this.phaseTimer = this.ph(1.8);
      } else if (rr < 0.72) {
        this.phase = 'shooting';
        this.phaseTimer = this.ph(2.55);
      } else {
        this.phase = 'sweeping';
        this.phaseTimer = this.ph(2.4);
        this.sweepAngle = this.position.angleTo(this.game.player.position);
        this.sweepDir = Math.random() < 0.5 ? 1 : -1;
        this.shootCooldown = 0.18;
      }
    } else if (currentChildren < 1 && Math.random() < 0.24) {
      this.phase = 'spawning';
      this.phaseTimer = this.ph(2.6);
      this.spawnedChildren = 0;
      this.spawnCooldown = 0.55;
    } else {
      const rand = Math.random();
      if (rand < 0.28) {
        this.phase = 'idle';
        this.phaseTimer = this.ph(1.4);
      } else if (rand < 0.58) {
        this.phase = 'shooting';
        this.phaseTimer = this.ph(2.4);
      } else {
        this.phase = 'charging';
        this.phaseTimer = this.ph(1.85);
      }
    }
    this.broodAnticipationShake();
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
    AudioManager.play('SFX_WEB', 0.28);
    const baseAngle = this.position.angleTo(this.game.player.position);
    const n = this.spreadCount();
    const spread = this.spreadArc();
    const half = (n - 1) / 2;
    // Break the "same gap every time" feel: a small wave + slight random jitter.
    const stage = this.getLifeStage();
    const wave = Math.sin(this.enragePulse * (stage === 2 ? 0.9 : 0.6)) * (stage === 2 ? 0.09 : 0.06);
    const jitter = (Math.random() - 0.5) * (stage === 2 ? 0.06 : 0.04);
    const bias = wave + jitter;

    for (let i = 0; i < n; i++) {
      const angle = baseAngle + bias + (i - half) * (spread / Math.max(1, n - 1));
      const direction = new Vector2(Math.cos(angle), Math.sin(angle));

      const projectile = new Projectile({
        position: this.position.clone(),
        direction,
        isPlayerProjectile: false,
        damage: this.damage,
        speed: this.projSpeed(),
        playerHitKind: 'boss',
      });

      this.game.spawnProjectile(projectile);
    }
  }

  private shootSweepVolley(angle: number): void {
    const stage = this.getLifeStage();
    const count = stage === 2 ? 3 : 2;
    const sep = stage === 2 ? 0.12 : 0.16;
    for (let i = 0; i < count; i++) {
      const a = angle + (i - (count - 1) / 2) * sep;
      const direction = new Vector2(Math.cos(a), Math.sin(a));
      const projectile = new Projectile({
        position: this.position.clone(),
        direction,
        isPlayerProjectile: false,
        damage: this.damage,
        speed: this.projSpeed(),
        playerHitKind: 'boss',
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
    const shielded = this.broodSpiderCount() > 0;

    if (shielded) {
      const sy = barY - 8;
      ctx.fillStyle = 'rgba(12, 28, 42, 0.95)';
      ctx.fillRect(hx, sy, barWidth, 4);
      ctx.fillStyle = 'rgba(60, 200, 255, 0.35)';
      ctx.fillRect(hx, sy, barWidth, 4);
      ctx.strokeStyle = 'rgba(160, 240, 255, 0.75)';
      ctx.lineWidth = 1;
      ctx.strokeRect(hx + 0.5, sy + 0.5, barWidth - 1, 3);
    }

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
