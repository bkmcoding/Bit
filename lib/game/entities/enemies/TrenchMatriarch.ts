import { Enemy } from './Enemy';
import { MurkLeech } from './MurkLeech';
import { Projectile } from '../Projectile';
import { Vector2 } from '../../utils/Vector2';
import { ENEMY, COLORS } from '../../utils/constants';
import { AudioManager } from '../../audio/AudioManager';
import type { Game } from '../../engine/Game';

type TMPhase =
  | 'idle'
  | 'fan'
  | 'summon'
  | 'rush'
  | 'tendril'
  | 'whirlpool'
  | 'vacuum';

/**
 * Chapter 2 finale — abyss matriarch: fan volleys, summons, rush, aimed tendril bursts,
 * whirlpool spray, brief vacuum pull, desperation nova, boss HP bar.
 */
export class TrenchMatriarch extends Enemy {
  private phase: TMPhase = 'idle';
  private phaseTimer = 2.1;
  private fanSpin = 0;
  private fanShotTimer = 0;
  private tentaclePhase = 0;
  private rushTimer = 0;
  private readonly fanVolleyBase: number;
  private tendrilShotsLeft = 0;
  private tendrilDelay = 0;
  private whirlTimer = 0;
  private whirlSpin = 0;
  private vacuumTimer = 0;
  private novaUsed = false;
  private enraged = false;

  constructor(position: Vector2, game: Game) {
    super(position, ENEMY.TRENCH_MATRIARCH, game);
    this.fanVolleyBase =
      game.difficulty === 'easy' ? 0.52 : game.difficulty === 'hard' ? 0.34 : 0.42;
    AudioManager.play('SFX_BOSS_ROAR');
  }

  private fanPace(): number {
    const e = this.enraged ? 0.82 : 1;
    return this.fanVolleyBase * e;
  }

  takeDamage(amount: number): void {
    const prevFrac = this.maxHealth > 0 ? this.health / this.maxHealth : 1;
    super.takeDamage(amount);
    const frac = this.maxHealth > 0 ? this.health / this.maxHealth : 0;
    if (!this.novaUsed && prevFrac > 0.48 && frac <= 0.48) {
      this.novaUsed = true;
      this.emitDesperationNova();
    }
    if (!this.enraged && frac <= 0.34) {
      this.enraged = true;
      this.game.shake(6);
    }
  }

  protected updateBehavior(deltaTime: number): void {
    this.tentaclePhase += deltaTime * 2.4;
    this.phaseTimer -= deltaTime;

    switch (this.phase) {
      case 'idle':
        this.velocity.mulMut(0.86);
        if (this.phaseTimer <= 0) this.pickNextPhase();
        break;
      case 'fan':
        this.updateFan(deltaTime);
        break;
      case 'summon':
        this.velocity.mulMut(0.9);
        if (this.phaseTimer <= 0) {
          this.phase = 'idle';
          this.phaseTimer = 0.85 + Math.random() * 0.4;
        }
        break;
      case 'rush':
        this.updateRush(deltaTime);
        break;
      case 'tendril':
        this.updateTendril(deltaTime);
        break;
      case 'whirlpool':
        this.updateWhirlpool(deltaTime);
        break;
      case 'vacuum':
        this.updateVacuum(deltaTime);
        break;
    }
  }

  private pickNextPhase(): void {
    const d = this.game.difficulty;
    const r = Math.random();
    if (r < 0.28) {
      this.phase = 'fan';
      this.fanSpin = this.position.angleTo(this.game.player.position);
      this.fanShotTimer = 0;
      this.phaseTimer = d === 'easy' ? 2.6 : d === 'hard' ? 4.0 : 3.2;
      this.game.shake(2.8);
      return;
    }
    if (r < 0.46) {
      this.phase = 'summon';
      this.game.shake(2.2);
      this.spawnLeeches();
      this.phaseTimer = 0.55;
      return;
    }
    if (r < 0.58) {
      this.game.shake(3.6);
      this.startTendril();
      return;
    }
    if (r < 0.72) {
      this.game.shake(4.2);
      this.startWhirlpool();
      return;
    }
    if (r < 0.84) {
      this.game.shake(6);
      this.startVacuum();
      return;
    }
    this.phase = 'rush';
    this.rushTimer = d === 'easy' ? 0.3 : d === 'hard' ? 0.46 : 0.38;
    const dir = this.getDirectionToPlayer();
    const mult = d === 'hard' ? 2.5 : d === 'easy' ? 1.62 : 2.05;
    this.velocity = dir.mul(this.speed * mult);
    this.phaseTimer = 1.05;
    this.game.shake(4);
  }

  private updateFan(deltaTime: number): void {
    this.velocity.mulMut(0.88);
    this.fanShotTimer -= deltaTime;
    if (this.fanShotTimer <= 0) {
      this.emitFanRing(8);
      this.fanShotTimer = this.fanPace();
      this.fanSpin += dMult(this.game.difficulty) * (this.enraged ? 1.15 : 1);
    }
    if (this.phaseTimer <= 0) {
      this.phase = 'idle';
      this.phaseTimer = 0.75 + Math.random() * 0.45;
    }
  }

  private updateTendril(deltaTime: number): void {
    this.velocity.mulMut(0.78);
    this.tendrilDelay -= deltaTime;
    if (this.tendrilDelay <= 0 && this.tendrilShotsLeft > 0) {
      this.fireTendrilShot();
      this.tendrilShotsLeft--;
      this.tendrilDelay = this.game.difficulty === 'hard' ? 0.065 : 0.09;
    }
    if (this.tendrilShotsLeft <= 0 && this.tendrilDelay < -0.08) {
      this.phase = 'idle';
      this.phaseTimer = 0.7 + Math.random() * 0.35;
    }
  }

  private startTendril(): void {
    this.phase = 'tendril';
    this.tendrilShotsLeft = this.game.difficulty === 'hard' ? 9 : this.game.difficulty === 'easy' ? 5 : 7;
    this.tendrilDelay = 0;
  }

  private fireTendrilShot(): void {
    const lead = this.game.player.velocity.mul(0.12);
    const dir = this.game.player.position.add(lead).sub(this.position).normalize();
    const spread = (this.tendrilShotsLeft % 3 - 1) * 0.09;
    const d = dir.rotate(spread);
    this.game.spawnProjectile(
      new Projectile({
        position: this.position.clone(),
        direction: d,
        isPlayerProjectile: false,
        damage: this.damage,
        speed: 108,
        size: 3,
        playerHitKind: 'boss',
      })
    );
    AudioManager.play('SFX_WEB', 0.32);
  }

  private startWhirlpool(): void {
    this.phase = 'whirlpool';
    this.whirlTimer = 0;
    this.whirlSpin = this.position.angleTo(this.game.player.position);
    this.phaseTimer = this.game.difficulty === 'hard' ? 2.35 : this.game.difficulty === 'easy' ? 1.45 : 1.85;
  }

  private updateWhirlpool(deltaTime: number): void {
    this.velocity.mulMut(0.72);
    this.whirlTimer -= deltaTime;
    if (this.whirlTimer <= 0) {
      this.whirlTimer = this.enraged ? 0.16 : 0.22;
      this.emitFanRing(5);
      this.whirlSpin += 0.55;
      this.fanSpin = this.whirlSpin;
    }
    if (this.phaseTimer <= 0) {
      this.phase = 'idle';
      this.phaseTimer = 0.8 + Math.random() * 0.4;
    }
  }

  private startVacuum(): void {
    this.phase = 'vacuum';
    this.vacuumTimer = this.game.difficulty === 'hard' ? 0.95 : this.game.difficulty === 'easy' ? 0.55 : 0.72;
    this.phaseTimer = this.vacuumTimer + 0.35;
    this.velocity.set(0, 0);
  }

  private updateVacuum(deltaTime: number): void {
    this.velocity.mulMut(0.55);
    this.vacuumTimer -= deltaTime;
    const p = this.game.player.position;
    const toBoss = this.position.sub(p);
    const d = toBoss.magnitude();
    const pull =
      d > 6
        ? toBoss.normalize().mul(28 * deltaTime)
        : new Vector2((Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12).mul(deltaTime);
    p.addMut(pull);
    this.game.shake(0.45);
    if (this.vacuumTimer <= 0) {
      this.emitFanRing(6);
      this.game.shake(5);
      AudioManager.play('SFX_WEB', 0.5);
    }
    if (this.phaseTimer <= 0) {
      this.phase = 'idle';
      this.phaseTimer = 1.0 + Math.random() * 0.5;
    }
  }

  private emitDesperationNova(): void {
    const n = 16;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const dir = new Vector2(Math.cos(a), Math.sin(a));
      this.game.spawnProjectile(
        new Projectile({
          position: this.position.clone(),
          direction: dir,
          isPlayerProjectile: false,
          damage: Math.max(1, this.damage - 1),
          speed: 58,
          size: 4,
          playerHitKind: 'boss',
        })
      );
    }
    this.game.shake(11);
    AudioManager.play('SFX_BOSS_ROAR', 0.55);
  }

  private emitFanRing(n: number): void {
    const base = this.fanSpin;
    for (let i = 0; i < n; i++) {
      const a = base + (i / n) * Math.PI * 2;
      const dir = new Vector2(Math.cos(a), Math.sin(a));
      this.game.spawnProjectile(
        new Projectile({
          position: this.position.clone(),
          direction: dir,
          isPlayerProjectile: false,
          damage: this.damage,
          speed: 72,
          size: 4,
        })
      );
    }
    AudioManager.play('SFX_WEB', 0.45);
    this.game.shake(2.5);
  }

  private spawnLeeches(): void {
    const d = this.game.difficulty;
    const count = d === 'easy' ? 1 : d === 'hard' ? 3 : 2;
    for (let i = 0; i < count; i++) {
      const ang = (Math.PI * 2 * i) / count + this.tentaclePhase * 0.4;
      const off = new Vector2(Math.cos(ang) * 46, Math.sin(ang) * 40);
      this.game.spawnEnemy(new MurkLeech(this.position.add(off), this.game));
    }
    this.game.shake(4);
    AudioManager.playEnemyHit(0.5, ENEMY.MURK_LEECH.size);
  }

  private updateRush(deltaTime: number): void {
    this.rushTimer -= deltaTime;
    if (this.rushTimer <= 0) {
      this.velocity.mulMut(0.72);
    }
    if (this.phaseTimer <= 0) {
      this.phase = 'idle';
      this.phaseTimer = 0.75 + Math.random() * 0.55;
    }
  }

  protected renderEnemy(ctx: CanvasRenderingContext2D): void {
    const wobble = Math.sin(this.tentaclePhase) * 2;
    ctx.strokeStyle = '#0a3a42';
    ctx.lineWidth = 2;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + this.tentaclePhase * 0.6;
      const len = 12 + (i % 3) * 2 + wobble;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 8, Math.sin(a) * 8);
      ctx.quadraticCurveTo(
        Math.cos(a + 0.3) * (len * 0.6),
        Math.sin(a + 0.3) * (len * 0.6),
        Math.cos(a) * len,
        Math.sin(a) * len
      );
      ctx.stroke();
    }

    ctx.fillStyle = this.flashTimer > 0 ? '#ffffff' : COLORS.TRENCH_MATRIARCH_CORE;
    ctx.beginPath();
    ctx.ellipse(0, 2, 13, 11, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = COLORS.TRENCH_MATRIARCH_MANTLE;
    ctx.beginPath();
    ctx.ellipse(0, 4, 11, 9, 0.1, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = COLORS.TRENCH_MATRIARCH_EYE;
    ctx.beginPath();
    ctx.arc(-4, -2, 2.2, 0, Math.PI * 2);
    ctx.arc(4, -2, 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#061018';
    ctx.beginPath();
    ctx.arc(-4, -2, 0.9, 0, Math.PI * 2);
    ctx.arc(4, -2, 0.9, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = this.enraged ? 'rgba(255, 120, 90, 0.45)' : 'rgba(90, 200, 220, 0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, 2, 15 + Math.sin(this.tentaclePhase * 2) * 1.5, 0, Math.PI * 2);
    ctx.stroke();

    this.renderBossHealthBar(ctx);
  }

  private renderBossHealthBar(ctx: CanvasRenderingContext2D): void {
    const barWidth = 48;
    const barHeight = 5;
    const barY = -this.size / 2 - 12;
    const hx = -barWidth / 2;
    const hp = this.maxHealth > 0 ? this.health / this.maxHealth : 0;

    ctx.fillStyle = 'rgba(8, 14, 18, 0.92)';
    ctx.fillRect(hx - 1, barY - 1, barWidth + 2, barHeight + 2);
    ctx.fillStyle = '#0a1418';
    ctx.fillRect(hx, barY, barWidth, barHeight);
    ctx.fillStyle = 'rgba(30, 90, 110, 0.85)';
    ctx.fillRect(hx, barY, barWidth * hp, barHeight);
    ctx.strokeStyle = 'rgba(140, 230, 255, 0.75)';
    ctx.lineWidth = 1;
    ctx.strokeRect(hx + 0.5, barY + 0.5, barWidth - 1, barHeight - 1);
  }
}

function dMult(d: 'easy' | 'medium' | 'hard'): number {
  if (d === 'hard') return 0.24;
  if (d === 'easy') return 0.11;
  return 0.16;
}
