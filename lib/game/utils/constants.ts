// Game rendering
export const GAME = {
  /** Legacy viewport size (pre–letterbox expansion). */
  NATIVE_WIDTH: 240,
  NATIVE_HEIGHT: 160,
  /** Fixed 2D buffer; rooms are drawn letterboxed inside this area. */
  BUFFER_WIDTH: 352,
  BUFFER_HEIGHT: 208,
  SCALE: 4,
  get DISPLAY_WIDTH() { return this.BUFFER_WIDTH * this.SCALE; },
  get DISPLAY_HEIGHT() { return this.BUFFER_HEIGHT * this.SCALE; },
  FPS_TARGET: 60,
} as const;

// Player settings
export const PLAYER = {
  SIZE: 8,
  SPEED: 60, // pixels per second
  FIRE_RATE: 0.58, // seconds between shots (higher = slower; tuned vs enemy HP)
  DAMAGE: 1,
  MAX_HEALTH: 3,
  INVULN_TIME: 1.0, // seconds of invincibility after hit
  ACCELERATION: 400, // how fast player reaches max speed
  FRICTION: 10, // how fast player slows down
  /** Shift-dash burst (seconds); full invuln for this window. */
  DASH_BURST_SEC: 0.11,
  DASH_SPEED_MULT: 3.05,
  /** Stamina units per dash (integer-ish pool). */
  DASH_STAMINA_COST: 1,
  DASH_STAMINA_MAX_BASE: 1,
  DASH_REGEN_PER_SEC: 0.2,
  DASH_COOLDOWN_SEC: 0.44,
  /** Max stamina from upgrades (base + upgrades). */
  DASH_STAMINA_CAP: 4,
} as const;

/** Selected from main menu; scales enemies, player fire cadence, and spawn safety. */
export type Difficulty = 'easy' | 'medium' | 'hard';

export const DIFFICULTY_DEFAULT: Difficulty = 'medium';

export const DIFFICULTY_SETTINGS: Record<
  Difficulty,
  {
    enemyHealthMult: number;
    enemyDamageMult: number;
    /** Multiplies enemy move speed after spawn (chase, kite, wander). */
    enemySpeedMult: number;
    /** Extra multiplier on Broodmother HP (stacks with enemyHealthMult). */
    bossHealthMult: number;
    /** Extra multiplier on Broodmother damage (stacks with enemyDamageMult). */
    bossDamageMult: number;
    /** Chapter 1 Broodmother (sector 12) only — stacks on boss mult; lower = easier. */
    chapter1BroodHealthFactor: number;
    chapter1BroodDamageFactor: number;
    /** Multiplies seconds-between-shots; lower = faster shooting for the player. */
    playerFireRateMult: number;
    spawnProtectionSec: number;
  }
> = {
  easy: {
    enemyHealthMult: 0.82,
    enemyDamageMult: 0.78,
    enemySpeedMult: 1,
    bossHealthMult: 0.72,
    bossDamageMult: 0.8,
    chapter1BroodHealthFactor: 0.5,
    chapter1BroodDamageFactor: 0.72,
    playerFireRateMult: 0.88,
    spawnProtectionSec: 3.0,
  },
  medium: {
    enemyHealthMult: 1,
    enemyDamageMult: 1,
    enemySpeedMult: 1,
    bossHealthMult: 1,
    bossDamageMult: 1,
    chapter1BroodHealthFactor: 0.78,
    chapter1BroodDamageFactor: 0.9,
    playerFireRateMult: 1,
    spawnProtectionSec: 2.45,
  },
  hard: {
    enemyHealthMult: 1.28,
    enemyDamageMult: 1.25,
    enemySpeedMult: 1.09,
    bossHealthMult: 1.42,
    bossDamageMult: 1.18,
    chapter1BroodHealthFactor: 1,
    chapter1BroodDamageFactor: 1.06,
    playerFireRateMult: 1.12,
    spawnProtectionSec: 1.85,
  },
};

/** Hard-only coordinated AI: ring slots (see `HiveMind.ts`). */
export const HIVE_MIND_HARD = {
  RING_CHASE: 44,
  /** When the player is nearly still, melee hive ring shrinks toward the player. */
  RING_CHASE_CLOSE: 22,
  RING_WANDER: 62,
  /** Light prediction for kiters only (px); chase uses actual player pos to avoid “dancing”. */
  KITE_PREDICT_SEC: 0.1,
  /** Player speed (px/s) for ring-radius lerp (still vs moving). */
  SPIN_RAMP_SPEED: 36,
  /** Weight of hive *tangential* spread while chasing; most of the vector stays toward the player. */
  CHASE_BLEND: 0.24,
  KITE_BLEND: 0.26,
  WANDER_BLEND: 0.22,
  WEB_WANDER_BLEND: 0.34,
  SKITTER_JITTER: 0.14,
  DASHER_LEAD_SEC: 0.06,
} as const;

// Projectile settings
export const PROJECTILE = {
  PLAYER_SPEED: 150,
  ENEMY_SPEED: 80,
  SIZE: 3,
  LIFETIME: 3, // seconds before despawn
} as const;

// Enemy configurations (health tuned for slower player fire rate and longer runs)
export const ENEMY = {
  SPIDER: {
    size: 10,
    speed: 38,
    health: 7,
    damage: 1,
    chaseRange: 80,
  },
  SPITTER: {
    size: 12,
    speed: 20,
    health: 10,
    damage: 1,
    range: 100,
    fireRate: 1.75,
    preferredDistance: 60,
  },
  DASHER: {
    size: 8,
    speed: 30,
    dashSpeed: 150,
    health: 9,
    damage: 1,
    chargeTime: 1.45,
    dashDuration: 0.28,
  },
  WEBSPINNER: {
    size: 14,
    speed: 15,
    health: 12,
    damage: 1,
    webCooldown: 3.0,
  },
  BRUTE: {
    size: 18,
    speed: 22,
    health: 22,
    damage: 2,
    chaseRange: 130,
  },
  SKITTER: {
    size: 7,
    speed: 56,
    health: 5,
    damage: 1,
    chaseRange: 125,
  },
  WIDOW: {
    size: 11,
    speed: 19,
    health: 14,
    damage: 1,
    range: 105,
    preferredDistance: 72,
    burstCount: 3,
    burstSpacing: 0.2,
    burstCooldown: 2.65,
    projectileSpeed: 76,
  },
  TOXIC_SPITTER: {
    size: 12,
    speed: 23,
    health: 12,
    damage: 1,
    range: 108,
    fireRate: 1.45,
    preferredDistance: 66,
  },
  TIDECRAWLER: {
    size: 9,
    speed: 34,
    burstSpeed: 128,
    health: 10,
    damage: 1,
    chaseRange: 135,
    surgeCooldown: 2.2,
    surgeDuration: 0.32,
  },
  /** Fast shoreline skirmisher — chapter 2. */
  GILL_STALKER: {
    size: 8,
    speed: 32,
    dashSpeed: 138,
    health: 8,
    damage: 1,
    chargeTime: 1.35,
    dashDuration: 0.26,
  },
  /** Glassy minnow pack — chapter 2. */
  MURK_LEECH: {
    size: 7,
    speed: 58,
    health: 5,
    damage: 1,
    chaseRange: 128,
  },
  /** Shore crab — chapter 2 skirmisher. */
  BRINE_SCUTTLER: {
    size: 10,
    speed: 29,
    health: 11,
    damage: 1,
    chaseRange: 118,
    surgeCooldown: 2.35,
    surgeDuration: 0.24,
    burstSpeed: 118,
  },
  BROODMOTHER: {
    size: 32,
    speed: 22,
    health: 280,
    damage: 2,
    spawnCooldown: 4.0,
  },
  /** Flooded abyss finale (chapter 2). */
  TRENCH_MATRIARCH: {
    size: 28,
    speed: 21,
    health: 300,
    damage: 2,
    spawnCooldown: 4.0,
  },
} as const;

// Room settings
export const ROOM = {
  WIDTH: GAME.BUFFER_WIDTH,
  HEIGHT: GAME.BUFFER_HEIGHT,
  WALL_THICKNESS: 8,
  DOOR_WIDTH: 24,
  DOOR_HEIGHT: 8,
} as const;

/** Minimum spawn shield on any combat room entry (seconds); difficulty can add more on top. */
export const SPAWN_PROTECTION_MIN_SEC = 2.85;

export type RoomThemeId =
  | 'cellar'
  | 'moss'
  | 'ash'
  | 'deep'
  | 'rust'
  | 'flooded'
  | 'toxicworks';

export const ROOM_THEME_PALETTES: Record<
  RoomThemeId,
  {
    floor: string;
    floorAccent: string;
    wall: string;
    wallDark: string;
    obstacle: string;
    obstacleTop: string;
  }
> = {
  cellar: {
    floor: '#2a1e16',
    floorAccent: '#35261c',
    wall: '#443028',
    wallDark: '#1c1410',
    obstacle: '#35261c',
    obstacleTop: '#4a3828',
  },
  moss: {
    floor: '#1e2820',
    floorAccent: '#263228',
    wall: '#384238',
    wallDark: '#121810',
    obstacle: '#2d3a2e',
    obstacleTop: '#3d4a3e',
  },
  ash: {
    floor: '#282420',
    floorAccent: '#302c26',
    wall: '#454038',
    wallDark: '#181610',
    obstacle: '#383228',
    obstacleTop: '#4a4238',
  },
  deep: {
    floor: '#181420',
    floorAccent: '#221c2a',
    wall: '#342e3a',
    wallDark: '#0e0c12',
    obstacle: '#282030',
    obstacleTop: '#383044',
  },
  rust: {
    floor: '#2e1e18',
    floorAccent: '#38241c',
    wall: '#523428',
    wallDark: '#201410',
    obstacle: '#442c20',
    obstacleTop: '#5a3828',
  },
  flooded: {
    floor: '#11242b',
    floorAccent: '#1a3640',
    wall: '#1d3c46',
    wallDark: '#08161a',
    obstacle: '#204650',
    obstacleTop: '#2d5b66',
  },
  toxicworks: {
    floor: '#1f2a1a',
    floorAccent: '#2b3a22',
    wall: '#3a4d28',
    wallDark: '#12190d',
    obstacle: '#3a4f2a',
    obstacleTop: '#4f6a38',
  },
};

// Colors (limited palette for pixel art look)
export const COLORS = {
  // Background & walls
  FLOOR: '#2a1e16',
  WALL: '#443028',
  WALL_DARK: '#1c1410',
  DOOR_CLOSED: '#5a0808',
  DOOR_OPEN: '#0a0a0c',
  
  // Player
  PLAYER_BODY: '#ffffff',
  PLAYER_OUTLINE: '#000000',
  PLAYER_HURT: '#ff6666',
  
  // Enemies
  SPIDER_BODY: '#4a0e0e',
  SPIDER_LEGS: '#2d0808',
  SPIDER_EYES: '#ff0000',
  SPITTER_BODY: '#2d4a0e',
  DASHER_BODY: '#4a0e4a',
  WEBSPINNER_BODY: '#3d3d3d',
  BROODMOTHER_BODY: '#1a0505',
  BRUTE_BODY: '#3d2818',
  BRUTE_SHELL: '#5c3d22',
  BRUTE_LEGS: '#1f140c',
  SKITTER_BODY: '#5c1818',
  SKITTER_ABDOMEN: '#3d1010',
  SKITTER_LEGS: '#2a0a0a',
  SKITTER_EYES: '#ffaa00',
  WIDOW_BODY: '#1a0a28',
  WIDOW_ABDOMEN: '#2a1040',
  WIDOW_LEGS: '#0d0514',
  WIDOW_EYES: '#cc00ff',
  TOXIC_SPITTER_BODY: '#2e5f2d',
  TOXIC_SPITTER_GLAND: '#8adf41',
  TIDECRAWLER_BODY: '#1f5260',
  TIDECRAWLER_ABDOMEN: '#2d7a8f',
  TIDECRAWLER_EYES: '#9af0ff',
  GILL_STALKER_BODY: '#2a6b75',
  MURK_LEECH_BODY: '#3d3048',
  MURK_LEECH_EYES: '#66ffcc',
  BRINE_SCUTTLER_SHELL: '#3d5a62',
  BRINE_SCUTTLER_CARAPACE: '#2a6f78',
  BRINE_SCUTTLER_LEGS: '#1a3038',
  BRINE_SCUTTLER_EYE: '#ffeed0',
  TRENCH_MATRIARCH_CORE: '#1a4a52',
  TRENCH_MATRIARCH_MANTLE: '#0f3540',
  TRENCH_MATRIARCH_EYE: '#6af0ff',
  
  // Projectiles
  PLAYER_BULLET: '#5a3038',
  ENEMY_BULLET: '#88ff00',
  
  // Effects
  WEB: '#cccccc',
  PARTICLE_HIT: '#ffff00',
  PARTICLE_DEATH: '#ff4444',
  
  // UI
  HEART_FULL: '#ff0000',
  HEART_EMPTY: '#333333',
  TEXT: '#ffffff',
  TEXT_SHADOW: '#000000',
} as const;

// Collision layers (bitmask)
export const COLLISION_LAYER = {
  NONE: 0,
  PLAYER: 1 << 0,
  ENEMY: 1 << 1,
  PLAYER_PROJECTILE: 1 << 2,
  ENEMY_PROJECTILE: 1 << 3,
  WALL: 1 << 4,
  DOOR: 1 << 5,
  WEB: 1 << 6,
  OBSTACLE: 1 << 7,
} as const;

// Game states
export type GameState =
  | 'MENU'
  | 'PLAYING'
  | 'PAUSED'
  | 'UPGRADE'
  | 'CHAPTER_MAP'
  | 'GAME_OVER'
  | 'VICTORY';

// Direction enum
export type Direction = 'NORTH' | 'SOUTH' | 'EAST' | 'WEST';

export const DIRECTION_VECTORS = {
  NORTH: { x: 0, y: -1 },
  SOUTH: { x: 0, y: 1 },
  EAST: { x: 1, y: 0 },
  WEST: { x: -1, y: 0 },
} as const;
