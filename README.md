<div align="center">

<pre>
    __    _ __ 
   / /_  (_) /_
  / __ \/ / __/
 / /_/ / / /_  
/_.___/_/\__/  
</pre>

### *A tiny bug in a vast, dreadful box.*

---

**[ PLAY THE DESCENT NOW ](https://bit.bkmcoding.com)**

---

</div>

### 🕷️ THE PREMISE

You are **bit**. You are small, fragile, and trapped.  
Every room is a box. Once you enter, the heavy doors slam shut.  
The swarm drops from the shadows.  
You must survive the wave, harvest mutations, and crawl deeper into the dark.

Twenty sectors. Two chapters. Two bosses. One way out.

---

### ⌨️ CONTROLS

| Action | Input |
| :--- | :--- |
| **Move** | `W` `A` `S` `D` |
| **Aim** | `Mouse` |
| **Shoot** | `Left Click` |
| **Dash** | `Shift` |
| **Pause** | `ESC` |

*Opposite keys cancel. Use walls to block shots. Dash through gaps — but stamina is finite.*

---

### 📖 THE DESCENT

The run is split into two chapters, each ending in a boss room.

**Chapter 1 — The Cellar** *(Sectors 1–12)*  
Dark, earthy rooms across cellar, moss, ash, deep, and rust themes. The swarm is fast and relentless. Sector 12 ends with the **Broodmother**.

**Chapter 2 — The Flooded Arc** *(Sectors 13–20)*  
Rooms are submerged and corroded — flooded and toxicworks palettes replace the dry dark above. The creatures here are worse. Sector 20 ends with the **Trench Matriarch**.

---

### 👾 THE SWARM

**Chapter 1**

| Enemy | HP | Behavior |
| :--- | :---: | :--- |
| **Spider** | 7 | Wanders; chases when you get close |
| **Skitter** | 5 | Fast, aggressive chaser — arrives before you hear it |
| **Spitter** | 10 | Keeps distance; lobs acid from range |
| **Dasher** | 9 | Glows red, winds up, then launches a full-speed charge |
| **WebSpinner** | 12 | Circles slowly; drops web traps that slow movement |
| **Brute** | 22 | Big, tanky, hits for 2 — doesn't need to be fast |
| **Widow** | 14 | Fires tight burst volleys; gives no warning |
| **Broodmother** *(boss)* | 280 | Spawns offspring, sweeps projectiles, charges — enters a second stage at half HP |

**Chapter 2**

| Enemy | HP | Behavior |
| :--- | :---: | :--- |
| **TideCrawler** | 10 | Chaser with periodic speed surges |
| **GillStalker** | 8 | Fast shoreline dasher |
| **MurkLeech** | 5 | Glassy pack hunter — travels in groups |
| **BrineScuttler** | 11 | Shore crab; skirmishes with burst lunges |
| **ToxicSpitter** | 12 | Ranged corrosive fire with a tighter arc than the Spitter |
| **TrenchMatriarch** *(boss)* | 300 | Fan volleys, tendril bursts, whirlpool spray, vacuum pull, and a desperation nova |

On **Hard**, enemies share a **HiveMind** — they coordinate ring positions around you so no direction is ever safe at once.

---

### 🧬 MUTATIONS

Clearing a sector offers a choice of three mutations from a pool of 50+.  
Many are tradeoffs. Read carefully.

A sample of what you might find:

| Mutation | Effect |
| :--- | :--- |
| **Barbed Stinger** | +1 damage |
| **Hollow Needle** | Shots pierce 1 more enemy |
| **Gristly Heart** | +1 max HP; full heal |
| **Panic Scuttle** | +12% movement speed |
| **Glass Carapace** | +0.35s invulnerability after hits |
| **Carrion Crumb** | 30% chance to heal 1 HP on kill |
| **Blood Frenzy** | On kill: ~1.25s burst of faster fire |
| **Jagged Odds** | ~18% crit chance; crits deal double |
| **Greedsprout** | +2 damage; −1 max HP |
| **Parasite Bond** | +1 max HP & full heal; −0.2s i-frames after hits |
| **Abyss Lung** *(Ch.2)* | +1 max dash charge |
| **Rip Current** *(Ch.2)* | +12% shot speed + 1 pierce; take ~4% more damage |

Chapter 2 rooms bias toward thematically appropriate mutations — defensive picks surface earlier on Easy, offensive ones on Hard.

---

### ⚙️ DIFFICULTY

Selected from the main menu. Scales enemies and adjusts your fire cadence.

| Setting | Enemy HP | Enemy Speed | Boss HP | Player Fire Rate |
| :--- | :---: | :---: | :---: | :---: |
| **Easy** | ×0.82 | ×1.0 | ×0.72 | faster |
| **Medium** | ×1.0 | ×1.0 | ×1.0 | baseline |
| **Hard** | ×1.28 | ×1.09 | ×1.42 | slower |

Hard also enables the HiveMind coordinated AI.

---

### 🛠️ TECH STACK

| Layer | Technology |
| :--- | :--- |
| **Framework** | Next.js 15 (App Router) |
| **Rendering** | HTML5 Canvas — 352×208 buffer, scaled 4× to 1408×832 |
| **Post-processing** | WebGL (horror vignette + shader pass) |
| **UI / Menus** | React + Tailwind CSS |
| **Audio** | Web Audio API — synthesized fallbacks built in |
| **Room generation** | Procedural layouts with seeded door connections |

---

### 🗂️ ARCHITECTURE

```
lib/game/
├── engine/
│   ├── Game.ts              # Main loop, state machine, boss intros, sector-0 cinematic
│   └── InputManager.ts      # Keyboard & mouse input
├── entities/
│   ├── Entity.ts            # Base class (position, velocity, collision)
│   ├── Player.ts            # Movement, dash stamina, shooting, health
│   ├── Projectile.ts        # Player and enemy projectiles
│   └── enemies/
│       ├── Enemy.ts         # Base enemy class
│       ├── Spider.ts / Skitter.ts / Brute.ts
│       ├── Spitter.ts / ToxicSpitter.ts / Widow.ts
│       ├── Dasher.ts / GillStalker.ts
│       ├── WebSpinner.ts
│       ├── TideCrawler.ts / BrineScuttler.ts / MurkLeech.ts
│       ├── Broodmother.ts   # Chapter 1 boss (two life stages)
│       └── TrenchMatriarch.ts # Chapter 2 boss (fan, tendril, vacuum, nova)
├── rooms/
│   ├── Room.ts              # Walls, doors, rendering
│   ├── roomData.ts          # 20 sector blueprints (enemy composition + theme)
│   ├── chapterConfig.ts     # Chapter boundary indices
│   ├── proceduralRoomLayout.ts # Obstacle & layout generation
│   └── runDoorLayout.ts     # Seeded door connection graph
├── systems/
│   ├── CollisionSystem.ts   # Circle-based collision detection
│   ├── RoomManager.ts       # Room transitions, enemy spawning, spawn protection
│   └── HiveMind.ts          # Hard-mode coordinated ring AI
├── upgrades/
│   ├── Upgrade.ts           # Upgrade interface
│   └── upgradePool.ts       # 50+ upgrades; chapter-2 zone biasing
├── rendering/
│   ├── particles.ts         # Particle effects
│   ├── roomMoonlight.ts     # Per-room ambient shaft pass
│   └── webglHorrorPresent.ts# WebGL post-process shader
├── audio/
│   ├── AudioManager.ts      # SFX + music; synth fallbacks
│   └── atmosphere-audio.ts  # Ambient layer management
└── utils/
    ├── Vector2.ts
    ├── constants.ts         # All tuning: speeds, HP, themes, palettes, difficulty
    └── obstacleCollision.ts # Circle-vs-obstacle resolution

components/game/
├── GameCanvas.tsx           # Root game component & canvas mount
├── GameUI.tsx               # HUD (health, dash bar, sector progress)
├── MainMenu.tsx             # Title screen
├── ChapterMapScreen.tsx     # Between-chapter transition screen
├── PauseMenu.tsx
├── UpgradeModal.tsx         # Post-sector mutation selection
└── GameOverScreen.tsx       # Victory / defeat
```

**State flow:**
```
MENU → PLAYING → UPGRADE → PLAYING → ··· → CHAPTER_MAP → PLAYING → ··· → VICTORY
                    |                                                       |
                    └───────────────────── GAME_OVER ───────────────────────┘
                                               │
                                             MENU
```

---

### ⚙️ LOCAL DEVELOPMENT

```bash
git clone https://github.com/bkmcoding/bit.git
cd bit
npm install
npm run dev
```

---

### 🩸 EXTENDING THE GAME

**New enemy**
1. Create a class in `lib/game/entities/enemies/` extending `Enemy`
2. Add stats to `ENEMY` in `constants.ts`
3. Register the type in `RoomManager.spawnEnemies()`
4. Add it to sector blueprints in `roomData.ts`

**New upgrade**
1. Add an entry to `upgradePool.ts` with an `apply(player)` function
2. Optionally tag it in `TOXIC_ZONE_UPGRADES` to bias it toward chapter 2 rooms

**New sector**
1. Add a blueprint to `ROOM_BLUEPRINT_BASE` in `roomData.ts`
2. Update chapter boundary indices in `chapterConfig.ts` if needed
