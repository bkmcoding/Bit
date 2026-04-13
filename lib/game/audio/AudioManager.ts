/**
 * AudioManager - Modular audio system for Box Crawler
 *
 * To swap audio files:
 * 1. Replace the files in /public/audio/ with your own
 * 2. Or update the AUDIO_PATHS config below to point to different files
 *
 * Atmosphere (white noise, cave loops, skitter): `lib/game/settings/atmosphere-audio.ts`
 *
 * Supported formats: mp3, wav, ogg
 */

import { ATMOSPHERE_AUDIO_SETTINGS } from '../settings/atmosphere-audio';

export type MusicTrack = 'MUSIC_MENU' | 'MUSIC_GAME' | 'MUSIC_BOSS';

/** Paths tried in order: GAME_CONTEXT names first, then public/audio/README.txt names. */
export const MUSIC_SEARCH_PATHS: Record<MusicTrack, readonly string[]> = {
  MUSIC_MENU: ['/audio/music_menu.mp3', '/audio/menu-music.mp3'],
  MUSIC_GAME: ['/audio/music_gameplay.mp3', '/audio/game-music.mp3'],
  MUSIC_BOSS: ['/audio/music_boss.mp3', '/audio/boss-music.mp3'],
};

/**
 * Looping ambience beds during gameplay / boss (optional MP3). Place files under
 * `public/audio/ambience/` — see `public/audio/README.txt`.
 */
export const AMBIENCE_SEARCH_PATHS = {
  whiteNoise: [
    '/audio/ambience/white-noise.mp3',
    '/audio/ambience_white_noise.mp3',
    '/audio/sfx/white-noise.mp3',
  ],
  cave: [
    '/audio/ambience/cave.mp3',
    '/audio/ambience-cave.mp3',
    '/audio/sfx/cave-ambience.mp3',
  ],
} as const;

/** One-shot chitin / leg scuttle near the player (optional MP3). */
export const ENEMY_SKITTER_SEARCH_PATHS: readonly string[] = [
  '/audio/sfx/enemy-skitter.mp3',
  '/audio/sfx/skitter.mp3',
  '/audio/sfx/chitin-scuttle.mp3',
];

// Audio file paths - modify these to use custom audio (music keys mirror first search path)
export const AUDIO_PATHS = {
  MUSIC_MENU: MUSIC_SEARCH_PATHS.MUSIC_MENU[0],
  MUSIC_GAME: MUSIC_SEARCH_PATHS.MUSIC_GAME[0],
  MUSIC_BOSS: MUSIC_SEARCH_PATHS.MUSIC_BOSS[0],

  // Sound effects
  SFX_SHOOT: '/audio/sfx/shoot.mp3',
  SFX_HIT: '/audio/sfx/hit.mp3',
  SFX_ENEMY_HIT: '/audio/sfx/enemy-hit.mp3',
  SFX_ENEMY_DEATH: '/audio/sfx/enemy-death.mp3',
  SFX_PLAYER_HURT: '/audio/sfx/player-hurt.mp3',
  SFX_DOOR_OPEN: '/audio/sfx/door-open.mp3',
  /** Walking through a doorway (optional `door-pass.mp3`; falls back to door-open clip). */
  SFX_DOOR_PASS: '/audio/sfx/door-pass.mp3',
  SFX_UPGRADE: '/audio/sfx/upgrade.mp3',
  SFX_VICTORY: '/audio/sfx/victory.mp3',
  SFX_GAME_OVER: '/audio/sfx/game-over.mp3',
  SFX_DASH: '/audio/sfx/dash.mp3',
  SFX_WEB: '/audio/sfx/web.mp3',
  SFX_BOSS_ROAR: '/audio/sfx/boss-roar.mp3',
  SFX_ENEMY_SKITTER: ENEMY_SKITTER_SEARCH_PATHS[0],
} as const;

export type SoundEffect = Exclude<keyof typeof AUDIO_PATHS, MusicTrack>;

// Volume settings
export interface AudioSettings {
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  muted: boolean;
  /** 0 = off. Loops under gameplay; uses master (not music fader). */
  ambienceWhiteNoiseVolume: number;
  /** 0 = off. Layer with white noise or alone. */
  ambienceCaveVolume: number;
  enemySkitterEnabled: boolean;
  /** Scales skitter one-shots (0–1). */
  enemySkitterVolume: number;
}

const DEFAULT_SETTINGS: AudioSettings = {
  masterVolume: 0.7,
  musicVolume: 0.5,
  sfxVolume: 0.8,
  muted: false,
  ambienceWhiteNoiseVolume: ATMOSPHERE_AUDIO_SETTINGS.whiteNoiseVolume,
  ambienceCaveVolume: ATMOSPHERE_AUDIO_SETTINGS.caveVolume,
  enemySkitterEnabled: ATMOSPHERE_AUDIO_SETTINGS.enemySkitterEnabled,
  enemySkitterVolume: ATMOSPHERE_AUDIO_SETTINGS.enemySkitterVolume,
};

/** Only these are read/written to localStorage (atmosphere comes from source file). */
const PERSISTED_AUDIO_KEYS = ['masterVolume', 'musicVolume', 'sfxVolume', 'muted'] as const;
type PersistedAudioKey = (typeof PERSISTED_AUDIO_KEYS)[number];

type AmbienceLayer = { source: AudioBufferSourceNode; gain: GainNode };

class AudioManagerClass {
  private audioContext: AudioContext | null = null;
  private sounds: Map<string, AudioBuffer> = new Map();
  private currentMusic: AudioBufferSourceNode | null = null;
  private currentMusicGain: GainNode | null = null;
  private currentMusicTrack: MusicTrack | null = null;
  /** Low horror drone under gameplay / boss music (synthesized). */
  private horrorGain: GainNode | null = null;
  private horrorOscillators: OscillatorNode[] = [];
  private ambienceWhite: AmbienceLayer | null = null;
  private ambienceCave: AmbienceLayer | null = null;
  /** Low rumble when no `cave` MP3 is present (distinct from white noise). */
  private ambienceCaveOsc: { gain: GainNode; oscillators: OscillatorNode[] } | null = null;
  private skitterCooldownUntil: number = 0;
  /** Serializes track switches so concurrent playMusic (e.g. menu unlock + start game) cannot overlap. */
  private musicSwitchQueue: Promise<void> = Promise.resolve();
  private settings: AudioSettings = { ...DEFAULT_SETTINGS };
  private isInitialized: boolean = false;
  private loadedPaths: Set<string> = new Set();
  
  // Fallback oscillator-based sounds when audio files aren't available
  private useFallback: boolean = true;

  /**
   * Menu music uses an HTMLMediaElement: browsers allow muted autoplay, and unmuted autoplay
   * often succeeds when the user navigated here with a tap/click (transient activation).
   * Web Audio stays suspended longer under the same policy, so gameplay/SFX still use the graph.
   */
  private menuHtmlAudio: HTMLAudioElement | null = null;
  private menuHtmlActive = false;
  /** Menu track is playing but only at full level after `resume()` clears policy-driven `muted`. */
  private menuHtmlPolicyMute = false;
  /** Next `MUSIC_MENU` start uses zero gain/volume until `crossfadeMenuStaticToMusic` (or manual update). */
  private pendingMenuMusicSilentStart = false;
  private menuHtmlVolumeRampRaf: number | null = null;
  /** Looped TV static under the main-menu boot veil (Web Audio noise). */
  private menuTvStaticSource: AudioBufferSourceNode | null = null;
  private menuTvStaticGain: GainNode | null = null;
  private menuTvStaticStopTimer: ReturnType<typeof setTimeout> | null = null;
  /** Quiet AC / flyback-style buzz under menu (stays with music until gameplay). */
  private menuTvBuzz: { gain: GainNode; oscillators: OscillatorNode[] } | null = null;
  /** Next MUSIC_GAME / MUSIC_BOSS Web Audio gain ramps from 0 (after leaving main menu). */
  private pendingGameplayMusicFadeInMs: number | null = null;

  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    try {
      this.audioContext = new AudioContext();
      this.isInitialized = true;
      
      // Load settings from localStorage
      this.loadSettings();
      
      // Try to preload audio files
      await this.preloadSounds();
    } catch (error) {
      console.warn('[AudioManager] Web Audio API not supported, using fallback');
      this.useFallback = true;
    }
  }

  private loadSettings(): void {
    this.settings = { ...DEFAULT_SETTINGS };
    try {
      const saved = localStorage.getItem('boxcrawler_audio_settings');
      if (saved) {
        const parsed = JSON.parse(saved) as Record<string, unknown>;
        for (const key of PERSISTED_AUDIO_KEYS) {
          const v = parsed[key];
          if (typeof v === typeof this.settings[key]) {
            (this.settings as unknown as Record<PersistedAudioKey, number | boolean>)[key] =
              v as never;
          }
        }
      }
    } catch {
      // Keep defaults
    }
    this.applyAtmosphereFromSettingsFile();
  }

  /** Always mirrors `atmosphere-audio.ts` (not persisted). */
  private applyAtmosphereFromSettingsFile(): void {
    const a = ATMOSPHERE_AUDIO_SETTINGS;
    this.settings.ambienceWhiteNoiseVolume = Math.max(0, Math.min(1, a.whiteNoiseVolume));
    this.settings.ambienceCaveVolume = Math.max(0, Math.min(1, a.caveVolume));
    this.settings.enemySkitterEnabled = a.enemySkitterEnabled;
    this.settings.enemySkitterVolume = Math.max(0, Math.min(1, a.enemySkitterVolume));
  }

  saveSettings(): void {
    try {
      const payload: Pick<AudioSettings, PersistedAudioKey> = {
        masterVolume: this.settings.masterVolume,
        musicVolume: this.settings.musicVolume,
        sfxVolume: this.settings.sfxVolume,
        muted: this.settings.muted,
      };
      localStorage.setItem('boxcrawler_audio_settings', JSON.stringify(payload));
    } catch {
      // Ignore
    }
  }

  private async preloadSounds(): Promise<void> {
    if (!this.audioContext) return;
    
    // Try to load key sound effects
    const keySounds = [
      AUDIO_PATHS.SFX_SHOOT,
      AUDIO_PATHS.SFX_HIT,
      AUDIO_PATHS.SFX_ENEMY_DEATH,
      AUDIO_PATHS.SFX_PLAYER_HURT,
      AUDIO_PATHS.SFX_DOOR_OPEN,
      AUDIO_PATHS.SFX_DOOR_PASS,
      AUDIO_PATHS.SFX_UPGRADE,
      ...AMBIENCE_SEARCH_PATHS.whiteNoise,
      ...AMBIENCE_SEARCH_PATHS.cave,
      ...ENEMY_SKITTER_SEARCH_PATHS,
    ];
    
    for (const path of keySounds) {
      try {
        await this.loadSound(path);
      } catch {
        // File doesn't exist, will use fallback
      }
    }
  }

  private async loadSound(path: string): Promise<AudioBuffer | null> {
    if (!this.audioContext || this.loadedPaths.has(path)) {
      return this.sounds.get(path) || null;
    }
    
    try {
      const response = await fetch(path);
      if (!response.ok) throw new Error('Not found');
      
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
      this.sounds.set(path, audioBuffer);
      this.loadedPaths.add(path);
      this.useFallback = false;
      return audioBuffer;
    } catch {
      return null;
    }
  }

  /** Web Audio may be suspended after long async gaps; resume before output. */
  private ensureAudioContextRunning(): void {
    if (!this.audioContext || this.audioContext.state === 'closed') return;
    if (this.audioContext.state !== 'running') {
      void this.audioContext.resume().catch(() => undefined);
    }
  }

  // Play a sound effect
  play(effect: SoundEffect, volume: number = 1): void {
    if (this.settings.muted || !this.isInitialized) return;
    this.ensureAudioContextRunning();

    const path = AUDIO_PATHS[effect];
    let buffer = this.sounds.get(path);
    if (!buffer && effect === 'SFX_DOOR_PASS') {
      buffer = this.sounds.get(AUDIO_PATHS.SFX_DOOR_OPEN);
    }

    if (buffer && this.audioContext) {
      this.playBuffer(buffer, volume * this.settings.sfxVolume * this.settings.masterVolume);
    } else {
      // Use oscillator fallback
      this.playFallbackSound(effect, volume);
    }
  }

  private playBuffer(buffer: AudioBuffer, volume: number): void {
    if (!this.audioContext) return;
    
    const source = this.audioContext.createBufferSource();
    const gainNode = this.audioContext.createGain();
    
    source.buffer = buffer;
    gainNode.gain.value = volume;
    
    source.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    source.start(0);
  }

  // Fallback synthesized sounds
  private playFallbackSound(effect: SoundEffect, volume: number): void {
    if (!this.audioContext || this.settings.muted) return;
    
    const ctx = this.audioContext;
    const now = ctx.currentTime;
    const vol = volume * this.settings.sfxVolume * this.settings.masterVolume * 0.3;
    
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    switch (effect) {
      case 'SFX_SHOOT':
        oscillator.type = 'square';
        oscillator.frequency.setValueAtTime(800, now);
        oscillator.frequency.exponentialRampToValueAtTime(200, now + 0.1);
        gainNode.gain.setValueAtTime(vol, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        oscillator.start(now);
        oscillator.stop(now + 0.1);
        break;
        
      case 'SFX_HIT':
      case 'SFX_ENEMY_HIT':
        oscillator.type = 'sawtooth';
        oscillator.frequency.setValueAtTime(200, now);
        oscillator.frequency.exponentialRampToValueAtTime(50, now + 0.15);
        gainNode.gain.setValueAtTime(vol, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
        oscillator.start(now);
        oscillator.stop(now + 0.15);
        break;
        
      case 'SFX_ENEMY_DEATH':
        oscillator.type = 'sawtooth';
        oscillator.frequency.setValueAtTime(400, now);
        oscillator.frequency.exponentialRampToValueAtTime(30, now + 0.3);
        gainNode.gain.setValueAtTime(vol * 1.5, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
        oscillator.start(now);
        oscillator.stop(now + 0.3);
        break;
        
      case 'SFX_PLAYER_HURT':
        oscillator.type = 'square';
        oscillator.frequency.setValueAtTime(150, now);
        oscillator.frequency.setValueAtTime(100, now + 0.1);
        oscillator.frequency.setValueAtTime(150, now + 0.2);
        gainNode.gain.setValueAtTime(vol, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
        oscillator.start(now);
        oscillator.stop(now + 0.3);
        break;
        
      case 'SFX_DOOR_OPEN':
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(300, now);
        oscillator.frequency.exponentialRampToValueAtTime(600, now + 0.2);
        gainNode.gain.setValueAtTime(vol * 0.5, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
        oscillator.start(now);
        oscillator.stop(now + 0.2);
        break;

      case 'SFX_DOOR_PASS':
        oscillator.type = 'triangle';
        oscillator.frequency.setValueAtTime(155, now);
        oscillator.frequency.exponentialRampToValueAtTime(48, now + 0.12);
        gainNode.gain.setValueAtTime(vol * 0.75, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.16);
        oscillator.start(now);
        oscillator.stop(now + 0.16);
        break;
        
      case 'SFX_UPGRADE':
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(400, now);
        oscillator.frequency.setValueAtTime(500, now + 0.1);
        oscillator.frequency.setValueAtTime(600, now + 0.2);
        oscillator.frequency.setValueAtTime(800, now + 0.3);
        gainNode.gain.setValueAtTime(vol, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
        oscillator.start(now);
        oscillator.stop(now + 0.4);
        break;
        
      case 'SFX_VICTORY':
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(523, now); // C5
        oscillator.frequency.setValueAtTime(659, now + 0.15); // E5
        oscillator.frequency.setValueAtTime(784, now + 0.3); // G5
        oscillator.frequency.setValueAtTime(1047, now + 0.45); // C6
        gainNode.gain.setValueAtTime(vol, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.6);
        oscillator.start(now);
        oscillator.stop(now + 0.6);
        break;
        
      case 'SFX_GAME_OVER':
        oscillator.type = 'sawtooth';
        oscillator.frequency.setValueAtTime(200, now);
        oscillator.frequency.exponentialRampToValueAtTime(50, now + 0.5);
        gainNode.gain.setValueAtTime(vol, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
        oscillator.start(now);
        oscillator.stop(now + 0.5);
        break;
        
      case 'SFX_DASH':
        oscillator.type = 'sawtooth';
        oscillator.frequency.setValueAtTime(100, now);
        oscillator.frequency.exponentialRampToValueAtTime(300, now + 0.1);
        gainNode.gain.setValueAtTime(vol, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
        oscillator.start(now);
        oscillator.stop(now + 0.15);
        break;
        
      case 'SFX_WEB':
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(100, now);
        gainNode.gain.setValueAtTime(vol * 0.3, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
        oscillator.start(now);
        oscillator.stop(now + 0.2);
        break;
        
      case 'SFX_BOSS_ROAR':
        oscillator.type = 'sawtooth';
        oscillator.frequency.setValueAtTime(80, now);
        oscillator.frequency.setValueAtTime(60, now + 0.2);
        oscillator.frequency.setValueAtTime(100, now + 0.4);
        oscillator.frequency.setValueAtTime(40, now + 0.6);
        gainNode.gain.setValueAtTime(vol * 2, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.8);
        oscillator.start(now);
        oscillator.stop(now + 0.8);
        break;

      case 'SFX_ENEMY_SKITTER':
        oscillator.type = 'square';
        oscillator.frequency.setValueAtTime(420 + Math.random() * 180, now);
        oscillator.frequency.exponentialRampToValueAtTime(90, now + 0.07);
        gainNode.gain.setValueAtTime(vol * 0.55, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.09);
        oscillator.start(now);
        oscillator.stop(now + 0.09);
        break;
        
      default:
        // Generic beep
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(440, now);
        gainNode.gain.setValueAtTime(vol, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        oscillator.start(now);
        oscillator.stop(now + 0.1);
    }
  }

  /**
   * Same track already running — keep buffers/horror/ambience going (e.g. every room load).
   */
  private shouldKeepCurrentMusicTrack(track: MusicTrack): boolean {
    if (this.currentMusicTrack !== track) return false;
    /** Avoid “horror-only” stub: missing buffer + horror used to skip rebuilding the loop. */
    if (
      (track === 'MUSIC_GAME' || track === 'MUSIC_BOSS') &&
      this.currentMusic === null
    ) {
      return false;
    }
    if (track === 'MUSIC_MENU' && this.menuHtmlActive) return true;
    if (this.currentMusic !== null) return true;
    if (
      (track === 'MUSIC_GAME' || track === 'MUSIC_BOSS') &&
      this.horrorOscillators.length > 0
    ) {
      return true;
    }
    return false;
  }

  private ensureMenuHtmlAudio(): HTMLAudioElement | null {
    if (typeof window === 'undefined' || typeof document === 'undefined') return null;
    if (!this.menuHtmlAudio) {
      const el = document.createElement('audio');
      el.preload = 'auto';
      el.setAttribute('playsInline', '');
      el.style.display = 'none';
      document.body.appendChild(el);
      this.menuHtmlAudio = el;
    }
    return this.menuHtmlAudio;
  }

  private cancelMenuHtmlVolumeRamp(): void {
    if (this.menuHtmlVolumeRampRaf !== null) {
      cancelAnimationFrame(this.menuHtmlVolumeRampRaf);
      this.menuHtmlVolumeRampRaf = null;
    }
  }

  private stopMenuHtmlAudio(): void {
    this.cancelMenuHtmlVolumeRamp();
    if (!this.menuHtmlAudio) return;
    try {
      this.menuHtmlAudio.pause();
    } catch {
      // ignore
    }
    this.menuHtmlAudio.removeAttribute('src');
    try {
      this.menuHtmlAudio.load();
    } catch {
      // ignore
    }
    this.menuHtmlActive = false;
    this.menuHtmlPolicyMute = false;
  }

  private stopMenuTvStatic(): void {
    if (this.menuTvStaticStopTimer !== null) {
      clearTimeout(this.menuTvStaticStopTimer);
      this.menuTvStaticStopTimer = null;
    }
    if (this.menuTvStaticSource) {
      try {
        this.menuTvStaticSource.stop();
      } catch {
        // ignore
      }
      try {
        this.menuTvStaticSource.disconnect();
      } catch {
        // ignore
      }
      this.menuTvStaticSource = null;
    }
    if (this.menuTvStaticGain) {
      try {
        this.menuTvStaticGain.disconnect();
      } catch {
        // ignore
      }
      this.menuTvStaticGain = null;
    }
  }

  private createTvStaticNoiseBuffer(durationSec: number): AudioBuffer {
    const ctx = this.audioContext!;
    const sampleRate = ctx.sampleRate;
    const n = Math.max(1, Math.floor(sampleRate * durationSec));
    const buffer = ctx.createBuffer(1, n, sampleRate);
    const d = buffer.getChannelData(0);
    for (let i = 0; i < n; i++) {
      d[i] = (Math.random() * 2 - 1) * 0.9;
    }
    return buffer;
  }

  /**
   * Looped TV static (quiet); gain ramps from 0 → target over `fadeInMs`.
   * Runs until `crossfadeMenuStaticToMusic` stops it.
   */
  startMenuTvStaticLoop(fadeInMs: number = 900): void {
    this.stopMenuTvStatic();
    if (!this.audioContext || !this.isInitialized || this.settings.muted) return;

    const buf = this.createTvStaticNoiseBuffer(1.25);
    const src = this.audioContext.createBufferSource();
    const g = this.audioContext.createGain();
    src.buffer = buf;
    src.loop = true;
    const targetVol = 0.035 * this.settings.masterVolume;
    const t = this.audioContext.currentTime;
    const fadeSec = Math.max(0.05, fadeInMs / 1000);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(targetVol, t + fadeSec);
    src.connect(g);
    g.connect(this.audioContext.destination);
    src.start(0);
    this.menuTvStaticSource = src;
    this.menuTvStaticGain = g;
    this.startMenuTvBuzz();
  }

  private stopMenuTvBuzz(): void {
    if (!this.menuTvBuzz) return;
    for (const o of this.menuTvBuzz.oscillators) {
      try {
        o.stop();
      } catch {
        // ignore
      }
      try {
        o.disconnect();
      } catch {
        // ignore
      }
    }
    try {
      this.menuTvBuzz.gain.disconnect();
    } catch {
      // ignore
    }
    this.menuTvBuzz = null;
  }

  /**
   * Low CRT-style hum/buzz (60 Hz family + harmonics). Idempotent if already running.
   * Stops when leaving the menu (gameplay music) or on full `stopMusic`.
   */
  startMenuTvBuzz(): void {
    if (!this.audioContext || !this.isInitialized) return;
    if (this.settings.muted) return;
    if (this.menuTvBuzz) return;

    const ctx = this.audioContext;
    const g = ctx.createGain();
    this.updateMenuTvBuzzGainNode(g);

    const freqs = [120, 60, 180];
    const types: OscillatorType[] = ['triangle', 'sine', 'triangle'];
    const oscillators: OscillatorNode[] = [];
    for (let i = 0; i < freqs.length; i++) {
      const o = ctx.createOscillator();
      o.type = types[i];
      o.frequency.value = freqs[i];
      o.detune.value = (i - 1) * 1.2;
      o.connect(g);
      oscillators.push(o);
    }
    g.connect(ctx.destination);
    for (const o of oscillators) {
      o.start(0);
    }
    this.menuTvBuzz = { gain: g, oscillators };
  }

  private updateMenuTvBuzzGainNode(gainNode: GainNode): void {
    if (!this.audioContext) return;
    const v = this.settings.muted ? 0 : 0.012 * this.settings.masterVolume;
    gainNode.gain.setValueAtTime(v, this.audioContext.currentTime);
  }

  private refreshMenuTvBuzzVolume(): void {
    if (!this.menuTvBuzz?.gain || !this.audioContext) return;
    const v = this.settings.muted ? 0 : 0.012 * this.settings.masterVolume;
    this.menuTvBuzz.gain.gain.setValueAtTime(v, this.audioContext.currentTime);
  }

  /** Next menu music playback starts at zero volume/gain for a crossfade from TV static. */
  beginMenuMusicSilentStart(): void {
    this.pendingMenuMusicSilentStart = true;
  }

  /**
   * Smooth crossfade: static eases out on a cosine quarter; menu music eases in on a sine quarter
   * after `musicDelayMs` so it overlaps the tail of the static fade (less harsh than linear + simultaneous).
   */
  crossfadeMenuStaticToMusic(options: {
    staticFadeOutMs: number;
    musicFadeInMs: number;
    /** When menu music begins its fade (after static has started ducking). */
    musicDelayMs?: number;
  }): void {
    const { staticFadeOutMs, musicFadeInMs, musicDelayMs = 0 } = options;
    const staticSec = Math.max(0.08, staticFadeOutMs / 1000);
    const musicSec = Math.max(0.08, musicFadeInMs / 1000);
    const delaySec = Math.max(0, musicDelayMs / 1000);
    const ctx = this.audioContext;

    const curvePoints = 192;
    const cosQuarterCurve = (from: number): Float32Array => {
      const c = new Float32Array(curvePoints);
      for (let i = 0; i < curvePoints; i++) {
        const p = i / (curvePoints - 1);
        c[i] = Math.max(1e-4, from * Math.cos(p * Math.PI * 0.5));
      }
      return c;
    };
    const sinQuarterCurve = (to: number): Float32Array => {
      const c = new Float32Array(curvePoints);
      for (let i = 0; i < curvePoints; i++) {
        const p = i / (curvePoints - 1);
        c[i] = to * Math.sin(p * Math.PI * 0.5);
      }
      return c;
    };

    if (ctx && this.menuTvStaticGain) {
      const g = this.menuTvStaticGain.gain;
      const t = ctx.currentTime;
      const now = Math.max(1e-4, g.value);
      g.cancelScheduledValues(t);
      g.setValueAtTime(now, t);
      try {
        g.setValueCurveAtTime(cosQuarterCurve(now), t, staticSec);
      } catch {
        g.exponentialRampToValueAtTime(0.0001, t + staticSec);
      }
    }

    const target = this.settings.muted ? 0 : this.settings.musicVolume * this.settings.masterVolume;

    if (this.menuHtmlActive && this.menuHtmlAudio) {
      this.cancelMenuHtmlVolumeRamp();
      const t0 = performance.now();
      const step = (frameNow: number) => {
        if (!this.menuHtmlAudio || !this.menuHtmlActive) {
          this.menuHtmlVolumeRampRaf = null;
          return;
        }
        const elapsed = frameNow - t0;
        let vol = 0;
        if (elapsed >= musicDelayMs) {
          const u = Math.min(1, (elapsed - musicDelayMs) / musicFadeInMs);
          vol = target * Math.sin(u * Math.PI * 0.5);
        }
        this.menuHtmlAudio.volume = vol;
        const totalEnd = musicDelayMs + musicFadeInMs;
        if (elapsed < totalEnd) {
          this.menuHtmlVolumeRampRaf = requestAnimationFrame(step);
        } else {
          this.menuHtmlVolumeRampRaf = null;
          this.menuHtmlAudio.volume = target;
        }
      };
      this.menuHtmlVolumeRampRaf = requestAnimationFrame(step);
    }

    if (this.currentMusicGain && ctx && this.currentMusicTrack === 'MUSIC_MENU') {
      const g = this.currentMusicGain.gain;
      const t = ctx.currentTime;
      g.cancelScheduledValues(t);
      g.setValueAtTime(0, t);
      const tMusic = t + delaySec;
      g.setValueAtTime(0, tMusic);
      try {
        g.setValueCurveAtTime(sinQuarterCurve(target), tMusic, musicSec);
      } catch {
        g.linearRampToValueAtTime(target, tMusic + musicSec);
      }
    }

    const stopAfter = Math.max(staticFadeOutMs, musicDelayMs + musicFadeInMs) + 200;
    if (this.menuTvStaticStopTimer !== null) {
      clearTimeout(this.menuTvStaticStopTimer);
    }
    this.menuTvStaticStopTimer = setTimeout(() => {
      this.menuTvStaticStopTimer = null;
      this.stopMenuTvStatic();
    }, stopAfter);
  }

  private applyMenuHtmlVolume(): void {
    if (!this.menuHtmlAudio || !this.menuHtmlActive || this.menuHtmlVolumeRampRaf !== null) return;
    const v = this.settings.muted ? 0 : this.settings.musicVolume * this.settings.masterVolume;
    this.menuHtmlAudio.volume = v;
  }

  /** Try each public path; unmuted play first, then muted autoplay (browser policy). */
  private async tryStartMenuMusicHtml(): Promise<boolean> {
    const el = this.ensureMenuHtmlAudio();
    if (!el) return false;

    for (const path of MUSIC_SEARCH_PATHS.MUSIC_MENU) {
      el.loop = true;
      el.src = path;
      const targetVol = this.settings.muted ? 0 : this.settings.musicVolume * this.settings.masterVolume;
      const silentStart = this.pendingMenuMusicSilentStart;
      el.volume = silentStart ? 0 : targetVol;
      el.muted = false;
      try {
        await el.play();
        this.menuHtmlActive = true;
        this.menuHtmlPolicyMute = false;
        if (silentStart) this.pendingMenuMusicSilentStart = false;
        return true;
      } catch {
        el.muted = true;
        try {
          await el.play();
          this.menuHtmlActive = true;
          this.menuHtmlPolicyMute = true;
          if (silentStart) this.pendingMenuMusicSilentStart = false;
          return true;
        } catch {
          // try next path
        }
      }
    }
    return false;
  }

  /** Call before `Game.start()` so the first gameplay/boss track fades in instead of stepping. */
  scheduleGameplayMusicFadeIn(ms: number): void {
    this.pendingGameplayMusicFadeInMs = Math.max(0, ms);
  }

  /**
   * Fade out menu HTML music, TV buzz, and Web Audio menu buffer; clears menu track state.
   * Call before starting a run so `playMusic(MUSIC_GAME)` does not cut menu audio abruptly.
   */
  async fadeOutMenuAtmosphereForGameplay(durationMs: number): Promise<void> {
    const ms = Math.max(280, durationMs);
    this.cancelMenuHtmlVolumeRamp();

    const ctx = this.audioContext;
    if (ctx) {
      const t0 = ctx.currentTime;
      const durSec = ms / 1000;
      if (this.menuTvBuzz?.gain) {
        const g = this.menuTvBuzz.gain.gain;
        const v = Math.max(1e-4, g.value);
        g.cancelScheduledValues(t0);
        g.setValueAtTime(v, t0);
        g.exponentialRampToValueAtTime(0.0001, t0 + durSec);
      }
      if (this.menuTvStaticGain) {
        const g = this.menuTvStaticGain.gain;
        const v = Math.max(1e-4, g.value);
        g.cancelScheduledValues(t0);
        g.setValueAtTime(v, t0);
        g.exponentialRampToValueAtTime(0.0001, t0 + durSec);
      }
      if (this.currentMusicGain && this.currentMusicTrack === 'MUSIC_MENU') {
        const g = this.currentMusicGain.gain;
        const v = Math.max(1e-4, g.value);
        g.cancelScheduledValues(t0);
        g.setValueAtTime(v, t0);
        g.exponentialRampToValueAtTime(0.0001, t0 + durSec);
      }
    }

    const htmlEl = this.menuHtmlAudio;
    const htmlStart = htmlEl && this.menuHtmlActive ? htmlEl.volume : 0;
    const tStart = performance.now();
    await new Promise<void>((resolve) => {
      const step = () => {
        const elapsed = performance.now() - tStart;
        const u = Math.min(1, elapsed / ms);
        if (htmlEl && this.menuHtmlActive) {
          htmlEl.volume = htmlStart * (1 - u);
        }
        if (u < 1) {
          requestAnimationFrame(step);
        } else {
          resolve();
        }
      };
      requestAnimationFrame(step);
    });

    await new Promise<void>((r) => setTimeout(r, 40));

    this.stopMenuHtmlAudio();
    this.stopMenuTvBuzz();
    this.stopMenuTvStatic();
    if (this.currentMusicTrack === 'MUSIC_MENU' && this.currentMusic) {
      try {
        this.currentMusic.stop();
      } catch {
        // ignore
      }
      try {
        this.currentMusic.disconnect();
      } catch {
        // ignore
      }
      this.currentMusic = null;
    }
    if (this.currentMusicGain && this.currentMusicTrack === 'MUSIC_MENU') {
      try {
        this.currentMusicGain.disconnect();
      } catch {
        // ignore
      }
      this.currentMusicGain = null;
    }
    if (this.currentMusicTrack === 'MUSIC_MENU') {
      this.currentMusicTrack = null;
    }
  }

  // Music control
  async playMusic(track: MusicTrack): Promise<void> {
    const scheduled = this.musicSwitchQueue.then(() => this.runPlayMusic(track));
    this.musicSwitchQueue = scheduled.catch(() => {
      // Keep the queue alive if one switch throws
    });
    return scheduled;
  }

  private async runPlayMusic(track: MusicTrack): Promise<void> {
    if (!this.isInitialized) return;
    if (this.audioContext && this.audioContext.state !== 'closed') {
      try {
        await this.audioContext.resume();
      } catch {
        // ignore
      }
    }

    if (this.shouldKeepCurrentMusicTrack(track)) {
      this.updateMusicVolume();
      return;
    }

    const preserveTvStaticForCrossfade =
      track === 'MUSIC_MENU' && this.pendingMenuMusicSilentStart;
    this.hardStopMusicAndBeds(
      preserveTvStaticForCrossfade ? { preserveTvStatic: true } : undefined
    );
    this.currentMusicTrack = track;

    if (track === 'MUSIC_MENU' && typeof window !== 'undefined') {
      const htmlOk = await this.tryStartMenuMusicHtml();
      if (htmlOk) {
        this.syncHorrorWithTrack(track);
        await this.refreshAmbienceLoops(track);
        if (!preserveTvStaticForCrossfade) {
          this.startMenuTvBuzz();
        }
        return;
      }
    }

    if (!this.audioContext) return;

    let buffer: AudioBuffer | null = null;
    for (const path of MUSIC_SEARCH_PATHS[track]) {
      const cached = this.sounds.get(path);
      if (cached) {
        buffer = cached;
        break;
      }
      buffer = await this.loadSound(path);
      if (buffer) break;
    }

    if (!buffer) {
      this.syncHorrorWithTrack(track);
      await this.refreshAmbienceLoops(track);
      return;
    }

    this.currentMusic = this.audioContext.createBufferSource();
    this.currentMusicGain = this.audioContext.createGain();

    this.currentMusic.buffer = buffer;
    this.currentMusic.loop = true;

    const volume = this.settings.muted ? 0 :
      this.settings.musicVolume * this.settings.masterVolume;
    const silentStart = this.pendingMenuMusicSilentStart;
    const gameplayFadeIn = this.pendingGameplayMusicFadeInMs;
    if (gameplayFadeIn != null) {
      this.pendingGameplayMusicFadeInMs = null;
    }
    if (silentStart) this.pendingMenuMusicSilentStart = false;

    this.currentMusic.connect(this.currentMusicGain);
    this.currentMusicGain.connect(this.audioContext.destination);

    const t = this.audioContext.currentTime;
    const useGameplayFade =
      !silentStart &&
      gameplayFadeIn != null &&
      gameplayFadeIn > 0 &&
      volume > 0 &&
      (track === 'MUSIC_GAME' || track === 'MUSIC_BOSS');
    if (useGameplayFade) {
      this.currentMusicGain.gain.setValueAtTime(0, t);
      this.currentMusicGain.gain.linearRampToValueAtTime(
        volume,
        t + gameplayFadeIn / 1000
      );
    } else {
      this.currentMusicGain.gain.value = silentStart ? 0 : volume;
    }

    this.currentMusic.start(0);
    this.syncHorrorWithTrack(track);
    await this.refreshAmbienceLoops(track);
    if (track === 'MUSIC_MENU' && !preserveTvStaticForCrossfade) {
      this.startMenuTvBuzz();
    }
  }

  /**
   * Stops the looping music buffer and tears down horror + ambience beds.
   * Used when switching tracks so nothing from the previous mode keeps playing.
   * `preserveTvStatic`: keep TV static running (menu boot crossfade into MUSIC_MENU).
   */
  hardStopMusicAndBeds(opts?: { preserveTvStatic?: boolean }): void {
    if (!opts?.preserveTvStatic) {
      this.stopMenuTvStatic();
      this.stopMenuTvBuzz();
    }
    this.stopMenuHtmlAudio();
    if (this.currentMusic) {
      try {
        this.currentMusic.stop();
      } catch {
        // Already stopped
      }
      try {
        this.currentMusic.disconnect();
      } catch {
        // ignore
      }
      this.currentMusic = null;
    }
    if (this.currentMusicGain) {
      try {
        this.currentMusicGain.disconnect();
      } catch {
        // ignore
      }
      this.currentMusicGain = null;
    }
    this.stopAmbienceLoops();
    this.stopHorrorAmbience();
  }

  stopMusic(): void {
    this.hardStopMusicAndBeds();
  }

  private stopHorrorAmbience(): void {
    for (const o of this.horrorOscillators) {
      try {
        o.stop();
      } catch {
        // ignore
      }
    }
    this.horrorOscillators = [];
    this.horrorGain = null;
  }

  /** Ominous undertone during runs; menu stops it. */
  private startHorrorAmbience(boss: boolean): void {
    this.stopHorrorAmbience();
    if (!this.audioContext || !this.isInitialized) return;

    const ctx = this.audioContext;
    const g = ctx.createGain();
    const base = boss ? 38 : 52;
    const o1 = ctx.createOscillator();
    o1.type = 'sawtooth';
    o1.frequency.value = base;
    const o2 = ctx.createOscillator();
    o2.type = 'sine';
    o2.frequency.value = boss ? 52 : 71;
    const o3 = ctx.createOscillator();
    o3.type = 'triangle';
    o3.frequency.value = boss ? 28 : 34;

    o1.connect(g);
    o2.connect(g);
    o3.connect(g);
    g.connect(ctx.destination);

    this.horrorGain = g;
    this.horrorOscillators = [o1, o2, o3];
    o1.start();
    o2.start();
    o3.start();
    this.updateHorrorVolume();
  }

  private updateHorrorVolume(): void {
    if (!this.horrorGain || !this.audioContext) return;
    const v =
      this.settings.muted || !this.horrorOscillators.length
        ? 0
        : 0.022 * this.settings.masterVolume * this.settings.musicVolume;
    this.horrorGain.gain.setValueAtTime(v, this.audioContext.currentTime);
  }

  private syncHorrorWithTrack(track: MusicTrack): void {
    if (track === 'MUSIC_MENU') {
      this.stopHorrorAmbience();
    } else if (track === 'MUSIC_GAME') {
      this.startHorrorAmbience(false);
    } else if (track === 'MUSIC_BOSS') {
      this.startHorrorAmbience(true);
    }
  }

  private stopCaveOscillatorBed(): void {
    if (!this.ambienceCaveOsc) return;
    for (const o of this.ambienceCaveOsc.oscillators) {
      try {
        o.stop();
      } catch {
        // ignore
      }
    }
    this.ambienceCaveOsc = null;
  }

  private stopAmbienceLoops(): void {
    for (const layer of [this.ambienceWhite, this.ambienceCave]) {
      if (!layer) continue;
      try {
        layer.source.stop();
      } catch {
        // ignore
      }
    }
    this.ambienceWhite = null;
    this.ambienceCave = null;
    this.stopCaveOscillatorBed();
  }

  private updateAmbienceLoopGains(): void {
    if (!this.audioContext) return;
    const t = this.audioContext.currentTime;
    const m = this.settings.muted ? 0 : this.settings.masterVolume;
    if (this.ambienceWhite) {
      this.ambienceWhite.gain.gain.setValueAtTime(
        Math.max(0, this.settings.ambienceWhiteNoiseVolume) * m,
        t
      );
    }
    if (this.ambienceCave) {
      this.ambienceCave.gain.gain.setValueAtTime(
        Math.max(0, this.settings.ambienceCaveVolume) * m,
        t
      );
    }
    if (this.ambienceCaveOsc) {
      const v = Math.max(0, this.settings.ambienceCaveVolume) * m * 0.055;
      this.ambienceCaveOsc.gain.gain.setValueAtTime(v, t);
    }
  }

  private async startAmbienceLoop(
    slot: 'white' | 'cave',
    paths: readonly string[],
    volumeSetting: number
  ): Promise<void> {
    if (volumeSetting <= 0 || !this.audioContext || this.settings.muted) return;

    let buffer: AudioBuffer | null = null;
    for (const p of paths) {
      const cached = this.sounds.get(p);
      if (cached) {
        buffer = cached;
        break;
      }
      buffer = await this.loadSound(p);
      if (buffer) break;
    }
    if (slot === 'cave' && !buffer) {
      this.startCaveOscillatorBed();
      return;
    }

    if (!buffer) return;

    const source = this.audioContext.createBufferSource();
    const gain = this.audioContext.createGain();
    source.buffer = buffer;
    source.loop = true;
    source.connect(gain);
    gain.connect(this.audioContext.destination);
    source.start(0);

    if (slot === 'white') this.ambienceWhite = { source, gain };
    else this.ambienceCave = { source, gain };
    this.updateAmbienceLoopGains();
  }

  /** Sub-bass / stone-room tone when no cave ambience file is installed. */
  private startCaveOscillatorBed(): void {
    if (!this.audioContext || this.settings.muted) return;
    this.stopCaveOscillatorBed();

    const ctx = this.audioContext;
    const g = ctx.createGain();
    const o1 = ctx.createOscillator();
    o1.type = 'sine';
    o1.frequency.value = 39;
    const o2 = ctx.createOscillator();
    o2.type = 'sine';
    o2.frequency.value = 63;
    const o3 = ctx.createOscillator();
    o3.type = 'triangle';
    o3.frequency.value = 21;

    o1.connect(g);
    o2.connect(g);
    o3.connect(g);
    g.connect(ctx.destination);
    o1.start();
    o2.start();
    o3.start();

    this.ambienceCaveOsc = { gain: g, oscillators: [o1, o2, o3] };
    this.updateAmbienceLoopGains();
  }

  private async refreshAmbienceLoops(track: MusicTrack): Promise<void> {
    this.stopAmbienceLoops();
    if (
      !this.audioContext ||
      !this.isInitialized ||
      this.settings.muted ||
      (track !== 'MUSIC_GAME' && track !== 'MUSIC_BOSS')
    ) {
      return;
    }
    await this.startAmbienceLoop(
      'white',
      AMBIENCE_SEARCH_PATHS.whiteNoise,
      this.settings.ambienceWhiteNoiseVolume
    );
    await this.startAmbienceLoop(
      'cave',
      AMBIENCE_SEARCH_PATHS.cave,
      this.settings.ambienceCaveVolume
    );
  }

  playEnemySkitter(urgency: number): void {
    if (
      !this.settings.enemySkitterEnabled ||
      !this.isInitialized ||
      this.settings.muted ||
      !this.audioContext
    ) {
      return;
    }
    this.ensureAudioContextRunning();
    const nowT = this.audioContext.currentTime;
    if (nowT < this.skitterCooldownUntil) return;
    this.skitterCooldownUntil = nowT + 0.06;

    const scale = Math.min(1.45, 0.38 + urgency * 0.42);
    const v =
      scale *
      this.settings.enemySkitterVolume *
      this.settings.sfxVolume *
      this.settings.masterVolume;

    let buffer: AudioBuffer | null = null;
    for (const p of ENEMY_SKITTER_SEARCH_PATHS) {
      buffer = this.sounds.get(p) ?? null;
      if (buffer) break;
    }

    if (buffer) {
      this.playBuffer(buffer, v);
    } else {
      this.playFallbackSound('SFX_ENEMY_SKITTER', scale * 0.85);
    }
  }

  // Volume controls
  setMasterVolume(volume: number): void {
    this.settings.masterVolume = Math.max(0, Math.min(1, volume));
    this.updateMusicVolume();
    this.saveSettings();
  }

  setMusicVolume(volume: number): void {
    this.settings.musicVolume = Math.max(0, Math.min(1, volume));
    this.updateMusicVolume();
    this.saveSettings();
  }

  setSfxVolume(volume: number): void {
    this.settings.sfxVolume = Math.max(0, Math.min(1, volume));
    this.saveSettings();
  }

  setMuted(muted: boolean): void {
    const was = this.settings.muted;
    this.settings.muted = muted;
    this.updateMusicVolume();
    this.saveSettings();
    if (was && !muted) {
      void this.refreshAmbienceLoops(this.currentMusicTrack ?? 'MUSIC_MENU');
    }
    if (!was && muted) {
      this.stopAmbienceLoops();
    }
  }

  toggleMute(): boolean {
    void this.resume();
    const was = this.settings.muted;
    this.settings.muted = !this.settings.muted;
    this.updateMusicVolume();
    this.saveSettings();
    if (was && !this.settings.muted) {
      void this.refreshAmbienceLoops(this.currentMusicTrack ?? 'MUSIC_MENU');
    }
    if (!was && this.settings.muted) {
      this.stopAmbienceLoops();
    }
    return this.settings.muted;
  }

  private updateMusicVolume(): void {
    if (this.currentMusicGain && this.audioContext) {
      const volume = this.settings.muted ? 0 :
        this.settings.musicVolume * this.settings.masterVolume;
      this.currentMusicGain.gain.setValueAtTime(
        volume,
        this.audioContext.currentTime
      );
    }
    this.applyMenuHtmlVolume();
    if (this.currentMusicTrack === 'MUSIC_MENU' && !this.settings.muted && !this.menuTvBuzz) {
      this.startMenuTvBuzz();
    }
    this.refreshMenuTvBuzzVolume();
    this.updateHorrorVolume();
    this.updateAmbienceLoopGains();
  }

  getSettings(): AudioSettings {
    return { ...this.settings };
  }

  // Resume audio context after user interaction; also lifts policy mute on HTML menu music.
  async resume(): Promise<void> {
    if (this.menuHtmlPolicyMute && this.menuHtmlAudio && this.menuHtmlActive) {
      if (!this.settings.muted) {
        this.menuHtmlAudio.muted = false;
      }
      this.menuHtmlPolicyMute = false;
      this.applyMenuHtmlVolume();
      void this.menuHtmlAudio.play().catch(() => undefined);
    }
    if (this.audioContext && this.audioContext.state !== 'closed') {
      try {
        await this.audioContext.resume();
      } catch {
        // ignore
      }
    }
  }
}

// Singleton instance
export const AudioManager = new AudioManagerClass();
