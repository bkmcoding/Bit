'use client'

import { useId } from 'react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'

/** Matches in-game cellar / deep / rust tones. */
export const MENU = {
  void: '#050302',
  voidMid: '#0a0606',
  panel: '#100a0c',
  panelHi: '#1a1214',
  rim: '#2a1818',
  rimHi: '#3d2828',
  blood: '#5a1818',
  bloodHi: '#7a2428',
  bone: '#c4b8a8',
  boneDim: '#8a7a70',
  whisper: '#5a4e48',
} as const

/** Full-bleed void: gradient, vignette, grain, scanlines (no rounded “app” chrome). */
export function MenuBackdrop() {
  return (
    <div
      className="absolute inset-0 overflow-hidden"
      style={{
        background: `linear-gradient(165deg, ${MENU.void} 0%, ${MENU.voidMid} 42%, #0c080a 100%)`,
      }}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(ellipse 55% 48% at 50% 42%, transparent 0%, rgba(0,0,0,0.55) 55%, rgba(0,0,0,0.92) 100%)`,
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          background: `
            radial-gradient(ellipse 80% 50% at 0% 100%, rgba(20,12,8,0.5) 0%, transparent 55%),
            radial-gradient(ellipse 70% 45% at 100% 0%, rgba(12,8,14,0.45) 0%, transparent 50%)
          `,
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.12] mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E")`,
          backgroundSize: '128px 128px',
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 1px, #000 1px, #000 2px)',
        }}
      />
    </div>
  )
}

export function MenuWebSilhouette() {
  const pid = useId().replace(/:/g, '')
  return (
    <div className="pointer-events-none absolute inset-0 opacity-[0.11]">
      <svg width="100%" height="100%" className="absolute inset-0" preserveAspectRatio="xMidYMid slice">
        <defs>
          <pattern id={pid} x="0" y="0" width="96" height="96" patternUnits="userSpaceOnUse">
            <path
              d="M48 0 L48 96 M0 48 L96 48 M0 0 L96 96 M96 0 L0 96"
              stroke="#4a3838"
              strokeWidth="0.6"
              fill="none"
            />
            <circle cx="48" cy="48" r="1.2" fill="#3d3030" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#${pid})`} />
      </svg>
    </div>
  )
}

export function MenuPanel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`relative border-2 px-5 py-5 ${className}`}
      style={{
        background: `linear-gradient(180deg, ${MENU.panelHi} 0%, ${MENU.panel} 100%)`,
        borderColor: MENU.rim,
        boxShadow: `
          inset 0 1px 0 rgba(90, 70, 65, 0.15),
          inset 0 -8px 24px rgba(0,0,0,0.45),
          0 0 0 1px rgba(0,0,0,0.6)
        `,
      }}
    >
      <div
        className="pointer-events-none absolute left-0 top-0 h-px w-full opacity-30"
        style={{ background: `linear-gradient(90deg, transparent, ${MENU.boneDim}, transparent)` }}
      />
      {children}
    </div>
  )
}

type MenuBtnVariant = 'primary' | 'secondary' | 'danger' | 'muted' | 'enter'

const BTN: Record<
  MenuBtnVariant,
  { from: string; to: string; border: string; text: string; outer: string; insetHi: string }
> = {
  primary: {
    from: '#2a1818',
    to: '#120a0c',
    border: '#6e2828',
    text: MENU.bone,
    outer: '#080404',
    insetHi: 'rgba(255, 240, 230, 0.08)',
  },
  enter: {
    from: '#0e0a0a',
    to: '#050303',
    border: '#241818',
    text: '#6a5e56',
    outer: '#020101',
    insetHi: 'rgba(80, 60, 58, 0.06)',
  },
  secondary: {
    from: '#1a1614',
    to: '#0c0a08',
    border: MENU.rimHi,
    text: MENU.boneDim,
    outer: '#060504',
    insetHi: 'rgba(255, 240, 230, 0.08)',
  },
  danger: {
    from: '#3a1414',
    to: '#160808',
    border: '#6e2020',
    text: '#e8d8d4',
    outer: '#0a0404',
    insetHi: 'rgba(255, 240, 230, 0.08)',
  },
  muted: {
    from: '#141210',
    to: '#080606',
    border: '#2a2420',
    text: MENU.whisper,
    outer: '#040302',
    insetHi: 'rgba(255, 240, 230, 0.06)',
  },
}

export function MenuBtn({
  children,
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: MenuBtnVariant }) {
  const v = BTN[variant]
  return (
    <button
      type="button"
      className={`rounded-none uppercase tracking-[0.2em] text-[11px] font-bold transition-[transform,filter,box-shadow] duration-100 hover:brightness-110 active:translate-y-0.5 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:brightness-100 disabled:active:translate-y-0 ${className}`}
      style={{
        color: v.text,
        fontFamily: 'ui-monospace, "Cascadia Code", "Consolas", monospace',
        background: `linear-gradient(180deg, ${v.from} 0%, ${v.to} 100%)`,
        border: `2px solid ${v.border}`,
        boxShadow: `
          inset 0 1px 0 ${v.insetHi},
          inset 0 -3px 6px rgba(0,0,0,0.5),
          0 3px 0 ${v.outer},
          0 0 14px rgba(0,0,0,0.35)
        `,
        textShadow: '0 1px 0 rgba(0,0,0,0.9)',
      }}
      {...props}
    >
      {children}
    </button>
  )
}
