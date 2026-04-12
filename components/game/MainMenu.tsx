'use client'

import { useState, useEffect, useRef, useCallback, type MutableRefObject } from 'react'
import { AudioManager } from '@/lib/game/audio/AudioManager'
import type { Difficulty } from '@/lib/game/utils/constants'
import { Volume2, VolumeX, ArrowLeft } from 'lucide-react'
import { MenuBackdrop, MenuWebSilhouette, MenuPanel, MenuBtn, MENU } from '@/components/game/menuTheme'

interface MainMenuProps {
  onStart: (difficulty: Difficulty) => void
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

const mono = { fontFamily: 'ui-monospace, "Cascadia Code", "Consolas", monospace' } as const

const CROSS_MS = 1900
/** Full-screen static only, then auto-fade into menu (never blocked on audio resume). */
const BOOT_STATIC_MS = 3200
const BOOT_TAIL_MS = 350
/** Veil + static grain ease; longer reads smoother on screen. */
const INTRO_FADE_MS = 2200
/** Audio crossfade: static tails out while menu theme rises (can run longer than the veil). */
const AUDIO_STATIC_FADE_OUT_MS = 3600
const AUDIO_MENU_FADE_IN_MS = 3200
/** Menu music starts after static has begun fading — overlap without a hard seam. */
const AUDIO_MENU_FADE_DELAY_MS = 380
const START_RUN_MS = 1400
/** Visual snow eases in after power-on (matches static audio roughly). */
const STATIC_VISUAL_FADE_IN_MS = 900
const STATIC_AUDIO_FADE_IN_MS = 900

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3)
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
    const bias = 18 + 22 * b
    const img = ctx.createImageData(w, h)
    const d = img.data
    for (let i = 0; i < d.length; i += 4) {
      const v = Math.random() * 255
      const n = v > 128 - bias ? 255 : 0
      const alpha = Math.round(95 + 105 * b)
      d[i] = n
      d[i + 1] = n
      d[i + 2] = n
      d[i + 3] = alpha
    }
    ctx.putImageData(img, 0, 0)

    c.style.opacity = String(0.11 + 0.31 * b)
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

export function MainMenu({ onStart }: MainMenuProps) {
  const [awaitingStandby, setAwaitingStandby] = useState(true)
  const [introOpaque, setIntroOpaque] = useState(true)
  const [introLayerMounted, setIntroLayerMounted] = useState(true)
  const [isVisible, setIsVisible] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [isStarting, setIsStarting] = useState(false)
  const [difficulty, setDifficulty] = useState<Difficulty>('medium')
  const [phase, setPhase] = useState<'title' | 'setup'>('title')

  const justPoweredOnRef = useRef(false)
  /** Released on effect cleanup so Strict Mode can run a second boot attempt. */
  const menuBootIdleRef = useRef(true)
  const staticBleedRef = useRef(0)
  const bleedInRafRef = useRef<number | null>(null)
  const noiseRef = useWhiteNoiseCanvas(staticBleedRef)

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

      await sleep(BOOT_TAIL_MS)
      if (cancelled) return

      setIntroOpaque(false)
      setIsVisible(true)
      AudioManager.crossfadeMenuStaticToMusic({
        staticFadeOutMs: AUDIO_STATIC_FADE_OUT_MS,
        musicFadeInMs: AUDIO_MENU_FADE_IN_MS,
        musicDelayMs: AUDIO_MENU_FADE_DELAY_MS,
      })
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

  useEffect(() => {
    if (awaitingStandby) return
    if (introOpaque) return

    const start = performance.now()
    let frame: number
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / INTRO_FADE_MS)
      staticBleedRef.current = 1 - easeOutCubic(t)
      if (t < 1) {
        frame = requestAnimationFrame(step)
      } else {
        staticBleedRef.current = 0
      }
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [introOpaque, awaitingStandby])

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
        className="pointer-events-none absolute inset-0 z-[1] opacity-[0.14]"
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
        className="pointer-events-none absolute inset-0 z-[2] h-full w-full"
        style={{
          imageRendering: 'pixelated',
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
        @keyframes tv-click-hint {
          0%, 100% { opacity: 0.22; }
          50% { opacity: 1; }
        }
        .main-menu-pixel {
          image-rendering: pixelated;
          image-rendering: crisp-edges;
          -webkit-font-smoothing: antialiased;
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
        className="pointer-events-none absolute inset-0 z-[1]"
        style={{
          animation: 'bit-drift 14s ease-in-out infinite',
          background: `radial-gradient(ellipse 40% 30% at 70% 20%, rgba(60,20,24,0.22) 0%, transparent 70%)`,
        }}
      />

      {awaitingStandby && (
        <button
          type="button"
          className="absolute inset-0 z-[50] flex cursor-pointer flex-col items-center justify-center gap-8 border-0 bg-[#020101] p-8 outline-none transition-colors hover:bg-[#050302] focus-visible:ring-2 focus-visible:ring-[#5a2828] focus-visible:ring-offset-2 focus-visible:ring-offset-black"
          onClick={handleTvPowerOn}
          aria-label="Click to power on the display"
        >
          <span className="sr-only">Click anywhere to power on the display</span>
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{
              backgroundColor: MENU.bloodHi,
              boxShadow: `0 0 10px ${MENU.bloodHi}, 0 0 22px rgba(140, 36, 42, 0.45)`,
              animation: 'tv-standby-blink 1.25s ease-in-out infinite',
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
          className="absolute inset-0 z-40 pointer-events-none transition-opacity ease-in-out"
          style={{
            opacity: introOpaque ? 1 : 0,
            transitionDuration: `${INTRO_FADE_MS}ms`,
            background: 'rgba(2, 1, 1, 0.92)',
          }}
          onTransitionEnd={introFadeDone}
        />
      )}

      <button
        onClick={toggleMute}
        className={`absolute top-4 right-4 z-30 p-2.5 transition-all ease-in-out ${
          menuRevealed ? 'pointer-events-auto opacity-100 translate-y-0' : 'pointer-events-none opacity-0'
        }`}
        style={{
          transitionDuration: `${Math.min(800, INTRO_FADE_MS)}ms`,
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

      <div
        className={`main-menu-pixel relative z-10 h-full min-h-0 w-full max-w-lg ${
          phase === 'title' ? 'flex flex-col items-center justify-center' : 'flex flex-col'
        }`}
        style={{
          opacity: introOpaque ? 0 : 1,
          transition: `opacity ${INTRO_FADE_MS}ms ease-in-out`,
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
              className="text-center text-7xl font-bold leading-none tracking-tight sm:text-8xl md:text-9xl"
              style={{
                ...mono,
                color: '#2a2220',
                letterSpacing: '-0.04em',
                animation: 'bit-breathe 5s ease-in-out infinite, bit-flicker 7s linear infinite',
                textShadow: `
                  0 0 42px rgba(120, 30, 35, 0.45),
                  0 0 2px rgba(0,0,0,1),
                  3px 3px 0 #0a0606,
                  -1px -1px 0 #1a1010,
                  0 1px 0 rgba(200, 180, 170, 0.12)
                `,
              }}
            >
              Bit
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
              className={`max-w-md text-center text-base leading-relaxed sm:text-lg transition-opacity ease-out ${
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
              className={`transition-[opacity,transform] duration-[1100ms] ease-out ${
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
          className={`main-menu-setup-scroll absolute inset-0 flex min-h-0 flex-col items-center gap-5 overflow-y-auto overflow-x-hidden px-4 pb-6 transition-opacity ease-in-out ${
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
                    className="min-h-[44px] flex-1 border-2 px-4 py-3 text-left transition-[box-shadow,filter,border-color] duration-300 disabled:opacity-50 sm:min-w-[100px] sm:flex-none"
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
