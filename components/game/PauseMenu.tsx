'use client'

import { MenuBackdrop, MenuWebSilhouette, MenuPanel, MenuBtn, MENU } from '@/components/game/menuTheme'

interface PauseMenuProps {
  onResume: () => void
  onRestart: () => void
  onMainMenu: () => void
}

const mono = { fontFamily: 'ui-monospace, "Cascadia Code", "Consolas", monospace' } as const

export function PauseMenu({ onResume, onRestart, onMainMenu }: PauseMenuProps) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center">
      <MenuBackdrop />
      <MenuWebSilhouette />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(ellipse 50% 40% at 50% 45%, transparent 0%, rgba(0,0,0,0.75) 100%)`,
        }}
      />

      <div className="relative z-10 flex flex-col items-center px-6">
        <p className="mb-2 text-[10px] uppercase tracking-[0.5em]" style={{ color: MENU.whisper, ...mono }}>
          Bit
        </p>
        <h2
          className="mb-8 text-2xl font-bold uppercase tracking-[0.35em] sm:text-3xl"
          style={{
            color: MENU.boneDim,
            ...mono,
            textShadow: '0 0 24px rgba(80, 30, 30, 0.4), 0 2px 0 #000',
          }}
        >
          Still
        </h2>

        <MenuPanel className="flex w-[min(100%,280px)] flex-col gap-3 py-6">
          <MenuBtn variant="primary" onClick={onResume} className="w-full py-3.5">
            Resume
          </MenuBtn>
          <MenuBtn variant="secondary" onClick={onRestart} className="w-full py-3.5">
            Restart run
          </MenuBtn>
          <MenuBtn variant="danger" onClick={onMainMenu} className="w-full py-3.5">
            Flee to title
          </MenuBtn>
        </MenuPanel>

        <p className="mt-8 text-center text-[10px] uppercase tracking-[0.25em]" style={{ color: MENU.whisper, ...mono }}>
          Esc — resume
        </p>
      </div>
    </div>
  )
}
