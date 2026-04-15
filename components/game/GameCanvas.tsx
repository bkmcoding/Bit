'use client';

import { useEffect, useRef, useState, useCallback, type PointerEvent as ReactPointerEvent } from 'react';
import { Game, type DevPanelPayload, type RoomHudPayload } from '@/lib/game/engine/Game';
import { GAME, type GameState, type Difficulty } from '@/lib/game/utils/constants';
import { ROOM_COUNT, type MinimapLayout } from '@/lib/game/rooms/roomData';
import type { Upgrade } from '@/lib/game/upgrades/Upgrade';
import { Vector2 } from '@/lib/game/utils/Vector2';
import { AudioManager } from '@/lib/game/audio/AudioManager';
import { createGameGlPresenter } from '@/lib/game/rendering/webglHorrorPresent';
import { GameUI } from './GameUI';
import { MainMenu } from './MainMenu';
import { PauseMenu } from './PauseMenu';
import { UpgradeModal } from './UpgradeModal';
import { GameOverScreen } from './GameOverScreen';
import { DevToolsPanel } from './DevToolsPanel';
import { ChapterMapScreen } from './ChapterMapScreen';

/** Fade to black before first run; menu audio ducks out before gameplay music fades in. */
const MENU_TO_GAME_COVER_MS = 620;
const MENU_AUDIO_LEAVE_MS = 880;
const GAMEPLAY_MUSIC_FADE_IN_MS = 2000;
const VIEWPORT_MARGIN_PX = 16;
const MOBILE_MARGIN_PX = 8;
const DISPLAY_ASPECT_W_OVER_H = GAME.DISPLAY_WIDTH / GAME.DISPLAY_HEIGHT;
const DISPLAY_ASPECT_H_OVER_W = GAME.DISPLAY_HEIGHT / GAME.DISPLAY_WIDTH;
const STICK_RADIUS_PX = 42;
const STICK_KNOB_MAX = 24;
const STICK_DEADZONE = 0.16;

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
    chapter: 1,
    dash: { unlocked: false, stamina: 0, max: 1 },
  });
  const [upgrades, setUpgrades] = useState<Upgrade[]>([]);
  const [isVictory, setIsVictory] = useState(false);
  /** Fullscreen black cover opacity (0–1) for menu → gameplay. */
  const [menuToGameCover, setMenuToGameCover] = useState(0);
  /** Sector 0 opening cutscene hides the HUD until the story finishes. */
  const [sector0IntroActive, setSector0IntroActive] = useState(false);
  const [isTouchUi, setIsTouchUi] = useState(false);
  const [moveStick, setMoveStick] = useState({ active: false, x: 0, y: 0 });
  const [aimStick, setAimStick] = useState({ active: false, x: 0, y: 0 });
  const movePointerIdRef = useRef<number | null>(null);
  const aimPointerIdRef = useRef<number | null>(null);

  const [devHud, setDevHud] = useState<DevPanelPayload>({
    unlocked: false,
    panelOpen: false,
    godMode: false,
    gameState: 'MENU',
    roomLine: '—',
  });

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
      onDevPanelChange: setDevHud,
      onPresentFrame: presenter ? (src, u) => presenter.present(src, u) : undefined,
      onSector0Intro: setSector0IntroActive,
    });

    game.attach(presenter ? glCanvas : buffer);
    gameRef.current = game;

    /** Dev unlock must run here: the game loop is not active on the main menu before the first run. */
    const onDevChord = (e: KeyboardEvent) => {
      if (!e.ctrlKey || !e.shiftKey || e.altKey || e.metaKey || e.repeat) return;
      if (e.code !== 'F9' && e.code !== 'KeyY') return;
      e.preventDefault();
      e.stopPropagation();
      game.applyDevBackdoorToggle();
    };
    document.addEventListener('keydown', onDevChord, true);

    return () => {
      document.removeEventListener('keydown', onDevChord, true);
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

  const handleMainMenu = useCallback(async () => {
    await AudioManager.returnToMainMenuFromRun();
    gameRef.current?.setState('MENU');
  }, []);

  const handleUpgradeSelect = useCallback((upgrade: Upgrade) => {
    gameRef.current?.applyUpgrade(upgrade);
    setUpgrades([]);
  }, []);

  const handleChapterContinue = useCallback((path: 'adaptation' | 'mutation') => {
    gameRef.current?.continueToChapter2(path);
  }, []);

  useEffect(() => {
    const mq = window.matchMedia('(pointer: coarse), (max-width: 900px)');
    const update = () => setIsTouchUi(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    const game = gameRef.current;
    if (!game) return;
    if (!isTouchUi || gameState !== 'PLAYING') {
      game.input.clearVirtualControls();
      return;
    }
    const mv = moveStick.active ? new Vector2(moveStick.x, moveStick.y) : null;
    const av = aimStick.active ? new Vector2(aimStick.x, aimStick.y) : null;
    game.input.setVirtualMovementDirection(mv);
    game.input.setVirtualAimDirection(av, Boolean(av));
  }, [isTouchUi, moveStick, aimStick, gameState]);

  const resolveStickVector = useCallback((e: ReactPointerEvent): { x: number; y: number } => {
    const rect = e.currentTarget.getBoundingClientRect();
    const cx = rect.left + rect.width * 0.5;
    const cy = rect.top + rect.height * 0.5;
    const dx = (e.clientX - cx) / STICK_RADIUS_PX;
    const dy = (e.clientY - cy) / STICK_RADIUS_PX;
    const mag = Math.hypot(dx, dy);
    if (mag <= STICK_DEADZONE) return { x: 0, y: 0 };
    const clamped = Math.min(1, mag);
    const nx = dx / (mag || 1);
    const ny = dy / (mag || 1);
    return { x: nx * clamped, y: ny * clamped };
  }, []);

  const frameMargin = isTouchUi ? MOBILE_MARGIN_PX : VIEWPORT_MARGIN_PX;

  const onMoveStickDown = useCallback((e: ReactPointerEvent) => {
    movePointerIdRef.current = e.pointerId;
    e.currentTarget.setPointerCapture(e.pointerId);
    const v = resolveStickVector(e);
    setMoveStick({ active: true, x: v.x, y: v.y });
  }, [resolveStickVector]);
  const onMoveStickMove = useCallback((e: ReactPointerEvent) => {
    if (movePointerIdRef.current !== e.pointerId) return;
    const v = resolveStickVector(e);
    setMoveStick({ active: true, x: v.x, y: v.y });
  }, [resolveStickVector]);
  const onMoveStickUp = useCallback((e: ReactPointerEvent) => {
    if (movePointerIdRef.current !== e.pointerId) return;
    movePointerIdRef.current = null;
    setMoveStick({ active: false, x: 0, y: 0 });
  }, []);

  const onAimStickDown = useCallback((e: ReactPointerEvent) => {
    aimPointerIdRef.current = e.pointerId;
    e.currentTarget.setPointerCapture(e.pointerId);
    const v = resolveStickVector(e);
    setAimStick({ active: true, x: v.x, y: v.y });
  }, [resolveStickVector]);
  const onAimStickMove = useCallback((e: ReactPointerEvent) => {
    if (aimPointerIdRef.current !== e.pointerId) return;
    const v = resolveStickVector(e);
    setAimStick({ active: true, x: v.x, y: v.y });
  }, [resolveStickVector]);
  const onAimStickUp = useCallback((e: ReactPointerEvent) => {
    if (aimPointerIdRef.current !== e.pointerId) return;
    aimPointerIdRef.current = null;
    setAimStick({ active: false, x: 0, y: 0 });
  }, []);

  return (
    <div className="relative w-full h-full flex items-center justify-center bg-black">
      <div 
        className="relative"
        style={{ 
          // Deterministic SSR/CSR sizing: no hydration drift and no first-paint pop.
          width: `min(${GAME.DISPLAY_WIDTH}px, calc(100vw - ${frameMargin}px), calc((100vh - ${frameMargin}px) * ${DISPLAY_ASPECT_W_OVER_H}))`,
          height: `min(${GAME.DISPLAY_HEIGHT}px, calc(100vh - ${frameMargin}px), calc((100vw - ${frameMargin}px) * ${DISPLAY_ASPECT_H_OVER_W}))`,
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
          className="pointer-events-none absolute inset-0 z-100 bg-black transition-opacity duration-700 ease-in-out"
          style={{ opacity: menuToGameCover }}
          aria-hidden
        />

        {/* UI Overlay */}
        {gameState === 'PLAYING' && !sector0IntroActive && (
          <GameUI
            health={health.current}
            maxHealth={health.max}
            currentRoom={hud.current}
            totalRooms={hud.total}
            theme={hud.theme}
            minimap={hud.minimap}
            enteredRooms={hud.enteredRooms}
            chapter={hud.chapter}
            dash={hud.dash}
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

        {isTouchUi && gameState === 'PLAYING' && !sector0IntroActive && (
          <>
            <div
              className="absolute left-3 bottom-3 z-90 h-24 w-24 rounded-full border border-white/20 bg-black/30"
              style={{ touchAction: 'none' }}
              onPointerDown={onMoveStickDown}
              onPointerMove={onMoveStickMove}
              onPointerUp={onMoveStickUp}
              onPointerCancel={onMoveStickUp}
            >
              <div
                className="absolute left-1/2 top-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/35 bg-white/20"
                style={{
                  transform: `translate(calc(-50% + ${moveStick.x * STICK_KNOB_MAX}px), calc(-50% + ${moveStick.y * STICK_KNOB_MAX}px))`,
                }}
              />
            </div>
            <div
              className="absolute right-3 bottom-3 z-90 h-24 w-24 rounded-full border border-red-200/25 bg-black/30"
              style={{ touchAction: 'none' }}
              onPointerDown={onAimStickDown}
              onPointerMove={onAimStickMove}
              onPointerUp={onAimStickUp}
              onPointerCancel={onAimStickUp}
            >
              <div
                className="absolute left-1/2 top-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full border border-red-200/35 bg-red-200/20"
                style={{
                  transform: `translate(calc(-50% + ${aimStick.x * STICK_KNOB_MAX}px), calc(-50% + ${aimStick.y * STICK_KNOB_MAX}px))`,
                }}
              />
            </div>
          </>
        )}
      </div>

      {gameState === 'CHAPTER_MAP' && (
        <ChapterMapScreen onContinue={handleChapterContinue} />
      )}

      <DevToolsPanel hud={devHud} />
    </div>
  );
}
