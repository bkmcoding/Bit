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
      <div className="absolute top-4 right-4 flex gap-1">
        {Array.from({ length: totalRooms }).map((_, i) => (
          <div
            key={i}
            className="w-3 h-3 rounded-sm border"
            style={{
              backgroundColor: i < currentRoom ? '#4ade80' : i === currentRoom ? '#fbbf24' : '#374151',
              borderColor: i === currentRoom ? '#fbbf24' : '#1f2937',
            }}
          />
        ))}
      </div>

      {/* Controls hint (only in first room) */}
      {currentRoom === 0 && (
        <div 
          className="absolute bottom-4 left-1/2 -translate-x-1/2 text-center px-4 py-2 rounded"
          style={{
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            color: COLORS.TEXT,
            fontFamily: 'monospace',
            fontSize: '12px',
          }}
        >
          <div>WASD to move | Mouse to aim | Click to shoot</div>
          <div className="mt-1 text-yellow-400">Clear the room to open the door!</div>
        </div>
      )}
    </div>
  );
}
