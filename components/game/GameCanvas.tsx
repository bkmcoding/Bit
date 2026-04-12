'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Game } from '@/lib/game/engine/Game';
import { GAME, type GameState, type Difficulty } from '@/lib/game/utils/constants';
import { ROOM_CONFIGS } from '@/lib/game/rooms/roomData';
import type { Upgrade } from '@/lib/game/upgrades/Upgrade';
import { AudioManager } from '@/lib/game/audio/AudioManager';
import { GameUI } from './GameUI';
import { MainMenu } from './MainMenu';
import { PauseMenu } from './PauseMenu';
import { UpgradeModal } from './UpgradeModal';
import { GameOverScreen } from './GameOverScreen';

export function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  
  const [gameState, setGameState] = useState<GameState>('MENU');
  const [health, setHealth] = useState({ current: 3, max: 3 });
  const [roomInfo, setRoomInfo] = useState({ current: 0, total: ROOM_CONFIGS.length });
  const [upgrades, setUpgrades] = useState<Upgrade[]>([]);
  const [isVictory, setIsVictory] = useState(false);

  const gameStateRef = useRef<GameState>('MENU');
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  /** Browsers require a gesture before audio; first pointer or key unlocks + menu track when on the menu. */
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
    window.addEventListener('keydown', primeAudioFromGesture, { passive: true });
    return () => window.removeEventListener('keydown', primeAudioFromGesture);
  }, [primeAudioFromGesture]);

  // Initialize game
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Disable image smoothing for pixel art
    ctx.imageSmoothingEnabled = false;

    const game = new Game(ctx, {
      onStateChange: setGameState,
      onHealthChange: (current, max) => setHealth({ current, max }),
      onRoomChange: (current, total) => setRoomInfo({ current, total }),
      onUpgradeSelect: setUpgrades,
      onGameOver: (victory) => setIsVictory(victory),
    });

    game.attach(canvas);
    gameRef.current = game;

    return () => {
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
    <div
      className="relative w-full h-full flex items-center justify-center bg-black"
      onPointerDownCapture={primeAudioFromGesture}
    >
      <div 
        className="relative"
        style={{ 
          width: GAME.DISPLAY_WIDTH, 
          height: GAME.DISPLAY_HEIGHT,
        }}
      >
        <canvas
          ref={canvasRef}
          width={GAME.NATIVE_WIDTH}
          height={GAME.NATIVE_HEIGHT}
          className="w-full h-full"
          style={{ 
            imageRendering: 'pixelated',
            cursor: gameState === 'PLAYING' ? 'crosshair' : 'default',
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
