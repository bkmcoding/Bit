'use client';

import { useState, useEffect } from 'react';
import { AudioManager } from '@/lib/game/audio/AudioManager';
import type { Difficulty } from '@/lib/game/utils/constants';
import { Volume2, VolumeX, ArrowLeft } from 'lucide-react';

interface MainMenuProps {
  onStart: (difficulty: Difficulty) => void;
}

const DIFFICULTY_OPTIONS: { id: Difficulty; label: string; hint: string }[] = [
  { id: 'easy', label: 'Easy', hint: 'Softer enemies, faster shots, longer spawn shield' },
  { id: 'medium', label: 'Medium', hint: 'Balanced' },
  { id: 'hard', label: 'Hard', hint: 'Tougher foes, slower shots' },
];

export function MainMenu({ onStart }: MainMenuProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [phase, setPhase] = useState<'title' | 'setup'>('title');

  useEffect(() => {
    AudioManager.initialize().then(() => {
      setIsMuted(AudioManager.getSettings().muted);
      void AudioManager.playMusic('MUSIC_MENU');
    });

    const timer = setTimeout(() => setIsVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const goToSetup = async () => {
    await AudioManager.resume();
    setPhase('setup');
  };

  const handleBeginRun = async () => {
    setIsStarting(true);
    await AudioManager.resume();
    const selected = difficulty;
    setTimeout(() => {
      onStart(selected);
    }, 200);
  };

  const toggleMute = () => {
    const newMuted = AudioManager.toggleMute();
    setIsMuted(newMuted);
  };

  const mono = { fontFamily: 'monospace' } as const;

  return (
    <div
      className={`absolute inset-0 flex flex-col items-center ${
        phase === 'title'
          ? 'justify-center overflow-hidden'
          : 'justify-start overflow-y-auto overflow-x-hidden py-6 sm:py-8'
      }`}
      style={{
        background: 'linear-gradient(180deg, #0a0505 0%, #1a0a0a 50%, #0d0404 100%)',
      }}
    >
      <div className="absolute inset-0 opacity-10">
        <svg width="100%" height="100%" className="absolute inset-0">
          <defs>
            <pattern id="webPattern" x="0" y="0" width="60" height="60" patternUnits="userSpaceOnUse">
              <circle cx="30" cy="30" r="1" fill="#ffffff" />
              <line x1="30" y1="0" x2="30" y2="60" stroke="#ffffff" strokeWidth="0.5" />
              <line x1="0" y1="30" x2="60" y2="30" stroke="#ffffff" strokeWidth="0.5" />
              <line x1="0" y1="0" x2="60" y2="60" stroke="#ffffff" strokeWidth="0.3" />
              <line x1="60" y1="0" x2="0" y2="60" stroke="#ffffff" strokeWidth="0.3" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#webPattern)" />
        </svg>
      </div>

      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 0%, rgba(0,0,0,0.7) 100%)',
        }}
      />

      <button
        onClick={toggleMute}
        className={`absolute top-4 right-4 p-2 rounded-lg transition-all duration-300 ${
          isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'
        }`}
        style={{
          backgroundColor: 'rgba(255,255,255,0.1)',
          border: '1px solid rgba(255,255,255,0.2)',
          transitionDelay: '800ms',
        }}
        aria-label={isMuted ? 'Unmute audio' : 'Mute audio'}
      >
        {isMuted ? (
          <VolumeX className="w-5 h-5 text-red-400" />
        ) : (
          <Volume2 className="w-5 h-5 text-white/70" />
        )}
      </button>

      {phase === 'title' ? (
        <div className="relative z-10 flex flex-col items-center gap-8 px-4">
          <div
            className={`text-center transition-all duration-700 ${
              isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-8'
            }`}
          >
            <h1
              className="text-6xl md:text-7xl font-bold tracking-tight mb-3"
              style={{
                color: '#cc2222',
                textShadow: '0 0 40px rgba(200,0,0,0.5), 4px 4px 0 #000, -1px -1px 0 #000',
                fontFamily: 'monospace',
                letterSpacing: '-2px',
              }}
            >
              BOX CRAWLER
            </h1>
            <p
              className={`text-lg md:text-xl transition-all duration-500 delay-200 ${
                isVisible ? 'opacity-100' : 'opacity-0'
              }`}
              style={{ color: '#666', ...mono }}
            >
              A tiny bug in a big, scary world
            </p>
          </div>

          <div
            className={`transition-all duration-700 delay-300 ${
              isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-75'
            }`}
          >
            <svg width="120" height="100" viewBox="0 0 120 100" className="drop-shadow-2xl">
              <defs>
                <radialGradient id="eyeGlow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#ff0000" stopOpacity="1" />
                  <stop offset="100%" stopColor="#ff0000" stopOpacity="0" />
                </radialGradient>
                <filter id="glow">
                  <feGaussianBlur stdDeviation="2" result="coloredBlur" />
                  <feMerge>
                    <feMergeNode in="coloredBlur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              <g className="animate-pulse" style={{ animationDuration: '2s' }}>
                {[0, 1, 2, 3].map((i) => (
                  <g key={i}>
                    <path
                      d={`M ${42 - i * 2} ${35 + i * 10} Q ${15 - i * 3} ${25 + i * 12} ${5 + i * 2} ${35 + i * 10}`}
                      stroke="#2a1010"
                      strokeWidth="3"
                      fill="none"
                      strokeLinecap="round"
                    />
                    <path
                      d={`M ${78 + i * 2} ${35 + i * 10} Q ${105 + i * 3} ${25 + i * 12} ${115 - i * 2} ${35 + i * 10}`}
                      stroke="#2a1010"
                      strokeWidth="3"
                      fill="none"
                      strokeLinecap="round"
                    />
                  </g>
                ))}
              </g>
              <ellipse cx="60" cy="35" rx="20" ry="15" fill="#3d1515" />
              <ellipse cx="60" cy="35" rx="16" ry="11" fill="#4a1a1a" />
              <ellipse cx="60" cy="65" rx="25" ry="30" fill="#2d0a0a" />
              <ellipse cx="60" cy="62" rx="18" ry="20" fill="#3d1010" />
              <ellipse cx="60" cy="58" rx="8" ry="10" fill="#4a1515" />
              <g filter="url(#glow)">
                <circle cx="52" cy="28" r="5" fill="url(#eyeGlow)" />
                <circle cx="68" cy="28" r="5" fill="url(#eyeGlow)" />
                <circle cx="52" cy="28" r="3" fill="#ff0000" />
                <circle cx="68" cy="28" r="3" fill="#ff0000" />
                <circle cx="51" cy="27" r="1" fill="#ffffff" />
                <circle cx="67" cy="27" r="1" fill="#ffffff" />
              </g>
              <circle cx="45" cy="35" r="2" fill="#cc0000" />
              <circle cx="75" cy="35" r="2" fill="#cc0000" />
              <path d="M 55 42 Q 53 50 56 48" fill="#1a0505" stroke="#1a0505" strokeWidth="2" />
              <path d="M 65 42 Q 67 50 64 48" fill="#1a0505" stroke="#1a0505" strokeWidth="2" />
            </svg>
          </div>

          <button
            type="button"
            onClick={goToSetup}
            className={`
              relative px-12 py-4 text-2xl font-bold rounded-lg 
              transition-all duration-500 delay-500
              hover:scale-105 hover:shadow-lg hover:shadow-red-900/50
              active:scale-95
              ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}
            `}
            style={{
              backgroundColor: '#5a1515',
              color: '#fff',
              border: '3px solid #8b0000',
              fontFamily: 'monospace',
              textShadow: '2px 2px 0 #000',
              boxShadow: '0 4px 20px rgba(139, 0, 0, 0.4), inset 0 1px 0 rgba(255,255,255,0.1)',
            }}
          >
            START GAME
          </button>

          <p
            className={`text-xs text-gray-600 transition-all duration-700 delay-1000 ${
              isVisible ? 'opacity-100' : 'opacity-0'
            }`}
            style={mono}
          >
            Theme: Box + Spiders
          </p>
        </div>
      ) : (
        <div className="relative z-10 flex flex-col items-center gap-6 px-4 max-w-lg w-full shrink-0 pb-10">
          <button
            type="button"
            onClick={() => setPhase('title')}
            className="self-start flex items-center gap-2 text-gray-400 hover:text-white text-sm transition-colors"
            style={mono}
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>

          <h2 className="text-2xl font-bold text-red-500/90" style={mono}>
            Prepare your run
          </h2>

          <div className="w-full rounded-lg border border-white/10 bg-black/40 p-4 space-y-3">
            <p className="text-xs uppercase tracking-widest text-gray-500" style={mono}>
              Difficulty
            </p>
            <div className="flex flex-wrap gap-2">
              {DIFFICULTY_OPTIONS.map((opt) => {
                const active = difficulty === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    disabled={isStarting}
                    onClick={() => setDifficulty(opt.id)}
                    title={opt.hint}
                    className={`px-4 py-2 rounded-md text-sm font-bold border-2 transition-all disabled:opacity-50 ${
                      active ? 'scale-105' : 'opacity-80 hover:opacity-100'
                    }`}
                    style={{
                      fontFamily: 'monospace',
                      backgroundColor: active ? '#6b1c1c' : 'rgba(40,20,20,0.6)',
                      color: '#f5f5f5',
                      borderColor: active ? '#ff4444' : '#4a2a2a',
                      boxShadow: active ? '0 0 12px rgba(255,60,60,0.35)' : 'none',
                    }}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-gray-500" style={mono}>
              {DIFFICULTY_OPTIONS.find((o) => o.id === difficulty)?.hint}
            </p>
          </div>

          <button
            type="button"
            onClick={handleBeginRun}
            disabled={isStarting}
            className="relative w-full max-w-sm px-10 py-4 text-xl font-bold rounded-lg transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              backgroundColor: '#5a1515',
              color: '#fff',
              border: '3px solid #8b0000',
              fontFamily: 'monospace',
              textShadow: '2px 2px 0 #000',
              boxShadow: '0 4px 20px rgba(139, 0, 0, 0.4)',
            }}
          >
            {isStarting ? <span className="animate-pulse">LOADING...</span> : 'PLAY'}
          </button>

          <div className="w-full rounded-lg border border-white/10 bg-black/40 p-4">
            <p className="text-xs uppercase tracking-widest text-gray-500 mb-3" style={mono}>
              Controls
            </p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm text-gray-400" style={mono}>
              <div className="flex items-center gap-2">
                <kbd className="px-2 py-1 bg-gray-800 rounded text-xs border border-gray-700">WASD</kbd>
                <span>Move</span>
              </div>
              <div className="flex items-center gap-2">
                <kbd className="px-2 py-1 bg-gray-800 rounded text-xs border border-gray-700">Mouse</kbd>
                <span>Aim</span>
              </div>
              <div className="flex items-center gap-2">
                <kbd className="px-2 py-1 bg-gray-800 rounded text-xs border border-gray-700">Click</kbd>
                <span>Shoot</span>
              </div>
              <div className="flex items-center gap-2">
                <kbd className="px-2 py-1 bg-gray-800 rounded text-xs border border-gray-700">ESC</kbd>
                <span>Pause</span>
              </div>
            </div>
            <p className="text-[11px] text-gray-600 mt-3" style={mono}>
              Opposite movement keys cancel (e.g. A+D). Use crates and pillars for cover.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
