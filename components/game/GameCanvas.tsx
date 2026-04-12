'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Game } from '@/lib/game/engine/Game';
import { GAME, type GameState, type Difficulty } from '@/lib/game/utils/constants';
import { ROOM_CONFIGS } from '@/lib/game/rooms/roomData';
import type { Upgrade } from '@/lib/game/upgrades/Upgrade';
import { AudioManager } from '@/lib/game/audio/AudioManager';
import { createGameGlPresenter } from '@/lib/game/rendering/webglHorrorPresent';
import { GameUI } from './GameUI';
import { MainMenu } from './MainMenu';
import { PauseMenu } from './PauseMenu';
import { UpgradeModal } from './UpgradeModal';
import { GameOverScreen } from './GameOverScreen';

export function GameCanvas() {
  const bufferRef = useRef<HTMLCanvasElement>(null);
  const glRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const [displayMode, setDisplayMode] = useState<'webgl' | 'canvas2d'>('canvas2d');
  
  const [gameState, setGameState] = useState<GameState>('MENU');
  const [health, setHealth] = useState({ current: 3, max: 3 });
  const [roomInfo, setRoomInfo] = useState({ current: 0, total: ROOM_CONFIGS.length });
  const [upgrades, setUpgrades] = useState<Upgrade[]>([]);
  const [isVictory, setIsVictory] = useState(false);

  const gameStateRef = useRef<GameState>('MENU');
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  /** Unmutes policy-muted HTML menu audio and resumes Web Audio; runs once per page load. */
  const audioGestureDoneRef = useRef(false);
  const primeAudioFromGesture = useCallback(() => {
    if (audioGestureDoneRef.current) return;
    audioGestureDoneRef.current = true;
    void (async () => {
      await AudioManager.resume();
      if (gameStateRef.current === 'MENU') {
        await AudioManager.playMusic('MUSIC_MENU');
      }
    })();
  }, []);

  useEffect(() => {
    const opts = { capture: true, passive: true } as const;
    document.addEventListener('pointerdown', primeAudioFromGesture, opts);
    window.addEventListener('keydown', primeAudioFromGesture, opts);
    return () => {
      document.removeEventListener('pointerdown', primeAudioFromGesture, opts);
      window.removeEventListener('keydown', primeAudioFromGesture, opts);
    };
  }, [primeAudioFromGesture]);

  // Native-res 2D buffer + WebGL present (or single 2D canvas if WebGL missing)
  useEffect(() => {
    const buffer = bufferRef.current;
    const glCanvas = glRef.current;
    if (!buffer || !glCanvas) return;

    const ctx = buffer.getContext('2d');
    if (!ctx) return;

    ctx.imageSmoothingEnabled = false;

    const presenter = createGameGlPresenter(glCanvas);
    setDisplayMode(presenter ? 'webgl' : 'canvas2d');

    const game = new Game(ctx, {
      onStateChange: setGameState,
      onHealthChange: (current, max) => setHealth({ current, max }),
      onRoomChange: (current, total) => setRoomInfo({ current, total }),
      onUpgradeSelect: setUpgrades,
      onGameOver: (victory) => setIsVictory(victory),
      onPresentFrame: presenter ? (src, u) => presenter.present(src, u) : undefined,
    });

    game.attach(presenter ? glCanvas : buffer);
    gameRef.current = game;

    return () => {
      presenter?.dispose();
      game.detach();
      gameRef.current = null;
    };
  }, []);

  const handleStart = useCallback(async (selected: Difficulty) => {
    await AudioManager.resume();
    gameRef.current?.start(selected);
  }, []);

  const handleResume = useCallback(() => {
    gameRef.current?.setState('PLAYING');
  }, []);

  const handleRestart = useCallback(() => {
    gameRef.current?.restart();
  }, []);

  const handleMainMenu = useCallback(() => {
    gameRef.current?.setState('MENU');
    void AudioManager.playMusic('MUSIC_MENU');
  }, []);

  const handleUpgradeSelect = useCallback((upgrade: Upgrade) => {
    gameRef.current?.applyUpgrade(upgrade);
    setUpgrades([]);
  }, []);

  return (
    <div className="relative w-full h-full flex items-center justify-center bg-black">
      <div 
        className="relative"
        style={{ 
          width: GAME.DISPLAY_WIDTH, 
          height: GAME.DISPLAY_HEIGHT,
        }}
      >
        <canvas
          ref={bufferRef}
          width={GAME.NATIVE_WIDTH}
          height={GAME.NATIVE_HEIGHT}
          className={
            displayMode === 'webgl'
              ? 'pointer-events-none absolute left-0 top-0 h-px w-px opacity-0'
              : 'h-full w-full'
          }
          style={{
            imageRendering: 'pixelated',
            cursor: displayMode === 'canvas2d' && gameState === 'PLAYING' ? 'crosshair' : 'default',
          }}
          aria-hidden={displayMode === 'webgl'}
        />
        <canvas
          ref={glRef}
          width={GAME.DISPLAY_WIDTH}
          height={GAME.DISPLAY_HEIGHT}
          className={displayMode === 'webgl' ? 'h-full w-full' : 'hidden'}
          style={{
            imageRendering: 'pixelated',
            cursor: displayMode === 'webgl' && gameState === 'PLAYING' ? 'crosshair' : 'default',
          }}
        />

        {/* UI Overlay */}
        {gameState === 'PLAYING' && (
          <GameUI 
            health={health.current}
            maxHealth={health.max}
            currentRoom={roomInfo.current}
            totalRooms={roomInfo.total}
          />
        )}

        {/* Main Menu */}
        {gameState === 'MENU' && <MainMenu onStart={handleStart} />}

        {/* Pause Menu */}
        {gameState === 'PAUSED' && (
          <PauseMenu 
            onResume={handleResume}
            onRestart={handleRestart}
            onMainMenu={handleMainMenu}
          />
        )}

        {/* Upgrade Selection */}
        {gameState === 'UPGRADE' && upgrades.length > 0 && (
          <UpgradeModal 
            upgrades={upgrades}
            onSelect={handleUpgradeSelect}
          />
        )}

        {/* Game Over / Victory */}
        {(gameState === 'GAME_OVER' || gameState === 'VICTORY') && (
          <GameOverScreen 
            isVictory={isVictory}
            onRestart={handleRestart}
            onMainMenu={handleMainMenu}
          />
        )}
      </div>
    </div>
  );
}
