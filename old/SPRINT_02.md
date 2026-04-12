# SPRINT 02 — Room System + Walls
**Reference:** GAME_CONTEXT.md  
**Depends on:** Sprint 01 complete and passing  
**Goal:** A proper room loads from a template. Player walks around inside a box with wall collisions. Locked door tiles exist on walls but are not passable yet.

---

## Deliverables

### 1. constants.js additions
Add these if not already present:
```js
export const FLOOR_ROOMS_PER_FLOOR = [3, 4, 5]; // rooms per floor index 0,1,2
export const DOOR_SIZE = 24; // pixel width/height of door opening
```

---

### 2. rooms.js
Populate `ROOM_TEMPLATES` array with 3 starter templates.

Each template shape:
```js
{
  id: string,
  obstacles: Array<{ xNorm: number, yNorm: number, w: number, h: number }>,
  doors: Array<'north' | 'south' | 'east' | 'west'>,
  enemySlots: Array<{ xNorm: number, yNorm: number }>
}
```

`xNorm` and `yNorm` are 0.0–1.0 normalized, relative to the inner floor area (excluding walls).

Template 1 — `'open'`: no obstacles, doors on east and south, 3 enemy slots spread around  
Template 2 — `'pillars'`: 3 small square obstacles (20×20) in a triangle formation, doors on all 4 sides, 4 enemy slots  
Template 3 — `'corridor'`: 2 long rectangular obstacles (16×80) running vertically forming a channel, doors north and south, 3 enemy slots  

---

### 3. RoomManager.js
Implement the `RoomManager` class.

Constructor: `constructor(scene)`
- Stores reference to scene
- Initializes `this.wallGroup` (static physics group)
- Initializes `this.doorGroup` (static physics group)
- Initializes `this.obstacleGroup` (static physics group)
- Initializes `this.currentTemplate = null`
- Initializes `this.doorsLocked = true`

Method: `loadRoom(template)`
- Clears all groups
- Draws floor as a filled graphics rect (color `COLORS.FLOOR`)
- Builds 4 wall segments as physics-enabled static sprites or graphics using `wall_tile` texture, thickness `WALL_THICKNESS`
  - Leave a gap in each wall where a door exists per `template.doors`
  - Gap size: `DOOR_SIZE` pixels, centered on that wall
- For each door in `template.doors`: create a door tile (colored rect) using `COLORS.DOOR_LOCKED`, add to `doorGroup` with physics body enabled (solid/blocking for now)
- For each obstacle in `template.obstacles`: denormalize position using room inner bounds, create static rect sprite, add to `obstacleGroup`
- Store `this.currentTemplate = template`

Method: `lockDoors()`
- Set all door body enabled = true
- Tint door tiles `COLORS.DOOR_LOCKED`

Method: `unlockDoors()`
- Set all door body enabled = false (passable)
- Tint door tiles `COLORS.DOOR_OPEN`
- Play a brief tween: each door tile scales from 1 → 1.15 → 1 over 200ms

Method: `destroyRoom()`
- Clear all groups, destroy all game objects

---

### 4. GameScene.js — update
Replace the manual room drawing from Sprint 1 with `RoomManager`.

In `create()`:
- Instantiate `RoomManager`
- Pick the first template from `ROOM_TEMPLATES` for now (hardcoded index 0)
- Call `this.roomManager.loadRoom(template)`
- Register colliders:
  - `player` vs `wallGroup`
  - `player` vs `obstacleGroup`
  - `player` vs `doorGroup`
- Player still spawns at center

In `update()`:
- No changes needed for Sprint 2

---

### 5. Player.js — minor update
No logic changes. Ensure the physics body is a circle (use `setCircle()`) with appropriate radius so it fits through door gaps cleanly.

```js
// In constructor after adding to scene:
this.body.setCircle(5, 3, 3); // radius 5, offset to center
```

---

## Visual Spec for Doors
- Door tile should be a visible colored rectangle placed flush in the wall gap
- Locked: `COLORS.DOOR_LOCKED` (red-tinted)
- Open: `COLORS.DOOR_OPEN` (yellow)
- Door is the same thickness as the wall (WALL_THICKNESS) and DOOR_SIZE wide

---

## Acceptance Criteria
- [ ] Room loads from a template
- [ ] Walls are solid — player cannot pass through them
- [ ] Door gaps exist on correct walls per template
- [ ] Doors are visually distinct from walls (colored differently)
- [ ] Door tiles are solid/impassable (rooms are fully sealed this sprint)
- [ ] Obstacles are solid and player collides with them
- [ ] Switching the hardcoded template index shows a different room layout
- [ ] No console errors

## Do NOT build in this sprint
- Door unlock logic (that's Sprint 5)
- Room transitions / next room loading
- Enemy spawning
- Shooting
- HUD
