# SPRINT 06 — HUD, Health Display & Death Screen
**Reference:** GAME_CONTEXT.md  
**Depends on:** Sprint 05 complete and passing  
**Goal:** Player health is displayed on screen as hearts. Taking damage updates the HUD. Dying shows a game over screen with stats. Restarting resets everything correctly.

---

## Deliverables

### 1. BootScene.js — heart textures
Generate heart textures procedurally:

**Full heart** (key: `'heart_full'`): 12×12, white filled circle  
**Half heart** (key: `'heart_half'`): 12×12, left half filled white, right half outline only  
**Empty heart** (key: `'heart_empty'`): 12×12, white circle outline only (no fill), stroke 1.5px  

Use Phaser Graphics with appropriate arc/fill calls. Keep them simple — circles are fine for placeholder. Custom heart art can replace these later.

---

### 2. HealthBar.js
A UI component class (not a Phaser Scene — just a plain class that manages Phaser objects).

```js
class HealthBar {
  constructor(scene, x, y) {
    this.scene = scene;
    this.x = x;
    this.y = y;
    this.hearts = [];        // array of Image objects
    this.maxHearts = 0;
    this.container = scene.add.container(x, y);
  }

  setMax(maxHp) {
    // maxHp is in half-hearts; full hearts = maxHp / 2
    this.maxHearts = Math.ceil(maxHp / 2);
    this.rebuild(maxHp, maxHp);
  }

  update(currentHp, maxHp) {
    // Update each heart image based on current HP
    // full heart = 2 half-hearts, half heart = 1, empty = 0
    this.hearts.forEach((heart, i) => {
      const heartValue = currentHp - i * 2;
      if (heartValue >= 2) heart.setTexture('heart_full');
      else if (heartValue === 1) heart.setTexture('heart_half');
      else heart.setTexture('heart_empty');
    });
  }

  rebuild(currentHp, maxHp) {
    this.container.removeAll(true);
    this.hearts = [];
    const count = Math.ceil(maxHp / 2);
    for (let i = 0; i < count; i++) {
      const img = this.scene.add.image(i * 16, 0, 'heart_full');
      img.setOrigin(0, 0);
      this.container.add(img);
      this.hearts.push(img);
    }
    this.update(currentHp, maxHp);
  }
}
```

---

### 3. HUDScene.js — implement
HUDScene runs **in parallel** with GameScene. It must NEVER pause when GameScene pauses (UpgradeScene uses `scene.pause()` on GameScene, not HUDScene).

In `create()`:
- Set camera to ignore all game world objects (this scene only renders UI)
- Add `HealthBar` instance at position (8, 8) in screen space
- Initialize it from `RunState.currentHealth` and `RunState.maxHealth`
- Add floor + room text at top right:
  ```js
  this.floorText = this.add.text(
    ROOM_WIDTH - 8, 8,
    `FLOOR ${RunState.floor} — ROOM ${RunState.roomsCleared + 1}`,
    { fontSize: '8px', color: '#aaaaaa', fontFamily: 'monospace' }
  ).setOrigin(1, 0);
  ```
- Listen to game events:
  ```js
  this.game.events.on('playerDamaged', (hp, maxHp) => {
    this.healthBar.update(hp, maxHp);
    RunState.currentHealth = hp;
  });
  this.game.events.on('roomCleared', () => {
    this.floorText.setText(`FLOOR ${RunState.floor} — ROOM ${RunState.roomsCleared + 1}`);
  });
  this.game.events.on('maxHpChanged', (maxHp) => {
    this.healthBar.rebuild(RunState.currentHealth, maxHp);
  });
  ```

In `update()`:
- No per-frame logic needed — event driven only

**Important:** Launch HUDScene from GameScene, not from main config scene array:
```js
// In GameScene create():
this.scene.launch('HUDScene');
```
Stop HUDScene when GameScene stops or restarts:
```js
// In GameScene (on death / restart):
this.scene.stop('HUDScene');
```

---

### 4. GameScene.js — emit HUD events
Ensure these events are emitted at the right moments:

- On room cleared (when doors unlock): `this.game.events.emit('roomCleared')`
- On player damaged: already emitted in `Player.takeDamage()` — verify it passes `(hp, maxHp)`
- On max HP upgrade applied (in `syncPlayerFromRunState`): 
  ```js
  this.game.events.emit('maxHpChanged', RunState.maxHealth);
  ```

---

### 5. GameOverScene.js — implement
Receives optional data: `{ win: boolean, floor: number, roomsCleared: number }`

In `create()`:
- Stop HUDScene if still running
- Black background (graphics rect, full screen)
- If `win`:
  - Title: "YOU ESCAPED" in white, 28px, centered at 40% height
- If not win (death):
  - Title: "YOU DIED" in `#cc3333`, 28px, centered at 40% height
- Stats text (centered, 10px gray):
  - `Floor reached: X`
  - `Rooms cleared: X`
- Restart button text: "PRESS SPACE TO TRY AGAIN" in white, 12px, centered at 70% height
  - Blink tween: alpha 1 → 0 → 1, 800ms loop
- On SPACE or click:
  - `RunState.reset()`
  - `this.scene.stop('HUDScene')`
  - `this.scene.start('GameScene')`

---

### 6. Player.js — trigger death scene
Update `takeDamage()` — on death:
```js
if (this.hp <= 0) {
  this.scene.game.events.emit('playerDied');
  this.scene.time.delayedCall(400, () => {
    this.scene.scene.stop('HUDScene');
    this.scene.scene.start('GameOverScene', {
      win: false,
      floor: RunState.floor,
      roomsCleared: RunState.roomsCleared
    });
  });
}
```
The 400ms delay gives a brief pause for impact before the scene switches.

---

### 7. UpgradeSystem — emit maxHp event on apply
When `max_hp_up` upgrade is applied, the HUD needs to rebuild hearts.
In `UpgradeScene.js`, after calling `upgradeSystem.applyUpgrade(...)`:
```js
if (selectedId === 'max_hp_up') {
  scene.game.events.emit('maxHpChanged', RunState.maxHealth);
}
```

Or better: make all upgrade `apply()` functions emit their own side-effect events. For Sprint 6, just handle `max_hp_up` explicitly.

---

## Acceptance Criteria
- [ ] Health hearts visible in top-left during gameplay
- [ ] Hearts update immediately when player is hit
- [ ] Half-heart state displays correctly when on odd HP
- [ ] Hearts rebuild correctly after a max HP upgrade
- [ ] Floor and room number display updates after each room clear
- [ ] Player death triggers GameOverScene after a short delay
- [ ] GameOver screen shows "YOU DIED", floor reached, rooms cleared
- [ ] SPACE on GameOver restarts the full run from Floor 1
- [ ] RunState.reset() works — all stats return to base on restart
- [ ] HUD does not pause/disappear when UpgradeScene opens
- [ ] No memory leaks from HUDScene event listeners on restart (remove listeners on scene shutdown)

## Do NOT build in this sprint
- Win condition / floor 3 escape
- SpiderDasher enemy
- Boss room
- Minimap
- Audio
