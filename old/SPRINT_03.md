# SPRINT 03 — Shooting System
**Reference:** GAME_CONTEXT.md  
**Depends on:** Sprint 02 complete and passing  
**Goal:** Player clicks to shoot a projectile toward the mouse cursor. Projectiles destroy on wall/obstacle contact. Fire rate cooldown works. Object pooling is in place.

---

## Deliverables

### 1. Projectile.js
Implement the `Projectile` class extending `Phaser.Physics.Arcade.Sprite`.

Use the full implementation from GAME_CONTEXT.md section 8 as the base.

Additional details:
- In `preload` (handled in BootScene — see below), a `'projectile'` texture will exist
- On `fire()`, set velocity using `scene.physics.velocityFromAngle(angleDeg, speed, this.body.velocity)`
- Track `this.distanceTraveled` each `preUpdate` using delta-time calculation
- On max range exceeded OR wall hit: call `this.deactivate()`
- Physics body: circle, radius = `this.size` (passed in from player stats)

`fire(x, y, angleDeg, speed, damage, range, size)` signature.

---

### 2. BootScene.js — add projectile texture
In `preload()`, generate the projectile texture:
```js
// Small glowing white circle
const pg = scene.make.graphics({ add: false });
pg.fillStyle(0xffffff, 1);
pg.fillCircle(4, 4, 3);
pg.generateTexture('projectile', 8, 8);
pg.destroy();
```

---

### 3. Player.js — add shooting
Add shooting capability to Player.

New properties:
```js
this.projectileDamage = 1;
this.fireRate = 500;       // ms
this.projectileSpeed = 200;
this.projectileRange = 200;
this.projectileSize = 3;
this.lastFired = 0;
```

New method: `shoot(targetX, targetY, time, projectileGroup)`
- Check cooldown: `if (time - this.lastFired < this.fireRate) return`
- Calculate angle from player center to (targetX, targetY) using `Phaser.Math.Angle.Between` then convert to degrees
- Get a projectile from the pool: `projectileGroup.get()`
- If no projectile available (pool exhausted), return
- Call `projectile.fire(this.x, this.y, angleDeg, speed, damage, range, size)`
- Update `this.lastFired = time`

Update `update(keys, wasd, time, pointer, projectileGroup)` signature to accept new params. Call `shoot` when mouse button is held down (`pointer.isDown`).

---

### 4. GameScene.js — wire up shooting
In `create()`:
- Create player projectile group as an object pool:
```js
this.playerProjectiles = this.physics.add.group({
  classType: Projectile,
  maxSize: 30,
  runChildUpdate: true
});
```
- Register colliders:
  - `this.playerProjectiles` vs `this.roomManager.wallGroup` → destroy projectile
  - `this.playerProjectiles` vs `this.roomManager.obstacleGroup` → destroy projectile
- Enable pointer input: `this.input.setPollAlways()` so pointer position updates even when not moving

In `update(time, delta)`:
- Pass `time`, `this.input.activePointer`, and `this.playerProjectiles` to `player.update()`

---

### 5. Projectile wall hit handler
```js
function onProjectileHitWall(projectile, wall) {
  projectile.deactivate();
}
```
Register this as the callback for both wall and obstacle overlaps.

---

## Visual Spec
- Projectile: small white circle (radius 3), moves in a straight line
- No trail or glow effects yet (save for a later polish sprint)
- Projectile disappears instantly on wall contact (no explosion, no particles yet)

---

## Acceptance Criteria
- [ ] Clicking fires a projectile toward the mouse cursor
- [ ] Holding mouse button fires continuously at the fire rate interval
- [ ] Projectile travels in a straight line at correct angle
- [ ] Projectile disappears when it hits a wall or obstacle
- [ ] Projectile disappears after traveling its max range
- [ ] Object pool is used (not `new Projectile()` each shot)
- [ ] Fire rate cooldown prevents spam shooting
- [ ] No console errors, no memory leaks from un-deactivated projectiles

## Do NOT build in this sprint
- Projectile hitting enemies (no enemies yet)
- Enemy projectiles
- Upgrade modifiers on shooting stats
- Visual effects / particles on impact
- Keyboard-direction shooting (mouse only for now)
