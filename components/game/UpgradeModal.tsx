'use client'

import type { Upgrade } from '@/lib/game/upgrades/Upgrade'
import { MenuBackdrop, MenuWebSilhouette, MENU } from '@/components/game/menuTheme'

interface UpgradeModalProps {
  upgrades: Upgrade[]
  onSelect: (upgrade: Upgrade) => void
}

const mono = { fontFamily: 'ui-monospace, "Cascadia Code", "Consolas", monospace' } as const

export function UpgradeModal({ upgrades, onSelect }: UpgradeModalProps) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center px-3">
      <MenuBackdrop />
      <MenuWebSilhouette />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(ellipse 70% 55% at 50% 42%, rgba(24, 10, 18, 0.5) 0%, rgba(0,0,0,0.94) 100%)`,
        }}
      />

      <div className="relative z-10 flex max-w-4xl flex-col items-center">
        <p className="mb-1 text-[10px] uppercase tracking-[0.45em]" style={{ color: MENU.whisper, ...mono }}>
          Bit
        </p>
        <h2
          className="mb-1 text-center text-xl font-bold uppercase tracking-[0.2em] sm:text-2xl"
          style={{
            color: MENU.boneDim,
            ...mono,
            textShadow: '0 0 20px rgba(60, 30, 40, 0.4), 0 1px 0 #000',
          }}
        >
          The silence after
        </h2>
        <p className="mb-8 max-w-sm text-center text-[11px] leading-relaxed sm:text-xs" style={{ color: MENU.whisper, ...mono }}>
          Damp plaster. Something offers a trade — one gift, then the dark remembers you.
        </p>

        <div className="flex flex-wrap justify-center gap-4">
          {upgrades.map((upgrade) => (
            <button
              key={upgrade.id}
              type="button"
              onClick={() => onSelect(upgrade)}
              className="group w-40 border-2 p-0 text-left transition-[transform,box-shadow,filter] duration-150 hover:brightness-110 active:translate-y-0.5 sm:w-44"
              style={{
                borderColor: MENU.rim,
                background: `linear-gradient(180deg, ${MENU.panelHi} 0%, ${MENU.panel} 100%)`,
                boxShadow: `
                  inset 0 1px 0 rgba(90, 70, 65, 0.12),
                  inset 0 -6px 16px rgba(0,0,0,0.4),
                  0 3px 0 #080404,
                  0 0 0 1px rgba(0,0,0,0.5)
                `,
              }}
            >
              <div
                className="flex items-center justify-center border-b-2 py-3 transition-colors group-hover:border-[#4a3038]"
                style={{
                  borderColor: MENU.rim,
                  background: '#0c080a',
                }}
              >
                <span
                  className="text-2xl font-bold"
                  style={{
                    color: '#6a7a78',
                    textShadow: '0 0 12px rgba(40, 60, 55, 0.35)',
                  }}
                >
                  {upgrade.icon}
                </span>
              </div>
              <div className="px-3 py-3">
                <div
                  className="mb-1 text-xs font-bold uppercase tracking-wider"
                  style={{ color: MENU.bone, ...mono }}
                >
                  {upgrade.name}
                </div>
                <div className="text-[10px] leading-snug" style={{ color: MENU.whisper, ...mono }}>
                  {upgrade.description}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
