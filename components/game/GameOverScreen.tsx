interface GameOverScreenProps {
  isVictory: boolean;
  onRestart: () => void;
  onMainMenu: () => void;
}

export function GameOverScreen({ isVictory, onRestart, onMainMenu }: GameOverScreenProps) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90">
      {isVictory ? (
        <>
          <h2 
            className="text-5xl font-bold mb-4"
            style={{
              color: '#4ade80',
              textShadow: '3px 3px 0 #000',
              fontFamily: 'monospace',
            }}
          >
            VICTORY!
          </h2>
          <p 
            className="text-xl mb-8"
            style={{
              color: '#888',
              fontFamily: 'monospace',
            }}
          >
            The Broodmother has been defeated!
          </p>
          
          {/* Victory spider (dead) */}
          <div className="mb-8 opacity-50" style={{ transform: 'rotate(180deg)' }}>
            <svg width="60" height="45" viewBox="0 0 80 60">
              <ellipse cx="40" cy="25" rx="15" ry="10" fill="#333" />
              <ellipse cx="40" cy="45" rx="12" ry="15" fill="#333" />
              {[0, 1, 2, 3].map(i => (
                <g key={i}>
                  <line x1="28" y1={20 + i * 6} x2="5" y2={15 + i * 8} stroke="#333" strokeWidth="2" />
                  <line x1="52" y1={20 + i * 6} x2="75" y2={15 + i * 8} stroke="#333" strokeWidth="2" />
                </g>
              ))}
            </svg>
          </div>
        </>
      ) : (
        <>
          <h2 
            className="text-5xl font-bold mb-4"
            style={{
              color: '#ff4444',
              textShadow: '3px 3px 0 #000',
              fontFamily: 'monospace',
            }}
          >
            GAME OVER
          </h2>
          <p 
            className="text-xl mb-8"
            style={{
              color: '#888',
              fontFamily: 'monospace',
            }}
          >
            The spiders got you...
          </p>
        </>
      )}

      <div className="flex gap-4">
        <button
          onClick={onRestart}
          className="px-6 py-3 text-lg font-bold rounded transition-all hover:scale-105 active:scale-95"
          style={{
            backgroundColor: isVictory ? '#2d4a0e' : '#4a0e0e',
            color: '#fff',
            border: `3px solid ${isVictory ? '#4a7a1a' : '#8b0000'}`,
            fontFamily: 'monospace',
          }}
        >
          PLAY AGAIN
        </button>

        <button
          onClick={onMainMenu}
          className="px-6 py-3 text-lg font-bold rounded transition-all hover:scale-105 active:scale-95"
          style={{
            backgroundColor: '#333',
            color: '#fff',
            border: '3px solid #555',
            fontFamily: 'monospace',
          }}
        >
          MAIN MENU
        </button>
      </div>
    </div>
  );
}
