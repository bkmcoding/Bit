import { PixelHeart } from './PixelHeart';
import { RunRadar } from './RunRadar';
import type { MinimapLayout } from '@/lib/game/rooms/roomData';
import { PLAYER, type RoomThemeId } from '@/lib/game/utils/constants';

interface GameUIProps {
  health: number;
  maxHealth: number;
  currentRoom: number;
  totalRooms: number;
  theme: RoomThemeId;
  minimap: MinimapLayout;
  enteredRooms: number[];
}

export function GameUI({
  health,
  maxHealth,
  currentRoom,
  totalRooms,
  theme,
  minimap,
  enteredRooms,
}: GameUIProps) {
  return (
    <div className="absolute inset-0 pointer-events-none">
      <div
        className="absolute top-4 left-4 flex gap-0.5 items-center transition-opacity duration-200"
        role="status"
        aria-label={`Health ${health} of ${maxHealth}`}
        key={`hp-${maxHealth}`}
      >
        {Array.from({ length: maxHealth }).map((_, i) => (
          <PixelHeart
            key={i}
            filled={i < health}
            fromUpgrade={i >= PLAYER.MAX_HEALTH}
          />
        ))}
      </div>

      <div className="absolute top-4 right-4 flex flex-col items-end gap-1 opacity-[0.92]">
        <RunRadar
          theme={theme}
          minimap={minimap}
          currentRoom={currentRoom}
          totalRooms={totalRooms}
          enteredRooms={enteredRooms}
        />
        <div
          className="text-[10px] font-mono tracking-widest"
          style={{ color: 'rgba(140, 128, 118, 0.75)' }}
        >
          SECTOR {currentRoom + 1}/{totalRooms}
        </div>
      </div>

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
