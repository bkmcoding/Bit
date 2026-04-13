'use client'

import { useEffect, useState } from 'react'
import { AudioManager } from '@/lib/game/audio/AudioManager'
import { MenuBackdrop, MenuWebSilhouette, MenuPanel, MenuBtn, MENU } from '@/components/game/menuTheme'

interface PauseMenuProps {
  onResume: () => void
  onRestart: () => void
  onMainMenu: () => void
}

const mono = { fontFamily: 'ui-monospace, "Cascadia Code", "Consolas", monospace' } as const

export function PauseMenu({ onResume, onRestart, onMainMenu }: PauseMenuProps) {
  const [musicPct, setMusicPct] = useState(50)
  const [sfxPct, setSfxPct] = useState(80)

  useEffect(() => {
    const s = AudioManager.getSettings()
    setMusicPct(Math.round(s.musicVolume * 100))
    setSfxPct(Math.round(s.sfxVolume * 100))
  }, [])

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

        <MenuPanel className="flex w-[min(100%,280px)] flex-col gap-4 py-6">
          <div className="w-full space-y-3 border-b pb-4" style={{ borderColor: MENU.rim }}>
            <p
              className="text-[10px] uppercase tracking-[0.35em]"
              style={{ color: MENU.whisper, ...mono }}
            >
              Audio
            </p>
            <label className="block space-y-1.5">
              <span className="flex justify-between text-[10px] uppercase tracking-[0.2em]" style={{ color: MENU.boneDim, ...mono }}>
                <span>Music</span>
                <span>{musicPct}%</span>
              </span>
              <input
                type="range"
                min={0}
                max={100}
                value={musicPct}
                onChange={(e) => {
                  const v = Number(e.target.value)
                  setMusicPct(v)
                  AudioManager.setMusicVolume(v / 100)
                }}
                className="h-2 w-full cursor-pointer"
                style={{ accentColor: MENU.blood }}
                aria-label="Music volume"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="flex justify-between text-[10px] uppercase tracking-[0.2em]" style={{ color: MENU.boneDim, ...mono }}>
                <span>Game sounds</span>
                <span>{sfxPct}%</span>
              </span>
              <input
                type="range"
                min={0}
                max={100}
                value={sfxPct}
                onChange={(e) => {
                  const v = Number(e.target.value)
                  setSfxPct(v)
                  AudioManager.setSfxVolume(v / 100)
                }}
                className="h-2 w-full cursor-pointer"
                style={{ accentColor: MENU.blood }}
                aria-label="Game sounds volume"
              />
            </label>
          </div>

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
