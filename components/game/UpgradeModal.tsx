import type { Upgrade } from '@/lib/game/upgrades/Upgrade';

interface UpgradeModalProps {
  upgrades: Upgrade[];
  onSelect: (upgrade: Upgrade) => void;
}

export function UpgradeModal({ upgrades, onSelect }: UpgradeModalProps) {
  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center"
      style={{
        background:
          'radial-gradient(ellipse 80% 60% at 50% 45%, rgba(24, 12, 28, 0.92) 0%, rgba(4, 4, 8, 0.96) 70%, #020203 100%)',
        boxShadow: 'inset 0 0 120px rgba(0,0,0,0.85)',
      }}
    >
      <h2
        className="text-2xl sm:text-3xl font-bold mb-1 tracking-tight"
        style={{
          color: '#b8a898',
          textShadow: '0 0 24px rgba(80, 20, 20, 0.5), 2px 2px 0 #000',
          fontFamily: 'monospace',
        }}
      >
        The room falls quiet
      </h2>
      <p
        className="text-xs sm:text-sm mb-6 opacity-80"
        style={{
          color: '#6a5a58',
          fontFamily: 'monospace',
        }}
      >
        Something in the walls offers a trade. Choose one.
      </p>

      <div className="flex flex-wrap justify-center gap-4 px-2">
        {upgrades.map((upgrade) => (
          <button
            key={upgrade.id}
            onClick={() => onSelect(upgrade)}
            className="w-40 p-4 rounded transition-all hover:scale-[1.02] active:scale-[0.98]"
            style={{
              backgroundColor: '#0f0c12',
              border: '2px solid #3d2832',
              boxShadow: '0 0 0 1px rgba(0,0,0,0.6), inset 0 1px 0 rgba(60,40,50,0.25)',
              fontFamily: 'monospace',
            }}
          >
            <div
              className="text-2xl font-bold mb-2 py-2 rounded"
              style={{
                backgroundColor: '#161018',
                color: '#7a9a9a',
                border: '1px solid #2a2228',
              }}
            >
              {upgrade.icon}
            </div>

            <div
              className="text-base font-bold mb-1"
              style={{ color: '#c4bcb4' }}
            >
              {upgrade.name}
            </div>

            <div className="text-xs leading-snug" style={{ color: '#6d6560' }}>
              {upgrade.description}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
