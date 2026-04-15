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

/** Seconds; first visit Broodmother (sector 12) only. */
const BOSS_INTRO_BROODMOTHER_TOTAL = 4.92;
/** Seconds; final Trench Matriarch room. */
const BOSS_INTRO_MATRIARCH_TOTAL = 5.42;
/** Wall-clock seconds for each intro stinger (same index = both bosses). */
const BOSS_INTRO_BROOD_CUES = [0, 0.3, 0.86, 1.52, 2.32, 3.18] as const;
const BOSS_INTRO_MAT_CUES = [0, 0.42, 1.08, 1.85, 2.78, 3.68] as const;

/** Sector 0 run start — zoom on Bit, storyline captions, synth audio. */
const SECTOR0_INTRO_LINES = [
  'TINY HEART BEHIND COLD VARNISH.',
  'THE SILK DOES NOT FORGET WHAT YOU WILL BECOME.',
  'EACH CORNER HOLDS A MEMORY YOU HAVE NOT LIVED.',
  'THE BOX ONLY OPENS ONE WAY.',
] as const;
const SECTOR0_ZOOM_IN_SEC = 1.05;
/** Brief beat at max zoom after the last caption character before easing out. */
const SECTOR0_POST_STORY_HOLD_SEC = 0.55;
/** Longer zoom-out with smooth easing (avoids an abrupt snap to gameplay scale). */
const SECTOR0_ZOOM_OUT_SEC = 2.35;
const SECTOR0_CHARS_PER_SEC = 12.5;
const SECTOR0_LINE_PAUSE_SEC = 0.78;
const SECTOR0_MAX_ZOOM = 4.25;
/** Hold Space this long to skip the sector-0 intro. */
const SECTOR0_SKIP_HOLD_SEC = 0.72;
/** Keep the final caption visible briefly after it finishes typing. */
const SECTOR0_CAPTION_LINGER_SEC = 1.25;
/** Fade captions out slowly after linger. */
const SECTOR0_CAPTION_FADE_SEC = 1.1;
/** After intro ends, keep overlay briefly to slide/fade smoothly. */
const SECTOR0_OUTRO_SEC = 0.85;

const SECTOR0_DIALOGUE_VARIANTS: readonly (readonly string[])[] = [
  [
    'TINY HEART BEHIND COLD VARNISH.',
    'THE SILK DOES NOT FORGET WHAT YOU WILL BECOME.',
    'EACH CORNER HOLDS A MEMORY YOU HAVE NOT LIVED.',
    'THE BOX ONLY OPENS ONE WAY.',
  ],
  [
    'SMALL LIGHT IN A THICK ROOM.',
    'THE SILK REMEMBERS YOUR NAME.',
    'EVERY CORNER HIDES A FUTURE YOU DID NOT CHOOSE.',
    'THE LID CLOSES FROM THE INSIDE.',
  ],
  [
    'WHITE SPECK. HEAVY AIR.',
    'THE THREADS WAIT. PATIENT.',
    'THE BOX LEARNS YOU BY HEART.',
    'WALK FORWARD. DO NOT TURN.',
  ],
] as const;

/** Aligns with `menuTheme` MENU — caption bar matches main menu / HUD browns. */
const SECTOR0_CAPTION = {
  bar: '#100a0c',
  rim: '#2a1818',
  rimHi: '#3a2828',
  text: '#c4b8a8',
  textDim: '#8a7a70',
  textShadow: '#0a0606',
} as const;
const CANVAS_UI_FONT = 'ui-monospace, "Cascadia Mono", Consolas, monospace';

function sector0ZoomOutEnd(storyEnd: number): number {
  return storyEnd + SECTOR0_POST_STORY_HOLD_SEC + SECTOR0_ZOOM_OUT_SEC;
}

function sector0StoryDurationSec(lines: readonly string[] = SECTOR0_INTRO_LINES): number {
  let d = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    d += line.length / SECTOR0_CHARS_PER_SEC;
    if (i < lines.length - 1) {
      d += SECTOR0_LINE_PAUSE_SEC;
    }
  }
  return d;
}

type Sector0Reveal = {
  lineIdx: number;
  current: string;
  totalCharsRevealed: number;
};

function sector0RevealAt(
  storyTime: number,
  lines: readonly string[] = SECTOR0_INTRO_LINES
): Sector0Reveal {
  let t = Math.max(0, storyTime);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const revealDur = line.length / SECTOR0_CHARS_PER_SEC;
    if (t <= revealDur) {
      const nc = Math.min(line.length, Math.floor(t * SECTOR0_CHARS_PER_SEC + 0.0001));
      let tc = 0;
      for (let j = 0; j < i; j++) {
        tc += lines[j]!.length;
      }
      tc += nc;
      return { lineIdx: i, current: line.slice(0, nc), totalCharsRevealed: tc };
    }
    t -= revealDur;
    if (i < lines.length - 1) {
      if (t <= SECTOR0_LINE_PAUSE_SEC) {
        let tc = 0;
        for (let j = 0; j <= i; j++) {
          tc += lines[j]!.length;
        }
        return { lineIdx: i, current: line, totalCharsRevealed: tc };
      }
      t -= SECTOR0_LINE_PAUSE_SEC;
    }
  }
  let tc = 0;
  for (const ln of lines) {
    tc += ln.length;
  }
  return {
    lineIdx: lines.length - 1,
    current: lines[lines.length - 1]!,
    totalCharsRevealed: tc,
  };
}

function pickSector0IntroLines(seed: number): readonly string[] {
  const v = SECTOR0_DIALOGUE_VARIANTS;
  const idx = Math.abs((seed | 0) ^ ((seed >>> 11) | 0)) % v.length;
  return v[idx] ?? v[0]!;
}

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
  /** First room intro: suppress React HUD until story + zoom resolve. */
  onSector0Intro?: (active: boolean) => void;
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
  private runSeed: number = 0;
  private dev = {
    unlocked: false,
    panelOpen: false,
    godMode: false,
  };

  /** After sector 12 upgrade, show chapter map instead of PLAYING. */
  private chapterBridgePending = false;
  private chapter2Unlocked = false;

  /** Cinematic beat before boss AI engages (sector 12 Broodmother + finale Matriarch). */
  private bossIntro: null | {
    kind: 'broodmother' | 'matriarch';
    t: number;
    fired: Set<number>;
  } = null;

  /** Sector 0 opening: set once per `prepareNewRun`; cleared after first-room intro plays. */
  private sector0IntroPending = false;
  private sector0Intro: null | {
    t: number;
    prevCharCount: number;
    whimperAcc: number;
    whimperNext: number;
    skipHoldAccum: number;
    lines: readonly string[];
  } = null;
  /** After intro ends: smooth vignette fade + caption slide-out. */
  private sector0IntroOutro: null | { t: number; text: string } = null;

  /** Tear puddle under Bit (world-space), persists after intro. 0–1. */
  private sector0TearPuddle = 0;
  private sector0TearPuddlePos: Vector2 | null = null;
  private sector0TearPuddleRoomIndex: number = -1;

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
    this.beginSector0IntroIfPending();
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
    this.beginSector0IntroIfPending();
    this.lastTime = performance.now();
    this.loop();
  }

  private prepareNewRun(): void {
    if (this.sector0Intro) {
      this.callbacks.onSector0Intro?.(false);
    }
    this.sector0Intro = null;
    this.sector0IntroOutro = null;
    this.sector0IntroPending = true;
    this.sector0TearPuddle = 0;
    this.sector0TearPuddlePos = null;
    this.sector0TearPuddleRoomIndex = -1;
    this.chapterBridgePending = false;
    this.chapter2Unlocked = false;
    this.bossIntro = null;
    this.stop();
    this.hiveMindRegistry.clear();
    this.entities = [];
    this.projectiles = [];
    this.enemies = [];
    this.particles.clear();
    this.runSeed = Game.rollRunSeed();
    this.roomManager.rebuildRun(this.runSeed);
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

    if (newState === 'MENU' && this.sector0Intro) {
      this.sector0Intro = null;
      this.sector0IntroOutro = null;
      this.callbacks.onSector0Intro?.(false);
    }

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

    if (this.bossIntro) {
      this.updateBossIntro(deltaTime);
    }

    if (this.sector0Intro) {
      this.updateSector0Intro(deltaTime);
    }
    if (this.sector0IntroOutro) {
      this.sector0IntroOutro.t += deltaTime;
      if (this.sector0IntroOutro.t >= SECTOR0_OUTRO_SEC) {
        this.sector0IntroOutro = null;
      }
    }

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
      if (!enemy.isActive) continue;
      if (
        this.bossIntro &&
        (enemy instanceof Broodmother || enemy instanceof TrenchMatriarch)
      ) {
        continue;
      }
      enemy.update(deltaTime);
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
    if (!this.bossIntro && !this.sector0Intro) {
      this.checkDoorTransition();
    }

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

  isBossIntroPlaying(): boolean {
    return this.bossIntro !== null;
  }

  isCinematicIntroPlaying(): boolean {
    return this.bossIntro !== null || this.sector0Intro !== null;
  }

  /** Sector 0 story + zoom (after new run loads room 0). */
  beginSector0IntroIfPending(): void {
    if (!this.sector0IntroPending) return;
    if (this.roomManager.currentRoomIndex !== 0) return;
    this.sector0IntroPending = false;
    this.sector0Intro = {
      t: 0,
      prevCharCount: 0,
      whimperAcc: 0,
      whimperNext: 0.32,
      skipHoldAccum: 0,
      lines: pickSector0IntroLines(this.runSeed),
    };
    this.callbacks.onSector0Intro?.(true);
  }

  private finishSector0Intro(): void {
    if (!this.sector0Intro) return;
    // Capture the final caption so the UI can slide/fade away smoothly into gameplay.
    const lines = this.sector0Intro.lines;
    const sd = sector0StoryDurationSec(lines);
    const last = sector0RevealAt(sd, lines).current || ' ';
    this.sector0IntroOutro = { t: 0, text: last };
    this.sector0Intro = null;
    this.callbacks.onSector0Intro?.(false);
    this.player.grantSpawnProtection(0.9);
  }

  private updateSector0Intro(deltaTime: number): void {
    if (!this.sector0Intro || this.state !== 'PLAYING') return;
    const s = this.sector0Intro;
    s.t += deltaTime;
    const lines = s.lines;
    const zis = SECTOR0_ZOOM_IN_SEC;
    const sd = sector0StoryDurationSec(lines);
    const storyEnd = zis + sd;
    const zoomOutEnd = sector0ZoomOutEnd(storyEnd);

    if (this.input.isKeyDown(' ')) {
      s.skipHoldAccum += deltaTime;
      if (s.skipHoldAccum >= SECTOR0_SKIP_HOLD_SEC) {
        this.finishSector0Intro();
        return;
      }
    } else {
      s.skipHoldAccum = 0;
    }

    if (s.t >= zis && s.t < storyEnd) {
      const reveal = sector0RevealAt(s.t - zis, lines);
      const n = reveal.totalCharsRevealed;
      if (n > s.prevCharCount) {
        for (let k = s.prevCharCount; k < n; k++) {
          AudioManager.playSector0IntroTextBlip();
        }
        s.prevCharCount = n;
      }
    }

    // Grow tear puddle under Bit while crying; persists after the cutscene.
    if (this.shouldShowSector0Crying()) {
      this.sector0TearPuddle = Math.min(1, this.sector0TearPuddle + deltaTime * 0.065);
      if (!this.sector0TearPuddlePos && this.sector0TearPuddle >= 0.02) {
        this.sector0TearPuddlePos = this.player.position.clone();
        this.sector0TearPuddleRoomIndex = this.roomManager.currentRoomIndex;
      }
    }

    // Bit keeps whimpering through the full intro timeline.
    s.whimperAcc += deltaTime;
    if (s.whimperAcc >= s.whimperNext) {
      s.whimperAcc = 0;
      s.whimperNext = 0.42 + Math.random() * 0.28;
      AudioManager.playSector0IntroScaredWhimper();
    }

    if (s.t >= zoomOutEnd) {
      this.finishSector0Intro();
    }
  }

  private getSector0IntroZoom(): number {
    if (!this.sector0Intro) return 1;
    const st = this.sector0Intro.t;
    const lines = this.sector0Intro.lines;
    const zis = SECTOR0_ZOOM_IN_SEC;
    const sd = sector0StoryDurationSec(lines);
    const storyEnd = zis + sd;
    const holdEnd = storyEnd + SECTOR0_POST_STORY_HOLD_SEC;
    const outEnd = sector0ZoomOutEnd(storyEnd);
    const max = SECTOR0_MAX_ZOOM;
    if (st < zis) {
      const u = st / zis;
      const e = 1 - (1 - u) ** 2.35;
      return 1 + (max - 1) * e;
    }
    if (st < storyEnd) {
      return max + Math.sin(st * 2.05) * 0.018;
    }
    if (st < holdEnd) {
      return max + Math.sin(st * 2.4) * 0.012;
    }
    if (st < outEnd) {
      const u = (st - holdEnd) / SECTOR0_ZOOM_OUT_SEC;
      const sm = u * u * (3 - 2 * u);
      return 1 + (max - 1) * (1 - sm);
    }
    return 1;
  }

  private shouldShowSector0Crying(): boolean {
    if (!this.sector0Intro) return false;
    const storyEnd = SECTOR0_ZOOM_IN_SEC + sector0StoryDurationSec(this.sector0Intro.lines);
    return this.sector0Intro.t < storyEnd + SECTOR0_CAPTION_LINGER_SEC;
  }

  /** Vignette + captions; must draw before WebGL `present` so text is visible on screen. */
  private renderSector0IntroScreenFX(ctx: CanvasRenderingContext2D): void {
    if (!this.sector0Intro && !this.sector0IntroOutro) return;
    this.renderSector0IntroVignette(ctx);
    this.renderSector0SkipHint(ctx);
    this.renderSector0IntroCaptions(ctx);
  }

  private renderSector0SkipHint(ctx: CanvasRenderingContext2D): void {
    const s = this.sector0Intro;
    if (!s) return;
    const w = GAME.BUFFER_WIDTH;
    ctx.save();
    ctx.font = `bold 8px ${CANVAS_UI_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const label = 'HOLD SPACE TO SKIP';
    const x = w * 0.5;
    const y = 5;
    const bw = 96;
    const bh = 4;
    ctx.lineWidth = 3;
    ctx.strokeStyle = SECTOR0_CAPTION.textShadow;
    ctx.strokeText(label, x, y);
    ctx.fillStyle = SECTOR0_CAPTION.textDim;
    ctx.fillText(label, x, y);
    const p = Math.min(1, s.skipHoldAccum / SECTOR0_SKIP_HOLD_SEC);
    ctx.fillStyle = SECTOR0_CAPTION.rim;
    ctx.fillRect(x - bw * 0.5, y + 10, bw * p, bh);
    ctx.strokeStyle = SECTOR0_CAPTION.rimHi;
    ctx.globalAlpha = 0.7;
    ctx.strokeRect(x - bw * 0.5, y + 10, bw, bh);
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  private renderSector0IntroVignette(ctx: CanvasRenderingContext2D): void {
    if (!this.sector0Intro && !this.sector0IntroOutro) return;
    const st = this.sector0Intro ? this.sector0Intro.t : 0;
    const zis = SECTOR0_ZOOM_IN_SEC;
    const lines = this.sector0Intro?.lines ?? SECTOR0_INTRO_LINES;
    const sd = sector0StoryDurationSec(lines);
    const storyEnd = zis + sd;
    const zoomOutEnd = sector0ZoomOutEnd(storyEnd);
    if (this.sector0Intro && st >= zoomOutEnd) return;

    const w = GAME.BUFFER_WIDTH;
    const h = GAME.BUFFER_HEIGHT;
    const holdEnd = storyEnd + SECTOR0_POST_STORY_HOLD_SEC;
    let edge = 0.38;
    if (st < zis) {
      edge = 0.28 + 0.22 * (st / zis);
    } else if (st < storyEnd) {
      edge = 0.58 + Math.sin(st * 2.05) * 0.06;
    } else if (st < holdEnd) {
      edge = 0.58 + Math.sin(st * 2.2) * 0.04;
    } else {
      const u = (st - holdEnd) / SECTOR0_ZOOM_OUT_SEC;
      const sm = u * u * (3 - 2 * u);
      edge = 0.58 * (1 - sm);
    }

    const outro = this.sector0IntroOutro;
    if (outro) {
      const u = Math.max(0, Math.min(1, outro.t / SECTOR0_OUTRO_SEC));
      const sm = u * u * (3 - 2 * u);
      edge *= 1 - sm;
    }

    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    const cx = w * 0.5;
    const cy = h * 0.5;
    const gr = ctx.createRadialGradient(cx, cy, 18, cx, cy, Math.hypot(w, h) * 0.72);
    gr.addColorStop(0, 'rgba(8, 4, 14, 0)');
    gr.addColorStop(0.55, `rgba(5, 2, 10, ${edge * 0.45})`);
    gr.addColorStop(1, `rgba(0, 0, 0, ${edge})`);
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, w, h);

    const q = 0.22 * edge;
    const corners = [
      [0, 0],
      [w, 0],
      [0, h],
      [w, h],
    ] as const;
    for (const [kx, ky] of corners) {
      const cgr = ctx.createRadialGradient(kx, ky, 0, kx, ky, Math.hypot(w, h) * 0.5);
      cgr.addColorStop(0, `rgba(0,0,0,${q * 1.4})`);
      cgr.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = cgr;
      ctx.fillRect(0, 0, w, h);
    }
    ctx.restore();
  }

  private renderSector0IntroCaptions(ctx: CanvasRenderingContext2D): void {
    const w = GAME.BUFFER_WIDTH;
    const h = GAME.BUFFER_HEIGHT;
    const barH = 44;
    const intro = this.sector0Intro;
    const outro = this.sector0IntroOutro;
    if (!intro && !outro) return;

    let text = ' ';
    let fadeP = 1;
    let slideP = 0;
    if (intro) {
      const st = intro.t;
      const lines = intro.lines;
      const zis = SECTOR0_ZOOM_IN_SEC;
      const sd = sector0StoryDurationSec(lines);
      const storyEnd = zis + sd;
      const lingerEnd = storyEnd + SECTOR0_CAPTION_LINGER_SEC;
      const fadeEnd = lingerEnd + SECTOR0_CAPTION_FADE_SEC;
      if (st < zis || st >= fadeEnd) return;
      const reveal = sector0RevealAt(Math.min(sd, st - zis), lines);
      text = reveal.current || ' ';
      fadeP =
        st <= lingerEnd ? 1 : Math.max(0, 1 - (st - lingerEnd) / SECTOR0_CAPTION_FADE_SEC);
    } else if (outro) {
      const u = Math.max(0, Math.min(1, outro.t / SECTOR0_OUTRO_SEC));
      const sm = u * u * (3 - 2 * u);
      fadeP = 1 - sm;
      const overshoot = Math.sin(u * Math.PI) * (1 - u);
      slideP = sm + overshoot * 0.12;
      text = outro.text || ' ';
    }
    ctx.save();
    ctx.fillStyle = SECTOR0_CAPTION.bar;
    const y0 = h - barH;
    const y = y0 + slideP * (barH + 14);
    ctx.globalAlpha = 0.92 * fadeP;
    ctx.fillRect(0, y, w, barH);
    ctx.strokeStyle = SECTOR0_CAPTION.rim;
    ctx.lineWidth = 1;
    ctx.strokeRect(1, y + 1, w - 2, barH - 2);
    ctx.strokeStyle = SECTOR0_CAPTION.rimHi;
    ctx.globalAlpha = 0.35;
    ctx.beginPath();
    ctx.moveTo(2, y + 2);
    ctx.lineTo(w - 2, y + 2);
    ctx.stroke();
    ctx.globalAlpha = 1;

    ctx.font = `bold 8px ${CANVAS_UI_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const ty = y + barH * 0.5;
    const flicker = 0.94 + 0.04 * Math.sin(this.ambiencePhase * 2.8);
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = SECTOR0_CAPTION.textShadow;
    ctx.globalAlpha = Math.min(1, flicker) * fadeP;
    ctx.strokeText(text, w * 0.5, ty);
    ctx.fillStyle = SECTOR0_CAPTION.text;
    ctx.globalAlpha = Math.min(1, flicker) * fadeP;
    ctx.fillText(text, w * 0.5, ty);
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  /** Called from `RoomManager` on first combat entry to sector 12 or the finale boss room. */
  beginBossIntroIfNeeded(roomIndex: number, room: Room): void {
    if (this.state !== 'PLAYING') return;
    const sectorBrood =
      roomIndex === CHAPTER_1_LAST_ROOM_INDEX &&
      room.spawns.some((s) => s.enemyType === 'broodmother');
    const finaleMat = room.isBossRoom;
    if (!sectorBrood && !finaleMat) return;
    this.bossIntro = {
      kind: finaleMat ? 'matriarch' : 'broodmother',
      t: 0,
      fired: new Set(),
    };
    this.player.grantSpawnProtection(
      Math.max(BOSS_INTRO_BROODMOTHER_TOTAL, BOSS_INTRO_MATRIARCH_TOTAL) + 0.45
    );
    if (sectorBrood) {
      void AudioManager.playMusic('MUSIC_BOSS');
    }
  }

  private updateBossIntro(deltaTime: number): void {
    if (!this.bossIntro) return;
    const bi = this.bossIntro;
    bi.t += deltaTime;
    const cues =
      bi.kind === 'broodmother' ? BOSS_INTRO_BROOD_CUES : BOSS_INTRO_MAT_CUES;
    const total =
      bi.kind === 'broodmother'
        ? BOSS_INTRO_BROODMOTHER_TOTAL
        : BOSS_INTRO_MATRIARCH_TOTAL;

    for (let i = 0; i < cues.length; i++) {
      const tCue = cues[i]!;
      if (bi.t >= tCue && !bi.fired.has(i)) {
        bi.fired.add(i);
        if (bi.kind === 'broodmother') {
          AudioManager.playBossIntroBroodmotherCue(i);
          if (i === 4) this.shake(9);
        } else {
          AudioManager.playBossIntroMatriarchCue(i);
          if (i === 4) this.shake(12);
        }
      }
    }

    if (bi.t >= total) {
      this.bossIntro = null;
    }
  }

  private renderBossIntroOverlay(ctx: CanvasRenderingContext2D): void {
    if (!this.bossIntro) return;
    const w = GAME.BUFFER_WIDTH;
    const h = GAME.BUFFER_HEIGHT;
    const dur =
      this.bossIntro.kind === 'broodmother'
        ? BOSS_INTRO_BROODMOTHER_TOTAL
        : BOSS_INTRO_MATRIARCH_TOTAL;
    const p = Math.min(1, this.bossIntro.t / dur);
    ctx.save();
    const bar = 15 + Math.floor(p * 5);
    ctx.fillStyle = 'rgba(0,0,0,0.9)';
    ctx.fillRect(0, 0, w, bar);
    ctx.fillRect(0, h - bar, w, bar);
    const title =
      this.bossIntro.kind === 'broodmother' ? 'BROODMOTHER' : 'TRENCH MATRIARCH';
    ctx.font = `bold 9px ${CANVAS_UI_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = `rgba(230, 210, 255, ${0.42 + 0.38 * Math.sin(this.ambiencePhase * 2.2)})`;
    ctx.fillText(title, w * 0.5, bar * 0.5 + 1);
    const subtitle = this.bossIntro.kind === 'broodmother' ? 'SECTOR 12' : 'ABYSS';
    ctx.font = `6px ${CANVAS_UI_FONT}`;
    ctx.fillStyle = 'rgba(160, 150, 190, 0.55)';
    ctx.fillText(subtitle, w * 0.5, h - bar * 0.5 + 1);
    ctx.restore();
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

    if (this.sector0Intro) {
      const px = rox + this.player.position.x;
      const py = roy + this.player.position.y;
      const zIntro = this.getSector0IntroZoom();
      const cx = GAME.BUFFER_WIDTH * 0.5;
      const cy = GAME.BUFFER_HEIGHT * 0.5;
      // Cinematic camera: keep Bit centered while zooming.
      ctx.translate(cx, cy);
      ctx.scale(zIntro, zIntro);
      ctx.translate(-px, -py);
    }

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

    // World-space puddle so it doesn't shake with the player's intro jitter.
    if (
      this.sector0TearPuddle > 0.01 &&
      this.sector0TearPuddlePos &&
      this.roomManager.currentRoomIndex === this.sector0TearPuddleRoomIndex
    ) {
      this.renderSector0TearPuddle(ctx);
    }

    this.player.render(ctx, {
      crying: this.shouldShowSector0Crying(),
      sector0IntroT: this.sector0Intro ? this.sector0Intro.t : undefined,
    });

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

    // Drawn into the buffer before WebGL samples it (otherwise captions / boss bars are invisible).
    if (this.state === 'PLAYING' && (this.sector0Intro || this.sector0IntroOutro)) {
      this.renderSector0IntroScreenFX(ctx);
    }
    if (this.state === 'PLAYING' && this.bossIntro) {
      this.renderBossIntroOverlay(ctx);
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

  private renderSector0TearPuddle(ctx: CanvasRenderingContext2D): void {
    const p = Math.max(0, Math.min(1, this.sector0TearPuddle));
    const k = Math.floor(p * 7);
    if (k <= 0) return;
    const pos = this.sector0TearPuddlePos;
    if (!pos) return;
    const px = Math.round(pos.x);
    const py = Math.round(pos.y);
    const baseY = py + 6;
    ctx.save();
    ctx.fillStyle = `rgba(160, 215, 255, ${0.10 + p * 0.22})`;
    if (k >= 1) ctx.fillRect(px - 1, baseY, 1, 1);
    if (k >= 2) ctx.fillRect(px + 0, baseY, 1, 1);
    if (k >= 3) ctx.fillRect(px + 1, baseY, 1, 1);
    if (k >= 4) ctx.fillRect(px - 2, baseY + 1, 1, 1);
    if (k >= 5) ctx.fillRect(px + 2, baseY + 1, 1, 1);
    if (k >= 6) ctx.fillRect(px - 1, baseY + 1, 1, 1);
    if (k >= 7) ctx.fillRect(px + 1, baseY + 1, 1, 1);
    ctx.restore();
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
