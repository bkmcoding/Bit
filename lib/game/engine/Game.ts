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
  type RoomThemeId,
} from '../utils/constants';
import type { MinimapLayout } from '../rooms/roomData';
import {
  CHAPTER_1_LAST_ROOM_INDEX,
  CHAPTER_2_FIRST_ROOM_INDEX,
} from '../rooms/chapterConfig';
import { Broodmother } from '../entities/enemies/Broodmother';
import { TrenchMatriarch } from '../entities/enemies/TrenchMatriarch';
import { hiveMindSteerUnit, type HiveRole } from '../systems/HiveMind';
import { Vector2 } from '../utils/Vector2';
import { resolveCircleObstacles } from '../utils/obstacleCollision';
import { ParticleSystem } from '../rendering/particles';
import type { GamePostUniforms } from '../rendering/webglHorrorPresent';
import { getMoonShaftForRoom } from '../rendering/roomMoonlight';
import { AudioManager } from '../audio/AudioManager';
import type { Upgrade } from '../upgrades/Upgrade';
import { getRandomUpgrades } from '../upgrades/upgradePool';

export type RoomHudPayload = {
  current: number;
  total: number;
  theme: RoomThemeId;
  minimap: MinimapLayout;
  /** Rooms the player has entered this run (for radar fade). */
  enteredRooms: number[];
  chapter: 1 | 2;
  /** Shift-dash stamina (unlocks after clearing sector 2). */
  dash: { unlocked: boolean; stamina: number; max: number };
};

export type DevPanelPayload = {
  unlocked: boolean;
  panelOpen: boolean;
  godMode: boolean;
  gameState: GameState;
  roomLine: string;
};

export interface GameCallbacks {
  onStateChange?: (state: GameState) => void;
  onHealthChange?: (health: number, maxHealth: number) => void;
  onRoomChange?: (payload: RoomHudPayload) => void;
  onUpgradeSelect?: (upgrades: Upgrade[]) => void;
  onGameOver?: (victory: boolean) => void;
  /** Dev HUD (React overlay); canvas dev text was unreliable with WebGL + menu (no game loop). */
  onDevPanelChange?: (payload: DevPanelPayload) => void;
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
  /** Seconds since run start; WebGL horror shader (warp / grain / rare jolts). */
  private horrorTime: number = 0;
  private skitterCooldown: number = 0;
  private hudDashThrottle = 0;

  private hiveMindRegistry: Map<Enemy, { i: number; n: number }> = new Map();
  private dev = {
    unlocked: false,
    panelOpen: false,
    godMode: false,
  };

  /** After sector 12 upgrade, show chapter map instead of PLAYING. */
  private chapterBridgePending = false;
  private chapter2Unlocked = false;

  private static rollRunSeed(): number {
    try {
      const buf = new Uint32Array(1);
      crypto.getRandomValues(buf);
      return buf[0]! | 0;
    } catch {
      return (Math.random() * 0x1_0000_0000) | 0;
    }
  }

  constructor(ctx: CanvasRenderingContext2D, callbacks: GameCallbacks = {}) {
    this.ctx = ctx;
    this.callbacks = callbacks;
    
    this.input = new InputManager();
    this.roomManager = new RoomManager(this);
    this.collisionSystem = new CollisionSystem(this);
    this.particles = new ParticleSystem();
    
    // Create player at center of first room
    this.player = new Player(
      new Vector2(GAME.BUFFER_WIDTH / 2, GAME.BUFFER_HEIGHT / 2),
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
    this.chapterBridgePending = false;
    this.chapter2Unlocked = false;
    this.stop();
    this.hiveMindRegistry.clear();
    this.entities = [];
    this.projectiles = [];
    this.enemies = [];
    this.particles.clear();
    this.roomManager.rebuildRun(Game.rollRunSeed());
    this.player = new Player(
      new Vector2(GAME.BUFFER_WIDTH / 2, GAME.BUFFER_HEIGHT / 2),
      this
    );
    this.applyDifficultyToPlayer(this.player);
    this.horrorTime = 0;
  }

  private applyDifficultyToPlayer(player: Player): void {
    const s = DIFFICULTY_SETTINGS[this.difficulty];
    player.fireRate = PLAYER.FIRE_RATE * s.playerFireRateMult;
  }

  setState(newState: GameState): void {
    this.state = newState;
    this.callbacks.onStateChange?.(newState);
    if (this.dev.unlocked) this.emitDevPanel();

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
    this.handleDeveloperBackdoor();

    // Handle pause toggle
    if (this.input.isKeyJustPressed('escape')) {
      if (this.state === 'PLAYING') {
        this.setState('PAUSED');
        return;
      } else if (this.state === 'PAUSED') {
        this.setState('PLAYING');
      }
    }

    if (this.state === 'CHAPTER_MAP') return;
    if (this.state !== 'PLAYING') return;

    if (this.dev.godMode) {
      // Keep the player effectively unkillable while still allowing normal movement/testing.
      this.player.grantSpawnProtection(0.25);
      this.player.health = this.player.maxHealth;
      this.notifyHealthChange();
    }

    this.refreshHiveMindRegistry();

    this.player.resetEnvironmentMoveMult();

    // Enemies first so hazards (e.g. webs) can set movement penalties before the player moves.
    for (const enemy of this.enemies) {
      if (enemy.isActive) {
        enemy.update(deltaTime);
      }
    }

    this.applyEnemySeparation(deltaTime);

    this.player.update(deltaTime);

    const cr = this.roomManager.currentRoom;
    const pBw = cr?.width ?? GAME.BUFFER_WIDTH;
    const pBh = cr?.height ?? GAME.BUFFER_HEIGHT;
    for (const projectile of this.projectiles) {
      if (projectile.isActive) {
        projectile.update(deltaTime, pBw, pBh);
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

    this.hudDashThrottle += deltaTime;
    if (this.player.dashUnlocked && this.hudDashThrottle >= 0.1) {
      this.hudDashThrottle = 0;
      this.notifyRoomChange();
    }

    // Check door transitions
    this.checkDoorTransition();

    // Update screen shake
    if (this.shakeIntensity > 0.1) {
      this.shakeIntensity *= this.shakeDecay;
    } else {
      this.shakeIntensity = 0;
    }

    this.ambiencePhase += deltaTime;
    this.horrorTime += deltaTime;

    this.updateEnemySkitter(deltaTime);
  }

  private handleDeveloperBackdoor(): void {
    /** Unlock chord is handled in GameCanvas (window listener) so it works on the main menu before the game loop runs. */
    if (!this.dev.unlocked) return;

    if (this.input.isKeyJustPressed('f1')) {
      this.dev.panelOpen = !this.dev.panelOpen;
      this.emitDevPanel();
    }
    if (this.input.isKeyJustPressed('f2')) {
      this.dev.godMode = !this.dev.godMode;
      this.emitDevPanel();
    }
    if (this.input.isKeyJustPressed('f3') && this.state === 'PLAYING') {
      this.clearAllEnemiesInRoom();
    }
    if (this.input.isKeyJustPressed('f4')) {
      this.player.health = this.player.maxHealth;
      this.notifyHealthChange();
    }
    if (this.input.isKeyJustPressed('f5') && this.state === 'PLAYING') {
      const room = this.roomManager.currentRoom;
      const upgrades = getRandomUpgrades(3, {
        roomIndex: this.roomManager.currentRoomIndex,
        theme: room?.themeId,
        difficulty: this.difficulty,
        dashUnlocked: this.player.dashUnlocked,
      });
      this.showUpgradeSelection(upgrades);
    }
    if (this.input.isKeyJustPressed('f6') && this.state === 'PLAYING') {
      this.roomManager.loadRoom(this.roomManager.currentRoomIndex);
    }
    if (this.input.isKeyJustPressed('pageup')) {
      this.jumpToRoom(this.roomManager.currentRoomIndex + 1);
    }
    if (this.input.isKeyJustPressed('pagedown')) {
      this.jumpToRoom(this.roomManager.currentRoomIndex - 1);
    }
  }

  private emitDevPanel(): void {
    this.callbacks.onDevPanelChange?.({
      unlocked: this.dev.unlocked,
      panelOpen: this.dev.panelOpen,
      godMode: this.dev.godMode,
      gameState: this.state,
      roomLine: `${this.roomManager.currentRoomIndex + 1}/${this.roomManager.totalRooms}`,
    });
  }

  /** Toggle dev unlock + panel (called from GameCanvas window keydown; works on main menu). */
  applyDevBackdoorToggle(): void {
    this.dev.unlocked = !this.dev.unlocked;
    this.dev.panelOpen = this.dev.unlocked;
    this.emitDevPanel();
  }

  private clearAllEnemiesInRoom(): void {
    for (const e of this.enemies) {
      e.markedForDeletion = true;
    }
    this.cleanupEntities();
    this.roomManager.checkRoomCleared();
  }

  private jumpToRoom(roomIndex: number): void {
    const max = Math.max(0, this.roomManager.totalRooms - 1);
    const target = Math.max(0, Math.min(max, roomIndex));
    this.roomManager.loadRoom(target);
    if (this.state === 'PAUSED' || this.state === 'UPGRADE') {
      this.setState('PLAYING');
    }
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
    const w = room.width;
    const h = room.height;
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
    ctx.fillStyle = '#030203';
    ctx.fillRect(0, 0, GAME.BUFFER_WIDTH, GAME.BUFFER_HEIGHT);

    const rw = room?.width ?? GAME.BUFFER_WIDTH;
    const rh = room?.height ?? GAME.BUFFER_HEIGHT;
    const rox = Math.floor((GAME.BUFFER_WIDTH - rw) / 2);
    const roy = Math.floor((GAME.BUFFER_HEIGHT - rh) / 2);
    if (room) {
      ctx.save();
      ctx.translate(rox, roy);
    }

    this.roomManager.render(ctx);

    for (const enemy of this.enemies) {
      if (enemy.isActive) {
        enemy.render(ctx);
      }
    }

    for (const projectile of this.projectiles) {
      if (projectile.isActive) {
        projectile.render(ctx);
      }
    }

    this.player.render(ctx);

    this.particles.render(ctx);

    if (room) {
      ctx.restore();
    }

    ctx.restore();

    if (this.callbacks.onPresentFrame && this.state !== 'MENU') {
      const w = GAME.BUFFER_WIDTH;
      const h = GAME.BUFFER_HEIGHT;
      ctx.save();
      ctx.globalCompositeOperation = 'multiply';
      // Gentle toning only; avoid crushing midtones (the WebGL pass already vignettes).
      ctx.fillStyle = 'rgba(34, 28, 48, 0.18)';
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }

    if (this.callbacks.onPresentFrame) {
      const moon = getMoonShaftForRoom(this.roomManager.currentRoomIndex);
      const showFx = this.state !== 'MENU';
      const cr = this.roomManager.currentRoom;
      const uvw = cr?.width ?? GAME.BUFFER_WIDTH;
      const uvh = cr?.height ?? GAME.BUFFER_HEIGHT;
      this.callbacks.onPresentFrame(this.ctx.canvas, {
        time: this.horrorTime,
        playerX: this.player.position.x / uvw,
        playerY: this.player.position.y / uvh,
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

  /** Dark + vignette + corner pools — no radial triangles (those read as a “star” on screen). */
  private renderHorrorOverlay(ctx: CanvasRenderingContext2D): void {
    const w = GAME.BUFFER_WIDTH;
    const h = GAME.BUFFER_HEIGHT;
    const cx = w * 0.5;
    const cy = h * 0.5;
    const maxR = Math.hypot(cx, cy);
    const t = this.ambiencePhase;

    ctx.save();

    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = 'rgba(14, 10, 24, 0.52)';
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'source-over';

    ctx.globalCompositeOperation = 'multiply';
    const cornerR = maxR * 0.72;
    const corners = [
      [0, 0],
      [w, 0],
      [0, h],
      [w, h],
    ] as const;
    for (const [kx, ky] of corners) {
      const gr = ctx.createRadialGradient(kx, ky, 0, kx, ky, cornerR);
      gr.addColorStop(0, 'rgba(0,0,0,0.45)');
      gr.addColorStop(0.45, 'rgba(0,0,0,0.16)');
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gr;
      ctx.fillRect(0, 0, w, h);
    }
    ctx.globalCompositeOperation = 'source-over';

    const lastRoom =
      this.roomManager.totalRooms > 0 &&
      this.roomManager.currentRoomIndex === this.roomManager.totalRooms - 1;
    if (lastRoom && this.state === 'PLAYING') {
      ctx.fillStyle = 'rgba(28, 2, 10, 0.38)';
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
    threat = Math.min(1, threat * 0.28);
    if (threat > 0.02) {
      ctx.fillStyle = `rgba(6, 0, 18, ${threat * 0.34})`;
      ctx.fillRect(0, 0, w, h);
    }

    const hpFrac =
      this.player.maxHealth > 0 ? this.player.health / this.player.maxHealth : 1;
    if (hpFrac < 0.38 && this.state === 'PLAYING') {
      const a = (1 - hpFrac / 0.38) * 0.32;
      ctx.fillStyle = `rgba(40, 0, 8, ${Math.min(0.52, a)})`;
      ctx.fillRect(0, 0, w, h);
    }

    const g = ctx.createRadialGradient(cx, cy, maxR * 0.06, cx, cy, maxR * 1.02);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(0.32, 'rgba(0,0,0,0.52)');
    g.addColorStop(0.58, 'rgba(0,0,0,0.78)');
    g.addColorStop(1, 'rgba(0,0,0,0.9)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = 'rgba(6, 2, 14, 0.32)';
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'source-over';

    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = 'rgba(18, 12, 28, 0.42)';
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'source-over';

    for (let i = 0; i < 72; i++) {
      const gx = (i * 9973 + Math.floor(t * 3) * 13) % w;
      const gy = (i * 7919 + Math.floor(t * 2) * 17) % h;
      ctx.fillStyle = `rgba(0,0,0,${0.04 + (i % 7) * 0.018})`;
      ctx.fillRect(gx, gy, 1, 1);
    }

    ctx.restore();
  }

  // Check if player is touching an open door and transition
  private checkDoorTransition(): void {
    const room = this.roomManager.currentRoom;
    if (!room) return;

    const door = room.getDoorAt(this.player.position);
    if (door && door.isOpen && door.targetRoom >= 0) {
      if (
        this.roomManager.currentRoomIndex === CHAPTER_1_LAST_ROOM_INDEX &&
        door.targetRoom === CHAPTER_2_FIRST_ROOM_INDEX &&
        !this.chapter2Unlocked
      ) {
        this.setState('CHAPTER_MAP');
        return;
      }
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
    const boss = enemy instanceof Broodmother || enemy instanceof TrenchMatriarch;
    let hMult = s.enemyHealthMult * (boss ? s.bossHealthMult : 1);
    let dMult = s.enemyDamageMult * (boss ? s.bossDamageMult : 1);
    if (boss && this.roomManager.currentRoomIndex === CHAPTER_1_LAST_ROOM_INDEX) {
      hMult *= s.chapter1BroodHealthFactor;
      dMult *= s.chapter1BroodDamageFactor;
    }
    if (boss && enemy instanceof Broodmother && enemy.variant === 'flooded') {
      hMult *= 1.12;
      dMult *= 1.04;
    }
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
      e =>
        e.isActive &&
        !e.markedForDeletion &&
        !(e instanceof Broodmother) &&
        !(e instanceof TrenchMatriarch)
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

  /** Letterbox offset when drawing a smaller room in the fixed buffer. */
  getRoomViewOffset(): { ox: number; oy: number } {
    const room = this.roomManager.currentRoom;
    if (!room) return { ox: 0, oy: 0 };
    return {
      ox: Math.floor((GAME.BUFFER_WIDTH - room.width) / 2),
      oy: Math.floor((GAME.BUFFER_HEIGHT - room.height) / 2),
    };
  }

  /** Mouse in room-local space (matches entity coordinates). */
  getAimMousePosition(): Vector2 {
    const { ox, oy } = this.getRoomViewOffset();
    const m = this.input.getMousePosition();
    return new Vector2(m.x - ox, m.y - oy);
  }

  // Notify UI of health change
  notifyHealthChange(): void {
    this.callbacks.onHealthChange?.(this.player.health, this.player.maxHealth);
  }

  // Notify UI of room change
  notifyRoomChange(): void {
    const room = this.roomManager.currentRoom;
    const idx = this.roomManager.currentRoomIndex;
    this.callbacks.onRoomChange?.({
      current: idx,
      total: this.roomManager.totalRooms,
      theme: room?.themeId ?? 'cellar',
      minimap: this.roomManager.minimapLayout,
      enteredRooms: this.roomManager.getEnteredRoomsSnapshot(),
      chapter: idx >= CHAPTER_2_FIRST_ROOM_INDEX ? 2 : 1,
      dash: {
        unlocked: this.player.dashUnlocked,
        stamina: this.player.dashStamina,
        max: this.player.dashStaminaMax,
      },
    });
    if (this.dev.unlocked) this.emitDevPanel();
  }

  /** Unlocks after clearing the second sector (linear dash + stamina pool). */
  unlockDash(): void {
    if (this.player.dashUnlocked) return;
    this.player.dashUnlocked = true;
    this.player.dashStamina = this.player.dashStaminaMax;
    this.notifyRoomChange();
  }

  // Show upgrade selection
  showUpgradeSelection(upgrades: Upgrade[]): void {
    this.setState('UPGRADE');
    this.callbacks.onUpgradeSelect?.(upgrades);
  }

  markChapterBridgePending(): void {
    this.chapterBridgePending = true;
  }

  /**
   * Chapter 2 entry: optional path bonus, then load first flooded sector.
   * `adaptation` — mitigation; `mutation` — offense (risk/reward).
   */
  continueToChapter2(path: 'adaptation' | 'mutation'): void {
    this.chapter2Unlocked = true;
    if (path === 'adaptation') {
      this.player.damageTakenMult *= 0.9;
      this.player.hitInvulnBonus += 0.2;
    } else {
      this.player.damage += 1;
      this.player.fireRate *= 0.92;
    }
    this.notifyHealthChange();
    const dir = this.roomManager.findDirectionToRoom(
      CHAPTER_1_LAST_ROOM_INDEX,
      CHAPTER_2_FIRST_ROOM_INDEX
    );
    this.setState('PLAYING');
    if (dir) {
      this.roomManager.transitionToRoom(CHAPTER_2_FIRST_ROOM_INDEX, dir);
    } else {
      this.roomManager.loadRoom(CHAPTER_2_FIRST_ROOM_INDEX);
    }
  }

  // Apply selected upgrade
  applyUpgrade(upgrade: Upgrade): void {
    AudioManager.play('SFX_UPGRADE');
    upgrade.apply(this.player);
    this.notifyHealthChange();
    const bridge = this.chapterBridgePending;
    this.chapterBridgePending = false;
    if (bridge) {
      this.setState('CHAPTER_MAP');
      return;
    }
    this.setState('PLAYING');
  }

  onEnemyKilled(): void {
    this.player.onEnemyKilled();
  }
}
