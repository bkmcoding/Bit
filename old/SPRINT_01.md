# SPRINT 01 — Project Scaffold + Boot
**Reference:** GAME_CONTEXT.md  
**Goal:** A white circle (player) appears in a dark room and moves with WASD/arrow keys. Nothing else.

---

## Deliverables

### 1. Project Setup
Initialize a Vite project with Phaser 3 installed.

```
npm create vite@latest boxed-in -- --template vanilla
cd boxed-in
npm install phaser
```

Final folder structure to create (empty files are fine, just scaffold them):
```
src/
  main.js
  scenes/
    BootScene.js
    MainMenuScene.js
    GameScene.js
    UpgradeScene.js
    HUDScene.js
    GameOverScene.js
  entities/
    Player.js
    enemies/
      EnemyBase.js
    Projectile.js
  systems/
    RoomManager.js
    UpgradeSystem.js
    RunState.js
    EnemySpawner.js
  ui/
    HealthBar.js
    UpgradeCard.js
  data/
    upgrades.js
    enemies.js
    rooms.js
  utils/
    constants.js
    helpers.js
assets/
  sprites/   (empty)
  audio/     (empty)
index.html
vite.config.js
GAME_CONTEXT.md
```

---

### 2. constants.js
Populate with ALL constants from the GAME_CONTEXT.md constants section. This file must be complete before anything else imports from it.

---

### 3. main.js
Implement the full Phaser game config exactly as specified in GAME_CONTEXT.md section 3. Import all scene classes. All scenes not yet implemented should be stubbed as empty classes that extend `Phaser.Scene` with a `create()` that does nothing.

---

### 4. BootScene.js
Implement the following in `preload()`:
- Generate the player texture procedurally using Phaser Graphics exactly as shown in GAME_CONTEXT.md section 4. Texture key: `'player'`
- Generate a floor tile texture: 16x16 filled rect, color `COLORS.FLOOR` from constants. Key: `'floor_tile'`
- Generate a wall tile texture: 16x16 filled rect, color `COLORS.WALL` from constants. Key: `'wall_tile'`

In `create()`:
- Transition to `MainMenuScene`

---

### 5. MainMenuScene.js
Keep this minimal for now:
- Black background
- Centered text: "BOXED IN" in white, font size 32px
- Smaller text below: "press SPACE to start"
- On SPACE key: `this.scene.start('GameScene')`

---

### 6. Player.js
Implement the Player class as a `Phaser.Physics.Arcade.Sprite`.

Constructor takes `(scene, x, y)`.

Properties (read from RunState, but for now use BASE_STATS directly):
```js
this.speed = 120;
this.hp = 6;
this.maxHp = 6;
```

Methods:
- `update(keys, wasd)` — handles movement only (no shooting yet)
  - Read 8-directional input from keys and wasd
  - Normalize diagonal movement
  - Set arcade physics velocity accordingly
  - If no input, set velocity to zero

Input mapping:
- Move up: UP arrow or W
- Move down: DOWN arrow or S  
- Move left: LEFT arrow or A
- Move right: RIGHT arrow or D

---

### 7. GameScene.js
Implement only what's needed for Sprint 1:

In `create()`:
- Draw a simple room: filled rect for floor, 4 wall rects around the border using `WALL_THICKNESS` from constants
- Instantiate `Player` at center of room (240, 135)
- Set up keyboard input (`createCursorKeys` + WASD addKeys)
- Set up arcade physics worldBounds so player can't leave the room area

In `update(time, delta)`:
- Call `this.player.update(this.cursors, this.wasd)`

Do NOT implement: enemies, projectiles, doors, room manager, HUD. Those are future sprints.

---

## Acceptance Criteria
- [ ] `npm run dev` starts without errors
- [ ] Main menu displays "BOXED IN" and responds to SPACE
- [ ] GameScene shows a dark floor with darker wall borders
- [ ] White circle with two leg lines is visible in the center
- [ ] WASD and arrow keys move the player
- [ ] Player cannot move through walls or off screen
- [ ] No console errors

## Do NOT build in this sprint
- Shooting
- Enemies
- Doors
- Health / HUD
- Upgrades
- Room transitions
