import { ROOM_COUNT } from '../rooms/roomData';

/**
 * Per-room “window” moon shaft in normalized game UV (0–1).
 * Origin sits near a wall; dir points into the room (normalized in getter).
 */
export type RoomMoonShaftConfig = {
  originX: number;
  originY: number;
  /** Into-room direction (need not be normalized). */
  dirX: number;
  dirY: number;
  /** Cross-beam width in UV space (~0.1–0.25). */
  spread: number;
  /** Overall brightness of the shaft (0–1 scale in shader). */
  strength: number;
};

function n(dx: number, dy: number): { x: number; y: number } {
  const l = Math.hypot(dx, dy) || 1;
  return { x: dx / l, y: dy / l };
}

/** Hand-tuned per chamber so each room reads like a different window placement. */
const RAW: RoomMoonShaftConfig[] = [
  { originX: 0.5, originY: 0.1, dirX: 0.08, dirY: 0.92, spread: 0.2, strength: 0.55 },
  { originX: 0.1, originY: 0.5, dirX: 0.92, dirY: 0.06, spread: 0.17, strength: 0.5 },
  { originX: 0.78, originY: 0.11, dirX: -0.32, dirY: 0.88, spread: 0.16, strength: 0.52 },
  { originX: 0.5, originY: 0.88, dirX: 0.1, dirY: -0.9, spread: 0.19, strength: 0.48 },
  { originX: 0.9, originY: 0.38, dirX: -0.88, dirY: 0.22, spread: 0.15, strength: 0.54 },
  { originX: 0.14, originY: 0.72, dirX: 0.82, dirY: -0.35, spread: 0.18, strength: 0.5 },
  { originX: 0.62, originY: 0.09, dirX: -0.15, dirY: 0.9, spread: 0.21, strength: 0.51 },
  { originX: 0.88, originY: 0.62, dirX: -0.9, dirY: -0.12, spread: 0.14, strength: 0.53 },
  { originX: 0.42, originY: 0.9, dirX: 0.35, dirY: -0.88, spread: 0.17, strength: 0.49 },
  { originX: 0.08, originY: 0.28, dirX: 0.9, dirY: 0.35, spread: 0.16, strength: 0.52 },
  { originX: 0.55, originY: 0.12, dirX: 0.25, dirY: 0.88, spread: 0.22, strength: 0.56 },
  { originX: 0.22, originY: 0.14, dirX: 0.55, dirY: 0.78, spread: 0.18, strength: 0.42 },
  // Flooded / toxic sectors (match ROOM_COUNT in roomData)
  { originX: 0.38, originY: 0.08, dirX: 0.12, dirY: 0.92, spread: 0.2, strength: 0.45 },
  { originX: 0.82, originY: 0.78, dirX: -0.62, dirY: -0.68, spread: 0.17, strength: 0.44 },
  { originX: 0.12, originY: 0.48, dirX: 0.88, dirY: 0.12, spread: 0.18, strength: 0.42 },
  { originX: 0.48, originY: 0.1, dirX: 0.08, dirY: 0.94, spread: 0.23, strength: 0.4 },
  // Deep arc (rooms 16–19): murkier shafts
  { originX: 0.72, originY: 0.14, dirX: -0.45, dirY: 0.82, spread: 0.19, strength: 0.38 },
  { originX: 0.18, originY: 0.82, dirX: 0.55, dirY: -0.72, spread: 0.2, strength: 0.36 },
  { originX: 0.5, originY: 0.06, dirX: 0.02, dirY: 0.98, spread: 0.24, strength: 0.35 },
  { originX: 0.92, originY: 0.45, dirX: -0.92, dirY: 0.18, spread: 0.16, strength: 0.33 },
];

if (RAW.length !== ROOM_COUNT) {
  console.error(
    `[roomMoonlight] expected ${ROOM_COUNT} moon shafts, have ${RAW.length} — fix RAW or room list`
  );
}

export type MoonShaftUniforms = {
  originX: number;
  originY: number;
  dirX: number;
  dirY: number;
  spread: number;
  strength: number;
};

export function getMoonShaftForRoom(roomIndex: number): MoonShaftUniforms {
  const i = Math.max(0, Math.min(RAW.length - 1, roomIndex | 0));
  const r = RAW[i] ?? RAW[0];
  const d = n(r.dirX, r.dirY);
  return {
    originX: r.originX,
    originY: r.originY,
    dirX: d.x,
    dirY: d.y,
    spread: r.spread,
    strength: r.strength,
  };
}
