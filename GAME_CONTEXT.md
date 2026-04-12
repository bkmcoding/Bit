# Box Crawler - Game Context

A 2D roguelike shooter built with HTML5 Canvas and React/Next.js. Theme: "Box" + "Spiders".

## Game Overview

You play as a tiny white insect navigating through box-shaped rooms filled with spider enemies. Clear rooms, collect upgrades, and defeat the Broodmother boss.

**Controls:** WASD movement, Mouse aim/shoot, ESC pause

---

## Tech Stack

- **Framework:** Next.js 15 (App Router)
- **Rendering:** HTML5 Canvas (240x160 native, scaled 4x for pixel art)
- **UI:** React + Tailwind CSS
- **Audio:** Web Audio API with synthesized fallbacks

---

## File Structure

```
lib/game/
├── engine/
│   ├── Game.ts              # Main game loop, state management, rendering
│   └── InputManager.ts      # Keyboard/mouse input handling
├── entities/
│   ├── Entity.ts            # Base entity class (position, velocity, collision)
│   ├── Player.ts            # Player character (movement, shooting, health)
│   ├── Projectile.ts        # Bullets (player and enemy)
│   └── enemies/
│       ├── Enemy.ts         # Base enemy class
│       ├── Spider.ts        # Basic chaser enemy
│       ├── Spitter.ts       # Ranged enemy, shoots acid
│       ├── Dasher.ts        # Charges at player
│       ├── WebSpinner.ts    # Leaves slowing web traps
│       └── Broodmother.ts   # Boss - spawns babies, shoots spreads
├── rooms/
│   ├── Room.ts              # Room class (walls, doors, rendering)
│   └── roomData.ts          # Handcrafted room definitions (7 rooms)
├── systems/
│   ├── CollisionSystem.ts   # Entity collision detection
│   └── RoomManager.ts       # Room transitions, enemy spawning
├── upgrades/
│   ├── Upgrade.ts           # Upgrade interface
│   └── upgradePool.ts       # All available upgrades (8 types)
├── rendering/
│   └── particles.ts         # Particle system for effects
├── audio/
│   └── AudioManager.ts      # Sound effects and music (modular)
└── utils/
    ├── Vector2.ts           # 2D vector math utilities
    └── constants.ts         # Game constants (speeds, sizes, colors)

components/game/
├── GameCanvas.tsx           # Main game component, canvas setup
├── GameUI.tsx               # In-game HUD (health, room progress)
├── MainMenu.tsx             # Title screen with animations
├── PauseMenu.tsx            # Pause overlay
├── UpgradeModal.tsx         # Post-room upgrade selection
└── GameOverScreen.tsx       # Victory/defeat screen
```

---

## Core Systems

### Game Loop (`Game.ts`)

```typescript
class Game {
  state: 'MENU' | 'PLAYING' | 'PAUSED' | 'UPGRADING' | 'GAME_OVER' | 'VICTORY'
  player: Player
  enemies: Enemy[]
  projectiles: Projectile[]
  roomManager: RoomManager
  particles: ParticleSystem

  // Main loop: update(deltaTime) -> render(ctx)
}
```

### Entity System (`Entity.ts`)

All game objects inherit from Entity:

- `position: Vector2` - World position
- `velocity: Vector2` - Movement vector
- `radius: number` - Collision radius
- `collisionLayer: number` - Bitmask for collision filtering
- `update(deltaTime)` - Called each frame
- `render(ctx)` - Draw to canvas

### Room System

- 7 handcrafted rooms (index 0-6)
- Room 0: Starting room (no enemies, tutorial)
- Rooms 1-5: Combat rooms with increasing difficulty
- Room 6: Boss room (Broodmother)
- Doors connect rooms, lock during combat, unlock when cleared

### Collision Layers

```typescript
COLLISION_LAYER = {
  PLAYER: 1,
  ENEMY: 2,
  PLAYER_PROJECTILE: 4,
  ENEMY_PROJECTILE: 8,
  WEB: 16,
}
```

---

## Player Stats

```typescript
PLAYER = {
  SPEED: 60, // pixels/sec
  RADIUS: 4,
  MAX_HEALTH: 3, // hearts
  SHOOT_COOLDOWN: 0.25,
  INVULN_TIME: 1.0, // seconds after hit
  PROJECTILE_SPEED: 120,
  PROJECTILE_DAMAGE: 1,
}
```

Modifiable via upgrades: `speedMult`, `damageMult`, `fireRateMult`, `projectileCount`, `piercing`

---

## Enemy Types

| Type        | Health | Behavior                                         |
| ----------- | ------ | ------------------------------------------------ |
| Spider      | 2      | Wanders, chases when player nearby               |
| Spitter     | 3      | Keeps distance, shoots acid projectiles          |
| Dasher      | 4      | Charges up (red glow), then dashes at high speed |
| WebSpinner  | 3      | Circles player, drops web traps that slow        |
| Broodmother | 30     | Boss - spawns babies, spread shots, charges      |

---

## Upgrades (chosen after each room)

1. **Extra Heart** - +1 max health, full heal
2. **Swift Legs** - +20% movement speed
3. **Sharp Fangs** - +25% damage
4. **Rapid Fire** - +30% fire rate
5. **Piercing Shot** - Projectiles pass through enemies
6. **Triple Shot** - Fire 3 projectiles in spread
7. **Five Shot** - Fire 5 projectiles in spread
8. **Thick Shell** - Longer invulnerability after hit

---

## Audio System

Modular design with synthesized fallbacks. To add custom audio:

1. Place MP3 files in `/public/audio/`
2. Follow naming convention:
   - `shoot.mp3`, `enemy_hit.mp3`, `enemy_death.mp3`
   - `player_hurt.mp3`, `upgrade.mp3`, `door_open.mp3`
   - `boss_roar.mp3`, `dash.mp3`, `victory.mp3`, `game_over.mp3`
   - `music_menu.mp3`, `music_gameplay.mp3`, `music_boss.mp3`

AudioManager automatically uses files if present, falls back to synth sounds.

---

## Key Callbacks (Game -> React)

```typescript
callbacks: {
  onStateChange: (state: GameState) => void
  onHealthChange: (health: number, maxHealth: number) => void
  onRoomChange: (roomIndex: number, totalRooms: number) => void
  onUpgradeChoice: (upgrades: Upgrade[]) => void
  onGameOver: (victory: boolean) => void
}
```

---

## Rendering

- Native resolution: 240x160 pixels
- Scaled 4x to 960x640 for display
- `imageSmoothingEnabled = false` for crisp pixel art
- Screen shake via `shakeAmount` offset during render

---

## Color Palette

```typescript
COLORS = {
  BACKGROUND: '#1a1a2e',
  WALL: '#4a4a6a',
  FLOOR: '#2d2d44',
  PLAYER: '#ffffff',
  ENEMY_SPIDER: '#8b4513',
  ENEMY_SPITTER: '#556b2f',
  ENEMY_DASHER: '#8b0000',
  ENEMY_WEB_SPINNER: '#4a4a4a',
  BOSS: '#4a0080',
  PROJECTILE_PLAYER: '#ffff00',
  PROJECTILE_ENEMY: '#00ff00',
  WEB: 'rgba(200, 200, 200, 0.3)',
  DOOR_OPEN: '#00ff00',
  DOOR_CLOSED: '#ff0000',
  HEALTH: '#ff0000',
  HEALTH_EMPTY: '#333333',
}
```

---

## Adding New Features

### New Enemy Type

1. Create class in `lib/game/entities/enemies/` extending `Enemy`
2. Add constants to `ENEMY` in `constants.ts`
3. Add to switch in `RoomManager.spawnEnemies()`
4. Add spawn data to rooms in `roomData.ts`

### New Upgrade

1. Add to `upgradePool.ts` with `apply(player)` function
2. Upgrades modify player stats or add flags

### New Room

1. Add room config to `ROOMS` array in `roomData.ts`
2. Update `GAME.TOTAL_ROOMS` in `constants.ts`
3. Set door `targetRoom` values to connect rooms

---

## Game States Flow

```
MENU -> PLAYING -> UPGRADING -> PLAYING -> ... -> VICTORY
                      |                              |
                      v                              v
                  GAME_OVER <--------------------+
                      |
                      v
                    MENU (restart)
```

---

## Performance Notes

- Entity cleanup happens each frame (remove `isAlive === false`)
- Particle system uses object pooling implicitly (array splice)
- Collision uses simple circle-circle checks (O(n^2) but n is small)
- Canvas operations are batched per entity type
