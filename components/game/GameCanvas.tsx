'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Game } from '@/lib/game/engine/Game';
import { GAME, type GameState } from '@/lib/game/utils/constants';
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
  const [roomInfo, setRoomInfo] = useState({ current: 0, total: 7 });
  const [upgrades, setUpgrades] = useState<Upgrade[]>([]);
  const [isVictory, setIsVictory] = useState(false);

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

  const handleStart = useCallback(async () => {
    await AudioManager.resume();
    gameRef.current?.start();
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
        {gameState === 'MENU' && (
          <MainMenu onStart={handleStart} />
        )}

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
