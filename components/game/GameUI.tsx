import { PixelDashBar } from './PixelDashBar';
import { PixelHeart } from './PixelHeart';
import { RunRadar } from './RunRadar';
import type { MinimapLayout } from '@/lib/game/rooms/roomData';
import { PLAYER, type RoomThemeId } from '@/lib/game/utils/constants';

const HUD_FONT_STACK = 'ui-monospace, "Cascadia Mono", Consolas, monospace';

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
          className="absolute left-4 z-20 flex flex-col gap-1.5"
          style={{ top: '3.25rem' }}
          role="status"
          aria-label={`Dash stamina ${dash.stamina.toFixed(1)} of ${dash.max}`}
        >
          <PixelDashBar fraction={dashFrac} chapter={chapter} />
          <div
            className="select-none text-[9px] uppercase leading-none tracking-[0.14em]"
            style={{
              fontFamily: HUD_FONT_STACK,
              color: chapter === 2 ? '#5ec0c8' : '#7a98a8',
              textShadow:
                '1px 0 0 #080606, -1px 0 0 #080606, 0 1px 0 #080606, 0 -1px 0 #080606',
            }}
          >
            Shift·dash
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
          className="text-[11px] tracking-[0.16em] text-right leading-tight"
          style={{
            fontFamily: HUD_FONT_STACK,
            color: 'rgba(140, 128, 118, 0.82)',
            textShadow:
              '1px 0 0 rgba(8,6,6,0.9), -1px 0 0 rgba(8,6,6,0.9), 0 1px 0 rgba(8,6,6,0.9), 0 -1px 0 rgba(8,6,6,0.9)',
          }}
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
            fontFamily: HUD_FONT_STACK,
            fontSize: '11px',
            lineHeight: 1.45,
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
