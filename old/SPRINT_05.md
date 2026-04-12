# SPRINT 05 — Room Clear Loop + Upgrade Flow
**Reference:** GAME_CONTEXT.md  
**Depends on:** Sprint 04 complete and passing  
**Goal:** Kill all enemies → doors unlock → player walks through a door → upgrade card screen appears → player picks one → next room loads with more enemies. The full core loop works end to end.

---

## Deliverables

### 1. RunState.js — implement fully
Implement the complete RunState object from GAME_CONTEXT.md section 9.

```js
export const RunState = {
  maxHealth: 6,
  currentHealth: 6,
  speed: 120,
  projectileDamage: 1,
  fireRate: 500,
  projectileSpeed: 200,
  projectileSize: 3,
  projectileRange: 200,
  iFrameDuration: 800,

  floor: 1,
  roomsCleared: 0,
  upgradesAcquired: [],

  hasTripleShot: false,
  hasBouncyShots: false,
  hasPiercing: false,
  shieldCharges: 0,

  reset() {
    Object.assign(this, {
      maxHealth: 6, currentHealth: 6,
      speed: 120, projectileDamage: 1,
      fireRate: 500, projectileSpeed: 200,
      projectileSize: 3, projectileRange: 200,
      iFrameDuration: 800,
      floor: 1, roomsCleared: 0,
      upgradesAcquired: [],
      hasTripleShot: false, hasBouncyShots: false,
      hasPiercing: false, shieldCharges: 0
    });
  }
};
```

---

### 2. upgrades.js — implement 6 starter upgrades
Implement these 6 upgrades from GAME_CONTEXT.md section 9 as the starting pool. Follow the exact data shape:

```js
{ id, name, description, rarity: 'common'|'rare', icon: string, apply: (runState) => void }
```

Upgrades to implement:
1. `damage_up` — +1 projectile damage
2. `fire_rate_up` — fireRate -= 75 (faster), min cap at 150ms
3. `speed_up` — speed += 15
4. `max_hp_up` — maxHealth += 2, currentHealth += 2
5. `heal_1` — currentHealth = Math.min(currentHealth + 2, maxHealth)
6. `range_up` — projectileRange += 60

---

### 3. UpgradeSystem.js
```js
class UpgradeSystem {
  constructor() {
    this.pool = [...UPGRADES]; // copy of all available upgrades
  }

  draw(count = 3) {
    // Shuffle a copy and return `count` unique upgrades
    const shuffled = Phaser.Utils.Array.Shuffle([...this.pool]);
    return shuffled.slice(0, count);
  }
  
  applyUpgrade(upgradeId, runState) {
    const upgrade = this.pool.find(u => u.id === upgradeId);
    if (!upgrade) return;
    upgrade.apply(runState);
    runState.upgradesAcquired.push(upgradeId);
  }
}
```

---

### 4. UpgradeScene.js — implement card UI
This scene runs as an **overlay** on top of the paused GameScene.

In `create()`:
- Receive upgrade choices via `this.scene.settings.data.upgrades` (passed when launched)
- Dark semi-transparent background: graphics rect covering full screen, fill `0x000000` alpha `0.75`
- Centered title text: "CHOOSE YOUR UPGRADE" white, 18px
- Render 3 `UpgradeCard` UI objects horizontally centered with spacing

UpgradeCard layout (each card, drawn with Phaser Graphics + Text):
- Width: 120px, Height: 160px
- Background: dark rounded rect `0x222233` 
- Rarity color border: common = `0x888899`, rare = `0xffaa00`
- Icon area: 40×40 colored circle (use `rarity === 'rare' ? 0xffaa00 : 0x6677aa`) at top center of card
- Name text: white, 10px, centered below icon
- Description text: gray `0xaaaaaa`, 9px, word-wrapped, centered below name

On card click / keyboard 1-2-3:
- Call `upgradeSystem.applyUpgrade(selectedId, RunState)`
- Sync player stats from RunState (see below)
- Stop this scene: `this.scene.stop()`
- Resume GameScene: `this.scene.resume('GameScene')`
- GameScene will then load the next room (see RoomManager changes below)

---

### 5. RoomManager.js — add next room loading
Add new properties:
```js
this.currentRoomIndex = 0;
this.roomSequence = [];  // shuffled template array for this floor
```

New method: `initFloor(floor)`
- Shuffle a copy of `ROOM_TEMPLATES`
- Store as `this.roomSequence`
- Reset `this.currentRoomIndex = 0`

Update `loadRoom()` to accept no argument and use `this.roomSequence[this.currentRoomIndex]` internally. Or keep accepting a template directly — either is fine.

New method: `loadNextRoom()`
- Call `this.destroyRoom()`
- Increment `this.currentRoomIndex`
- If `currentRoomIndex >= roomSequence.length`, emit `'floorComplete'` event and return
- Otherwise call `this.loadRoom(nextTemplate)`
- Call `this.lockDoors()`
- Return the new template (so GameScene can respawn enemies)

Update `unlockDoors()`:
- After the door unlock tween completes, emit a `'doorsUnlocked'` event on `scene.events`

---

### 6. GameScene.js — wire the full loop

**On room load:**
- Read spawn count from `EnemySpawner` using current room + floor scaling
- For Sprint 5: spawn 2–3 SpiderSpitters per room

**Listening for enemy deaths:**
```js
this.game.events.on('enemyDied', () => {
  if (this.enemySpawner.getAliveCount() === 0) {
    this.roomManager.unlockDoors();
  }
});
```

**Listening for doors unlocked:**
```js
this.scene.events.on('doorsUnlocked', () => {
  // Doors are now passable — wait for player to walk through
});
```

**Detecting player walking through a door:**
- Add an overlap between `this.player` and `this.roomManager.doorGroup`
- When overlap detected AND doors are unlocked:
  ```js
  onPlayerEntersDoor() {
    if (!this.roomManager.doorsLocked) {
      RunState.roomsCleared++;
      this.scene.pause();
      this.scene.launch('UpgradeScene', {
        upgrades: this.upgradeSystem.draw(3)
      });
    }
  }
  ```

**On UpgradeScene close (GameScene resumes):**
- Listen for scene resume event:
  ```js
  this.events.on('resume', () => {
    this.syncPlayerFromRunState();
    this.roomManager.loadNextRoom();
    this.enemySpawner.clear();
    this.enemySpawner.spawnFromTemplate(this.roomManager.currentTemplate);
    this.rewireColliders(); // re-add colliders for new room objects
  });
  ```

**syncPlayerFromRunState():**
```js
syncPlayerFromRunState() {
  this.player.speed = RunState.speed;
  this.player.projectileDamage = RunState.projectileDamage;
  this.player.fireRate = RunState.fireRate;
  this.player.projectileSpeed = RunState.projectileSpeed;
  this.player.projectileRange = RunState.projectileRange;
  this.player.maxHp = RunState.maxHealth;
  this.player.hp = RunState.currentHealth;
}
```

**rewireColliders():** Extract all `physics.add.collider/overlap` calls into a dedicated method so they can be called again after a room reload without duplicating. Destroy old colliders before re-adding.

---

### 7. EnemySpawner.js — add clear() and scale spawning
```js
clear() {
  this.enemyGroup.clear(true, true);
  this.activeEnemies = [];
}

spawnFromTemplate(template, floor = 1, roomIndex = 0) {
  const count = Math.min(floor + roomIndex + 1, 5); // 2–5 enemies
  const slots = Phaser.Utils.Array.Shuffle([...template.enemySlots]).slice(0, count);
  slots.forEach(slot => {
    const x = WALL_THICKNESS + slot.xNorm * (ROOM_WIDTH - WALL_THICKNESS * 2);
    const y = WALL_THICKNESS + slot.yNorm * (ROOM_HEIGHT - WALL_THICKNESS * 2);
    const enemy = new SpiderSpitter(this.scene, x, y);
    this.enemyGroup.add(enemy);
    this.activeEnemies.push(enemy);
  });
}
```

---

## Acceptance Criteria
- [ ] Room starts with enemies present and doors locked (visually red)
- [ ] Killing all enemies causes doors to turn yellow and become passable
- [ ] Walking the player into an unlocked door triggers the upgrade screen
- [ ] Upgrade screen shows 3 cards with name and description
- [ ] Clicking a card applies the upgrade to RunState
- [ ] After selecting, the game resumes and a new room loads with enemies
- [ ] Player stats reflect the chosen upgrade (e.g. fire rate is visibly faster after `fire_rate_up`)
- [ ] Room index increments correctly — a different template loads each time
- [ ] No console errors, no duplicate colliders on room reload

## Do NOT build in this sprint
- HUD health display (Sprint 6)
- Player death screen (Sprint 6)
- Floor transitions / boss rooms
- SpiderDasher enemy
- Minimap
