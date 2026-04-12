# SPRINT 07 — Content Pass (Second Enemy, Full Upgrade Pool, Floor Scaling, Win Condition)
**Reference:** GAME_CONTEXT.md  
**Depends on:** Sprint 06 complete and passing  
**Goal:** The game is a complete playable run. SpiderDasher added. All upgrades in pool. Floor 1→2→3 scaling works. Beating floor 3 shows a win screen.

---

## Deliverables

### 1. SpiderDasher.js
Implement per GAME_CONTEXT.md section 7.

**Texture** (generate in BootScene, key: `'spider_dasher'`):
- Dark red filled circle, radius 7, color `0x6e1a1a`
- 8 legs (same pattern as SpiderSpitter)
- No eyes or very subtle eyes
- Canvas: 22×22

**State machine:** `IDLE` → `WANDER` → `PREPARE_DASH` → `DASH` → `COOLDOWN` → `WANDER`

State behaviors:
- `IDLE`: 300ms, then → `WANDER`
- `WANDER`: move in a slow random direction, change direction every 1000ms, if player within 160px → `PREPARE_DASH`
- `PREPARE_DASH` (0.5s wind-up):
  - Stop moving
  - Flash tint orange `0xff8800` rapidly (tween alpha between tints, 80ms cycle)
  - Record `this.dashTarget = { x: player.x, y: player.y }` at start of state (not updated during wind-up — dashes to where player WAS)
  - After 500ms → `DASH`
- `DASH`:
  - Set velocity toward `dashTarget` at `dashSpeed` (300)
  - Dash lasts until either: player position reached within 20px, OR 600ms elapsed, OR wall contact
  - On wall contact: stop, → `COOLDOWN`
  - Apply contact damage to player if overlap occurs during DASH state only
  - → `COOLDOWN` when done
- `COOLDOWN`: stand still 1500ms, clear tint, → `WANDER`

Add to `ENEMY_STATS` in `enemies.js`:
```js
spiderDasher: {
  hp: 2,
  speed: 50,
  dashSpeed: 300,
  damage: 1,
  dashCooldown: 1500,
  xp: 4
}
```

---

### 2. EnemySpawner.js — spawn mixed enemy types
Update `spawnFromTemplate` to spawn a mix of enemy types:

```js
spawnFromTemplate(template, floor = 1, roomIndex = 0) {
  const totalCount = Math.min(floor + roomIndex + 1, 6);
  const slots = Phaser.Utils.Array.Shuffle([...template.enemySlots]).slice(0, totalCount);
  
  slots.forEach((slot, i) => {
    const x = WALL_THICKNESS + slot.xNorm * (ROOM_WIDTH - WALL_THICKNESS * 2);
    const y = WALL_THICKNESS + slot.yNorm * (ROOM_HEIGHT - WALL_THICKNESS * 2);
    
    // Mix: floor 1 = mostly spitters, floor 2+ = mix
    let EnemyClass;
    if (floor === 1) {
      EnemyClass = i % 3 === 2 ? SpiderDasher : SpiderSpitter;
    } else {
      EnemyClass = i % 2 === 0 ? SpiderSpitter : SpiderDasher;
    }
    
    const enemy = new EnemyClass(this.scene, x, y);
    // Apply floor HP scaling
    const hpMult = FLOOR_MODS[floor]?.enemyHpMult ?? 1;
    enemy.hp = Math.ceil(enemy.hp * hpMult);
    enemy.maxHp = enemy.hp;
    
    this.enemyGroup.add(enemy);
    this.activeEnemies.push(enemy);
  });
}
```

Add `FLOOR_MODS` to `constants.js`:
```js
export const FLOOR_MODS = {
  1: { enemyHpMult: 1.0,  enemySpeedMult: 1.0 },
  2: { enemyHpMult: 1.4,  enemySpeedMult: 1.1 },
  3: { enemyHpMult: 1.8,  enemySpeedMult: 1.25 },
};
```

---

### 3. upgrades.js — complete the pool
Add all remaining upgrades from GAME_CONTEXT.md section 9:

- `proj_speed_up` — projectileSpeed += 50
- `proj_size_up` — projectileSize += 2 (max cap 8)
- `longer_iframes` — iFrameDuration += 200
- `shield` — shieldCharges = 1 (absorbs one hit; handled in Player.takeDamage)
- `triple_shot` — hasTripleShot = true
- `bouncy_shots` — hasBouncyShots = true
- `piercing` — hasPiercing = true

For `shield`: in `Player.takeDamage()`, check `RunState.shieldCharges > 0` first. If yes, decrement charges, show a brief shield break visual (white flash full body), skip damage. 

For `triple_shot`: in `Player.shoot()`, if `RunState.hasTripleShot`, fire 3 projectiles: one at the aim angle, one at angle-15°, one at angle+15°.

For `piercing`: track a `piercedCount` on the projectile. In `onPlayerProjHitEnemy`, only deactivate if `proj.piercedCount >= 1` (else increment and continue). Add `this.piercedCount = 0` to `Projectile.fire()`.

For `bouncy_shots`: in `onProjectileHitWall`, instead of deactivating, reflect the velocity vector and increment a `bounceCount`. Deactivate if `bounceCount >= 1`. Reflecting off a wall: negate vx if hitting a horizontal wall, negate vy if hitting a vertical wall. This requires knowing which wall was hit — pass the wall game object into the handler and check its orientation (or check: if `Math.abs(wall.width) > Math.abs(wall.height)` it's a horizontal wall).

---

### 4. Floor progression in RoomManager + GameScene

**Floor complete trigger:**
After clearing the last room of a floor, instead of loading another room, emit `'floorComplete'`.

In `RoomManager.loadNextRoom()`:
```js
if (this.currentRoomIndex >= this.roomSequence.length) {
  this.scene.game.events.emit('floorComplete', RunState.floor);
  return null;
}
```

In `GameScene`, listen for `floorComplete`:
```js
this.game.events.on('floorComplete', (completedFloor) => {
  if (completedFloor >= 3) {
    // Win!
    this.scene.stop('HUDScene');
    this.scene.start('GameOverScene', {
      win: true,
      floor: RunState.floor,
      roomsCleared: RunState.roomsCleared
    });
  } else {
    // Advance to next floor
    RunState.floor++;
    this.scene.pause();
    this.scene.launch('UpgradeScene', {
      upgrades: this.upgradeSystem.draw(3),
      isBetweenFloors: true
    });
  }
});
```

On UpgradeScene resume after a floor transition:
- `this.roomManager.initFloor(RunState.floor)`
- `this.roomManager.loadNextRoom()`
- Respawn enemies with new floor scaling

---

### 5. rooms.js — add 5 more templates
Expand to 8 total templates so each run feels different. Add:

- `'cross'`: two obstacle walls forming a + shape in the center, leaving 4 corridors
- `'ring'`: 8 small obstacles in a rough circle around the center  
- `'split'`: one long horizontal obstacle splitting the room roughly in half with a gap on each side
- `'corner_boxes'`: 4 small obstacles in each corner
- `'scattered'`: 6 random small obstacles at varied positions

All templates should have 4–5 enemy slots and a variety of door configurations.

---

### 6. GameOverScene.js — update win screen
Differentiate the win and death screens more clearly:

- Win: "YOU ESCAPED" in `#44cc88`, larger (32px), add a subtitle "the spider den"
- Death: "YOU DIED" in `#cc3333`
- Both: stats block with floor, rooms cleared, upgrades acquired count
- Restart prompt unchanged

---

## Acceptance Criteria
- [ ] SpiderDasher spawns and uses its full state machine (wander → telegraph → dash → cooldown)
- [ ] SpiderDasher orange flash is visible before dashing
- [ ] SpiderDasher deals contact damage only during the DASH state
- [ ] Floor 1 has 3 rooms, Floor 2 has 4, Floor 3 has 5 (from FLOOR_ROOMS_PER_FLOOR)
- [ ] Enemy HP visibly increases on floor 2 and 3 (takes more shots to kill)
- [ ] Between-floor upgrade screen appears after clearing the last room of a floor
- [ ] Clearing floor 3 triggers the win screen
- [ ] triple_shot fires 3 projectiles in a spread
- [ ] piercing projectile passes through first enemy, dies on second
- [ ] bouncy_shots reflect off one wall then die
- [ ] shield absorbs one hit with a visible flash, then is consumed
- [ ] All 14 upgrades appear in the pool (can verify by watching many upgrade screens)
- [ ] A full run (floor 1 → 2 → 3 → win) is completable without errors

## Do NOT build in this sprint
- SpiderMother boss
- Audio
- Minimap
- Meta-progression
- Particles / visual polish
