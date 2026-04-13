import type { Direction } from '../utils/constants';

const OPP: Record<Direction, Direction> = {
  NORTH: 'SOUTH',
  SOUTH: 'NORTH',
  EAST: 'WEST',
  WEST: 'EAST',
};

const ALL_DIRS: Direction[] = ['NORTH', 'EAST', 'SOUTH', 'WEST'];

function mulberry32(seed: number): () => number {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function deltaForExit(d: Direction): { dx: number; dy: number } {
  switch (d) {
    case 'NORTH':
      return { dx: 0, dy: -1 };
    case 'SOUTH':
      return { dx: 0, dy: 1 };
    case 'EAST':
      return { dx: 1, dy: 0 };
    case 'WEST':
      return { dx: -1, dy: 0 };
  }
}

export type MinimapLayout = {
  positions: { x: number; y: number }[];
  edges: { a: number; b: number }[];
};

/**
 * Linear run 0→1→…→boss, but each link picks a random wall pair (N/S/E/W) so maps feel less “always east”.
 */
export function buildLinearRunDoorLayout(roomCount: number, seed: number): {
  connections: Map<number, Map<string, number>>;
  roomDoors: Map<number, Direction[]>;
  minimap: MinimapLayout;
} {
  const rng = mulberry32(seed ^ 0x4b1d);
  const bossIndex = roomCount - 1;

  /** Direction from room `i` toward room `i + 1` (door on that side of room i). */
  const forward: Direction[] = [];

  const pickExitFrom = (entrance: Direction | null): Direction => {
    const choices = entrance ? ALL_DIRS.filter((d) => d !== entrance) : [...ALL_DIRS];
    return choices[Math.floor(rng() * choices.length)]!;
  };

  for (let i = 0; i < bossIndex; i++) {
    const entrance = i === 0 ? null : OPP[forward[i - 1]!];
    forward.push(pickExitFrom(entrance));
  }

  const connections = new Map<number, Map<string, number>>();
  const roomDoors = new Map<number, Direction[]>();

  for (let i = 0; i < roomCount; i++) {
    connections.set(i, new Map());
  }

  const addDoor = (from: number, dir: Direction, to: number): void => {
    const m = connections.get(from)!;
    m.set(dir, to);
    const doors = roomDoors.get(from) ?? [];
    if (!doors.includes(dir)) doors.push(dir);
    roomDoors.set(from, doors);
  };

  for (let i = 0; i < bossIndex; i++) {
    const d = forward[i]!;
    addDoor(i, d, i + 1);
    addDoor(i + 1, OPP[d], i);
  }

  const positions: { x: number; y: number }[] = [{ x: 0, y: 0 }];
  for (let i = 0; i < bossIndex; i++) {
    const { dx, dy } = deltaForExit(forward[i]!);
    const p = positions[i]!;
    positions.push({ x: p.x + dx, y: p.y + dy });
  }

  const edgeSet = new Set<string>();
  const edges: { a: number; b: number }[] = [];
  for (let i = 0; i < roomCount; i++) {
    const m = connections.get(i)!;
    for (const [, t] of m) {
      const a = Math.min(i, t);
      const b = Math.max(i, t);
      const key = `${a},${b}`;
      if (!edgeSet.has(key)) {
        edgeSet.add(key);
        edges.push({ a, b });
      }
    }
  }

  return {
    connections,
    roomDoors,
    minimap: { positions, edges },
  };
}
