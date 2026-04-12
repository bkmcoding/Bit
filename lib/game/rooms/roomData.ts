import { Vector2 } from '../utils/Vector2';
import type { RoomConfig, SpawnPoint } from './Room';

// Helper to create spawn points
const spawn = (x: number, y: number, type: SpawnPoint['enemyType']): SpawnPoint => ({
  position: new Vector2(x, y),
  enemyType: type,
});

export const ROOM_CONFIGS: RoomConfig[] = [
  // Room 0: Starting room (no enemies, tutorial)
  {
    id: 0,
    doors: ['EAST'],
    spawns: [],
  },
  
  // Room 1: First combat (2 basic spiders)
  {
    id: 1,
    doors: ['WEST', 'EAST'],
    spawns: [
      spawn(60, 50, 'spider'),
      spawn(180, 110, 'spider'),
    ],
  },
  
  // Room 2: Introducing spitters (3 spiders, 1 spitter)
  {
    id: 2,
    doors: ['WEST', 'SOUTH'],
    spawns: [
      spawn(40, 40, 'spider'),
      spawn(200, 40, 'spider'),
      spawn(120, 120, 'spider'),
      spawn(120, 50, 'spitter'),
    ],
  },
  
  // Room 3: Introducing dashers (2 dashers, 2 spiders)
  {
    id: 3,
    doors: ['NORTH', 'EAST'],
    spawns: [
      spawn(50, 80, 'dasher'),
      spawn(190, 80, 'dasher'),
      spawn(80, 40, 'spider'),
      spawn(160, 120, 'spider'),
    ],
  },
  
  // Room 4: Web spinner introduction (1 webspinner, 3 spiders)
  {
    id: 4,
    doors: ['WEST', 'SOUTH'],
    spawns: [
      spawn(120, 80, 'webspinner'),
      spawn(40, 40, 'spider'),
      spawn(200, 40, 'spider'),
      spawn(120, 130, 'spider'),
    ],
  },
  
  // Room 5: Mixed challenge (harder)
  {
    id: 5,
    doors: ['NORTH', 'EAST'],
    spawns: [
      spawn(50, 50, 'spitter'),
      spawn(190, 50, 'spitter'),
      spawn(80, 100, 'dasher'),
      spawn(160, 100, 'dasher'),
      spawn(120, 130, 'spider'),
    ],
  },
  
  // Room 6: Boss room (Broodmother)
  {
    id: 6,
    doors: ['WEST'],
    spawns: [
      spawn(120, 80, 'broodmother'),
    ],
    isBossRoom: true,
  },
];

// Room connections (which room each door leads to)
export const ROOM_CONNECTIONS: Map<number, Map<string, number>> = new Map([
  [0, new Map([['EAST', 1]])],
  [1, new Map([['WEST', 0], ['EAST', 2]])],
  [2, new Map([['WEST', 1], ['SOUTH', 3]])],
  [3, new Map([['NORTH', 2], ['EAST', 4]])],
  [4, new Map([['WEST', 3], ['SOUTH', 5]])],
  [5, new Map([['NORTH', 4], ['EAST', 6]])],
  [6, new Map([['WEST', 5]])],
]);
