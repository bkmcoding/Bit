import { Vector2 } from '../utils/Vector2';
import { GAME, ROOM } from '../utils/constants';
import type { Direction, RoomThemeId } from '../utils/constants';
import type { ObstacleRect } from '../utils/obstacleCollision';
import { circleOverlapsObstacle, walkableGridToWallRects } from '../utils/obstacleCollision';
import type { RoomConfig, RoomObstacleConfig, SpawnPoint } from './Room';

/** Authoring input; `buildRoomConfigsFromBlueprints` turns this into full `RoomConfig`. */
export type RoomBlueprint = {
  id: number;
  doors: Direction[];
  theme: RoomThemeId;
  isBossRoom?: boolean;
  enemies: SpawnPoint['enemyType'][];
};

const TILE = 8;
const SHAPES = [
  'rectangle',
  'l-west',
  'l-east',
  'bump-north',
  'bump-south',
  't-north',
  't-south',
  'plus',
  'canals',
  'pump-lanes',
] as const;
type RoomShape = (typeof SHAPES)[number];
const FURNISH = [
  'empty',
  'pillars_row',
  'barrel_pairs',
  'side_benches',
  'center_cistern',
  'pump_cross',
  'spill_channels',
] as const;
type FurnishKind = (typeof FURNISH)[number];

function mulberry32(seed: number): () => number {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function quantize8(n: number, min: number, max: number): number {
  const q = Math.round(n / 8) * 8;
  return Math.max(min, Math.min(max, q));
}

function pickDimensions(seed: number, isBoss: boolean): { width: number; height: number } {
  const rng = mulberry32(seed ^ 0x9e3779b9);
  if (isBoss) {
    const w = quantize8(312 + Math.floor(rng() * 48), 304, GAME.BUFFER_WIDTH);
    const h = quantize8(184 + Math.floor(rng() * 32), 176, GAME.BUFFER_HEIGHT);
    return { width: w, height: h };
  }
  const minW = 256;
  const maxW = GAME.BUFFER_WIDTH;
  const minH = 176;
  const maxH = GAME.BUFFER_HEIGHT;
  const nw = 1 + Math.floor(rng() * ((maxW - minW) / 8 + 1));
  const nh = 1 + Math.floor(rng() * ((maxH - minH) / 8 + 1));
  return {
    width: minW + (nw - 1) * 8,
    height: minH + (nh - 1) * 8,
  };
}

function toObstacleConfigs(obs: ObstacleRect[]): RoomObstacleConfig[] {
  return obs.map((o) => ({ x: o.x, y: o.y, w: o.w, h: o.h }));
}

function createWalkGrid(tw: number, th: number): boolean[][] {
  return Array.from({ length: th }, () => Array(tw).fill(false));
}

function fillRectWalk(
  walk: boolean[][],
  tx0: number,
  ty0: number,
  tx1: number,
  ty1: number,
  v: boolean
): void {
  const tw = walk[0]?.length ?? 0;
  const th = walk.length;
  for (let ty = ty0; ty < ty1; ty++) {
    if (ty < 0 || ty >= th) continue;
    for (let tx = tx0; tx < tx1; tx++) {
      if (tx >= 0 && tx < tw) walk[ty][tx] = v;
    }
  }
}

function stampRectangleInner(walk: boolean[][], tw: number, th: number, mt: number): void {
  fillRectWalk(walk, mt, mt, tw - mt, th - mt, true);
}

function stampLWest(walk: boolean[][], tw: number, th: number, mt: number): void {
  const iw = tw - 2 * mt;
  const ih = th - 2 * mt;
  const midX = mt + Math.max(2, Math.floor(iw * 0.48));
  const botY = mt + Math.max(2, Math.floor(ih * 0.34));
  fillRectWalk(walk, mt, mt, midX + 1, th - mt, true);
  fillRectWalk(walk, mt, botY, tw - mt, th - mt, true);
}

function stampLEast(walk: boolean[][], tw: number, th: number, mt: number): void {
  const iw = tw - 2 * mt;
  const ih = th - 2 * mt;
  const midX = mt + Math.max(2, Math.ceil(iw * 0.52));
  const botY = mt + Math.max(2, Math.floor(ih * 0.34));
  fillRectWalk(walk, midX, mt, tw - mt, th - mt, true);
  fillRectWalk(walk, mt, botY, tw - mt, th - mt, true);
}

function stampBumpNorth(walk: boolean[][], tw: number, th: number, mt: number, bumpH: number, bw: number): void {
  const ySplit = mt + bumpH;
  const cx = Math.floor(tw / 2);
  fillRectWalk(walk, mt, ySplit, tw - mt, th - mt, true);
  fillRectWalk(walk, cx - bw, mt, cx + bw + 1, ySplit, true);
}

function stampBumpSouth(walk: boolean[][], tw: number, th: number, mt: number, bumpH: number, bw: number): void {
  const ySplit = th - mt - bumpH - 1;
  const cx = Math.floor(tw / 2);
  fillRectWalk(walk, mt, mt, tw - mt, ySplit + 1, true);
  fillRectWalk(walk, cx - bw, ySplit + 1, tw - mt, th - mt, true);
}

function stampTSouth(walk: boolean[][], tw: number, th: number, mt: number, rng: () => number): void {
  const ih = th - 2 * mt;
  const iw = tw - 2 * mt;
  const barH = Math.max(2, Math.floor(ih * 0.2));
  const tyTop = mt + Math.max(1, Math.floor(ih * 0.12));
  const cx = Math.floor(tw / 2);
  const arm = 2 + Math.floor(rng() * 2);
  fillRectWalk(walk, mt, tyTop, tw - mt, Math.min(tyTop + barH, th - mt), true);
  fillRectWalk(walk, cx - arm, tyTop + barH, cx + arm + 1, th - mt, true);
}

function stampTNorth(walk: boolean[][], tw: number, th: number, mt: number, rng: () => number): void {
  const ih = th - 2 * mt;
  const barH = Math.max(2, Math.floor(ih * 0.2));
  const tyBot = th - mt - Math.max(1, Math.floor(ih * 0.12)) - barH;
  const cx = Math.floor(tw / 2);
  const arm = 2 + Math.floor(rng() * 2);
  fillRectWalk(walk, mt, Math.max(mt, tyBot), tw - mt, th - mt, true);
  fillRectWalk(walk, cx - arm, mt, cx + arm + 1, tyBot, true);
}

function stampPlus(walk: boolean[][], tw: number, th: number, mt: number, rng: () => number): void {
  const cx = Math.floor(tw / 2);
  const cy = Math.floor(th / 2);
  const arm = 2 + Math.floor(rng() * 3);
  fillRectWalk(walk, cx - arm, mt, cx + arm + 1, th - mt, true);
  fillRectWalk(walk, mt, cy - arm, tw - mt, cy + arm + 1, true);
}

function stampCanals(walk: boolean[][], tw: number, th: number, mt: number): void {
  const cx = Math.floor(tw / 2);
  const cy = Math.floor(th / 2);
  fillRectWalk(walk, mt, mt + 1, tw - mt, th - mt - 1, true);
  fillRectWalk(walk, cx - 1, mt + 1, cx + 2, th - mt - 1, false);
  fillRectWalk(walk, mt + 1, cy - 1, tw - mt - 1, cy + 2, false);
  fillRectWalk(walk, cx - 1, cy - 1, cx + 2, cy + 2, true);
}

function stampPumpLanes(walk: boolean[][], tw: number, th: number, mt: number): void {
  fillRectWalk(walk, mt + 1, mt + 1, tw - mt - 1, th - mt - 1, false);
  const laneW = 3;
  const laneH = 3;
  const cx = Math.floor(tw / 2);
  const cy = Math.floor(th / 2);
  fillRectWalk(walk, mt + 1, cy - laneH, tw - mt - 1, cy + laneH + 1, true);
  fillRectWalk(walk, cx - laneW, mt + 1, cx + laneW + 1, th - mt - 1, true);
}

function doorAnchorsOk(
  walk: boolean[][],
  tw: number,
  th: number,
  mt: number,
  doors: Direction[],
  w: number,
  h: number
): boolean {
  const midTx = Math.min(tw - mt - 1, Math.max(mt, Math.floor(w / 2 / TILE)));
  const midTy = Math.min(th - mt - 1, Math.max(mt, Math.floor(h / 2 / TILE)));
  for (const d of doors) {
    let tx = midTx;
    let ty = midTy;
    switch (d) {
      case 'NORTH':
        ty = mt;
        tx = midTx;
        break;
      case 'SOUTH':
        ty = th - mt - 1;
        tx = midTx;
        break;
      case 'WEST':
        tx = mt;
        ty = midTy;
        break;
      case 'EAST':
        tx = tw - mt - 1;
        ty = midTy;
        break;
    }
    if (!walk[ty]?.[tx]) return false;
  }
  return true;
}

function hashDoorDirs(doors: Direction[]): number {
  let h = 0;
  for (const d of doors) {
    for (let i = 0; i < d.length; i++) {
      h = (h * 33 + d.charCodeAt(i)) | 0;
    }
  }
  return h;
}

function stampShape(
  walk: boolean[][],
  tw: number,
  th: number,
  mt: number,
  shape: RoomShape,
  rng: () => number
): void {
  if (shape === 'rectangle') {
    stampRectangleInner(walk, tw, th, mt);
    return;
  }
  if (shape === 'l-west') {
    stampLWest(walk, tw, th, mt);
    return;
  }
  if (shape === 'l-east') {
    stampLEast(walk, tw, th, mt);
    return;
  }
  if (shape === 't-south') {
    stampTSouth(walk, tw, th, mt, rng);
    return;
  }
  if (shape === 't-north') {
    stampTNorth(walk, tw, th, mt, rng);
    return;
  }
  if (shape === 'plus') {
    stampPlus(walk, tw, th, mt, rng);
    return;
  }
  if (shape === 'canals') {
    stampCanals(walk, tw, th, mt);
    return;
  }
  if (shape === 'pump-lanes') {
    stampPumpLanes(walk, tw, th, mt);
    return;
  }
  const bumpH = 3 + Math.floor(rng() * 2);
  const bw = 3 + Math.floor(rng() * 2);
  if (shape === 'bump-north') {
    stampBumpNorth(walk, tw, th, mt, bumpH, bw);
  } else {
    stampBumpSouth(walk, tw, th, mt, bumpH, bw);
  }
}

function rectOverlapsDoorBand(
  ox: number,
  oy: number,
  ow: number,
  oh: number,
  w: number,
  h: number,
  wt: number,
  doors: Direction[],
  dw: number,
  dh: number
): boolean {
  const pad = 6;
  const r = { x: ox, y: oy, w: ow, h: oh };
  const inflate = (bx: number, by: number, bw: number, bh: number) =>
    !(r.x + r.w <= bx - pad || r.x >= bx + bw + pad || r.y + r.h <= by - pad || r.y >= by + bh + pad);

  for (const d of doors) {
    switch (d) {
      case 'NORTH':
        if (inflate((w - dw) / 2, 0, dw, wt + pad)) return true;
        break;
      case 'SOUTH':
        if (inflate((w - dw) / 2, h - wt - pad, dw, wt + pad)) return true;
        break;
      case 'EAST':
        if (inflate(w - wt - pad, (h - dh) / 2, wt + pad, dh)) return true;
        break;
      case 'WEST':
        if (inflate(0, (h - dh) / 2, wt + pad, dh)) return true;
        break;
    }
  }
  return false;
}

function rectFitsWalk(walk: boolean[][], ox: number, oy: number, ow: number, oh: number): boolean {
  const tx0 = Math.floor(ox / TILE);
  const ty0 = Math.floor(oy / TILE);
  const tx1 = Math.ceil((ox + ow) / TILE);
  const ty1 = Math.ceil((oy + oh) / TILE);
  for (let ty = ty0; ty < ty1; ty++) {
    for (let tx = tx0; tx < tx1; tx++) {
      if (!walk[ty]?.[tx]) return false;
    }
  }
  return true;
}

function placeStructuredProps(
  seed: number,
  walk: boolean[][],
  w: number,
  h: number,
  wt: number,
  doors: Direction[],
  kind: FurnishKind,
  isBoss: boolean
): ObstacleRect[] {
  const dw = ROOM.DOOR_WIDTH;
  const dh = ROOM.DOOR_HEIGHT;
  const ix0 = wt;
  const iy0 = wt;
  const ix1 = w - wt;
  const iy1 = h - wt;
  const iw = ix1 - ix0;
  const ih = iy1 - iy0;
  const out: ObstacleRect[] = [];

  const tryPush = (o: ObstacleRect): void => {
    if (o.w < 4 || o.h < 4) return;
    if (o.x < 0 || o.y < 0 || o.x + o.w > w || o.y + o.h > h) return;
    if (rectOverlapsDoorBand(o.x, o.y, o.w, o.h, w, h, wt, doors, dw, dh)) return;
    if (!rectFitsWalk(walk, o.x, o.y, o.w, o.h)) return;
    for (const e of out) {
      if (!(o.x + o.w <= e.x - 2 || o.x >= e.x + e.w + 2 || o.y + o.h <= e.y - 2 || o.y >= e.y + e.h + 2)) {
        return;
      }
    }
    out.push(o);
  };

  if (kind === 'empty') return out;

  if (kind === 'pillars_row') {
    const cols = isBoss ? 4 : 3;
    const pillarW = 16;
    const pillarH = 16;
    const y = iy0 + Math.floor(ih * 0.5) - pillarH / 2;
    for (let i = 0; i < cols; i++) {
      const t = (i + 1) / (cols + 1);
      const cx = ix0 + iw * t;
      tryPush({ x: Math.round(cx - pillarW / 2), y, w: pillarW, h: pillarH });
    }
    return out;
  }

  if (kind === 'barrel_pairs') {
    const s = 8;
    const inset = 26 + (seed % 3) * 2;
    tryPush({ x: ix0 + inset, y: iy0 + inset, w: s, h: s });
    tryPush({ x: ix1 - inset - s, y: iy0 + inset, w: s, h: s });
    tryPush({ x: ix0 + inset, y: iy1 - inset - s, w: s, h: s });
    tryPush({ x: ix1 - inset - s, y: iy1 - inset - s, w: s, h: s });
    return out;
  }

  if (kind === 'side_benches') {
    const bh = 10;
    const bw = 22;
    const mid = (iy0 + iy1) / 2;
    tryPush({ x: ix0 + 6, y: mid - bh / 2, w: bw, h: bh });
    tryPush({ x: ix1 - 6 - bw, y: mid - bh / 2, w: bw, h: bh });
    return out;
  }

  if (kind === 'center_cistern') {
    const cw = 40;
    const ch = 24;
    if (iw >= cw + 32 && ih >= ch + 32) {
      tryPush({
        x: Math.floor((ix0 + ix1) / 2 - cw / 2),
        y: Math.floor((iy0 + iy1) / 2 - ch / 2),
        w: cw,
        h: ch,
      });
    } else {
      const cw2 = 28;
      const ch2 = 18;
      tryPush({
        x: Math.floor((ix0 + ix1) / 2 - cw2 / 2),
        y: Math.floor((iy0 + iy1) / 2 - ch2 / 2),
        w: cw2,
        h: ch2,
      });
    }
    return out;
  }

  if (kind === 'pump_cross') {
    const armW = 12;
    const armL = Math.max(24, Math.floor(Math.min(iw, ih) * 0.22));
    const cx = Math.floor((ix0 + ix1) / 2);
    const cy = Math.floor((iy0 + iy1) / 2);
    tryPush({ x: cx - armW / 2, y: cy - armL, w: armW, h: armL * 2 });
    tryPush({ x: cx - armL, y: cy - armW / 2, w: armL * 2, h: armW });
    return out;
  }

  if (kind === 'spill_channels') {
    const ch = 10;
    const inset = 22;
    tryPush({ x: ix0 + inset, y: iy0 + 14, w: iw - inset * 2, h: ch });
    tryPush({ x: ix0 + inset, y: iy1 - 14 - ch, w: iw - inset * 2, h: ch });
    return out;
  }

  return out;
}

function sampleCircleWalkable(
  x: number,
  y: number,
  radius: number,
  walk: boolean[][]
): boolean {
  const pts: [number, number][] = [
    [x - radius * 0.65, y],
    [x + radius * 0.65, y],
    [x, y - radius * 0.65],
    [x, y + radius * 0.65],
  ];
  for (const [px, py] of pts) {
    const tx = Math.floor(px / TILE);
    const ty = Math.floor(py / TILE);
    if (!walk[ty]?.[tx]) return false;
  }
  return true;
}

function pickSpawnPoint(
  rng: () => number,
  w: number,
  h: number,
  wt: number,
  walk: boolean[][],
  obstacles: ObstacleRect[],
  avoid: Vector2[],
  radius: number
): Vector2 | null {
  const inner = { x0: wt, y0: wt, x1: w - wt, y1: h - wt };
  for (let t = 0; t < 160; t++) {
    const x = inner.x0 + radius + rng() * (inner.x1 - inner.x0 - radius * 2);
    const y = inner.y0 + radius + rng() * (inner.y1 - inner.y0 - radius * 2);
    if (!sampleCircleWalkable(x, y, radius, walk)) continue;
    if (circleOverlapsObstacle(x, y, radius, obstacles)) continue;
    let ok = true;
    for (const p of avoid) {
      if (Math.hypot(p.x - x, p.y - y) < radius * 2 + 14) {
        ok = false;
        break;
      }
    }
    if (ok) return new Vector2(x, y);
  }
  return null;
}

function generateSpawns(
  seed: number,
  w: number,
  h: number,
  wt: number,
  walk: boolean[][],
  obstacles: ObstacleRect[],
  enemies: SpawnPoint['enemyType'][]
): SpawnPoint[] {
  const rng = mulberry32(seed ^ 0xcafebabe);
  const placed: Vector2[] = [];
  const spawns: SpawnPoint[] = [];
  const baseR =
    enemies.includes('broodmother') || enemies.includes('trenchmatriarch') ? 22 : 14;

  const fallback = new Vector2(w * 0.5, h * 0.5);

  for (const type of enemies) {
    const p = pickSpawnPoint(rng, w, h, wt, walk, obstacles, placed, baseR);
    if (p) placed.push(p.clone());
    spawns.push({ position: p ?? fallback, enemyType: type });
  }
  return spawns;
}

export function generateProceduralContent(bp: RoomBlueprint, runSeed: number): {
  width: number;
  height: number;
  walkableGrid: boolean[][];
  obstacles: RoomObstacleConfig[];
  spawns: SpawnPoint[];
} {
  const seed =
    ((runSeed >>> 0) ^
      Math.imul(bp.id, 1597334677) ^
      Math.imul(bp.theme.charCodeAt(0), 374761393) ^
      Math.imul(hashDoorDirs(bp.doors), 0x85ebca6b) ^
      (bp.isBossRoom ? 0xbeef : 0)) |
    0;
  const { width: rw, height: rh } = pickDimensions(seed, !!bp.isBossRoom);
  const wt = ROOM.WALL_THICKNESS;
  const tw = Math.round(rw / TILE);
  const th = Math.round(rh / TILE);
  const mt = wt / TILE;

  const walk = createWalkGrid(tw, th);
  const rng = mulberry32(seed ^ 0x2f6d);

  let shape: RoomShape = 'rectangle';
  if (bp.theme === 'flooded') {
    shape = seed % 2 === 0 ? 'canals' : 'bump-south';
  } else if (bp.theme === 'toxicworks') {
    shape = seed % 2 === 0 ? 'pump-lanes' : 't-north';
  } else if (!bp.isBossRoom) {
    shape = SHAPES[(seed >>> 0) % SHAPES.length];
  }

  stampShape(walk, tw, th, mt, shape, rng);

  if (!doorAnchorsOk(walk, tw, th, mt, bp.doors, rw, rh)) {
    fillRectWalk(walk, 0, 0, tw, th, false);
    stampRectangleInner(walk, tw, th, mt);
  }

  let furnish: FurnishKind = FURNISH[seed % FURNISH.length];
  if (bp.theme === 'flooded') {
    furnish = seed % 2 === 0 ? 'spill_channels' : 'center_cistern';
  } else if (bp.theme === 'toxicworks') {
    furnish = seed % 2 === 0 ? 'pump_cross' : 'side_benches';
  } else if (bp.isBossRoom) {
    furnish = seed % 2 === 0 ? 'pillars_row' : 'empty';
  }
  const props = placeStructuredProps(seed + 3, walk, rw, rh, wt, bp.doors, furnish, !!bp.isBossRoom);

  const wallRects = walkableGridToWallRects(walk, TILE);
  const allObs = [...wallRects, ...props];

  const spawns = generateSpawns(seed + 9, rw, rh, wt, walk, allObs, bp.enemies);

  return {
    width: rw,
    height: rh,
    walkableGrid: walk,
    obstacles: toObstacleConfigs(props),
    spawns,
  };
}

export function buildRoomConfigsFromBlueprints(blueprints: RoomBlueprint[], runSeed: number): RoomConfig[] {
  return blueprints.map((bp) => {
    const g = generateProceduralContent(bp, runSeed);
    return {
      id: bp.id,
      doors: bp.doors,
      theme: bp.theme,
      isBossRoom: bp.isBossRoom,
      width: g.width,
      height: g.height,
      walkableGrid: g.walkableGrid,
      obstacles: g.obstacles,
      spawns: g.spawns,
    };
  });
}
