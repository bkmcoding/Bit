/**
 * AudioManager - Modular audio system for Box Crawler
 * 
 * To swap audio files:
 * 1. Replace the files in /public/audio/ with your own
 * 2. Or update the AUDIO_PATHS config below to point to different files
 * 
 * Supported formats: mp3, wav, ogg
 */

export type MusicTrack = 'MUSIC_MENU' | 'MUSIC_GAME' | 'MUSIC_BOSS';

/** Paths tried in order: GAME_CONTEXT names first, then public/audio/README.txt names. */
export const MUSIC_SEARCH_PATHS: Record<MusicTrack, readonly string[]> = {
  MUSIC_MENU: ['/audio/music_menu.mp3', '/audio/menu-music.mp3'],
  MUSIC_GAME: ['/audio/music_gameplay.mp3', '/audio/game-music.mp3'],
  MUSIC_BOSS: ['/audio/music_boss.mp3', '/audio/boss-music.mp3'],
};

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
} as const;

export type SoundEffect = Exclude<keyof typeof AUDIO_PATHS, MusicTrack>;

// Volume settings
export interface AudioSettings {
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  muted: boolean;
}

const DEFAULT_SETTINGS: AudioSettings = {
  masterVolume: 0.7,
  musicVolume: 0.5,
  sfxVolume: 0.8,
  muted: false,
};

class AudioManagerClass {
  private audioContext: AudioContext | null = null;
  private sounds: Map<string, AudioBuffer> = new Map();
  private currentMusic: AudioBufferSourceNode | null = null;
  private currentMusicGain: GainNode | null = null;
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
    try {
      const saved = localStorage.getItem('boxcrawler_audio_settings');
      if (saved) {
        this.settings = { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
      }
    } catch {
      // Use defaults
    }
  }

  saveSettings(): void {
    try {
      localStorage.setItem('boxcrawler_audio_settings', JSON.stringify(this.settings));
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

    if (!buffer) return;
    
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
    this.settings.muted = muted;
    this.updateMusicVolume();
    this.saveSettings();
  }

  toggleMute(): boolean {
    void this.resume();
    this.settings.muted = !this.settings.muted;
    this.updateMusicVolume();
    this.saveSettings();
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
