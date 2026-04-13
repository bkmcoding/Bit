'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Game, type RoomHudPayload } from '@/lib/game/engine/Game';
import { GAME, type GameState, type Difficulty } from '@/lib/game/utils/constants';
import { ROOM_COUNT, type MinimapLayout } from '@/lib/game/rooms/roomData';
import type { Upgrade } from '@/lib/game/upgrades/Upgrade';
import { AudioManager } from '@/lib/game/audio/AudioManager';
import { createGameGlPresenter } from '@/lib/game/rendering/webglHorrorPresent';
import { GameUI } from './GameUI';
import { MainMenu } from './MainMenu';
import { PauseMenu } from './PauseMenu';
import { UpgradeModal } from './UpgradeModal';
import { GameOverScreen } from './GameOverScreen';

/** Fade to black before first run; menu audio ducks out before gameplay music fades in. */
const MENU_TO_GAME_COVER_MS = 620;
const MENU_AUDIO_LEAVE_MS = 880;
const GAMEPLAY_MUSIC_FADE_IN_MS = 2000;

const EMPTY_MINIMAP: MinimapLayout = { positions: [], edges: [] };

export function GameCanvas() {
  const bufferRef = useRef<HTMLCanvasElement>(null);
  const glRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const [displayMode, setDisplayMode] = useState<'webgl' | 'canvas2d'>('canvas2d');
  
  const [gameState, setGameState] = useState<GameState>('MENU');
  const [health, setHealth] = useState({ current: 3, max: 3 });
  const [hud, setHud] = useState<RoomHudPayload>({
    current: 0,
    total: ROOM_COUNT,
    theme: 'cellar',
    minimap: EMPTY_MINIMAP,
    enteredRooms: [],
  });
  const [upgrades, setUpgrades] = useState<Upgrade[]>([]);
  const [isVictory, setIsVictory] = useState(false);
  /** Fullscreen black cover opacity (0–1) for menu → gameplay. */
  const [menuToGameCover, setMenuToGameCover] = useState(0);

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
      onRoomChange: setHud,
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
    setMenuToGameCover(1);
    await new Promise<void>((r) => setTimeout(r, MENU_TO_GAME_COVER_MS));
    AudioManager.scheduleGameplayMusicFadeIn(GAMEPLAY_MUSIC_FADE_IN_MS);
    await AudioManager.fadeOutMenuAtmosphereForGameplay(MENU_AUDIO_LEAVE_MS);
    await AudioManager.resume();
    gameRef.current?.start(selected);
    setMenuToGameCover(0);
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
          width={GAME.BUFFER_WIDTH}
          height={GAME.BUFFER_HEIGHT}
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

        <div
          className="pointer-events-none absolute inset-0 z-[100] bg-black transition-opacity duration-[700ms] ease-in-out"
          style={{ opacity: menuToGameCover }}
          aria-hidden
        />

        {/* UI Overlay */}
        {gameState === 'PLAYING' && (
          <GameUI
            health={health.current}
            maxHealth={health.max}
            currentRoom={hud.current}
            totalRooms={hud.total}
            theme={hud.theme}
            minimap={hud.minimap}
            enteredRooms={hud.enteredRooms}
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
