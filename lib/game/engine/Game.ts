import { InputManager } from './InputManager';
import { Entity } from '../entities/Entity';
import { Player } from '../entities/Player';
import { Projectile } from '../entities/Projectile';
import { Enemy } from '../entities/enemies/Enemy';
import { Room } from '../rooms/Room';
import { RoomManager } from '../systems/RoomManager';
import { CollisionSystem } from '../systems/CollisionSystem';
import {
  GAME,
  COLORS,
  PLAYER,
  DIFFICULTY_DEFAULT,
  DIFFICULTY_SETTINGS,
  ROOM_THEME_PALETTES,
  type GameState,
  type Difficulty,
} from '../utils/constants';
import { Broodmother } from '../entities/enemies/Broodmother';
import { hiveMindSteerUnit, type HiveRole } from '../systems/HiveMind';
import { Vector2 } from '../utils/Vector2';
import { resolveCircleObstacles } from '../utils/obstacleCollision';
import { ParticleSystem } from '../rendering/particles';
import type { GamePostUniforms } from '../rendering/webglHorrorPresent';
import { getMoonShaftForRoom } from '../rendering/roomMoonlight';
import { AudioManager } from '../audio/AudioManager';
import type { Upgrade } from '../upgrades/Upgrade';

export interface GameCallbacks {
  onStateChange?: (state: GameState) => void;
  onHealthChange?: (health: number, maxHealth: number) => void;
  onRoomChange?: (roomIndex: number, totalRooms: number) => void;
  onUpgradeSelect?: (upgrades: Upgrade[]) => void;
  onGameOver?: (victory: boolean) => void;
  /** WebGL post: native-res buffer → GPU. When set, Canvas horror overlay is skipped. */
  onPresentFrame?: (source: HTMLCanvasElement, uniforms: GamePostUniforms) => void;
}

export class Game {
  public state: GameState = 'MENU';
  public difficulty: Difficulty = DIFFICULTY_DEFAULT;
  public player: Player;
  public entities: Entity[] = [];
  public projectiles: Projectile[] = [];
  public enemies: Enemy[] = [];
  
  public input: InputManager;
  public roomManager: RoomManager;
  public collisionSystem: CollisionSystem;
  public particles: ParticleSystem;
  
  private ctx: CanvasRenderingContext2D;
  private lastTime: number = 0;
  private animationFrameId: number = 0;
  private callbacks: GameCallbacks;
  
  // Screen shake
  private shakeIntensity: number = 0;
  private shakeDecay: number = 0.9;

  /** Drives low-HP pulse and subtle flicker in the post overlay. */
  private ambiencePhase: number = 0;
  private skitterCooldown: number = 0;

  private hiveMindRegistry: Map<Enemy, { i: number; n: number }> = new Map();

  constructor(ctx: CanvasRenderingContext2D, callbacks: GameCallbacks = {}) {
    this.ctx = ctx;
    this.callbacks = callbacks;
    
    this.input = new InputManager();
    this.roomManager = new RoomManager(this);
    this.collisionSystem = new CollisionSystem(this);
    this.particles = new ParticleSystem();
    
    // Create player at center of first room
    this.player = new Player(
      new Vector2(GAME.NATIVE_WIDTH / 2, GAME.NATIVE_HEIGHT / 2),
      this
    );
  }

  attach(canvas: HTMLCanvasElement): void {
    this.input.attach(canvas);
  }

  detach(): void {
    this.input.detach();
    this.stop();
  }

  start(selectedDifficulty?: Difficulty): void {
    if (selectedDifficulty !== undefined) {
      this.difficulty = selectedDifficulty;
    }
    this.prepareNewRun();
    this.state = 'PLAYING';
    this.callbacks.onStateChange?.(this.state);
    this.roomManager.loadRoom(0);
    this.lastTime = performance.now();
    this.loop();
  }

  stop(): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = 0;
    }
  }

  restart(): void {
    this.prepareNewRun();
    this.state = 'PLAYING';
    this.callbacks.onStateChange?.(this.state);
    this.roomManager.loadRoom(0);
    this.lastTime = performance.now();
    this.loop();
  }

  private prepareNewRun(): void {
    this.stop();
    this.hiveMindRegistry.clear();
    this.entities = [];
    this.projectiles = [];
    this.enemies = [];
    this.particles.clear();
    this.roomManager.reset();
    this.player = new Player(
      new Vector2(GAME.NATIVE_WIDTH / 2, GAME.NATIVE_HEIGHT / 2),
      this
    );
    this.applyDifficultyToPlayer(this.player);
  }

  private applyDifficultyToPlayer(player: Player): void {
    const s = DIFFICULTY_SETTINGS[this.difficulty];
    player.fireRate = PLAYER.FIRE_RATE * s.playerFireRateMult;
  }

  setState(newState: GameState): void {
    this.state = newState;
    this.callbacks.onStateChange?.(newState);
    
    if (newState === 'GAME_OVER') {
      AudioManager.play('SFX_GAME_OVER');
      this.callbacks.onGameOver?.(false);
    } else if (newState === 'VICTORY') {
      AudioManager.play('SFX_VICTORY');
      this.callbacks.onGameOver?.(true);
    }
  }

  private loop = (): void => {
    const currentTime = performance.now();
    const deltaTime = Math.min((currentTime - this.lastTime) / 1000, 0.1); // Cap at 100ms
    this.lastTime = currentTime;

    this.update(deltaTime);
    this.render();
    
    this.input.update();
    this.animationFrameId = requestAnimationFrame(this.loop);
  };

  private update(deltaTime: number): void {
    // Handle pause toggle
    if (this.input.isKeyJustPressed('escape')) {
      if (this.state === 'PLAYING') {
        this.setState('PAUSED');
        return;
      } else if (this.state === 'PAUSED') {
        this.setState('PLAYING');
      }
    }

    if (this.state !== 'PLAYING') return;

    this.refreshHiveMindRegistry();

    // Update player
    this.player.update(deltaTime);

    // Update enemies
    for (const enemy of this.enemies) {
      if (enemy.isActive) {
        enemy.update(deltaTime);
      }
    }

    this.applyEnemySeparation(deltaTime);

    // Update projectiles
    for (const projectile of this.projectiles) {
      if (projectile.isActive) {
        projectile.update(deltaTime);
      }
    }

    // Check collisions
    this.collisionSystem.update();

    // Update particles
    this.particles.update(deltaTime);

    // Clean up dead entities
    this.cleanupEntities();

    // Check room cleared
    this.roomManager.checkRoomCleared();

    // Check door transitions
    this.checkDoorTransition();

    // Update screen shake
    if (this.shakeIntensity > 0.1) {
      this.shakeIntensity *= this.shakeDecay;
    } else {
      this.shakeIntensity = 0;
    }

    this.ambiencePhase += deltaTime;

    this.updateEnemySkitter(deltaTime);
  }

  /** Proximity-based insect leg / chitin one-shots (optional MP3 + settings). */
  private updateEnemySkitter(deltaTime: number): void {
    this.skitterCooldown = Math.max(0, this.skitterCooldown - deltaTime);
    if (this.skitterCooldown > 0) return;

    let urgency = 0;
    const px = this.player.position.x;
    const py = this.player.position.y;
    for (const enemy of this.enemies) {
      if (!enemy.isActive || enemy.markedForDeletion) continue;
      const v2 = enemy.velocity.magnitudeSq();
      if (v2 < 64) continue;
      const dx = enemy.position.x - px;
      const dy = enemy.position.y - py;
      const d = Math.hypot(dx, dy);
      if (d > 140) continue;
      urgency += (1 - d / 140) * Math.min(1.2, v2 / 3600);
    }
    if (urgency < 0.35) return;
    if (Math.random() > 0.012 + urgency * 0.028) return;

    AudioManager.playEnemySkitter(urgency);
    this.skitterCooldown = 0.28 + Math.random() * 0.55;
  }

  private cleanupEntities(): void {
    this.projectiles = this.projectiles.filter(p => !p.markedForDeletion);
    this.enemies = this.enemies.filter(e => !e.markedForDeletion);
  }

  /** Light separation so enemies do not sit on the same pixel stack. */
  private applyEnemySeparation(deltaTime: number): void {
    const room = this.roomManager.currentRoom;
    if (!room) return;
    const wt = room.wallThickness;
    const w = GAME.NATIVE_WIDTH;
    const h = GAME.NATIVE_HEIGHT;
    const strength = 108;

    for (const enemy of this.enemies) {
      if (!enemy.isActive || enemy.markedForDeletion) continue;
      const push = new Vector2();
      for (const other of this.enemies) {
        if (other === enemy || !other.isActive || other.markedForDeletion) continue;
        let diff = enemy.position.sub(other.position);
        const dist = diff.magnitude();
        const want = ((enemy.size + other.size) / 2) * 0.94;
        if (dist > 0.02 && dist < want) {
          const pen = (want - dist) / want;
          diff.normalizeMut();
          push.addMut(diff.mul(pen * strength * deltaTime));
        } else if (dist <= 0.02) {
          push.addMut(
            new Vector2(Math.random() - 0.5, Math.random() - 0.5)
              .normalize()
              .mul(28 * deltaTime)
          );
        }
      }
      enemy.position.addMut(push);
    }

    const obs = room.getObstacleRects();
    for (const enemy of this.enemies) {
      if (!enemy.isActive || enemy.markedForDeletion) continue;
      const half = enemy.size / 2;
      enemy.position.x = Math.max(wt + half, Math.min(w - wt - half, enemy.position.x));
      enemy.position.y = Math.max(wt + half, Math.min(h - wt - half, enemy.position.y));
      if (obs.length > 0) {
        resolveCircleObstacles(enemy.position, half, obs);
        enemy.position.x = Math.max(wt + half, Math.min(w - wt - half, enemy.position.x));
        enemy.position.y = Math.max(wt + half, Math.min(h - wt - half, enemy.position.y));
      }
    }
  }

  private render(): void {
    const ctx = this.ctx;
    
    // Apply screen shake
    ctx.save();
    if (this.shakeIntensity > 0) {
      const shakeX = (Math.random() - 0.5) * this.shakeIntensity;
      const shakeY = (Math.random() - 0.5) * this.shakeIntensity;
      ctx.translate(shakeX, shakeY);
    }

    const room = this.roomManager.currentRoom;
    ctx.fillStyle = room
      ? ROOM_THEME_PALETTES[room.themeId].floor
      : COLORS.FLOOR;
    ctx.fillRect(0, 0, GAME.NATIVE_WIDTH, GAME.NATIVE_HEIGHT);

    // Render current room
    this.roomManager.render(ctx);

    // Render enemies
    for (const enemy of this.enemies) {
      if (enemy.isActive) {
        enemy.render(ctx);
      }
    }

    // Render projectiles
    for (const projectile of this.projectiles) {
      if (projectile.isActive) {
        projectile.render(ctx);
      }
    }

    // Render player
    this.player.render(ctx);

    // Render particles on top
    this.particles.render(ctx);

    ctx.restore();

    if (this.callbacks.onPresentFrame) {
      const moon = getMoonShaftForRoom(this.roomManager.currentRoomIndex);
      const showFx = this.state !== 'MENU';
      this.callbacks.onPresentFrame(this.ctx.canvas, {
        time: performance.now() / 1000,
        playerX: this.player.position.x / GAME.NATIVE_WIDTH,
        playerY: this.player.position.y / GAME.NATIVE_HEIGHT,
        reactiveMood: showFx ? 1 : 0,
        moonOriginX: moon.originX,
        moonOriginY: moon.originY,
        moonDirX: moon.dirX,
        moonDirY: moon.dirY,
        moonSpread: moon.spread,
        moonStrength: showFx ? moon.strength : 0,
      });
    } else if (this.state !== 'MENU') {
      this.renderHorrorOverlay(ctx);
    }
  }

  /** Full-screen mood: cold wash, vignette, proximity dread, low-HP stress (not shaken). */
  private renderHorrorOverlay(ctx: CanvasRenderingContext2D): void {
    const w = GAME.NATIVE_WIDTH;
    const h = GAME.NATIVE_HEIGHT;
    const cx = w * 0.5;
    const cy = h * 0.5;
    const maxR = Math.hypot(cx, cy);

    ctx.save();

    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = 'rgba(12, 10, 22, 0.58)';
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'source-over';

    const lastRoom =
      this.roomManager.totalRooms > 0 &&
      this.roomManager.currentRoomIndex === this.roomManager.totalRooms - 1;
    if (lastRoom && this.state === 'PLAYING') {
      ctx.fillStyle = 'rgba(48, 12, 18, 0.12)';
      ctx.fillRect(0, 0, w, h);
    }

    let threat = 0;
    for (const enemy of this.enemies) {
      if (!enemy.isActive || enemy.markedForDeletion) continue;
      const dx = enemy.position.x - this.player.position.x;
      const dy = enemy.position.y - this.player.position.y;
      const d = Math.hypot(dx, dy);
      const near = 200;
      if (d < near) threat += (near - d) / near;
    }
    threat = Math.min(1, threat * 0.22);
    if (threat > 0.02) {
      const flicker = 0.04 * Math.sin(this.ambiencePhase * 6.2) * threat;
      ctx.fillStyle = `rgba(22, 8, 32, ${threat * 0.14 + flicker})`;
      ctx.fillRect(0, 0, w, h);
    }

    const hpFrac =
      this.player.maxHealth > 0 ? this.player.health / this.player.maxHealth : 1;
    if (hpFrac < 0.38 && this.state === 'PLAYING') {
      const pulse = 0.1 + 0.07 * Math.sin(this.ambiencePhase * 4.5);
      const a = (1 - hpFrac / 0.38) * pulse;
      ctx.fillStyle = `rgba(72, 4, 4, ${Math.min(0.38, a)})`;
      ctx.fillRect(0, 0, w, h);
    }

    const g = ctx.createRadialGradient(cx, cy, maxR * 0.15, cx, cy, maxR * 1.02);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(0.65, 'rgba(0,0,0,0.48)');
    g.addColorStop(1, 'rgba(0,0,0,0.9)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = 'rgba(8, 4, 12, 0.22)';
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'source-over';

    const grain = 55 + Math.floor(25 * Math.sin(this.ambiencePhase * 2.1));
    for (let i = 0; i < grain; i++) {
      const gx = (Math.sin(this.ambiencePhase * 1.7 + i * 12.989) * 0.5 + 0.5) * w;
      const gy = (Math.cos(this.ambiencePhase * 1.3 + i * 9.417) * 0.5 + 0.5) * h;
      ctx.fillStyle = `rgba(0,0,0,${0.04 + (i % 5) * 0.02})`;
      ctx.fillRect(Math.floor(gx), Math.floor(gy), 1, 1);
    }

    ctx.strokeStyle = 'rgba(0,0,0,0.12)';
    ctx.lineWidth = 1;
    for (let y = 0; y < h; y += 2) {
      ctx.beginPath();
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(w, y + 0.5);
      ctx.stroke();
    }

    ctx.restore();
  }

  // Check if player is touching an open door and transition
  private checkDoorTransition(): void {
    const room = this.roomManager.currentRoom;
    if (!room) return;

    const door = room.getDoorAt(this.player.position);
    if (door && door.isOpen && door.targetRoom >= 0) {
      this.roomManager.transitionToRoom(door.targetRoom, door.direction);
    }
  }

  // Add a projectile to the game
  spawnProjectile(projectile: Projectile): void {
    this.projectiles.push(projectile);
  }

  // Add an enemy to the game
  spawnEnemy(enemy: Enemy): void {
    const s = DIFFICULTY_SETTINGS[this.difficulty];
    const boss = enemy instanceof Broodmother;
    const hMult = s.enemyHealthMult * (boss ? s.bossHealthMult : 1);
    const dMult = s.enemyDamageMult * (boss ? s.bossDamageMult : 1);
    enemy.maxHealth = Math.max(1, Math.round(enemy.maxHealth * hMult));
    enemy.health = enemy.maxHealth;
    enemy.damage = Math.max(1, Math.round(enemy.damage * dMult));
    enemy.speed *= s.enemySpeedMult;
    this.enemies.push(enemy);
  }

  /** Hard mode: shared bearings on a ring around the player (see HiveMind). */
  getHiveMindSteer(
    enemy: Enemy,
    role: HiveRole,
    kiteRadius?: number
  ): Vector2 | null {
    if (this.difficulty !== 'hard') return null;
    const slot = this.hiveMindRegistry.get(enemy);
    if (!slot) return null;
    return hiveMindSteerUnit({
      slotIndex: slot.i,
      slotCount: slot.n,
      playerPos: this.player.position,
      playerVel: this.player.velocity,
      enemyPos: enemy.position,
      role,
      kiteRadius,
    });
  }

  private refreshHiveMindRegistry(): void {
    this.hiveMindRegistry.clear();
    if (this.difficulty !== 'hard') return;
    const list = this.enemies.filter(
      e => e.isActive && !e.markedForDeletion && !(e instanceof Broodmother)
    );
    const n = list.length;
    for (let i = 0; i < n; i++) {
      this.hiveMindRegistry.set(list[i], { i, n });
    }
  }

  // Trigger screen shake
  shake(intensity: number = 5): void {
    this.shakeIntensity = Math.max(this.shakeIntensity, intensity);
  }

  // Get current room
  getCurrentRoom(): Room | null {
    return this.roomManager.currentRoom;
  }

  // Notify UI of health change
  notifyHealthChange(): void {
    this.callbacks.onHealthChange?.(this.player.health, this.player.maxHealth);
  }

  // Notify UI of room change
  notifyRoomChange(): void {
    this.callbacks.onRoomChange?.(
      this.roomManager.currentRoomIndex,
      this.roomManager.totalRooms
    );
  }

  // Show upgrade selection
  showUpgradeSelection(upgrades: Upgrade[]): void {
    this.setState('UPGRADE');
    this.callbacks.onUpgradeSelect?.(upgrades);
  }

  // Apply selected upgrade
  applyUpgrade(upgrade: Upgrade): void {
    AudioManager.play('SFX_UPGRADE');
    upgrade.apply(this.player);
    this.setState('PLAYING');
  }

  onEnemyKilled(): void {
    this.player.onEnemyKilled();
  }
}
