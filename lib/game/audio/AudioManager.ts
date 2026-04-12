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
  private skitterCooldownUntil: number = 0;
  private settings: AudioSettings = { ...DEFAULT_SETTINGS };
  private isInitialized: boolean = false;
  private loadedPaths: Set<string> = new Set();
  
  // Fallback oscillator-based sounds when audio files aren't available
  private useFallback: boolean = true;

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

  // Play a sound effect
  play(effect: SoundEffect, volume: number = 1): void {
    if (this.settings.muted || !this.isInitialized) return;
    
    const path = AUDIO_PATHS[effect];
    const buffer = this.sounds.get(path);
    
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

  // Music control
  async playMusic(track: MusicTrack): Promise<void> {
    if (!this.audioContext || !this.isInitialized) return;

    this.stopMusic();
    this.currentMusicTrack = track;

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
    this.currentMusicGain.gain.value = volume;
    
    this.currentMusic.connect(this.currentMusicGain);
    this.currentMusicGain.connect(this.audioContext.destination);
    
    this.currentMusic.start(0);
    this.syncHorrorWithTrack(track);
    await this.refreshAmbienceLoops(track);
  }

  stopMusic(): void {
    if (this.currentMusic) {
      try {
        this.currentMusic.stop();
      } catch {
        // Already stopped
      }
      this.currentMusic = null;
      this.currentMusicGain = null;
    }
    this.stopAmbienceLoops();
    this.stopHorrorAmbience();
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
    this.updateHorrorVolume();
    this.updateAmbienceLoopGains();
  }

  getSettings(): AudioSettings {
    return { ...this.settings };
  }

  // Resume audio context after user interaction
  async resume(): Promise<void> {
    if (this.audioContext?.state === 'suspended') {
      await this.audioContext.resume();
    }
  }
}

// Singleton instance
export const AudioManager = new AudioManagerClass();
