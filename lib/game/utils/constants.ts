// Game rendering
export const GAME = {
  NATIVE_WIDTH: 240,
  NATIVE_HEIGHT: 160,
  SCALE: 4,
  get DISPLAY_WIDTH() { return this.NATIVE_WIDTH * this.SCALE; },
  get DISPLAY_HEIGHT() { return this.NATIVE_HEIGHT * this.SCALE; },
  FPS_TARGET: 60,
} as const;

// Player settings
export const PLAYER = {
  SIZE: 8,
  SPEED: 60, // pixels per second
  FIRE_RATE: 0.3, // seconds between shots
  DAMAGE: 1,
  MAX_HEALTH: 3,
  INVULN_TIME: 1.0, // seconds of invincibility after hit
  ACCELERATION: 400, // how fast player reaches max speed
  FRICTION: 10, // how fast player slows down
} as const;

// Projectile settings
export const PROJECTILE = {
  PLAYER_SPEED: 150,
  ENEMY_SPEED: 80,
  SIZE: 3,
  LIFETIME: 3, // seconds before despawn
} as const;

// Enemy configurations
export const ENEMY = {
  SPIDER: { 
    size: 10, 
    speed: 40, 
    health: 2, 
    damage: 1,
    chaseRange: 80,
  },
  SPITTER: { 
    size: 12, 
    speed: 20, 
    health: 3, 
    damage: 1, 
    range: 100,
    fireRate: 2.0,
    preferredDistance: 60,
  },
  DASHER: { 
    size: 8, 
    speed: 30,
    dashSpeed: 150, 
    health: 2, 
    damage: 1, 
    chargeTime: 1.5,
    dashDuration: 0.3,
  },
  WEBSPINNER: { 
    size: 14, 
    speed: 15, 
    health: 4, 
    damage: 1,
    webCooldown: 3.0,
  },
  BROODMOTHER: {
    size: 32,
    speed: 20,
    health: 15,
    damage: 2,
    spawnCooldown: 4.0,
  },
} as const;

// Room settings
export const ROOM = {
  WIDTH: GAME.NATIVE_WIDTH,
  HEIGHT: GAME.NATIVE_HEIGHT,
  WALL_THICKNESS: 8,
  DOOR_WIDTH: 24,
  DOOR_HEIGHT: 8,
} as const;

// Colors (limited palette for pixel art look)
export const COLORS = {
  // Background & walls
  FLOOR: '#3d2b1f',
  WALL: '#5c4033',
  WALL_DARK: '#2a1f14',
  DOOR_CLOSED: '#8b0000',
  DOOR_OPEN: '#1a1a1a',
  
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
  
  // Projectiles
  PLAYER_BULLET: '#00ffff',
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
} as const;

// Game states
export type GameState = 'MENU' | 'PLAYING' | 'PAUSED' | 'UPGRADE' | 'GAME_OVER' | 'VICTORY';

// Direction enum
export type Direction = 'NORTH' | 'SOUTH' | 'EAST' | 'WEST';

export const DIRECTION_VECTORS = {
  NORTH: { x: 0, y: -1 },
  SOUTH: { x: 0, y: 1 },
  EAST: { x: 1, y: 0 },
  WEST: { x: -1, y: 0 },
} as const;
