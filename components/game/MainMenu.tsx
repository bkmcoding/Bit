'use client'

import { useState, useEffect, useRef, useCallback, type MutableRefObject } from 'react'
import { AudioManager } from '@/lib/game/audio/AudioManager'
import type { Difficulty } from '@/lib/game/utils/constants'
import { Volume2, VolumeX, ArrowLeft, Cog } from 'lucide-react'
import {
  MenuBackdrop,
  MenuWebSilhouette,
  MenuPanel,
  MenuBtn,
  MENU,
  MENU_FONT_STACK,
} from '@/components/game/menuTheme'
import { menuBitTitleFont } from '@/lib/fonts'
import {
  loadClientGraphicsSettings,
  type ClientGraphicsSettings,
} from '@/lib/game/clientGraphicsSettings'

interface MainMenuProps {
  onStart: (difficulty: Difficulty) => void
  onClientGraphicsChange?: (settings: ClientGraphicsSettings) => void
}

const DIFFICULTY_OPTIONS: { id: Difficulty; label: string; hint: string }[] = [
  { id: 'easy', label: 'Easy', hint: 'Softer enemies, faster shots, longer spawn shield' },
  { id: 'medium', label: 'Medium', hint: 'Balanced' },
  {
    id: 'hard',
    label: 'Hard',
    hint: 'Stronger, faster foes; slower shots; coordinated hive AI',
  },
]

const mono = { fontFamily: MENU_FONT_STACK } as const

const CROSS_MS = 1900
/** Full-screen static only, then auto-fade into menu (never blocked on audio resume). */
const BOOT_STATIC_MS = 3200
const BOOT_TAIL_MS = 350
/** Static grain fades out first; then menu + veil fade in (sequential, no blend fight). */
const STATIC_FADE_OUT_MS = 2200
/** Menu UI + dark veil fade-in after static has cleared. */
const MENU_CONTENT_FADE_MS = 1650
const INTRO_FADE_EASE = 'cubic-bezier(0.22, 0.06, 0.18, 1)'
/** Audio: TV static ducks over the same window as visual static fade. */
const AUDIO_STATIC_FADE_OUT_MS = STATIC_FADE_OUT_MS
const AUDIO_MENU_FADE_IN_MS = 3200
/** Menu music starts after static has begun fading — overlap without a hard seam. */
const AUDIO_MENU_FADE_DELAY_MS = 380
const START_RUN_MS = 1400
/** Visual snow eases in after power-on (matches static audio roughly). */
const STATIC_VISUAL_FADE_IN_MS = 900
const STATIC_AUDIO_FADE_IN_MS = 900
/** Must match `tv-standby-blink` on the standby LED — also drives the sync pulse beeps. */
const STANDBY_BLINK_PERIOD_MS = 1250

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3)
}

function easeInOutQuint(t: number) {
  return t < 0.5 ? 16 * t * t * t * t * t : 1 - Math.pow(-2 * t + 2, 5) / 2
}

/**
 * TV static; `staticBleedRef` 1 = boot (harsh), 0 = settled menu (subtle).
 * Presentation (opacity / blend) is updated inside draw from the same ref.
 */
function useWhiteNoiseCanvas(staticBleedRef: MutableRefObject<number>) {
  const ref = useRef<HTMLCanvasElement>(null)
  const draw = useCallback(() => {
    const c = ref.current
    if (!c) return
    const w = 128
    const h = 96
    if (c.width !== w) {
      c.width = w
      c.height = h
    }
    const ctx = c.getContext('2d')
    if (!ctx) return
    const b = staticBleedRef.current
    const bias = 17 + 21 * b
    const img = ctx.createImageData(w, h)
    const d = img.data
    for (let i = 0; i < d.length; i += 4) {
      const v = Math.random() * 255
      const n = v > 128 - bias ? 255 : 0
      const alpha = Math.round(88 + 82 * b)
      d[i] = n
      d[i + 1] = n
      d[i + 2] = n
      d[i + 3] = alpha
    }
    ctx.putImageData(img, 0, 0)

    c.style.opacity = String(0.1 + 0.24 * b)
    c.style.mixBlendMode = b > 0.22 ? 'screen' : 'overlay'
  }, [staticBleedRef])

  useEffect(() => {
    let id: number
    const tick = () => {
      draw()
      id = window.requestAnimationFrame(tick)
    }
    id = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(id)
  }, [draw])

  return ref
}

/** Lightweight menu shader pass: chromatic crawl + scan shimmer. */
function useMenuShaderCanvas() {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    let raf = 0
    const draw = (t: number) => {
      const c = ref.current
      if (!c) return
      const w = 240
      const h = 144
      if (c.width !== w || c.height !== h) {
        c.width = w
        c.height = h
      }
      const ctx = c.getContext('2d')
      if (!ctx) return
      const tm = t * 0.001
      ctx.clearRect(0, 0, w, h)

      for (let x = 0; x < w; x += 2) {
        const p = x / w
        const wave = Math.sin(tm * 1.4 + p * 12.5) * 0.5 + 0.5
        ctx.fillStyle = `rgba(${Math.floor(65 + wave * 60)}, ${Math.floor(
          20 + wave * 24
        )}, ${Math.floor(86 + wave * 48)}, 0.1)`
        ctx.fillRect(x, 0, 1, h)
      }

      for (let y = 0; y < h; y += 4) {
        const p = y / h
        const a = 0.03 + (Math.sin(tm * 2.3 + p * 18) * 0.5 + 0.5) * 0.075
        ctx.fillStyle = `rgba(255,255,255,${a})`
        ctx.fillRect(0, y, w, 1)
      }

      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [])
  return ref
}

function SettingsToggleRow({
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  label: string
  description: string
  checked: boolean
  onChange: (next: boolean) => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="flex w-full items-start gap-3 border-2 px-3 py-3 text-left transition-[border-color,opacity] duration-200 disabled:cursor-not-allowed disabled:opacity-45"
      style={{
        ...mono,
        fontSize: '10px',
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
        color: MENU.boneDim,
        background: `linear-gradient(180deg, ${MENU.panelHi} 0%, #0c0808 100%)`,
        borderColor: checked ? '#6e2828' : MENU.rim,
        boxShadow: checked
          ? `inset 0 0 0 1px rgba(120,40,45,0.25), 0 0 12px rgba(60,20,22,0.2)`
          : 'inset 0 2px 6px rgba(0,0,0,0.35)',
      }}
    >
      <span
        className="mt-0.5 h-4 w-4 shrink-0 border-2"
        style={{
          borderColor: MENU.rimHi,
          background: checked ? MENU.blood : MENU.void,
          boxShadow: checked ? `inset 0 0 0 2px ${MENU.void}` : 'none',
        }}
        aria-hidden
      />
      <span className="min-w-0 flex-1">
        <span className="block" style={{ color: checked ? MENU.bone : MENU.boneDim }}>
          {label}
        </span>
        <span
          className="mt-1 block normal-case tracking-normal"
          style={{ color: MENU.whisper, fontSize: '11px', lineHeight: 1.45 }}
        >
          {description}
        </span>
      </span>
    </button>
  )
}

export function MainMenu({ onStart, onClientGraphicsChange }: MainMenuProps) {
  const [awaitingStandby, setAwaitingStandby] = useState(true)
  const [introOpaque, setIntroOpaque] = useState(true)
  const [introLayerMounted, setIntroLayerMounted] = useState(true)
  /** 0 until static has fully faded; then animates to 1 for menu copy (no overlap with harsh static). */
  const [menuContentOpacity, setMenuContentOpacity] = useState(0)
  const [isVisible, setIsVisible] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [isStarting, setIsStarting] = useState(false)
  const [difficulty, setDifficulty] = useState<Difficulty>('medium')
  const [phase, setPhase] = useState<'title' | 'setup'>('title')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [graphics, setGraphics] = useState<ClientGraphicsSettings>(() => loadClientGraphicsSettings())
  const [masterPct, setMasterPct] = useState(70)
  const [musicPct, setMusicPct] = useState(74)
  const [sfxPct, setSfxPct] = useState(88)

  const justPoweredOnRef = useRef(false)
  /** Released on effect cleanup so Strict Mode can run a second boot attempt. */
  const menuBootIdleRef = useRef(true)
  const staticBleedRef = useRef(0)
  const bleedInRafRef = useRef<number | null>(null)
  const noiseRef = useWhiteNoiseCanvas(staticBleedRef)
  const shaderRef = useMenuShaderCanvas()

  const handleTvPowerOn = useCallback(async () => {
    try {
      await AudioManager.initialize()
      await AudioManager.resume()
    } catch {
      // still continue boot; audio may be limited
    }
    justPoweredOnRef.current = true
    setAwaitingStandby(false)
  }, [])

  /** Low beep locked to the standby LED blink (Web Audio unlocks after first gesture if needed). */
  useEffect(() => {
    if (!awaitingStandby) return
    let cancelled = false
    let intervalId: ReturnType<typeof setInterval> | undefined
    void AudioManager.initialize()
      .then(() => {
        if (cancelled) return
        const tick = () => {
          AudioManager.playMenuStandbyPulse()
        }
        tick()
        intervalId = setInterval(tick, STANDBY_BLINK_PERIOD_MS)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
      if (intervalId !== undefined) clearInterval(intervalId)
    }
  }, [awaitingStandby])

  useEffect(() => {
    if (awaitingStandby) return
    if (!justPoweredOnRef.current) return
    if (!menuBootIdleRef.current) return
    menuBootIdleRef.current = false

    let cancelled = false
    const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

    const boot = async () => {
      const runBleedIn = () => {
        staticBleedRef.current = 0
        if (bleedInRafRef.current !== null) cancelAnimationFrame(bleedInRafRef.current)
        const t0 = performance.now()
        const tick = (now: number) => {
          if (cancelled) return
          const u = Math.min(1, (now - t0) / STATIC_VISUAL_FADE_IN_MS)
          staticBleedRef.current = easeOutCubic(u)
          if (u < 1) {
            bleedInRafRef.current = requestAnimationFrame(tick)
          } else {
            bleedInRafRef.current = null
          }
        }
        bleedInRafRef.current = requestAnimationFrame(tick)
      }

      const initPromise = AudioManager.initialize().catch(() => undefined)

      await initPromise
      if (cancelled) return

      runBleedIn()
      AudioManager.startMenuTvStaticLoop(STATIC_AUDIO_FADE_IN_MS)

      await sleep(BOOT_STATIC_MS)
      if (cancelled) return

      setIsMuted(AudioManager.getSettings().muted)
      AudioManager.beginMenuMusicSilentStart()
      await AudioManager.playMusic('MUSIC_MENU')
      await AudioManager.resume().catch(() => undefined)

      AudioManager.crossfadeMenuStaticToMusic({
        staticFadeOutMs: AUDIO_STATIC_FADE_OUT_MS,
        musicFadeInMs: AUDIO_MENU_FADE_IN_MS,
        musicDelayMs: AUDIO_MENU_FADE_DELAY_MS,
      })

      await new Promise<void>((resolve) => {
        const t0 = performance.now()
        const step = (now: number) => {
          if (cancelled) return
          const u = Math.min(1, (now - t0) / STATIC_FADE_OUT_MS)
          staticBleedRef.current = 1 - easeInOutQuint(u)
          if (u < 1) {
            requestAnimationFrame(step)
          } else {
            staticBleedRef.current = 0
            resolve()
          }
        }
        requestAnimationFrame(step)
      })
      if (cancelled) return

      await sleep(BOOT_TAIL_MS)
      if (cancelled) return

      setIntroOpaque(false)
      setMenuContentOpacity(1)
      setIsVisible(true)
      justPoweredOnRef.current = false
    }

    void boot().finally(() => {
      menuBootIdleRef.current = true
    })

    return () => {
      cancelled = true
      menuBootIdleRef.current = true
      if (bleedInRafRef.current !== null) {
        cancelAnimationFrame(bleedInRafRef.current)
        bleedInRafRef.current = null
      }
    }
  }, [awaitingStandby])

  useEffect(() => {
    if (awaitingStandby) staticBleedRef.current = 0
  }, [awaitingStandby])

  const goToSetup = async () => {
    await AudioManager.resume()
    setPhase('setup')
  }

  const handleBeginRun = async () => {
    setIsStarting(true)
    await AudioManager.resume()
    const selected = difficulty
    window.setTimeout(() => {
      onStart(selected)
    }, START_RUN_MS)
  }

  const toggleMute = () => {
    const newMuted = AudioManager.toggleMute()
    setIsMuted(newMuted)
  }

  useEffect(() => {
    if (!settingsOpen) return
    void AudioManager.initialize().then(() => {
      const a = AudioManager.getSettings()
      setIsMuted(a.muted)
      setMasterPct(Math.round(a.masterVolume * 100))
      setMusicPct(Math.round(a.musicVolume * 100))
      setSfxPct(Math.round(a.sfxVolume * 100))
    })
  }, [settingsOpen])

  useEffect(() => {
    if (!settingsOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Escape') {
        e.preventDefault()
        setSettingsOpen(false)
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [settingsOpen])

  const pushGraphics = (next: ClientGraphicsSettings) => {
    setGraphics(next)
    onClientGraphicsChange?.(next)
  }

  const introFadeDone = (e: React.TransitionEvent<HTMLDivElement>) => {
    if (e.propertyName !== 'opacity') return
    if (introOpaque) return
    setIntroLayerMounted(false)
  }

  const menuRevealed = !introOpaque

  return (
    <div
      className={`main-menu-root absolute inset-0 flex flex-col items-center overflow-x-hidden overflow-y-hidden ${
        phase === 'title' ? 'justify-center' : 'justify-start'
      }`}
    >
      <MenuBackdrop />
      <MenuWebSilhouette />

      <div
        className="pointer-events-none absolute inset-0 z-1 opacity-[0.14]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(0,0,0,0.45) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0,0,0,0.45) 1px, transparent 1px)
          `,
          backgroundSize: '2px 2px',
          mixBlendMode: 'multiply',
        }}
      />

      <canvas
        ref={noiseRef}
        className="pointer-events-none absolute inset-0 z-2 h-full w-full"
        style={{
          imageRendering: 'pixelated',
        }}
      />
      <canvas
        ref={shaderRef}
        className="pointer-events-none absolute inset-0 z-3 h-full w-full opacity-50"
        style={{
          imageRendering: 'pixelated',
          mixBlendMode: 'screen',
          filter: 'saturate(1.1) contrast(1.06)',
        }}
      />

      <style>{`
        @keyframes bit-breathe {
          0%, 100% { filter: brightness(1); }
          50% { filter: brightness(1.12); }
        }
        @keyframes bit-flicker {
          0%, 100% { opacity: 1; }
          92% { opacity: 1; }
          93% { opacity: 0.82; }
          94% { opacity: 1; }
          96% { opacity: 0.88; }
        }
        @keyframes bit-drift {
          0% { opacity: 0.04; transform: translate(0, 0); }
          50% { opacity: 0.09; transform: translate(-1%, 0.5%); }
          100% { opacity: 0.04; transform: translate(0, 0); }
        }
        @keyframes tv-standby-blink {
          0%, 100% { opacity: 1; filter: brightness(1); }
          45% { opacity: 0.14; filter: brightness(0.65); }
          50% { opacity: 0.14; filter: brightness(0.65); }
        }
        /* Same phase as tv-standby-blink (dim together with the LED). */
        @keyframes tv-standby-click-sync {
          0%, 100% { opacity: 1; }
          45%, 50% { opacity: 0.22; }
        }
        .main-menu-pixel {
          image-rendering: pixelated;
          image-rendering: crisp-edges;
          -webkit-font-smoothing: antialiased;
        }
        .main-menu-title-bit {
          text-transform: uppercase;
          -webkit-font-smoothing: none;
          -moz-osx-font-smoothing: grayscale;
          font-smooth: never;
        }
        .main-menu-setup-scroll {
          scrollbar-width: thin;
          scrollbar-color: #3a2828 #080606;
        }
        .main-menu-setup-scroll::-webkit-scrollbar {
          width: 5px;
        }
        .main-menu-setup-scroll::-webkit-scrollbar-thumb {
          background: #2a1818;
        }
        .main-menu-setup-scroll::-webkit-scrollbar-track {
          background: #060404;
        }
      `}</style>

      <div
        className="pointer-events-none absolute inset-0 z-1"
        style={{
          animation: 'bit-drift 14s ease-in-out infinite',
          background: `radial-gradient(ellipse 40% 30% at 70% 20%, rgba(60,20,24,0.22) 0%, transparent 70%)`,
        }}
      />

      {awaitingStandby && (
        <button
          type="button"
          className="absolute inset-0 z-50 flex cursor-pointer flex-col items-center justify-center gap-8 border-0 bg-[#020101] p-8 outline-none focus-visible:ring-2 focus-visible:ring-[#5a2828] focus-visible:ring-offset-2 focus-visible:ring-offset-black"
          onClick={handleTvPowerOn}
          aria-label="Click to power on the display"
        >
          <span className="sr-only">Click anywhere to power on the display</span>
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{
              backgroundColor: MENU.bloodHi,
              boxShadow: `0 0 10px ${MENU.bloodHi}, 0 0 22px rgba(140, 36, 42, 0.45)`,
              animation: `tv-standby-blink ${STANDBY_BLINK_PERIOD_MS}ms ease-in-out infinite`,
            }}
            aria-hidden
          />
          <p
            className="text-center uppercase tracking-[0.55em]"
            style={{
              color: MENU.boneDim,
              ...mono,
              fontSize: '13px',
              textShadow: '0 0 24px rgba(90, 40, 40, 0.35)',
              animation: 'tv-click-hint 1.05s ease-in-out infinite',
            }}
          >
            click
          </p>
          <p
            className="text-center uppercase tracking-[0.42em] opacity-50"
            style={{ color: MENU.whisper, ...mono, fontSize: '9px' }}
          >
            standby
          </p>
        </button>
      )}

      {/* Dark veil + static: fades out automatically (no text, no click). */}
      {introLayerMounted && (
        <div
          className="absolute inset-0 z-40 pointer-events-none transition-opacity"
          style={{
            opacity: introOpaque ? 1 : 0,
            transitionDuration: `${MENU_CONTENT_FADE_MS}ms`,
            transitionTimingFunction: INTRO_FADE_EASE,
            background: 'rgba(2, 1, 1, 0.92)',
          }}
          onTransitionEnd={introFadeDone}
        />
      )}

      <button
        type="button"
        onClick={() => setSettingsOpen(true)}
        className={`absolute top-4 right-4 z-30 p-2.5 transition-all ease-in-out ${
          menuRevealed ? 'pointer-events-auto opacity-100 translate-y-0' : 'pointer-events-none opacity-0'
        }`}
        style={{
          transitionDuration: `${Math.min(800, MENU_CONTENT_FADE_MS)}ms`,
          transitionDelay: menuRevealed ? '200ms' : '0ms',
          background: `linear-gradient(180deg, ${MENU.panelHi} 0%, ${MENU.panel} 100%)`,
          border: `2px solid ${MENU.rim}`,
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05), 0 2px 0 #080404',
        }}
        aria-label="Settings"
      >
        <Cog className="h-5 w-5" style={{ color: MENU.boneDim }} />
      </button>

      <button
        type="button"
        onClick={toggleMute}
        className={`absolute top-4 right-[3.75rem] z-30 p-2.5 transition-all ease-in-out sm:right-[4.25rem] ${
          menuRevealed ? 'pointer-events-auto opacity-100 translate-y-0' : 'pointer-events-none opacity-0'
        }`}
        style={{
          transitionDuration: `${Math.min(800, MENU_CONTENT_FADE_MS)}ms`,
          transitionDelay: menuRevealed ? '200ms' : '0ms',
          background: `linear-gradient(180deg, ${MENU.panelHi} 0%, ${MENU.panel} 100%)`,
          border: `2px solid ${MENU.rim}`,
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05), 0 2px 0 #080404',
        }}
        aria-label={isMuted ? 'Unmute audio' : 'Mute audio'}
      >
        {isMuted ? (
          <VolumeX className="h-5 w-5" style={{ color: '#7a3030' }} />
        ) : (
          <Volume2 className="h-5 w-5" style={{ color: MENU.boneDim }} />
        )}
      </button>

      {settingsOpen && (
        <div
          className="absolute inset-0 z-[45] flex items-center justify-center bg-black/72 p-4 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="menu-settings-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSettingsOpen(false)
          }}
        >
          <MenuPanel className="relative max-h-[min(90vh,520px)] w-full max-w-md overflow-y-auto">
            <button
              type="button"
              className="absolute right-2 top-2 border-0 bg-transparent px-2 py-1 text-[11px] uppercase tracking-[0.2em] transition-colors"
              style={{ color: MENU.whisper, ...mono }}
              onClick={() => setSettingsOpen(false)}
            >
              Esc
            </button>
            <h2
              id="menu-settings-title"
              className="pr-10 text-center text-[11px] uppercase tracking-[0.4em] sm:text-xs"
              style={{ color: MENU.boneDim, ...mono }}
            >
              Settings
            </h2>

            <div className="mt-5 space-y-4">
              <p className="text-[10px] uppercase tracking-[0.4em]" style={{ color: MENU.whisper, ...mono }}>
                Audio
              </p>
              <label className="block space-y-1.5">
                <span className="text-[11px]" style={{ color: MENU.boneDim, ...mono }}>
                  Master {masterPct}%
                </span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={masterPct}
                  className="w-full accent-[#6e2828]"
                  onChange={(e) => {
                    const v = Number(e.target.value)
                    setMasterPct(v)
                    AudioManager.setMasterVolume(v / 100)
                  }}
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-[11px]" style={{ color: MENU.boneDim, ...mono }}>
                  Music {musicPct}%
                </span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={musicPct}
                  className="w-full accent-[#6e2828]"
                  onChange={(e) => {
                    const v = Number(e.target.value)
                    setMusicPct(v)
                    AudioManager.setMusicVolume(v / 100)
                  }}
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-[11px]" style={{ color: MENU.boneDim, ...mono }}>
                  Sound effects {sfxPct}%
                </span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={sfxPct}
                  className="w-full accent-[#6e2828]"
                  onChange={(e) => {
                    const v = Number(e.target.value)
                    setSfxPct(v)
                    AudioManager.setSfxVolume(v / 100)
                  }}
                />
              </label>
            </div>

            <div className="mt-6 space-y-3">
              <p className="text-[10px] uppercase tracking-[0.4em]" style={{ color: MENU.whisper, ...mono }}>
                Video
              </p>
              <SettingsToggleRow
                label="Cap at 60 FPS"
                description="Limits frame pacing to 60 FPS to ease GPU load on high-refresh monitors. Off uses your display refresh when available."
                checked={graphics.fpsLimitEnabled}
                onChange={(v) => pushGraphics({ ...graphics, fpsLimitEnabled: v })}
              />
              <SettingsToggleRow
                label="Low quality mode"
                description="Skips the WebGL post pass and uses the simpler 2D presentation path."
                checked={graphics.lowQualityMode}
                onChange={(v) => pushGraphics({ ...graphics, lowQualityMode: v })}
              />
            </div>

            <div className="mt-6 flex justify-end">
              <MenuBtn variant="enter" className="px-8 py-3 text-[11px]" onClick={() => setSettingsOpen(false)}>
                Done
              </MenuBtn>
            </div>
          </MenuPanel>
        </div>
      )}

      <div
        className={`main-menu-pixel relative z-10 h-full min-h-0 w-full max-w-lg ${
          phase === 'title' ? 'flex flex-col items-center justify-center' : 'flex flex-col'
        }`}
        style={{
          opacity: awaitingStandby ? 0 : menuContentOpacity,
          transition: `opacity ${MENU_CONTENT_FADE_MS}ms ${INTRO_FADE_EASE}`,
          pointerEvents: introOpaque ? 'none' : 'auto',
        }}
      >
        <div
          className={`absolute inset-0 flex flex-col items-center justify-center gap-12 px-4 transition-opacity ease-in-out ${
            phase === 'title' ? 'pointer-events-auto z-20' : 'pointer-events-none z-10'
          }`}
          style={{
            opacity: phase === 'title' ? 1 : 0,
            transitionDuration: `${CROSS_MS}ms`,
          }}
        >
          <div
            className={`relative transition-all ease-out ${
              isVisible ? 'translate-y-0 opacity-100' : '-translate-y-10 opacity-0'
            }`}
            style={{ transitionDuration: '1200ms', transitionDelay: '120ms' }}
          >
            <h1
              className={`main-menu-title-bit main-menu-pixel text-center text-6xl leading-none tracking-[0.1em] sm:text-7xl md:text-8xl ${menuBitTitleFont.className}`}
              style={{
                color: '#5b5048',
                animation: 'bit-breathe 5s ease-in-out infinite, bit-flicker 7s linear infinite',
                textShadow: `
                  0 0 56px rgba(120, 30, 35, 0.6),
                  0 0 2px rgba(0,0,0,1),
                  3px 3px 0 #0a0606,
                  -1px -1px 0 #1a1010,
                  0 1px 0 rgba(200, 180, 170, 0.12)
                `,
              }}
            >
              BIT
            </h1>
            <div
              className="pointer-events-none absolute -inset-x-8 -bottom-2 h-8 opacity-50"
              style={{
                background: `linear-gradient(180deg, rgba(80,24,28,0.35) 0%, transparent 100%)`,
                filter: 'blur(8px)',
              }}
            />
          </div>

          <div className="flex flex-col items-center gap-8">
            <p
              className={`max-w-md text-center text-[13px] leading-relaxed sm:text-[15px] transition-opacity ease-out ${
                isVisible ? 'opacity-100' : 'opacity-0'
              }`}
              style={{
                color: MENU.boneDim,
                ...mono,
                textShadow: '0 0 20px rgba(0,0,0,0.9), 0 1px 0 #000',
                transitionDuration: '1000ms',
                transitionDelay: '280ms',
              }}
            >
              A speck of white in the damp dark. The box remembers every footstep.
            </p>

            <div
              className={`transition-[opacity,transform] duration-1100 ease-out ${
                isVisible ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
              }`}
              style={{ transitionDelay: '400ms' }}
            >
              <MenuBtn variant="enter" onClick={goToSetup} className="px-14 py-4 text-sm sm:px-16 sm:py-5 sm:text-base">
                Enter
              </MenuBtn>
            </div>
          </div>
        </div>

        <div
          className={`main-menu-setup-scroll absolute inset-0 flex min-h-0 flex-col items-center justify-center gap-5 overflow-y-auto overflow-x-hidden px-4 py-10 transition-opacity ease-in-out ${
            phase === 'setup' ? 'pointer-events-auto z-20' : 'pointer-events-none z-10'
          }`}
          style={{
            opacity: phase === 'setup' ? 1 : 0,
            transitionDuration: `${CROSS_MS}ms`,
            transitionDelay: phase === 'setup' ? '220ms' : '0ms',
          }}
        >
          <button
            type="button"
            onClick={() => setPhase('title')}
            className="group mt-2 flex items-center gap-2 self-start text-[11px] uppercase tracking-[0.25em] transition-colors duration-500"
            style={{ color: MENU.whisper, ...mono }}
          >
            <ArrowLeft className="h-3.5 w-3.5 transition-transform duration-500 group-hover:-translate-x-0.5" />
            <span className="border-b border-transparent transition-colors duration-500 group-hover:border-[#5a4040]">
              Return
            </span>
          </button>

          <h2
            className="text-center text-lg uppercase tracking-[0.35em] sm:text-xl"
            style={{ color: MENU.boneDim, ...mono, textShadow: '0 0 18px rgba(90,40,40,0.35)' }}
          >
            Before you go down
          </h2>

          <MenuPanel className="w-full space-y-4">
            <p className="text-[10px] uppercase tracking-[0.4em]" style={{ color: MENU.whisper, ...mono }}>
              Cruelty
            </p>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              {DIFFICULTY_OPTIONS.map((opt) => {
                const active = difficulty === opt.id
                return (
                  <button
                    key={opt.id}
                    type="button"
                    disabled={isStarting}
                    onClick={() => setDifficulty(opt.id)}
                    title={opt.hint}
                    className="min-h-11 flex-1 border-2 px-4 py-3 text-left transition-[box-shadow,filter,border-color] duration-300 disabled:opacity-50 sm:min-w-25 sm:flex-none"
                    style={{
                      ...mono,
                      fontSize: '11px',
                      letterSpacing: '0.12em',
                      textTransform: 'uppercase',
                      color: active ? MENU.bone : MENU.whisper,
                      background: active
                        ? `linear-gradient(180deg, #2a1416 0%, #140808 100%)`
                        : `linear-gradient(180deg, ${MENU.panelHi} 0%, #0c0808 100%)`,
                      borderColor: active ? '#6e2828' : MENU.rim,
                      boxShadow: active
                        ? `inset 0 0 0 1px rgba(120,40,45,0.35), 0 0 20px rgba(60,20,22,0.25)`
                        : 'inset 0 2px 8px rgba(0,0,0,0.35)',
                    }}
                  >
                    {opt.label}
                  </button>
                )
              })}
            </div>
            <p className="text-[11px] leading-relaxed" style={{ color: MENU.whisper, ...mono }}>
              {DIFFICULTY_OPTIONS.find((o) => o.id === difficulty)?.hint}
            </p>
          </MenuPanel>

          <MenuBtn
            variant="danger"
            onClick={handleBeginRun}
            disabled={isStarting}
            className="w-full max-w-md py-4 text-xs transition-opacity duration-500 sm:text-sm"
          >
            {isStarting ? 'Opening the box…' : 'Descend'}
          </MenuBtn>

          <MenuPanel className="w-full">
            <p className="mb-4 text-[10px] uppercase tracking-[0.4em]" style={{ color: MENU.whisper, ...mono }}>
              Bindings
            </p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-[11px]" style={{ color: MENU.boneDim, ...mono }}>
              <div className="flex items-center gap-2">
                <kbd
                  className="border px-2 py-1.5 text-[10px] uppercase"
                  style={{
                    background: MENU.void,
                    borderColor: MENU.rimHi,
                    boxShadow: 'inset 0 -2px 0 rgba(0,0,0,0.5)',
                    color: MENU.bone,
                  }}
                >
                  WASD
                </kbd>
                <span>Move</span>
              </div>
              <div className="flex items-center gap-2">
                <kbd
                  className="border px-2 py-1.5 text-[10px]"
                  style={{
                    background: MENU.void,
                    borderColor: MENU.rimHi,
                    boxShadow: 'inset 0 -2px 0 rgba(0,0,0,0.5)',
                    color: MENU.bone,
                  }}
                >
                  Mouse
                </kbd>
                <span>Aim</span>
              </div>
              <div className="flex items-center gap-2">
                <kbd
                  className="border px-2 py-1.5 text-[10px]"
                  style={{
                    background: MENU.void,
                    borderColor: MENU.rimHi,
                    boxShadow: 'inset 0 -2px 0 rgba(0,0,0,0.5)',
                    color: MENU.bone,
                  }}
                >
                  Click
                </kbd>
                <span>Shoot</span>
              </div>
              <div className="flex items-center gap-2">
                <kbd
                  className="border px-2 py-1.5 text-[10px]"
                  style={{
                    background: MENU.void,
                    borderColor: MENU.rimHi,
                    boxShadow: 'inset 0 -2px 0 rgba(0,0,0,0.5)',
                    color: MENU.bone,
                  }}
                >
                  Esc
                </kbd>
                <span>Pause</span>
              </div>
            </div>
            <p className="mt-4 text-[10px] leading-relaxed" style={{ color: MENU.whisper, ...mono }}>
              Opposite keys cancel. Crates and pillars block shots. Do not linger.
            </p>
          </MenuPanel>
        </div>
      </div>
    </div>
  )
}
