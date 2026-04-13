'use client';

import type { MinimapLayout } from '@/lib/game/rooms/roomData';
import type { RoomThemeId } from '@/lib/game/utils/constants';

const RADAR_THEME: Record<
  RoomThemeId,
  { grid: string; edge: string; blip: string; blipDim: string; ring: string }
> = {
  cellar: {
    grid: 'rgba(120, 92, 72, 0.22)',
    edge: 'rgba(160, 120, 88, 0.35)',
    blip: 'rgba(200, 150, 110, 0.85)',
    blipDim: 'rgba(90, 70, 55, 0.35)',
    ring: 'rgba(220, 160, 110, 0.55)',
  },
  moss: {
    grid: 'rgba(72, 110, 82, 0.22)',
    edge: 'rgba(100, 150, 110, 0.38)',
    blip: 'rgba(140, 210, 150, 0.78)',
    blipDim: 'rgba(50, 80, 58, 0.35)',
    ring: 'rgba(160, 240, 170, 0.5)',
  },
  ash: {
    grid: 'rgba(110, 108, 105, 0.2)',
    edge: 'rgba(150, 148, 142, 0.32)',
    blip: 'rgba(200, 198, 190, 0.75)',
    blipDim: 'rgba(70, 68, 64, 0.32)',
    ring: 'rgba(230, 226, 218, 0.48)',
  },
  deep: {
    grid: 'rgba(88, 72, 120, 0.22)',
    edge: 'rgba(120, 96, 160, 0.36)',
    blip: 'rgba(160, 130, 210, 0.8)',
    blipDim: 'rgba(55, 45, 78, 0.35)',
    ring: 'rgba(190, 150, 255, 0.52)',
  },
  rust: {
    grid: 'rgba(130, 80, 55, 0.22)',
    edge: 'rgba(170, 100, 65, 0.36)',
    blip: 'rgba(230, 140, 90, 0.78)',
    blipDim: 'rgba(90, 50, 35, 0.34)',
    ring: 'rgba(255, 160, 100, 0.52)',
  },
};

function layoutBounds(minimap: MinimapLayout): {
  pts: { x: number; y: number }[];
  w: number;
  h: number;
} {
  const { positions } = minimap;
  if (positions.length === 0) {
    return { pts: [], w: 1, h: 1 };
  }
  let minX = positions[0]!.x;
  let maxX = positions[0]!.x;
  let minY = positions[0]!.y;
  let maxY = positions[0]!.y;
  for (const p of positions) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }
  const pad = 0.65;
  minX -= pad;
  maxX += pad;
  minY -= pad;
  maxY += pad;
  const w = Math.max(0.8, maxX - minX);
  const h = Math.max(0.8, maxY - minY);
  const pts = positions.map((p) => ({ x: p.x - minX, y: p.y - minY }));
  return { pts, w, h };
}

type RunRadarProps = {
  theme: RoomThemeId;
  minimap: MinimapLayout;
  currentRoom: number;
  totalRooms: number;
  enteredRooms: number[];
};

export function RunRadar({ theme, minimap, currentRoom, totalRooms, enteredRooms }: RunRadarProps) {
  const pal = RADAR_THEME[theme] ?? RADAR_THEME.cellar;
  const entered = new Set(enteredRooms);
  const { pts, w, h } = layoutBounds(minimap);
  const vbW = 100;
  const vbH = (h / w) * 100;
  const sx = vbW / w;
  const sy = vbH / h;

  const screenX = (i: number) => (pts[i]?.x ?? 0) * sx;
  const screenY = (i: number) => (pts[i]?.y ?? 0) * sy;

  return (
    <div
      className="relative rounded-md overflow-hidden border"
      style={{
        width: 118,
        height: Math.max(80, Math.min(108, (vbH / vbW) * 118)),
        borderColor: 'rgba(20, 16, 18, 0.75)',
        background:
          'radial-gradient(ellipse at 50% 50%, rgba(12,10,14,0.92) 0%, rgba(4,3,6,0.97) 100%)',
        boxShadow: 'inset 0 0 24px rgba(0,0,0,0.65), 0 0 12px rgba(0,0,0,0.4)',
      }}
      role="img"
      aria-label={`Sector map, chamber ${currentRoom + 1} of ${totalRooms}`}
    >
      <svg
        className="absolute inset-0 w-full h-full"
        viewBox={`0 0 ${vbW} ${vbH}`}
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <pattern id={`radar-grid-${theme}`} width="8" height="8" patternUnits="userSpaceOnUse">
            <path
              d="M 8 0 L 0 0 0 8"
              fill="none"
              stroke={pal.grid}
              strokeWidth="0.35"
            />
          </pattern>
        </defs>
        <rect width={vbW} height={vbH} fill={`url(#radar-grid-${theme})`} opacity={0.9} />
        <circle
          cx={vbW * 0.5}
          cy={vbH * 0.5}
          r={Math.hypot(vbW, vbH) * 0.52}
          fill="none"
          stroke={pal.ring}
          strokeWidth="0.4"
          opacity={0.25}
        />

        {minimap.edges.map(({ a, b }, i) => {
          const x1 = screenX(a);
          const y1 = screenY(a);
          const x2 = screenX(b);
          const y2 = screenY(b);
          return (
            <line
              key={`e-${i}`}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={pal.edge}
              strokeWidth="1.1"
              strokeLinecap="round"
              opacity={0.55}
            />
          );
        })}

        {pts.map((_, i) => {
          const cx = screenX(i);
          const cy = screenY(i);
          const isHere = i === currentRoom;
          const seen = entered.has(i);
          const r = isHere ? 3.2 : seen ? 2.35 : 1.85;
          const fill = isHere ? pal.blip : seen ? pal.blipDim : pal.blipDim;
          const op = isHere ? 1 : seen ? 0.55 : 0.22;
          return (
            <circle
              key={`n-${i}`}
              cx={cx}
              cy={cy}
              r={r}
              fill={fill}
              opacity={op}
              className={isHere ? 'animate-pulse' : undefined}
              style={isHere ? { filter: `drop-shadow(0 0 3px ${pal.ring})` } : undefined}
            />
          );
        })}
      </svg>
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.14]"
        style={{
          background:
            'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.5) 2px, rgba(0,0,0,0.5) 3px)',
        }}
      />
    </div>
  );
}
