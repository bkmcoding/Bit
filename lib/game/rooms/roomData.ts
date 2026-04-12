import { Vector2 } from '../utils/Vector2';
import type { RoomConfig, RoomObstacleConfig, SpawnPoint } from './Room';
import type { RoomThemeId } from '../utils/constants';

const spawn = (x: number, y: number, type: SpawnPoint['enemyType']): SpawnPoint => ({
  position: new Vector2(x, y),
  enemyType: type,
});

const box = (x: number, y: number, w: number, h: number): RoomObstacleConfig => ({ x, y, w, h });

const themes: RoomThemeId[] = ['cellar', 'moss', 'ash', 'deep', 'rust'];
const themeFor = (id: number): RoomThemeId => themes[id % themes.length];

/**
 * Linear dungeon: room 0 (start) → rooms 1–10 (combat) → room 11 (Broodmother).
 * Longer run with ramping compositions and three new enemy types (brute, skitter, widow).
 */
export const ROOM_CONFIGS: RoomConfig[] = [
  {
    id: 0,
    doors: ['EAST'],
    spawns: [],
    theme: 'cellar',
  },
  {
    id: 1,
    doors: ['WEST', 'EAST'],
    theme: themeFor(1),
    obstacles: [box(96, 68, 10, 28), box(134, 64, 10, 28)],
    spawns: [
      spawn(55, 55, 'spider'),
      spawn(120, 90, 'spider'),
      spawn(185, 65, 'spider'),
    ],
  },
  {
    id: 2,
    doors: ['WEST', 'EAST'],
    theme: themeFor(2),
    obstacles: [box(118, 58, 12, 44), box(52, 96, 14, 12), box(174, 52, 14, 12)],
    spawns: [
      spawn(50, 45, 'spider'),
      spawn(190, 45, 'spider'),
      spawn(120, 115, 'skitter'),
      spawn(90, 75, 'spider'),
    ],
  },
  {
    id: 3,
    doors: ['WEST', 'EAST'],
    theme: themeFor(3),
    obstacles: [box(88, 88, 16, 14), box(136, 58, 16, 14)],
    spawns: [
      spawn(70, 70, 'spitter'),
      spawn(170, 70, 'spitter'),
      spawn(120, 120, 'spider'),
    ],
  },
  {
    id: 4,
    doors: ['WEST', 'EAST'],
    theme: themeFor(4),
    obstacles: [box(112, 72, 16, 16), box(72, 48, 12, 10), box(156, 102, 12, 10)],
    spawns: [
      spawn(45, 85, 'dasher'),
      spawn(195, 85, 'dasher'),
      spawn(85, 45, 'spider'),
      spawn(155, 120, 'spider'),
    ],
  },
  {
    id: 5,
    doors: ['WEST', 'EAST'],
    theme: themeFor(5),
    obstacles: [box(60, 72, 12, 20), box(168, 68, 12, 20), box(114, 44, 14, 10)],
    spawns: [
      spawn(60, 55, 'skitter'),
      spawn(180, 55, 'skitter'),
      spawn(120, 100, 'spider'),
      spawn(120, 40, 'spitter'),
    ],
  },
  {
    id: 6,
    doors: ['WEST', 'EAST'],
    theme: themeFor(6),
    obstacles: [box(104, 96, 20, 12), box(48, 52, 12, 14), box(180, 48, 12, 14)],
    spawns: [
      spawn(120, 85, 'webspinner'),
      spawn(45, 45, 'spider'),
      spawn(195, 45, 'spider'),
      spawn(120, 130, 'skitter'),
    ],
  },
  {
    id: 7,
    doors: ['WEST', 'EAST'],
    theme: themeFor(7),
    obstacles: [box(110, 70, 14, 36), box(78, 52, 10, 10), box(152, 100, 10, 10)],
    spawns: [
      spawn(120, 80, 'brute'),
      spawn(55, 50, 'spider'),
      spawn(185, 110, 'spider'),
      spawn(120, 45, 'skitter'),
    ],
  },
  {
    id: 8,
    doors: ['WEST', 'EAST'],
    theme: themeFor(8),
    obstacles: [box(118, 78, 12, 40), box(56, 58, 14, 12), box(170, 108, 14, 12)],
    spawns: [
      spawn(55, 50, 'spitter'),
      spawn(185, 50, 'spitter'),
      spawn(90, 100, 'dasher'),
      spawn(150, 100, 'dasher'),
      spawn(120, 125, 'widow'),
    ],
  },
  {
    id: 9,
    doors: ['WEST', 'EAST'],
    theme: themeFor(9),
    obstacles: [box(92, 62, 14, 36), box(134, 62, 14, 36), box(116, 108, 18, 10)],
    spawns: [
      spawn(70, 60, 'widow'),
      spawn(170, 60, 'widow'),
      spawn(120, 110, 'webspinner'),
      spawn(120, 40, 'spider'),
    ],
  },
  {
    id: 10,
    doors: ['WEST', 'EAST'],
    theme: themeFor(10),
    obstacles: [box(108, 56, 24, 12), box(108, 92, 24, 12), box(52, 74, 12, 18), box(176, 74, 12, 18)],
    spawns: [
      spawn(120, 75, 'brute'),
      spawn(55, 45, 'skitter'),
      spawn(185, 45, 'skitter'),
      spawn(50, 115, 'spitter'),
      spawn(190, 115, 'spitter'),
      spawn(120, 125, 'dasher'),
    ],
  },
  {
    id: 11,
    doors: ['WEST'],
    theme: 'deep',
    obstacles: [box(96, 70, 12, 28), box(132, 70, 12, 28), box(114, 48, 16, 10)],
    spawns: [spawn(120, 80, 'broodmother')],
    isBossRoom: true,
  },
];

function buildLinearConnections(roomCount: number): Map<number, Map<string, number>> {
  const map = new Map<number, Map<string, number>>();
  for (let id = 0; id < roomCount; id++) {
    const doors = new Map<string, number>();
    if (id > 0) doors.set('WEST', id - 1);
    if (id < roomCount - 1) doors.set('EAST', id + 1);
    map.set(id, doors);
  }
  return map;
}

export const ROOM_CONNECTIONS: Map<number, Map<string, number>> = buildLinearConnections(
  ROOM_CONFIGS.length
);
