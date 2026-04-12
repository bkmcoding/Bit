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
