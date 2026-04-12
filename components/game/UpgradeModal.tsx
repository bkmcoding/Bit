import type { Upgrade } from '@/lib/game/upgrades/Upgrade';

interface UpgradeModalProps {
  upgrades: Upgrade[];
  onSelect: (upgrade: Upgrade) => void;
}

export function UpgradeModal({ upgrades, onSelect }: UpgradeModalProps) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/85">
      <h2 
        className="text-3xl font-bold mb-2"
        style={{
          color: '#fbbf24',
          textShadow: '2px 2px 0 #000',
          fontFamily: 'monospace',
        }}
      >
        ROOM CLEARED!
      </h2>
      
      <p 
        className="mb-6"
        style={{
          color: '#888',
          fontFamily: 'monospace',
        }}
      >
        Choose an upgrade:
      </p>

      <div className="flex gap-4">
        {upgrades.map((upgrade) => (
          <button
            key={upgrade.id}
            onClick={() => onSelect(upgrade)}
            className="w-40 p-4 rounded-lg transition-all hover:scale-105 active:scale-95 hover:brightness-110"
            style={{
              backgroundColor: '#1a1a2e',
              border: '3px solid #4a0e4a',
              fontFamily: 'monospace',
            }}
          >
            {/* Icon */}
            <div 
              className="text-2xl font-bold mb-2 py-2 rounded"
              style={{
                backgroundColor: '#2a1a3e',
                color: '#00ffff',
              }}
            >
              {upgrade.icon}
            </div>
            
            {/* Name */}
            <div 
              className="text-lg font-bold mb-1"
              style={{ color: '#fff' }}
            >
              {upgrade.name}
            </div>
            
            {/* Description */}
            <div 
              className="text-sm"
              style={{ color: '#888' }}
            >
              {upgrade.description}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
