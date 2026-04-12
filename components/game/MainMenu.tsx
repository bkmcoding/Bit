'use client';

import { useState, useEffect } from 'react';
import { AudioManager } from '@/lib/game/audio/AudioManager';
import { Volume2, VolumeX } from 'lucide-react';

interface MainMenuProps {
  onStart: () => void;
}

export function MainMenu({ onStart }: MainMenuProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isStarting, setIsStarting] = useState(false);

  useEffect(() => {
    // Initialize audio system
    AudioManager.initialize().then(() => {
      setIsMuted(AudioManager.getSettings().muted);
      void AudioManager.playMusic('MUSIC_MENU');
    });
    
    // Trigger fade-in animation
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  const handleStart = async () => {
    setIsStarting(true);
    // Resume audio context on user interaction
    await AudioManager.resume();
    // Brief delay for the button animation
    setTimeout(() => {
      onStart();
    }, 200);
  };

  const toggleMute = () => {
    const newMuted = AudioManager.toggleMute();
    setIsMuted(newMuted);
  };

  return (
    <div 
      className="absolute inset-0 flex flex-col items-center justify-center overflow-hidden"
      style={{
        background: 'linear-gradient(180deg, #0a0505 0%, #1a0a0a 50%, #0d0404 100%)',
      }}
    >
      {/* Animated background web pattern */}
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

      {/* Vignette overlay */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 0%, rgba(0,0,0,0.7) 100%)',
        }}
      />

      {/* Audio toggle button */}
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

      {/* Main content container */}
      <div className="relative z-10 flex flex-col items-center gap-8 px-4">
        {/* Title with staggered animation */}
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
            style={{
              color: '#666',
              fontFamily: 'monospace',
            }}
          >
            A tiny bug in a big, scary world
          </p>
        </div>

        {/* Spider illustration */}
        <div 
          className={`transition-all duration-700 delay-300 ${
            isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-75'
          }`}
        >
          <svg width="120" height="100" viewBox="0 0 120 100" className="drop-shadow-2xl">
            {/* Body glow */}
            <defs>
              <radialGradient id="eyeGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#ff0000" stopOpacity="1" />
                <stop offset="100%" stopColor="#ff0000" stopOpacity="0" />
              </radialGradient>
              <filter id="glow">
                <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                <feMerge>
                  <feMergeNode in="coloredBlur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
            </defs>
            
            {/* Legs with subtle animation via CSS */}
            <g className="animate-pulse" style={{ animationDuration: '2s' }}>
              {[0, 1, 2, 3].map(i => (
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
            
            {/* Cephalothorax */}
            <ellipse cx="60" cy="35" rx="20" ry="15" fill="#3d1515" />
            <ellipse cx="60" cy="35" rx="16" ry="11" fill="#4a1a1a" />
            
            {/* Abdomen */}
            <ellipse cx="60" cy="65" rx="25" ry="30" fill="#2d0a0a" />
            <ellipse cx="60" cy="62" rx="18" ry="20" fill="#3d1010" />
            <ellipse cx="60" cy="58" rx="8" ry="10" fill="#4a1515" />
            
            {/* Eyes with glow */}
            <g filter="url(#glow)">
              <circle cx="52" cy="28" r="5" fill="url(#eyeGlow)" />
              <circle cx="68" cy="28" r="5" fill="url(#eyeGlow)" />
              <circle cx="52" cy="28" r="3" fill="#ff0000" />
              <circle cx="68" cy="28" r="3" fill="#ff0000" />
              <circle cx="51" cy="27" r="1" fill="#ffffff" />
              <circle cx="67" cy="27" r="1" fill="#ffffff" />
            </g>
            
            {/* Secondary eyes */}
            <circle cx="45" cy="35" r="2" fill="#cc0000" />
            <circle cx="75" cy="35" r="2" fill="#cc0000" />
            <circle cx="56" cy="32" r="1.5" fill="#990000" />
            <circle cx="64" cy="32" r="1.5" fill="#990000" />
            
            {/* Fangs */}
            <path d="M 55 42 Q 53 50 56 48" fill="#1a0505" stroke="#1a0505" strokeWidth="2" />
            <path d="M 65 42 Q 67 50 64 48" fill="#1a0505" stroke="#1a0505" strokeWidth="2" />
          </svg>
        </div>

        {/* Start button */}
        <button
          onClick={handleStart}
          disabled={isStarting}
          className={`
            relative px-12 py-4 text-2xl font-bold rounded-lg 
            transition-all duration-500 delay-500
            hover:scale-105 hover:shadow-lg hover:shadow-red-900/50
            active:scale-95
            disabled:opacity-50 disabled:cursor-not-allowed
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
          {isStarting ? (
            <span className="animate-pulse">LOADING...</span>
          ) : (
            'START GAME'
          )}
          
          {/* Button glow effect */}
          <div 
            className="absolute inset-0 rounded-lg opacity-0 hover:opacity-100 transition-opacity duration-300"
            style={{
              background: 'radial-gradient(ellipse at center, rgba(200,0,0,0.3) 0%, transparent 70%)',
              pointerEvents: 'none',
            }}
          />
        </button>

        {/* Controls */}
        <div 
          className={`text-center space-y-2 transition-all duration-700 delay-700 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
          style={{
            color: '#555',
            fontFamily: 'monospace',
            fontSize: '14px',
          }}
        >
          <div className="flex gap-8 justify-center text-gray-500">
            <div className="flex items-center gap-2">
              <kbd className="px-2 py-1 bg-gray-800 rounded text-xs border border-gray-700">WASD</kbd>
              <span>Move</span>
            </div>
            <div className="flex items-center gap-2">
              <kbd className="px-2 py-1 bg-gray-800 rounded text-xs border border-gray-700">Mouse</kbd>
              <span>Aim</span>
            </div>
          </div>
          <div className="flex gap-8 justify-center text-gray-500">
            <div className="flex items-center gap-2">
              <kbd className="px-2 py-1 bg-gray-800 rounded text-xs border border-gray-700">Click</kbd>
              <span>Shoot</span>
            </div>
            <div className="flex items-center gap-2">
              <kbd className="px-2 py-1 bg-gray-800 rounded text-xs border border-gray-700">ESC</kbd>
              <span>Pause</span>
            </div>
          </div>
        </div>

        {/* Game jam credits */}
        <p 
          className={`text-xs text-gray-600 mt-4 transition-all duration-700 delay-1000 ${
            isVisible ? 'opacity-100' : 'opacity-0'
          }`}
          style={{ fontFamily: 'monospace' }}
        >
          Theme: Box + Spiders
        </p>
      </div>
    </div>
  );
}
