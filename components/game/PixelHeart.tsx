/** 7×6 bitmap — crisp SVG “pixels”, no anti-aliased font glyph. */
const PIXEL_HEART = [
  '0110110',
  '1111111',
  '1111111',
  '0111110',
  '0011100',
  '0001000',
] as const;

const W = PIXEL_HEART[0].length;
const H = PIXEL_HEART.length;
const SCALE = 3;

export function PixelHeart({ filled }: { filled: boolean }) {
  return (
    <svg
      width={W * SCALE}
      height={H * SCALE}
      viewBox={`0 0 ${W} ${H}`}
      className="shrink-0"
      style={{
        imageRendering: 'pixelated',
        filter: filled
          ? 'drop-shadow(1px 0 0 #0c0808) drop-shadow(-1px 0 0 #0c0808) drop-shadow(0 1px 0 #0c0808) drop-shadow(0 -1px 0 #0c0808)'
          : 'drop-shadow(1px 0 0 #060404) drop-shadow(-1px 0 0 #060404) drop-shadow(0 1px 0 #060404) drop-shadow(0 -1px 0 #060404)',
      }}
      aria-hidden
    >
      {PIXEL_HEART.flatMap((row, y) =>
        [...row].map((c, x) => {
          if (c === '0') return null;
          return (
            <rect
              key={`${x}-${y}`}
              x={x}
              y={y}
              width={1}
              height={1}
              fill={filled ? '#5a2428' : '#1c181a'}
            />
          );
        })
      )}
    </svg>
  );
}
