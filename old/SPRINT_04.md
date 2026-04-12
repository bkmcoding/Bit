# SPRINT 04 — First Enemy (SpiderSpitter)
**Reference:** GAME_CONTEXT.md  
**Depends on:** Sprint 03 complete and passing  
**Goal:** One SpiderSpitter spawns in the room, tracks the player, fires projectiles at the player, takes damage from player projectiles, and dies. Player takes damage from enemy projectiles.

---

## Deliverables

### 1. BootScene.js — enemy textures
Generate enemy textures procedurally in `preload()`:

**SpiderSpitter texture** (key: `'spider_spitter'`):
- Dark purple filled circle, radius 8, color `0x4a1a6e`
- 4 short lines on each side as legs (8 total), color `0x3a1255`, width 1px
  - Left legs fan upward-left, mid-left, down-left at angles: 150°, 180°, 210°
  - Right legs at: 30°, 0°, 330°
  - Front left/right: 120° and 60°
  - Each leg line: 10px long from body edge
- 2 tiny red dot eyes: circles radius 1.5 at slight offsets from center
- Canvas size: 24×24

**Enemy projectile texture** (key: `'enemy_proj'`):
- Small dark purple circle, radius 3, color `0x9933cc`
- Canvas size: 8×8

---

### 2. EnemyBase.js
Implement the base class as described in GAME_CONTEXT.md section 7.

```js
class EnemyBase extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, textureKey, stats) {
    super(scene, x, y, textureKey);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    
    this.hp = stats.hp;
    this.maxHp = stats.hp;
    this.speed = stats.speed;
    this.damage = stats.damage;
    this.xpValue = stats.xp;
    
    this.isDead = false;
    this.state = 'IDLE';
    this.stateTimer = 0;
  }
  
  takeDamage(amount) {
    if (this.isDead) return;
    this.hp -= amount;
    // Flash red tint for 120ms
    this.setTint(0xff4444);
    this.scene.time.delayedCall(120, () => this.clearTint());
    if (this.hp <= 0) this.die();
  }
  
  die() {
    this.isDead = true;
    this.scene.game.events.emit('enemyDied', this);
    this.destroy();
  }
  
  setState(newState) {
    this.state = newState;
    this.stateTimer = 0;
  }
  
  update(time, delta) {
    // Override in subclasses
  }
}
```

---

### 3. SpiderSpitter.js
Extend `EnemyBase`. Use stats from `ENEMY_STATS.spiderSpitter` in `data/enemies.js`.

**State machine:** `IDLE` → `TRACK` → `SHOOT` → `COOLDOWN` → `TRACK`

State behaviors:
- `IDLE`: wait 500ms on spawn, then transition to `TRACK`
- `TRACK`: move toward player, maintain distance 80–150px
  - If closer than 80px: move away
  - If further than 150px: move toward
  - If in range: strafe (move perpendicular to player direction, pick a direction on enter and keep it)
  - After 1500ms in TRACK: transition to `SHOOT`
- `SHOOT`: stop moving, fire one projectile at player, immediately transition to `COOLDOWN`
- `COOLDOWN`: stand still for `fireRate` ms (2000ms), then back to `TRACK`

Projectile firing:
- Call `this.scene.spawnEnemyProjectile(this.x, this.y, angleToPlayer)`
- This method will be added to GameScene (see below)

Movement uses `scene.physics.velocityFromAngle()` to set velocity each frame.

Strafing: pick a strafe direction (clockwise or counter-clockwise) randomly on entering TRACK range. Reverse direction each time TRACK is re-entered.

---

### 4. enemies.js — populate
```js
export const ENEMY_STATS = {
  spiderSpitter: {
    hp: 3,
    speed: 60,
    damage: 1,
    projSpeed: 80,
    fireRate: 2000,
    xp: 5
  }
};
```

---

### 5. EnemySpawner.js
Simple class for now:

```js
class EnemySpawner {
  constructor(scene) {
    this.scene = scene;
    this.enemyGroup = scene.physics.add.group();
    this.activeEnemies = [];
  }
  
  spawnFromTemplate(template, floorMod) {
    // For Sprint 4: ignore floorMod, just spawn enemies at template slots
    // Hardcode: spawn 1 SpiderSpitter at first enemySlot
    const slot = template.enemySlots[0];
    const x = WALL_THICKNESS + slot.xNorm * (ROOM_WIDTH - WALL_THICKNESS * 2);
    const y = WALL_THICKNESS + slot.yNorm * (ROOM_HEIGHT - WALL_THICKNESS * 2);
    const enemy = new SpiderSpitter(this.scene, x, y);
    this.enemyGroup.add(enemy);
    this.activeEnemies.push(enemy);
  }
  
  getAliveCount() {
    return this.activeEnemies.filter(e => !e.isDead).length;
  }
  
  update(time, delta) {
    this.activeEnemies.forEach(e => {
      if (!e.isDead) e.update(time, delta);
    });
    // Clean up dead references
    this.activeEnemies = this.activeEnemies.filter(e => !e.isDead);
  }
}
```

---

### 6. GameScene.js — wire enemies + damage

In `create()`:
- Instantiate `EnemySpawner`
- Call `this.enemySpawner.spawnFromTemplate(template)` after room loads
- Create enemy projectile pool (same pattern as player projectiles, key `'enemy_proj'`, maxSize 20):
  ```js
  this.enemyProjectiles = this.physics.add.group({
    classType: Projectile,
    maxSize: 20,
    runChildUpdate: true
  });
  ```
- Register collisions:
  - `this.playerProjectiles` vs `this.enemySpawner.enemyGroup` → `onPlayerProjHitEnemy`
  - `this.enemyProjectiles` vs `this.player` → `onEnemyProjHitPlayer`
  - `this.enemyProjectiles` vs `this.roomManager.wallGroup` → destroy projectile
  - `this.enemyProjectiles` vs `this.roomManager.obstacleGroup` → destroy projectile
  - `this.enemySpawner.enemyGroup` vs `this.roomManager.wallGroup` → collide (block)
  - `this.enemySpawner.enemyGroup` vs `this.roomManager.obstacleGroup` → collide (block)

Add `spawnEnemyProjectile(x, y, angleDeg)` method:
```js
spawnEnemyProjectile(x, y, angleDeg) {
  const proj = this.enemyProjectiles.get();
  if (!proj) return;
  proj.fire(x, y, angleDeg, ENEMY_STATS.spiderSpitter.projSpeed, 1, 300, 3);
}
```

Handlers:
```js
function onPlayerProjHitEnemy(projectile, enemy) {
  projectile.deactivate();
  enemy.takeDamage(/* player's damage stat */ 1);
}

function onEnemyProjHitPlayer(player, projectile) {
  projectile.deactivate();
  player.takeDamage(1); // needs player.takeDamage() — see below
}
```

In `update(time, delta)`:
- Call `this.enemySpawner.update(time, delta)`

---

### 7. Player.js — add takeDamage
```js
takeDamage(amount) {
  if (this.invincible) return;
  this.hp -= amount;
  this.invincible = true;
  // Flash effect: alternate alpha
  this.scene.tweens.add({
    targets: this,
    alpha: 0.2,
    duration: 80,
    yoyo: true,
    repeat: 4,
    onComplete: () => {
      this.alpha = 1;
      this.invincible = false;
    }
  });
  // Emit event for HUD (Sprint 6 will listen)
  this.scene.game.events.emit('playerDamaged', this.hp, this.maxHp);
  if (this.hp <= 0) {
    this.scene.game.events.emit('playerDied');
  }
}
```

Set `this.invincible = false` in constructor. iFrame duration: `800`ms (use `iFrameDuration` from constants).

---

## Acceptance Criteria
- [ ] SpiderSpitter spawns at the enemy slot position
- [ ] Enemy visually has a body circle + 8 legs + 2 eyes
- [ ] Enemy tracks toward/away from player depending on distance
- [ ] Enemy stops and fires a projectile at the player every ~2 seconds
- [ ] Enemy projectile travels toward player and disappears on walls
- [ ] Enemy projectile hitting the player reduces player HP (console.log HP for now)
- [ ] Player projectile hitting enemy flashes it red
- [ ] 3 hits kill the enemy — it disappears
- [ ] Player has iFrames after being hit (flashing, can't be hit again mid-flash)
- [ ] No console errors

## Do NOT build in this sprint
- Multiple enemies
- Room clearing / door unlock
- HUD health display
- SpiderDasher
- Player death screen (just log it)
