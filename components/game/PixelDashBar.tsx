'use client';

/** Discrete pips for shift-dash stamina — flat fills, hard edges (matches `PixelHeart` vibe). */
const SEGMENTS = 14;
const CELL = 4;
const GAP = 1;
const H = 8;

export function PixelDashBar({
  fraction,
  chapter,
}: {
  /** 0–1 stamina */
  fraction: number;
  chapter: 1 | 2;
}) {
  const lit = Math.min(SEGMENTS, Math.max(0, Math.round(fraction * SEGMENTS)));
  const fillOn = chapter === 2 ? '#48c8d8' : '#68a8c8';
  const fillOff = chapter === 2 ? '#0c1418' : '#101418';
  const border = chapter === 2 ? '#285058' : '#384450';
  const inset = '#06080a';

  const totalW = SEGMENTS * CELL + (SEGMENTS - 1) * GAP;

  return (
    <div
      className="shrink-0"
      style={{
        padding: 2,
        background: inset,
        boxShadow: `0 0 0 1px ${border}, 2px 2px 0 rgba(0,0,0,0.5)`,
        imageRendering: 'pixelated' as const,
      }}
    >
      <div
        className="flex items-end"
        style={{
          width: totalW,
          height: H,
          gap: GAP,
        }}
      >
        {Array.from({ length: SEGMENTS }, (_, i) => {
          const on = i < lit;
          return (
            <div
              key={`dash-pip-${i}`}
              style={{
                width: CELL,
                height: H,
                flexShrink: 0,
                backgroundColor: on ? fillOn : fillOff,
                boxShadow: on
                  ? 'inset 0 2px 0 rgba(255,255,255,0.2), inset 0 -2px 0 rgba(0,0,0,0.35)'
                  : 'inset 0 0 0 1px rgba(0,0,0,0.5)',
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
