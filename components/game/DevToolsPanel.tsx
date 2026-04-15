import type { DevPanelPayload } from '@/lib/game/engine/Game';

type Props = {
  hud: DevPanelPayload;
};

export function DevToolsPanel({ hud }: Props) {
  if (!hud.unlocked || !hud.panelOpen) return null;

  const inRun =
    hud.gameState === 'PLAYING' ||
    hud.gameState === 'PAUSED' ||
    hud.gameState === 'UPGRADE' ||
    hud.gameState === 'GAME_OVER' ||
    hud.gameState === 'VICTORY';

  return (
    <div
      className="pointer-events-none max-w-[min(280px,calc(100vw-2rem))] rounded border px-3 py-2 text-[10px] font-mono leading-snug shadow-lg"
      style={{
        position: 'fixed',
        left: 20,
        bottom: 20,
        zIndex: 2147483000,
        backgroundColor: 'rgba(4, 8, 10, 0.92)',
        borderColor: 'rgba(120, 220, 220, 0.65)',
        color: '#c8d8dd',
        boxShadow: '0 4px 24px rgba(0,0,0,0.55)',
      }}
      role="status"
      aria-label="Developer tools"
    >
      <div className="text-[#aef6ff] font-semibold tracking-wide">DEV BACKDOOR</div>
      <div className="mt-1 text-[#9cc7cf]">
        State: <span className="text-[#d8e8ec]">{hud.gameState}</span>
      </div>
      <div className="text-[#9cc7cf]">
        Room: <span className="text-[#d8e8ec]">{hud.roomLine}</span>
      </div>
      <div className="text-[#9cc7cf]">
        God mode: <span className="text-[#d8e8ec]">{hud.godMode ? 'ON' : 'OFF'}</span>
      </div>
      {!inRun && (
        <div className="mt-2 border-t border-[rgba(120,220,220,0.25)] pt-2 text-[#7a9fa8]">
          Start a run for F2–F6, PgUp/PgDn. F1 toggles this panel in-game.
        </div>
      )}
      {inRun && (
        <div className="mt-2 border-t border-[rgba(120,220,220,0.25)] pt-2 text-[#7a9fa8]">
          F1 panel · F2 god · F3 clear · F4 heal · F5 cards · F6 reload · PgUp/PgDn rooms
        </div>
      )}
      <div className="mt-1 text-[#5a7a82]">Ctrl+Shift+F9 or Y — lock/unlock</div>
    </div>
  );
}
