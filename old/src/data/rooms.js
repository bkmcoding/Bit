/**
 * Room layout templates. xNorm/yNorm are 0–1 in the inner floor rect (excluding wall thickness).
 * @typedef {'north' | 'south' | 'east' | 'west'} DoorSide
 * @typedef {{ xNorm: number, yNorm: number, w: number, h: number }} RoomObstacle
 * @typedef {{ xNorm: number, yNorm: number }} EnemySlot
 * @typedef {{ id: string, obstacles: RoomObstacle[], doors: DoorSide[], enemySlots: EnemySlot[] }} RoomTemplate
 */

/** @type {RoomTemplate[]} */
export const ROOM_TEMPLATES = [
  {
    id: 'open',
    obstacles: [],
    doors: ['east', 'south'],
    enemySlots: [
      { xNorm: 0.25, yNorm: 0.3 },
      { xNorm: 0.75, yNorm: 0.3 },
      { xNorm: 0.5, yNorm: 0.7 },
    ],
  },
  {
    id: 'pillars',
    obstacles: [
      { xNorm: 0.3, yNorm: 0.4, w: 20, h: 20 },
      { xNorm: 0.7, yNorm: 0.4, w: 20, h: 20 },
      { xNorm: 0.5, yNorm: 0.62, w: 20, h: 20 },
    ],
    doors: ['north', 'south', 'east', 'west'],
    enemySlots: [
      { xNorm: 0.18, yNorm: 0.18 },
      { xNorm: 0.82, yNorm: 0.18 },
      { xNorm: 0.18, yNorm: 0.82 },
      { xNorm: 0.82, yNorm: 0.82 },
    ],
  },
  {
    id: 'corridor',
    obstacles: [
      { xNorm: 0.35, yNorm: 0.5, w: 16, h: 80 },
      { xNorm: 0.65, yNorm: 0.5, w: 16, h: 80 },
    ],
    doors: ['north', 'south'],
    enemySlots: [
      { xNorm: 0.5, yNorm: 0.22 },
      { xNorm: 0.5, yNorm: 0.78 },
      { xNorm: 0.5, yNorm: 0.5 },
    ],
  },
]
