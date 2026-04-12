interface PauseMenuProps {
  onResume: () => void;
  onRestart: () => void;
  onMainMenu: () => void;
}

export function PauseMenu({ onResume, onRestart, onMainMenu }: PauseMenuProps) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80">
      <h2 
        className="text-4xl font-bold mb-8"
        style={{
          color: '#fff',
          textShadow: '2px 2px 0 #000',
          fontFamily: 'monospace',
        }}
      >
        PAUSED
      </h2>

      <div className="flex flex-col gap-3">
        <button
          onClick={onResume}
          className="px-6 py-2 text-lg font-bold rounded transition-all hover:scale-105 active:scale-95"
          style={{
            backgroundColor: '#2d4a0e',
            color: '#fff',
            border: '2px solid #4a7a1a',
            fontFamily: 'monospace',
          }}
        >
          RESUME
        </button>

        <button
          onClick={onRestart}
          className="px-6 py-2 text-lg font-bold rounded transition-all hover:scale-105 active:scale-95"
          style={{
            backgroundColor: '#4a4a0e',
            color: '#fff',
            border: '2px solid #7a7a1a',
            fontFamily: 'monospace',
          }}
        >
          RESTART
        </button>

        <button
          onClick={onMainMenu}
          className="px-6 py-2 text-lg font-bold rounded transition-all hover:scale-105 active:scale-95"
          style={{
            backgroundColor: '#4a0e0e',
            color: '#fff',
            border: '2px solid #8b0000',
            fontFamily: 'monospace',
          }}
        >
          MAIN MENU
        </button>
      </div>

      <p 
        className="mt-6"
        style={{
          color: '#666',
          fontFamily: 'monospace',
          fontSize: '14px',
        }}
      >
        Press ESC to resume
      </p>
    </div>
  );
}
