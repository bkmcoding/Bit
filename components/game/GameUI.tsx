import { COLORS } from '@/lib/game/utils/constants';

interface GameUIProps {
  health: number;
  maxHealth: number;
  currentRoom: number;
  totalRooms: number;
}

export function GameUI({ health, maxHealth, currentRoom, totalRooms }: GameUIProps) {
  return (
    <div className="absolute inset-0 pointer-events-none">
      {/* Health display */}
      <div className="absolute top-4 left-4 flex gap-1">
        {Array.from({ length: maxHealth }).map((_, i) => (
          <div
            key={i}
            className="w-6 h-6 flex items-center justify-center"
            style={{
              color: i < health ? COLORS.HEART_FULL : COLORS.HEART_EMPTY,
              textShadow: '1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000',
              fontSize: '20px',
            }}
          >
            &#9829;
          </div>
        ))}
      </div>

      {/* Room indicator */}
      <div className="absolute top-4 right-4 flex gap-1 opacity-90">
        {Array.from({ length: totalRooms }).map((_, i) => (
          <div
            key={i}
            className="w-3 h-3 rounded-sm border"
            style={{
              backgroundColor:
                i < currentRoom ? '#3d4a38' : i === currentRoom ? '#5c4030' : '#1c1818',
              borderColor: i === currentRoom ? '#6b5040' : '#0f0c0c',
              boxShadow:
                i === currentRoom ? '0 0 6px rgba(90, 40, 30, 0.45)' : 'none',
            }}
          />
        ))}
      </div>

      {/* Controls hint (only in first room) */}
      {currentRoom === 0 && (
        <div
          className="absolute bottom-4 left-1/2 -translate-x-1/2 text-center px-4 py-2 rounded border"
          style={{
            backgroundColor: 'rgba(8, 6, 10, 0.82)',
            borderColor: 'rgba(50, 36, 40, 0.6)',
            color: '#9a9088',
            fontFamily: 'monospace',
            fontSize: '12px',
            boxShadow: '0 0 24px rgba(0,0,0,0.5)',
          }}
        >
          <div>WASD to move · Mouse to aim · Click to shoot</div>
          <div className="mt-1" style={{ color: '#7a6058' }}>
            Survive. Clear the chamber. The door unlocks when nothing stirs.
          </div>
        </div>
      )}
    </div>
  );
}
