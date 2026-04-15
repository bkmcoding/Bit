'use client'

import { MenuBackdrop, MenuWebSilhouette, MenuPanel, MenuBtn, MENU } from '@/components/game/menuTheme'

interface GameOverScreenProps {
  isVictory: boolean
  onRestart: () => void
  onMainMenu: () => void
}

const mono = { fontFamily: 'ui-monospace, "Cascadia Code", "Consolas", monospace' } as const

export function GameOverScreen({ isVictory, onRestart, onMainMenu }: GameOverScreenProps) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center">
      <MenuBackdrop />
      <MenuWebSilhouette />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: isVictory
            ? `radial-gradient(ellipse 55% 45% at 50% 40%, rgba(20, 32, 18, 0.35) 0%, rgba(0,0,0,0.88) 100%)`
            : `radial-gradient(ellipse 50% 40% at 50% 42%, rgba(48, 12, 14, 0.4) 0%, rgba(0,0,0,0.92) 100%)`,
        }}
      />

      <div className="relative z-10 flex max-w-md flex-col items-center px-6 text-center">
        <p className="mb-2 text-[10px] uppercase tracking-[0.45em]" style={{ color: MENU.whisper, ...mono }}>
          Bit
        </p>

        {isVictory ? (
          <>
            <h2
              className="mb-3 text-3xl font-bold uppercase tracking-[0.28em] sm:text-4xl"
              style={{
                color: '#7a8a6a',
                ...mono,
                textShadow: '0 0 20px rgba(60, 90, 50, 0.35), 0 2px 0 #000',
              }}
            >
              Hollow quiet
            </h2>
            <p className="mb-10 text-sm leading-relaxed" style={{ color: MENU.boneDim, ...mono }}>
              The trench goes quiet. For now, the box is yours.
            </p>
            <div className="mb-10 opacity-[0.35]" style={{ transform: 'rotate(180deg)' }}>
              <svg width="64" height="48" viewBox="0 0 80 60" aria-hidden={true}>
                <ellipse cx="40" cy="25" rx="15" ry="10" fill="#2a2220" />
                <ellipse cx="40" cy="45" rx="12" ry="15" fill="#2a2220" />
                {[0, 1, 2, 3].map((i) => (
                  <g key={i}>
                    <line
                      x1="28"
                      y1={20 + i * 6}
                      x2="5"
                      y2={15 + i * 8}
                      stroke="#2a2220"
                      strokeWidth="2"
                    />
                    <line
                      x1="52"
                      y1={20 + i * 6}
                      x2="75"
                      y2={15 + i * 8}
                      stroke="#2a2220"
                      strokeWidth="2"
                    />
                  </g>
                ))}
              </svg>
            </div>
          </>
        ) : (
          <>
            <h2
              className="mb-3 text-3xl font-bold uppercase tracking-[0.22em] sm:text-4xl"
              style={{
                color: '#6e2828',
                ...mono,
                textShadow: '0 0 28px rgba(90, 20, 24, 0.55), 0 2px 0 #000',
              }}
            >
              Consumed
            </h2>
            <p className="mb-10 text-sm leading-relaxed" style={{ color: MENU.boneDim, ...mono }}>
              They found you in the dark. The box keeps what it takes.
            </p>
          </>
        )}

        <MenuPanel className="flex w-full flex-col gap-3 py-5 sm:flex-row sm:justify-center">
          <MenuBtn variant={isVictory ? 'primary' : 'danger'} onClick={onRestart} className="min-w-[140px] flex-1 py-3.5">
            Again
          </MenuBtn>
          <MenuBtn variant="muted" onClick={onMainMenu} className="min-w-[140px] flex-1 py-3.5">
            Title
          </MenuBtn>
        </MenuPanel>
      </div>
    </div>
  )
}
