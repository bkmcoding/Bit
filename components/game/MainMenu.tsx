'use client'

import { useState, useEffect } from 'react'
import { AudioManager } from '@/lib/game/audio/AudioManager'
import type { Difficulty } from '@/lib/game/utils/constants'
import { Volume2, VolumeX, ArrowLeft } from 'lucide-react'

interface MainMenuProps {
  onStart: (difficulty: Difficulty) => void
}

const DIFFICULTY_OPTIONS: { id: Difficulty; label: string; hint: string }[] = [
  { id: 'easy', label: 'Easy', hint: 'Softer enemies, faster shots, longer spawn shield' },
  { id: 'medium', label: 'Medium', hint: 'Balanced' },
  { id: 'hard', label: 'Hard', hint: 'Tougher foes, slower shots' },
]

export function MainMenu({ onStart }: MainMenuProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [isStarting, setIsStarting] = useState(false)
  const [difficulty, setDifficulty] = useState<Difficulty>('medium')
  const [phase, setPhase] = useState<'title' | 'setup'>('title')

  useEffect(() => {
    let cancelled = false

    const boot = async () => {
      await AudioManager.initialize()
      if (cancelled) return
      setIsMuted(AudioManager.getSettings().muted)
      await AudioManager.resume()
      void AudioManager.playMusic('MUSIC_MENU')
    }
    void boot()

    const timer = setTimeout(() => setIsVisible(true), 100)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [])

  const goToSetup = async () => {
    await AudioManager.resume()
    setPhase('setup')
  }

  const handleBeginRun = async () => {
    setIsStarting(true)
    await AudioManager.resume()
    const selected = difficulty
    setTimeout(() => {
      onStart(selected)
    }, 200)
  }

  const toggleMute = () => {
    const newMuted = AudioManager.toggleMute()
    setIsMuted(newMuted)
  }

  const mono = { fontFamily: 'monospace' } as const

  return (
    <div
      className={`absolute inset-0 flex flex-col items-center justify-center ${
        phase === 'title' ? 'overflow-hidden' : 'justify-start overflow-y-auto overflow-x-hidden py-6 sm:py-8'
      }`}
      style={{
        background: 'linear-gradient(180deg, #030101 0%, #080303 50%, #050202 100%)',
        filter: 'contrast(1.1) brightness(0.7) sepia(0.2)', // Eerie dark/hue
      }}
    >
      <style>
        {`
          @keyframes shiver {
            0% { transform: translate(-1.5px, 0); }
            100% { transform: translate(1.5px, 0); }
          }
        `}
      </style>

      <div className="absolute inset-0 opacity-15">
        <svg width="100%" height="100%" className="absolute inset-0">
          <defs>
            <pattern id="webPattern" x="0" y="0" width="80" height="80" patternUnits="userSpaceOnUse">
              <circle cx="40" cy="40" r="1.5" fill="#333333" />
              <line x1="40" y1="0" x2="40" y2="80" stroke="#333333" strokeWidth="0.8" />
              <line x1="0" y1="40" x2="80" y2="40" stroke="#333333" strokeWidth="0.8" />
              <line x1="0" y1="0" x2="80" y2="80" stroke="#333333" strokeWidth="0.5" />
              <line x1="80" y1="0" x2="0" y2="80" stroke="#333333" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#webPattern)" />
        </svg>
      </div>

      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 0%, rgba(0,0,0,0.92) 100%)', // Heavy Vignette
        }}
      />

      <button
        onClick={toggleMute}
        className={`absolute top-4 right-4 p-2 rounded-lg transition-all duration-300 ${
          isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'
        }`}
        style={{
          backgroundColor: 'rgba(255,255,255,0.05)',
          border: '2px solid rgba(255,255,255,0.1)',
          transitionDelay: '800ms',
        }}
        aria-label={isMuted ? 'Unmute audio' : 'Mute audio'}
      >
        {isMuted ? <VolumeX className="w-5 h-5 text-red-600" /> : <Volume2 className="w-5 h-5 text-white/50" />}
      </button>

      {phase === 'title' ? (
        <div className="relative z-10 flex flex-col items-center gap-10 px-4">
          {/* Title and Hiding Bit block */}
          <div className="relative group" style={{ transitionDelay: '300ms' }}>
            <div
              className={`transition-all duration-700 ${
                isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-8'
              }`}
            >
              <h1
                className="text-8xl md:text-9xl font-bold tracking-tight lowercase text-center"
                style={{
                  color: '#444444',
                  textShadow: '0 0 25px rgba(255,255,255,0.2), 6px 6px 0 #cc2222, -2px -2px 0 #000, 0 0 5px #e5e5e5', // Pixelated outline feel via shadow
                  fontFamily: 'monospace',
                  letterSpacing: '-6px',
                }}
              >
                Bit
              </h1>
            </div>
          </div>

          <div className="flex flex-col items-center gap-6">
            <p
              className={`text-xl md:text-2xl transition-all duration-500 delay-200 ${
                isVisible ? 'opacity-100' : 'opacity-0'
              }`}
              style={{ color: '#666', ...mono, textShadow: '1px 1px 0 #000' }}
            >
              A tiny bug in a vast, dreadful box
            </p>

            <button
              type="button"
              onClick={goToSetup}
              className={`
                relative px-12 py-5 text-3xl font-bold rounded-lg 
                transition-all duration-500 delay-500
                hover:scale-105 hover:shadow-lg hover:shadow-red-950/60
                active:scale-95
                ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}
              `}
              style={{
                backgroundColor: '#3d1010',
                color: '#fff',
                border: '4px solid #5a0000',
                fontFamily: 'monospace',
                textShadow: '3px 3px 0 #000',
                boxShadow: '0 5px 25px rgba(50, 0, 0, 0.6), inset 0 1px 0 rgba(255,255,255,0.05)',
              }}
            >
              DESCEND
            </button>
          </div>

          {/* <p
            className={`text-sm text-gray-700 transition-all duration-700 delay-1000 ${
              isVisible ? 'opacity-100' : 'opacity-0'
            }`}
            style={mono}
          >
            Theme: Box &amp; Spiders
          </p> */}
        </div>
      ) : (
        <div className="relative z-10 flex flex-col items-center gap-6 px-4 max-w-2xl w-full shrink-0 pb-10">
          <button
            type="button"
            onClick={() => setPhase('title')}
            className="flex items-center gap-2 text-gray-500 hover:text-white text-sm transition-colors"
            style={mono}
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>

          <h2 className="text-3xl font-bold text-red-700/80" style={mono}>
            Prepare your run
          </h2>

          <div className="w-full rounded-lg border border-white/10 bg-black/50 p-6 space-y-4">
            <p className="text-xs uppercase tracking-widest text-gray-500" style={mono}>
              Difficulty
            </p>
            <div className="flex flex-wrap gap-2.5">
              {DIFFICULTY_OPTIONS.map((opt) => {
                const active = difficulty === opt.id
                return (
                  <button
                    key={opt.id}
                    type="button"
                    disabled={isStarting}
                    onClick={() => setDifficulty(opt.id)}
                    title={opt.hint}
                    className={`px-5 py-2.5 rounded-md text-sm font-bold border-2 transition-all disabled:opacity-50 ${
                      active ? 'scale-105' : 'opacity-80 hover:opacity-100'
                    }`}
                    style={{
                      fontFamily: 'monospace',
                      backgroundColor: active ? '#4d1414' : 'rgba(30,15,15,0.7)',
                      color: '#e5e5e5',
                      borderColor: active ? '#ff3333' : '#4a2a2a',
                      boxShadow: active ? '0 0 15px rgba(255,50,50,0.4)' : 'none',
                    }}
                  >
                    {opt.label}
                  </button>
                )
              })}
            </div>
            <p className="text-[12px] text-gray-500" style={mono}>
              {DIFFICULTY_OPTIONS.find((o) => o.id === difficulty)?.hint}
            </p>
          </div>

          <button
            type="button"
            onClick={handleBeginRun}
            disabled={isStarting}
            className="relative w-full max-w-md px-10 py-5 text-2xl font-bold rounded-lg transition-all hover:scale-[1.03] active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              backgroundColor: '#3d1010',
              color: '#fff',
              border: '4px solid #5a0000',
              fontFamily: 'monospace',
              textShadow: '3px 3px 0 #000',
              boxShadow: '0 5px 25px rgba(50, 0, 0, 0.6)',
            }}
          >
            {isStarting ? <span className="animate-pulse">LOADING...</span> : 'BEGIN THE DESCENT'}
          </button>

          <div className="w-full rounded-lg border border-white/10 bg-black/50 p-6">
            <p className="text-xs uppercase tracking-widest text-gray-500 mb-4" style={mono}>
              Controls
            </p>
            <div className="grid grid-cols-2 gap-x-8 gap-y-3.5 text-base text-gray-500" style={mono}>
              <div className="flex items-center gap-2">
                <kbd className="px-2.5 py-1.5 bg-gray-900 rounded-md text-sm border border-gray-700">WASD</kbd>
                <span>Move</span>
              </div>
              <div className="flex items-center gap-2">
                <kbd className="px-2.5 py-1.5 bg-gray-900 rounded-md text-sm border border-gray-700">Mouse</kbd>
                <span>Aim</span>
              </div>
              <div className="flex items-center gap-2">
                <kbd className="px-2.5 py-1.5 bg-gray-900 rounded-md text-sm border border-gray-700">Click</kbd>
                <span>Shoot</span>
              </div>
              <div className="flex items-center gap-2">
                <kbd className="px-2.5 py-1.5 bg-gray-900 rounded-md text-sm border border-gray-700">ESC</kbd>
                <span>Pause</span>
              </div>
            </div>
            <p className="text-[12px] text-gray-600 mt-4" style={mono}>
              Opposite keys cancel (A+D). Crates & pillars block. Be quick.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
