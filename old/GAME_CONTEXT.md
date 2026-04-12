# BOXED IN — Game Context Document

### Phaser.js 2D Roguelike | Cursor Agent Reference

---

## 1. PROJECT OVERVIEW

**Title (working):** Boxed In  
**Engine:** Phaser 3 (phaser@3.x via npm or CDN)  
**Language:** JavaScript (ES6+), optionally TypeScript  
**Build Tool:** Vite (recommended) or plain HTML/JS  
**Target:** Browser-based, desktop-first, keyboard + gamepad optional  
**Theme:** "Box" + "Spiders" — rooms are literal contained boxes; enemies are bugs and spiders

### Core Loop Summary

1. Player spawns in a sealed **room (box)**
2. Defeat all enemies to unlock exits
3. Choose an **upgrade card** from 3 options
4. Move to the next connected room
5. Repeat through N rooms until **boss** or **escape condition**
6. Death = full run restart (roguelike permadeath)

---

## 2. TECHNOLOGY STACK

```
phaser@3.x            — core game engine (scenes, physics, input, camera)
vite                  — dev server + bundler
howler.js (optional)  — audio management
```

### File Structure

```
/
├── index.html
├── vite.config.js
├── src/
│   ├── main.js                  — Phaser game config + scene list
│   ├── scenes/
│   │   ├── BootScene.js         — asset preload
│   │   ├── MainMenuScene.js     — title screen
│   │   ├── GameScene.js         — core gameplay loop
│   │   ├── UpgradeScene.js      — between-room upgrade selection (overlay)
│   │   ├── HUDScene.js          — persistent HP/XP UI overlay
│   │   └── GameOverScene.js     — death screen
│   ├── entities/
│   │   ├── Player.js
│   │   ├── enemies/
│   │   │   ├── EnemyBase.js
│   │   │   ├── SpiderSpitter.js
│   │   │   ├── SpiderDasher.js
│   │   │   ├── SpiderMother.js  — miniboss
│   │   │   └── [future bug types]
│   │   └── Projectile.js
│   ├── systems/
│   │   ├── RoomManager.js       — room layout, connections, lock/unlock logic
│   │   ├── UpgradeSystem.js     — upgrade pool, card draw logic
│   │   ├── RunState.js          — persistent run data (upgrades, room count, floor)
│   │   └── EnemySpawner.js      — per-room enemy configuration
│   ├── ui/
│   │   ├── HealthBar.js
│   │   ├── UpgradeCard.js
│   │   └── MiniMap.js           — future: show connected rooms
│   ├── data/
│   │   ├── upgrades.js          — all upgrade definitions
│   │   ├── enemies.js           — enemy stat tables
│   │   └── rooms.js             — room layout templates (or procedural seed data)
│   └── utils/
│       ├── constants.js
│       └── helpers.js
├── assets/
│   ├── sprites/                 — placeholder circles until custom art added
│   ├── tilemaps/                — room layouts (Tiled JSON)
│   └── audio/
```

---

## 3. PHASER 3 CONFIGURATION

```js
// src/main.js
import Phaser from 'phaser'
import BootScene from './scenes/BootScene.js'
import MainMenuScene from './scenes/MainMenuScene.js'
import GameScene from './scenes/GameScene.js'
import UpgradeScene from './scenes/UpgradeScene.js'
import HUDScene from './scenes/HUDScene.js'
import GameOverScene from './scenes/GameOverScene.js'

const config = {
  type: Phaser.AUTO,
  width: 480,
  height: 270, // 16:9, pixel-art friendly; scale up via CSS
  zoom: 3, // renders at 1440x810 visually
  backgroundColor: '#1a1a2e',
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 0 }, // top-down, no gravity
      debug: false,
    },
  },
  scene: [BootScene, MainMenuScene, GameScene, HUDScene, UpgradeScene, GameOverScene],
  pixelArt: true,
  roundPixels: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
}

export default new Phaser.Game(config)
```

---

## 4. VISUAL STYLE & PLACEHOLDER ART

**Until custom assets are ready, ALL sprites are drawn procedurally using Phaser Graphics:**

### Player

- White filled circle, radius 6px
- Two short lines extending downward as "legs" (left and right of bottom center)
- Thin white outline ring
- Faces direction of movement (rotate the leg lines)

```js
// Generating player texture at runtime
const gfx = scene.make.graphics({ x: 0, y: 0, add: false })
gfx.fillStyle(0xffffff)
gfx.fillCircle(8, 8, 6)
gfx.lineStyle(1, 0xcccccc)
gfx.lineBetween(5, 13, 3, 18) // left leg
gfx.lineBetween(11, 13, 13, 18) // right leg
gfx.generateTexture('player', 16, 20)
gfx.destroy()
```

### Spider Enemies

- Dark body circle (larger than player)
- 4 lines on each side as legs (8 total)
- Eyes: 2 tiny bright dots
- Color variants: SpiderSpitter = dark purple, SpiderDasher = dark red

### Room Walls

- Solid filled rectangles using Phaser Graphics or Tilemap
- Walls: dark gray/charcoal (`0x2d2d44`)
- Floor: slightly lighter (`0x1e1e30`)
- Door/exit: bright yellow outline when unlocked (`0xffdd00`), red/locked when enemies remain

---

## 5. PLAYER ENTITY

### Stats (base values, modified by upgrades)

```js
// src/entities/Player.js
const BASE_STATS = {
  maxHealth: 6, // 3 hearts = 6 half-hearts
  speed: 120, // pixels/second
  projectileSpeed: 200,
  projectileDamage: 1,
  fireRate: 500, // ms between shots (lower = faster)
  projectileSize: 3, // radius in pixels
  projectileRange: 200, // px before despawn
  iFrameDuration: 800, // ms of invincibility after hit
  contactDamage: 0, // player doesn't deal contact damage
}
```

### Movement

- 8-directional WASD or arrow keys
- Normalize diagonal movement (prevent 1.41x speed diagonal)
- Physics body: arcade circle collider, radius ~5

### Shooting

- Mouse aim: projectile fires toward cursor position
- Keyboard aim (alt): IJKL or numpad directional fire
- Projectile is a small glowing white circle
- On screen edge or wall collision: destroy projectile
- Fire rate is a cooldown timer (`lastFired` timestamp comparison)

### Health System

- HP stored as integer half-hearts (max 6 = 3 full hearts)
- iFrames on hit (player flashes alpha 0.3 ↔ 1.0 during iframe window)
- Death triggers GameOverScene via event

### Input Handling

```js
// In GameScene create():
this.keys = this.input.keyboard.createCursorKeys()
this.wasd = this.input.keyboard.addKeys({
  up: Phaser.Input.Keyboard.KeyCodes.W,
  down: Phaser.Input.Keyboard.KeyCodes.S,
  left: Phaser.Input.Keyboard.KeyCodes.A,
  right: Phaser.Input.Keyboard.KeyCodes.D,
})
this.input.on('pointermove', (pointer) => {
  this.aimTarget = pointer
})
this.input.on('pointerdown', () => {
  this.playerShoot()
})
```

---

## 6. ROOM (BOX) SYSTEM

### Room Philosophy

- Each room is a **self-contained rectangular arena** — the "box"
- Camera is locked to the room bounds (no scrolling mid-room)
- Rooms are connected via **door tiles** on N/S/E/W walls
- Door is **locked** (blocking collider active) while enemies alive
- Door **unlocks** (visual change + SFX + collider disabled) when all enemies dead

### Room Layout

- Fixed room size: **480 × 270** (matches viewport) OR tiled rooms at a larger scale with camera bounds
- Walls: 16px thick border tiles on all sides
- Floor: open area with optional obstacle tiles (web pillars, boxes, debris)
- 4 possible door positions (one per wall), not all used every room

### RoomManager.js

```js
// Responsibilities:
// - Track current room index in the run
// - Store which rooms have been cleared
// - Handle door lock/unlock state
// - Trigger UpgradeScene after room clear
// - Load next room

class RoomManager {
  constructor(scene) { ... }
  loadRoom(roomConfig) { ... }   // spawns walls, floor, obstacles, doors
  lockDoors() { ... }
  unlockDoors() { ... }          // called when enemyCount reaches 0
  onRoomCleared() { ... }        // triggers upgrade flow
  getNextRoomConfig() { ... }    // returns procedural or template room
}
```

### Procedural Room Generation (MVP approach)

- Start with a set of **handcrafted room templates** (JSON or code)
- Each template defines: obstacle positions, enemy spawn points, door positions
- Shuffle pool of templates each run
- Later: fully procedural generation using BSP or simple random obstacle scatter

### Room Templates (data/rooms.js)

```js
export const ROOM_TEMPLATES = [
  {
    id: 'empty',
    obstacles: [],
    doors: ['north', 'east'],
    enemySlots: [
      { x: 0.25, y: 0.3 },  // normalized 0-1 positions
      { x: 0.75, y: 0.3 },
      { x: 0.5,  y: 0.7 },
    ]
  },
  {
    id: 'pillars',
    obstacles: [
      { x: 0.3, y: 0.4, w: 20, h: 20 },
      { x: 0.7, y: 0.4, w: 20, h: 20 },
      { x: 0.5, y: 0.6, w: 20, h: 20 },
    ],
    doors: ['north', 'south', 'east'],
    enemySlots: [ ... ]
  },
  // ... 8-12 total templates for MVP
];
```

---

## 7. ENEMY SYSTEM

### EnemyBase.js

All enemies extend this base class:

```js
class EnemyBase {
  // Properties all enemies share:
  hp: number
  maxHp: number
  speed: number
  damage: number          // contact or projectile damage dealt to player
  knockbackForce: number  // how hard they push player on contact
  xpValue: number         // future use
  deathFX: string         // particle effect key

  // Methods:
  takeDamage(amount) { ... }    // flash red, reduce HP, check death
  die() { ... }                 // spawn particles, emit 'enemyDead' event
  update(time, delta) { ... }   // AI state machine tick
}
```

### Enemy: SpiderSpitter

- **Appearance:** Medium dark purple circle, 8 legs, 2 glowing red dot eyes
- **Behavior:** Stays at medium range, fires slow glob projectiles at player every 2s
- **Stats:** HP 3, Speed 60, Proj Damage 1, Proj Speed 80
- **AI States:** IDLE → TRACK_PLAYER → SHOOT → COOLDOWN → TRACK_PLAYER
- **Range:** Stays 80-150px from player, strafe-circles

### Enemy: SpiderDasher

- **Appearance:** Slightly smaller dark red circle, 8 legs, no visible projectile attack
- **Behavior:** Waits, telegraphs with a brief "charge" animation, then dashes in a straight line
- **Stats:** HP 2, Dash Speed 300 (momentary), Normal Speed 50, Contact Damage 1
- **AI States:** IDLE → WANDER → PREPARE_DASH (0.5s wind-up) → DASH → COOLDOWN (1.5s)
- **Dash telegraph:** Flash orange for 0.4s before launching

### Enemy: SpiderMother (Miniboss, floor 3+)

- **Appearance:** Large dark circle, 8 thick legs, crown of eyes
- **Behavior:** Alternates between spitting a spread shot (3 projectiles) and spawning 2x SpiderSpitters
- **Stats:** HP 20, Speed 40
- **Spawn cap:** Max 6 spiderlings in room at once

### Future Enemy Types (post-jam additions)

- `BeetleCharger` — armored, only takes damage from behind
- `MothFlyer` — ignores obstacles, drops poison patches
- `AntWorker` — weak, but comes in large groups
- `WaspBomber` — throws bouncing projectiles

### Enemy Data Table (data/enemies.js)

```js
export const ENEMY_STATS = {
  spiderSpitter: { hp: 3, speed: 60, damage: 1, projSpeed: 80, fireRate: 2000, xp: 5 },
  spiderDasher: { hp: 2, speed: 50, dashSpeed: 300, damage: 1, dashCooldown: 1500, xp: 4 },
  spiderMother: { hp: 20, speed: 40, damage: 2, projSpeed: 100, spawnRate: 5000, xp: 50 },
}
```

### Enemy AI Pattern

Use a simple state machine per enemy. Each state has an `enter()`, `update()`, and `exit()` method.
Do NOT use pathfinding for MVP — enemies navigate with direct vectors + obstacle avoidance steering behavior (separation force from walls and other enemies).

---

## 8. PROJECTILE SYSTEM

### Projectile.js

Shared by both player and enemies. A Projectile is a Phaser `Arcade Physics` sprite (or Graphics-generated texture).

```js
class Projectile extends Phaser.Physics.Arcade.Sprite {
  fire(x, y, angle, speed, damage, range, owner) {
    this.setPosition(x, y)
    this.setActive(true).setVisible(true)
    this.owner = owner // 'player' | 'enemy'
    this.damage = damage
    this.distanceTraveled = 0
    this.maxRange = range
    this.scene.physics.velocityFromAngle(angle, speed, this.body.velocity)
  }

  preUpdate(time, delta) {
    super.preUpdate(time, delta)
    this.distanceTraveled +=
      Math.abs((this.body.velocity.x * delta) / 1000) + Math.abs((this.body.velocity.y * delta) / 1000)
    if (this.distanceTraveled > this.maxRange) this.deactivate()
  }

  deactivate() {
    this.setActive(false).setVisible(false)
    this.body.stop()
  }
}
```

Use **Phaser Groups** (`scene.physics.add.group`) as object pools for player and enemy projectiles separately.

### Collisions to Register

```js
// In GameScene:
scene.physics.add.overlap(playerProjectiles, enemyGroup, onPlayerHitEnemy)
scene.physics.add.overlap(enemyProjectiles, player, onEnemyHitPlayer)
scene.physics.add.collider(playerProjectiles, wallLayer, destroyProjectile)
scene.physics.add.collider(enemyProjectiles, wallLayer, destroyProjectile)
scene.physics.add.collider(player, wallLayer)
scene.physics.add.collider(enemyGroup, wallLayer)
```

---

## 9. UPGRADE SYSTEM

### When Upgrades Trigger

After the last enemy in a room dies → `RoomManager.onRoomCleared()` → pause GameScene → launch UpgradeScene as an overlay

### Upgrade Card Selection

- Draw 3 cards randomly from the upgrade pool (no duplicates per draw)
- Weight upgrades by run context (e.g., health upgrades more likely if player is low)
- Player clicks/selects one card
- Card effect applies to `RunState`
- Close UpgradeScene, resume GameScene, load next room

### Upgrade Categories

**Offense**

- `damage_up` — +1 projectile damage
- `fire_rate_up` — -75ms fire rate (faster shooting)
- `proj_speed_up` — +50 projectile speed
- `triple_shot` — fires 3 projectiles in a spread (replaces single shot, additive)
- `bouncy_shots` — projectiles bounce off walls once
- `piercing` — projectiles pass through 1 enemy before expiring
- `explosive_tip` — small AoE on projectile impact

**Defense**

- `max_hp_up` — +2 max HP (restores +2 also)
- `heal_1` — restore 2 HP now (no permanent stat change)
- `speed_up` — +15 move speed
- `longer_iframes` — +200ms invincibility window
- `shield` — absorb 1 hit (one-time use, refreshes each floor)

**Utility**

- `range_up` — +60px projectile range
- `proj_size_up` — projectile radius +2
- `room_map` — reveals minimap of connected rooms (future)
- `curse_familiar` — orbiting projectile that fires on its own (advanced)

### Upgrade Data (data/upgrades.js)

```js
export const UPGRADES = [
  {
    id: 'damage_up',
    name: 'Sharpened Bite',
    description: '+1 projectile damage',
    rarity: 'common',
    icon: 'icon_tooth', // placeholder: colored circle until art added
    apply: (runState) => {
      runState.projectileDamage += 1
    },
  },
  // ... all upgrades follow this shape
]
```

### RunState.js

Global state object passed between scenes via Phaser's registry or a singleton:

```js
export const RunState = {
  // Player stats (start at base, modified by upgrades)
  maxHealth: 6,
  currentHealth: 6,
  speed: 120,
  projectileDamage: 1,
  fireRate: 500,
  projectileSpeed: 200,
  projectileSize: 3,
  projectileRange: 200,
  iFrameDuration: 800,

  // Run tracking
  floor: 1,
  roomsCleared: 0,
  upgradesAcquired: [],

  // Flags
  hasTripleShot: false,
  hasBouncyShots: false,
  hasPiercing: false,
  shieldCharges: 0,

  reset() {
    /* restore all defaults */
  },
}
```

---

## 10. SCENE STRUCTURE & FLOW

```
BootScene
  → preload all textures, audio, tilemaps
  → generate placeholder textures via Phaser Graphics
  → transition to MainMenuScene

MainMenuScene
  → Title: "BOXED IN"
  → Options: Start Run, Settings (stub)
  → On start: RunState.reset(), launch GameScene

GameScene (core)
  → runs HUDScene in parallel (scene.launch)
  → on room clear: scene.pause(), scene.launch('UpgradeScene')
  → on player death: scene.start('GameOverScene')
  → on floor complete: scene.start('GameOverScene', { win: true })

HUDScene (overlay, always on top)
  → displays health, floor number, room count
  → listens to RunState changes via Phaser events

UpgradeScene (overlay)
  → shows 3 upgrade cards
  → on selection: applies upgrade to RunState
  → scene.stop() and resumes GameScene

GameOverScene
  → shows DEAD or WIN
  → floor reached, rooms cleared
  → restart button → RunState.reset() → GameScene
```

### Scene Communication

Use Phaser's global event emitter:

```js
// Emit from GameScene:
this.game.events.emit('playerDamaged', currentHp, maxHp)
this.game.events.emit('roomCleared', roomsCleared)

// Listen in HUDScene:
this.game.events.on('playerDamaged', this.updateHealthUI, this)
```

---

## 11. HUD / UI

### Health Display

- Row of heart icons (or simple colored circles for placeholder)
- Full heart = white circle, half heart = half-filled, empty = outline
- Updates on `playerDamaged` event

### Floor / Room Counter

- Top-right: "FLOOR 1 — ROOM 3"

### Upgrade Indicator (small)

- Optionally show icons of acquired upgrades in bottom corner (future feature)

### UpgradeScene Card UI

- Dark semi-transparent overlay (`0x000000`, alpha 0.7) over GameScene
- 3 cards horizontally centered
- Each card: rounded rect, icon area, name text, description text, rarity color border
- Keyboard select (1/2/3) or mouse click
- Hover = slight scale-up tween

---

## 12. AUDIO (STUB — implement later)

All audio calls should be wrapped so they gracefully no-op if audio not loaded.

| Event          | Sound                     |
| -------------- | ------------------------- |
| Player shoot   | Soft pop/pew              |
| Enemy hit      | Thud                      |
| Player hit     | Crunch + brief music duck |
| Enemy death    | Squish + pop              |
| Door unlock    | Chime/click               |
| Upgrade select | Positive ding             |
| Player death   | Low hit + silence         |

---

## 13. ROOM PROGRESSION & SCALING

### Run Structure (MVP)

```
Floor 1:  3 rooms → Boss Room (SpiderMother)
Floor 2:  4 rooms → Boss Room (SpiderMother x2)
Floor 3:  5 rooms → Final Escape Room (win condition)
```

### Enemy Scaling per Room

```js
function getEnemiesForRoom(floor, roomIndex) {
  const base = floor + roomIndex
  return {
    spiderSpitter: Math.floor(base * 0.6),
    spiderDasher: Math.floor(base * 0.4),
  }
}
```

### Difficulty Modifiers per Floor

```js
const FLOOR_MODS = {
  1: { enemyHpMult: 1.0, enemySpeedMult: 1.0 },
  2: { enemyHpMult: 1.4, enemySpeedMult: 1.1 },
  3: { enemyHpMult: 1.8, enemySpeedMult: 1.25 },
}
```

### Future: Procedural Generation

When ready to go beyond templates:

- Use a simple BSP (Binary Space Partition) or random walk to carve rooms
- Assign enemy types per biome/theme (Floor 1 = spider den, Floor 2 = beetle tunnels, etc.)
- Track RNG seed per run for replayability/sharing

---

## 14. COLLISION LAYERS

| Layer A           | Layer B          | Result                           |
| ----------------- | ---------------- | -------------------------------- |
| Player            | Walls            | Hard block                       |
| Player            | Enemy body       | Damage + knockback (contact dmg) |
| Player            | Enemy projectile | Damage + iFrames                 |
| Player projectile | Enemy            | Damage enemy + destroy proj      |
| Player projectile | Walls            | Destroy proj                     |
| Enemy             | Walls            | Hard block                       |
| Enemy             | Enemy            | Soft push (separate, no damage)  |
| Enemy projectile  | Walls            | Destroy proj                     |

---

## 15. CONSTANTS (utils/constants.js)

```js
export const ROOM_WIDTH = 480
export const ROOM_HEIGHT = 270
export const TILE_SIZE = 16
export const WALL_THICKNESS = 16

export const PLAYER_DEPTH = 10
export const ENEMY_DEPTH = 9
export const PROJ_DEPTH = 8
export const FLOOR_DEPTH = 0
export const WALL_DEPTH = 1
export const HUD_DEPTH = 100

export const COLORS = {
  WALL: 0x2d2d44,
  FLOOR: 0x1e1e30,
  PLAYER: 0xffffff,
  SPIDER_SPIT: 0x6633aa,
  SPIDER_DASH: 0xaa3322,
  DOOR_LOCKED: 0xaa2222,
  DOOR_OPEN: 0xffdd00,
  PROJECTILE: 0xffffff,
  HIT_FLASH: 0xff4444,
}
```

---

## 16. ASSET REPLACEMENT PLAN

When custom art is ready, follow this replacement procedure:

1. **Sprites** — Load via `this.load.spritesheet('player', 'assets/sprites/player.png', { frameWidth: 16, frameHeight: 20 })` in BootScene. The `generateTexture` calls in placeholder code become unnecessary — delete them and load from file instead.

2. **Tilemaps** — Export from Tiled as JSON. Load via `this.load.tilemapTiledJSON('room_01', 'assets/tilemaps/room_01.json')`. Rooms currently using Graphics-drawn walls will be replaced with Tilemap layer colliders.

3. **UI / Cards** — UpgradeCard component currently draws via Phaser Graphics and BitmapText. Replace `icon` field handling in `UpgradeCard.js` to use `scene.add.image(...)` with the loaded asset key.

4. **Fonts** — Use `this.load.bitmapFont(...)` for pixel fonts in game world. Use CSS-loaded fonts in DOM overlay (if using HTML UI).

**Important:** Keep all magic art keys in `constants.js` or a dedicated `ASSET_KEYS` object so search-and-replace across scenes is trivial.

---

## 17. KNOWN DEFERRED FEATURES (post-MVP)

- Minimap of connected rooms
- Persistent meta-progression (unlockable starting upgrades)
- More enemy types (beetles, moths, wasps, ants)
- Multiple floors with distinct visual themes
- Shop rooms (spend currency for an upgrade)
- Curse system (negative modifier in exchange for a powerful upgrade)
- Fullscreen toggle
- Gamepad support
- Mobile touch controls
- Seed-based run sharing
- Leaderboard (rooms cleared, time)

---

## 18. CODING CONVENTIONS FOR AI AGENTS

- Use **ES6 class syntax** for all entities and systems
- **Never mutate RunState directly** from inside entities — emit events or call RunState methods
- **Phaser Groups** for all pooled objects (projectiles, particles)
- **No singletons accessed via global scope** — pass scene reference through constructors
- All **magic numbers** go in `constants.js`
- All **enemy stats** go in `data/enemies.js`, not hardcoded in entity files
- All **upgrade definitions** go in `data/upgrades.js`
- Keep `GameScene.js` as a **coordinator only** — it should not contain AI logic, upgrade logic, or room layout logic directly
- Prefer **Phaser events** over direct method calls for cross-system communication
- Every new enemy must extend `EnemyBase` and implement `update(time, delta)` with a state machine
- Comments on every non-obvious block; JSDoc on class constructors and public methods

---

_End of document — update this file as features are implemented or design decisions change._
