'use client';

type Props = {
  onContinue: (path: 'adaptation' | 'mutation') => void;
};

/**
 * Between chapter 1 (sectors 1–12) and the flooded arc: pick a defensive vs offensive boon, then descend.
 */
export function ChapterMapScreen({ onContinue }: Props) {
  return (
    <div
      className="fixed inset-0 z-500 flex items-center justify-center px-4"
      style={{ backgroundColor: 'rgba(2, 4, 8, 0.94)' }}
    >
      <div
        className="max-w-lg w-full rounded border p-6 text-sm"
        style={{
          fontFamily: PANEL_FONT,
          borderColor: 'rgba(100, 200, 220, 0.45)',
          backgroundColor: 'rgba(8, 12, 18, 0.96)',
          color: '#b8ccd4',
          boxShadow: '0 0 48px rgba(0,40,60,0.45)',
        }}
      >
        <div className="text-[11px] tracking-[0.35em] uppercase" style={{ color: '#5a8a9a' }}>
          Chapter I complete
        </div>
        <h2 className="mt-2 text-[15px] text-[#d4f4ff] tracking-[0.08em]">The Flooded Depths</h2>
        <p className="mt-3 leading-relaxed text-[#8aa8b0] text-[11px]">
          Sector 12 is behind you. Deeper pumps bleed brine and worse things. Choose how your body
          answers the water — then open the map node to continue the run.
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            className="rounded border px-4 py-3 text-left transition hover:brightness-110"
            style={{
              borderColor: 'rgba(80, 160, 140, 0.5)',
              backgroundColor: 'rgba(12, 32, 28, 0.85)',
              color: '#9ee0cc',
            }}
            onClick={() => onContinue('adaptation')}
          >
            <div className="text-[11px] uppercase tracking-widest text-[#5a9a8a]">Greater adaptation</div>
            <div className="mt-1 text-[11px] leading-relaxed text-[#c0e8dc]">
              Harden to the rot: less damage taken, longer grace after hits.
            </div>
          </button>
          <button
            type="button"
            className="rounded border px-4 py-3 text-left transition hover:brightness-110"
            style={{
              borderColor: 'rgba(180, 90, 120, 0.45)',
              backgroundColor: 'rgba(36, 14, 22, 0.82)',
              color: '#f0b8c8',
            }}
            onClick={() => onContinue('mutation')}
          >
            <div className="text-[11px] uppercase tracking-widest text-[#b06078]">Stronger mutation</div>
            <div className="mt-1 text-[11px] leading-relaxed text-[#f0d0dc]">
              Lean into hunger: +1 shot damage, faster trigger — the depths demand payment.
            </div>
          </button>
        </div>

        <p className="mt-5 text-[10px] text-[#5a7080]">
          Ctrl+Shift+F9/Y dev panel · harder enemy mixes ahead · final sector holds the abyss brood.
        </p>
      </div>
    </div>
  );
}
