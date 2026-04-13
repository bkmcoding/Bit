import { Vector2 } from './Vector2';

export type ObstacleRect = { x: number; y: number; w: number; h: number };

/** Push a circular body out of axis-aligned obstacle rectangles (iterative-friendly). */
export function resolveCircleObstacles(position: Vector2, radius: number, rects: ObstacleRect[]): void {
  for (const r of rects) {
    const closestX = Math.max(r.x, Math.min(r.x + r.w, position.x));
    const closestY = Math.max(r.y, Math.min(r.y + r.h, position.y));
    let dx = position.x - closestX;
    let dy = position.y - closestY;
    let d2 = dx * dx + dy * dy;

    if (d2 >= radius * radius) continue;

    if (d2 < 1e-6) {
      const dl = position.x - r.x;
      const dr = r.x + r.w - position.x;
      const dt = position.y - r.y;
      const db = r.y + r.h - position.y;
      const m = Math.min(dl, dr, dt, db);
      if (m === dl) position.x = r.x - radius - 0.25;
      else if (m === dr) position.x = r.x + r.w + radius + 0.25;
      else if (m === dt) position.y = r.y - radius - 0.25;
      else position.y = r.y + r.h + radius + 0.25;
      continue;
    }

    const dist = Math.sqrt(d2);
    const overlap = radius - dist + 0.15;
    position.x += (dx / dist) * overlap;
    position.y += (dy / dist) * overlap;
  }
}

export function circleOverlapsObstacle(cx: number, cy: number, radius: number, rects: ObstacleRect[]): boolean {
  for (const r of rects) {
    const px = Math.max(r.x, Math.min(r.x + r.w, cx));
    const py = Math.max(r.y, Math.min(r.y + r.h, cy));
    const dx = cx - px;
    const dy = cy - py;
    if (dx * dx + dy * dy < radius * radius) return true;
  }
  return false;
}

/**
 * Each `false` cell becomes solid collision (8×8 tiles). Row sweep plus vertical merge
 * keeps the rectangle count reasonable for shaped rooms.
 */
export function walkableGridToWallRects(walk: boolean[][], tileSize: number): ObstacleRect[] {
  const th = walk.length;
  const tw = walk[0]?.length ?? 0;
  if (th === 0 || tw === 0) return [];

  const rowRects: ObstacleRect[] = [];
  for (let ty = 0; ty < th; ty++) {
    let tx = 0;
    while (tx < tw) {
      if (walk[ty][tx]) {
        tx++;
        continue;
      }
      const tx0 = tx;
      while (tx < tw && !walk[ty][tx]) tx++;
      rowRects.push({
        x: tx0 * tileSize,
        y: ty * tileSize,
        w: (tx - tx0) * tileSize,
        h: tileSize,
      });
    }
  }

  rowRects.sort((a, b) => a.x - b.x || a.y - b.y || a.w - b.w);
  const merged: ObstacleRect[] = [];
  for (const r of rowRects) {
    const last = merged[merged.length - 1];
    if (last && last.x === r.x && last.w === r.w && last.y + last.h === r.y) {
      last.h += r.h;
    } else {
      merged.push({ ...r });
    }
  }
  return merged;
}
