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
  chapter: 1 | 2;
  dash: { unlocked: boolean; stamina: number; max: number };
}

export function GameUI({
  health,
  maxHealth,
  currentRoom,
  totalRooms,
  theme,
  minimap,
  enteredRooms,
  chapter,
  dash,
}: GameUIProps) {
  const dashFrac = dash.max > 0 ? Math.min(1, dash.stamina / dash.max) : 0;

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

      {dash.unlocked && (
        <div
          className="absolute left-4 z-20 flex flex-col gap-1"
          style={{ top: '3.25rem' }}
          role="status"
          aria-label={`Dash stamina ${dash.stamina.toFixed(1)} of ${dash.max}`}
        >
          <div
            className="h-2 w-22 rounded-sm overflow-hidden"
            style={{
              boxShadow: '0 0 0 1px rgba(160, 220, 255, 0.55), 0 0 12px rgba(40, 120, 180, 0.35)',
              backgroundColor: 'rgba(4, 10, 16, 0.92)',
            }}
          >
            <div
              className="h-full rounded-sm"
              style={{
                width: `${Math.round(dashFrac * 100)}%`,
                minWidth: dashFrac > 0.04 ? '4px' : 0,
                background:
                  chapter === 2
                    ? 'linear-gradient(180deg, rgba(160, 240, 255, 0.95), rgba(40, 140, 200, 0.88))'
                    : 'linear-gradient(180deg, rgba(200, 230, 255, 0.95), rgba(90, 140, 190, 0.9))',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.35)',
              }}
            />
          </div>
          <div
            className="text-[10px] font-mono tracking-wide"
            style={{ color: 'rgba(170, 210, 235, 0.9)', textShadow: '0 1px 2px rgba(0,0,0,0.85)' }}
          >
            SHIFT — dash
          </div>
        </div>
      )}

      <div className="absolute top-4 right-4 flex flex-col items-end gap-1 opacity-[0.92]">
        <RunRadar
          theme={theme}
          minimap={minimap}
          currentRoom={currentRoom}
          totalRooms={totalRooms}
          enteredRooms={enteredRooms}
        />
        <div
          className="text-[10px] font-mono tracking-widest text-right"
          style={{ color: 'rgba(140, 128, 118, 0.75)' }}
        >
          <div style={{ color: chapter === 2 ? 'rgba(130, 210, 230, 0.85)' : undefined }}>
            CHAPTER {chapter === 1 ? 'I' : 'II'}
          </div>
          <div className="mt-0.5">
            SECTOR {currentRoom + 1}/{totalRooms}
          </div>
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
          <div>WASD to move · Mouse to aim · Click to shoot · Shift dash (after sector 2)</div>
          <div className="mt-1" style={{ color: '#7a6058' }}>
            Survive. Clear the chamber. The door unlocks when nothing stirs.
          </div>
        </div>
      )}
    </div>
  );
}
