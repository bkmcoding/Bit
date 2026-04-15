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
import type { PlayerHurtKind } from '../entities/Projectile';

export type MusicTrack = 'MUSIC_MENU' | 'MUSIC_GAME' | 'MUSIC_BOSS' | 'MUSIC_WATER';

/** Paths tried in order: GAME_CONTEXT names first, then public/audio/README.txt names. */
export const MUSIC_SEARCH_PATHS: Record<MusicTrack, readonly string[]> = {
  MUSIC_MENU: ['/audio/music_menu.mp3', '/audio/menu-music.mp3'],
  /** README names `game-music.mp3` first — try it before legacy `music_gameplay.mp3`. */
  MUSIC_GAME: ['/audio/game-music.mp3', '/audio/music_gameplay.mp3'],
  MUSIC_BOSS: ['/audio/boss-music.mp3', '/audio/music_boss.mp3'],
  /** Chapter 2 (flooded arc). Add `public/audio/water-music.mp3` (or `chapter2-music.mp3`). */
  MUSIC_WATER: ['/audio/water-music.mp3', '/audio/chapter2-music.mp3', '/audio/music_water.mp3'],
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
  MUSIC_WATER: MUSIC_SEARCH_PATHS.MUSIC_WATER[0],

  // Sound effects
  SFX_SHOOT: '/audio/sfx/shoot.mp3',
  SFX_HIT: '/audio/sfx/hit.mp3',
  SFX_ENEMY_HIT: '/audio/sfx/enemy-hit.mp3',
  /** Enemy glob / venom shot telegraph (optional MP3). */
  SFX_ENEMY_SPIT: '/audio/sfx/enemy-spit.mp3',
  /** Narrow venom needle (optional MP3). */
  SFX_ENEMY_NEEDLE: '/audio/sfx/enemy-needle.mp3',
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
  /** Gameplay/boss tracks sit quieter than SFX at equal meters; nudge default up. */
  musicVolume: 0.74,
  /** Slightly higher default so horror SFX (often synth) sit closer to music. */
  sfxVolume: 0.88,
  muted: false,
  ambienceWhiteNoiseVolume: ATMOSPHERE_AUDIO_SETTINGS.whiteNoiseVolume,
  ambienceCaveVolume: ATMOSPHERE_AUDIO_SETTINGS.caveVolume,
  enemySkitterEnabled: ATMOSPHERE_AUDIO_SETTINGS.enemySkitterEnabled,
  enemySkitterVolume: ATMOSPHERE_AUDIO_SETTINGS.enemySkitterVolume,
};

/**
 * Base scale for Web Audio SFX fallbacks (legacy was `0.3`). Dark / low-heavy synths still
 * sound quiet vs full-range music — `SFX_SYNTH_PERCEIVED_BOOST` compensates for that.
 */
const SFX_SYNTH_LEVEL = 0.72;
/** Extra lift so SFX cut through music perceptually (low energy = quieter at same meter). */
const SFX_SYNTH_PERCEIVED_BOOST = 1.32;
/** Lift decoded one-shots (shoot, hits, etc.) toward gameplay music loudness. */
const SFX_BUFFER_LEVEL = 1.48;

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
  private rainPitterIntervalId: number | null = null;
  private rainWindow: { source: AudioBufferSourceNode; gain: GainNode } | null = null;
  private omenTimerId: number | null = null;
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
  /** Next MUSIC_GAME / MUSIC_BOSS / MUSIC_WATER Web Audio gain ramps from 0 (after leaving main menu). */
  private pendingGameplayMusicFadeInMs: number | null = null;
  /** Fluorescent-style buzz + occasional flicker during chapter 2 (non-boss). */
  private fluorescentHum: { gain: GainNode; oscillators: OscillatorNode[] } | null = null;
  private fluorescentRaf: number | null = null;

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

    for (const path of [
      ...MUSIC_SEARCH_PATHS.MUSIC_MENU,
      ...MUSIC_SEARCH_PATHS.MUSIC_GAME,
      ...MUSIC_SEARCH_PATHS.MUSIC_BOSS,
      ...MUSIC_SEARCH_PATHS.MUSIC_WATER,
    ]) {
      try {
        await this.loadSound(path);
      } catch {
        // optional music file
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

    if (effect === 'SFX_ENEMY_HIT') {
      this.playEnemyHit(volume, 12);
      return;
    }

    if (effect === 'SFX_ENEMY_DEATH') {
      const base =
        volume * this.settings.sfxVolume * this.settings.masterVolume * SFX_BUFFER_LEVEL;
      const path = AUDIO_PATHS.SFX_ENEMY_DEATH;
      const buffer = this.sounds.get(path);
      if (buffer && this.audioContext) {
        this.playBuffer(buffer, base * 1.22, 1.14);
      } else {
        this.playFallbackSound(effect, volume * 1.15);
      }
      return;
    }

    const path = AUDIO_PATHS[effect];
    let buffer = this.sounds.get(path);
    if (!buffer && effect === 'SFX_DOOR_PASS') {
      buffer = this.sounds.get(AUDIO_PATHS.SFX_DOOR_OPEN);
    }

    if (buffer && this.audioContext) {
      this.playBuffer(
        buffer,
        volume * this.settings.sfxVolume * this.settings.masterVolume * SFX_BUFFER_LEVEL,
        1
      );
    } else {
      // Use oscillator fallback
      this.playFallbackSound(effect, volume);
    }
  }

  /**
   * Player hurt sting — varies by damage source. Uses `player-hurt` MP3 with playbackRate when
   * present; otherwise Web Audio fallbacks tuned per kind.
   */
  playPlayerHurt(kind: PlayerHurtKind = 'melee'): void {
    if (this.settings.muted || !this.isInitialized) return;
    this.ensureAudioContextRunning();
    const base = this.settings.sfxVolume * this.settings.masterVolume;
    const buffer = this.sounds.get(AUDIO_PATHS.SFX_PLAYER_HURT);
    if (buffer && this.audioContext) {
      const rate =
        kind === 'projectile'
          ? 1.14
          : kind === 'acid'
            ? 0.74
            : kind === 'needle'
              ? 1.36
              : kind === 'boss'
                ? 0.84
                : kind === 'charge'
                  ? 0.68
                  : 1.02;
      this.playBuffer(buffer, base * 1.05 * SFX_BUFFER_LEVEL, rate);
      return;
    }
    this.playPlayerHurtFallback(kind, base * 0.42);
  }

  /**
   * Short low pulse for the main-menu standby LED. Stays subtle; Web Audio may stay silent until
   * a user gesture unlocks the AudioContext (same as other SFX).
   */
  playMenuStandbyPulse(): void {
    if (this.settings.muted || !this.isInitialized || !this.audioContext) return;
    this.ensureAudioContextRunning();

    const ctx = this.audioContext;
    const now = ctx.currentTime;
    const peak = Math.max(0.06, this.settings.sfxVolume * this.settings.masterVolume * 0.14);

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(88, now);
    osc.frequency.exponentialRampToValueAtTime(64, now + 0.054);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(peak, now + 0.0035);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.058);

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(420, now);
    lp.Q.setValueAtTime(0.7, now);

    osc.connect(lp);
    lp.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.065);
  }

  private playBuffer(buffer: AudioBuffer, volume: number, playbackRate = 1): void {
    if (!this.audioContext) return;
    
    const source = this.audioContext.createBufferSource();
    const gainNode = this.audioContext.createGain();
    
    source.buffer = buffer;
    source.playbackRate.value = playbackRate;
    gainNode.gain.value = volume;
    
    source.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    source.start(0);
  }

  /**
   * Enemy hurt — synthesized; `enemySize` maps pitch (`Enemy.size`, see `ENEMY` in constants).
   * Smaller enemies = higher chirp; bosses = deeper body. Ignores `enemy-hit.mp3`.
   */
  playEnemyHit(volume = 1, enemySize = 12): void {
    if (this.settings.muted || !this.isInitialized) return;
    this.ensureAudioContextRunning();
    const v =
      volume *
      this.settings.sfxVolume *
      this.settings.masterVolume *
      SFX_BUFFER_LEVEL *
      1.26;
    this.playEnemyHitGooey(v, enemySize);
  }

  /**
   * @param linearGain — pre-scaled gain
   * @param enemySize — collision diameter in px (`Enemy.size`), ~7 tiny → ~32 brood
   */
  private playEnemyHitGooey(linearGain: number, enemySize: number): void {
    if (!this.audioContext || this.settings.muted) return;
    const ctx = this.audioContext;
    const now = ctx.currentTime;
    const v = linearGain * 1.72;

    /** ~7 skitter → 0, ~32 brood → 1 */
    const SZ_MIN = 7;
    const SZ_MAX = 34;
    const t = Math.max(0, Math.min(1, (enemySize - SZ_MIN) / (SZ_MAX - SZ_MIN)));
    /** Higher for small bugs (insect squeal), lower for bosses (heft). */
    const fMul = 1.52 - t * 0.82;
    /** Big enemies keep more low body; tiny ones barely use the sine tap. */
    const wThump = 0.06 + t * 0.94;
    /** Extra level on crack/yelp/snap for small targets (cheap speakers skew low). */
    const wHigh = 1.05 + (1 - t) * 0.62;
    const fm = (hz: number) => hz * fMul;

    const merge = ctx.createGain();
    merge.gain.value = 1;

    // --- Optional low body (scaled down for small enemies so it doesn’t read as a “kick”)
    const thump = ctx.createOscillator();
    const thG = ctx.createGain();
    thump.type = 'sine';
    thump.frequency.setValueAtTime(fm(108 + Math.random() * 16), now);
    thump.frequency.exponentialRampToValueAtTime(fm(62 + t * 28), now + 0.07);
    thG.gain.setValueAtTime(0.0001, now);
    thG.gain.linearRampToValueAtTime(v * 0.52 * wThump, now + 0.01);
    thG.gain.exponentialRampToValueAtTime(0.0001, now + 0.13);
    thump.connect(thG);
    thG.connect(merge);
    thump.start(now);
    thump.stop(now + 0.15);

    // --- Mid squeal (main “bug” tone)
    const glop = ctx.createOscillator();
    const gG = ctx.createGain();
    glop.type = 'triangle';
    glop.frequency.setValueAtTime(fm(300 + Math.random() * 60), now);
    glop.frequency.exponentialRampToValueAtTime(fm(140 + t * 55), now + 0.05);
    gG.gain.setValueAtTime(0.0001, now);
    gG.gain.linearRampToValueAtTime(v * 0.58 * wHigh, now + 0.0035);
    gG.gain.exponentialRampToValueAtTime(0.0001, now + 0.1);
    glop.connect(gG);
    const gLp = ctx.createBiquadFilter();
    gLp.type = 'lowpass';
    gLp.frequency.setValueAtTime(fm(2600), now);
    gG.connect(gLp);
    gLp.connect(merge);
    glop.start(now);
    glop.stop(now + 0.12);

    // --- Grit (stepped noise), mids only
    const len = Math.floor(ctx.sampleRate * 0.11);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const ch = buf.getChannelData(0);
    const steps = 14;
    let brown = 0;
    for (let i = 0; i < len; i++) {
      const ti = i / len;
      const env =
        Math.pow(Math.sin(Math.PI * Math.min(1, ti * 1.65)), 0.75) * Math.exp(-2.05 * ti);
      brown += (Math.random() * 2 - 1) * 0.085;
      brown *= 0.965;
      let x = brown * env + (Math.random() * 2 - 1) * env * 0.35;
      x = Math.round(x * steps) / steps;
      ch[i] = x;
    }

    const mud = ctx.createBufferSource();
    mud.buffer = buf;
    const mG = ctx.createGain();
    mG.gain.setValueAtTime(0.0001, now);
    mG.gain.linearRampToValueAtTime(v * 0.48 * wHigh, now + 0.007);
    mG.gain.exponentialRampToValueAtTime(0.0001, now + 0.13);
    const mHp = ctx.createBiquadFilter();
    mHp.type = 'highpass';
    mHp.frequency.setValueAtTime(fm(420), now);
    const mLp = ctx.createBiquadFilter();
    mLp.type = 'lowpass';
    mLp.frequency.setValueAtTime(fm(2600), now);
    mLp.Q.setValueAtTime(0.85, now);
    mud.connect(mG);
    mG.connect(mHp);
    mHp.connect(mLp);
    mLp.connect(merge);
    mud.start(now);
    mud.stop(now + 0.14);

    // --- Chitin snap
    const crack = ctx.createOscillator();
    const cG = ctx.createGain();
    crack.type = 'triangle';
    crack.frequency.setValueAtTime(fm(480 + Math.random() * 100), now);
    crack.frequency.exponentialRampToValueAtTime(fm(240 + t * 80), now + 0.017);
    cG.gain.setValueAtTime(0.0001, now);
    cG.gain.linearRampToValueAtTime(v * 0.2 * wHigh, now + 0.001);
    cG.gain.exponentialRampToValueAtTime(0.0001, now + 0.032);
    crack.connect(cG);
    const bpf = ctx.createBiquadFilter();
    bpf.type = 'bandpass';
    bpf.frequency.setValueAtTime(fm(2200 + Math.random() * 420), now);
    bpf.Q.setValueAtTime(2.6, now);
    cG.connect(bpf);
    bpf.connect(merge);
    crack.start(now);
    crack.stop(now + 0.045);

    // --- Yelp / stridulation
    const yelp = ctx.createOscillator();
    const yG = ctx.createGain();
    yelp.type = 'sawtooth';
    const y0 = fm(920 + Math.random() * 200);
    yelp.frequency.setValueAtTime(y0, now);
    yelp.frequency.exponentialRampToValueAtTime(fm(280 + t * 120), now + 0.04);
    yG.gain.setValueAtTime(0.0001, now);
    yG.gain.linearRampToValueAtTime(v * 0.26 * wHigh, now + 0.0016);
    yG.gain.exponentialRampToValueAtTime(0.0001, now + 0.055);
    yelp.connect(yG);
    const yBpf = ctx.createBiquadFilter();
    yBpf.type = 'bandpass';
    yBpf.frequency.setValueAtTime(fm(1500 + Math.random() * 280), now);
    yBpf.Q.setValueAtTime(2.4, now);
    yG.connect(yBpf);
    yBpf.connect(merge);
    yelp.start(now);
    yelp.stop(now + 0.07);

    // --- Air / stridulation noise
    const nLen = Math.floor(ctx.sampleRate * 0.03);
    const nBuf = ctx.createBuffer(1, nLen, ctx.sampleRate);
    const nCh = nBuf.getChannelData(0);
    for (let i = 0; i < nLen; i++) {
      const e = Math.exp(-88 * (i / nLen));
      nCh[i] = (Math.random() * 2 - 1) * e * 0.95;
    }
    const nit = ctx.createBufferSource();
    nit.buffer = nBuf;
    const nG = ctx.createGain();
    nG.gain.setValueAtTime(0.0001, now);
    nG.gain.linearRampToValueAtTime(v * 0.2 * wHigh, now + 0.001);
    nG.gain.exponentialRampToValueAtTime(0.0001, now + 0.026);
    nit.connect(nG);
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.setValueAtTime(fm(2800), now);
    hp.Q.setValueAtTime(0.65, now);
    const nLp = ctx.createBiquadFilter();
    nLp.type = 'lowpass';
    nLp.frequency.setValueAtTime(fm(10000), now);
    nG.connect(hp);
    hp.connect(nLp);
    nLp.connect(merge);
    nit.start(now);
    nit.stop(now + 0.032);

    // --- Speaker-friendly “read” band: guaranteed 2.5–6 kHz energy (not masked by thump)
    const snapLen = Math.floor(ctx.sampleRate * 0.022);
    const snapBuf = ctx.createBuffer(1, snapLen, ctx.sampleRate);
    const snapCh = snapBuf.getChannelData(0);
    for (let i = 0; i < snapLen; i++) {
      const e = Math.sin((i / snapLen) * Math.PI);
      snapCh[i] = (Math.random() * 2 - 1) * e * 0.9;
    }
    const snap = ctx.createBufferSource();
    snap.buffer = snapBuf;
    const sG = ctx.createGain();
    sG.gain.setValueAtTime(0.0001, now);
    sG.gain.linearRampToValueAtTime(v * 0.42 * wHigh, now + 0.002);
    sG.gain.exponentialRampToValueAtTime(0.0001, now + 0.02);
    snap.connect(sG);
    const sBpf = ctx.createBiquadFilter();
    sBpf.type = 'bandpass';
    sBpf.frequency.setValueAtTime(fm(3200 + Math.random() * 900), now);
    sBpf.Q.setValueAtTime(3.2, now);
    sG.connect(sBpf);
    sBpf.connect(merge);
    snap.start(now);
    snap.stop(now + 0.024);

    // --- Master: steep sub cut so laptop drivers don’t turn everything into a thump
    const hip = ctx.createBiquadFilter();
    hip.type = 'highpass';
    hip.frequency.setValueAtTime(140, now);
    hip.Q.setValueAtTime(0.71, now);

    const masterLp = ctx.createBiquadFilter();
    masterLp.type = 'lowpass';
    masterLp.frequency.setValueAtTime(11000, now);
    masterLp.frequency.exponentialRampToValueAtTime(7600, now + 0.05);
    masterLp.Q.setValueAtTime(0.5, now);

    const presence = ctx.createBiquadFilter();
    presence.type = 'peaking';
    presence.frequency.setValueAtTime(fm(1600), now);
    presence.Q.setValueAtTime(0.82, now);
    presence.gain.setValueAtTime(4.2 + (1 - t) * 2.8, now);

    const bite = ctx.createBiquadFilter();
    bite.type = 'peaking';
    bite.frequency.setValueAtTime(fm(3400), now);
    bite.Q.setValueAtTime(1.05, now);
    bite.gain.setValueAtTime(5.5 + (1 - t) * 2, now);

    const hs = ctx.createBiquadFilter();
    hs.type = 'highshelf';
    hs.frequency.setValueAtTime(4800, now);
    hs.gain.setValueAtTime(4.8 + (1 - t) * 1.5, now);

    const out = ctx.createGain();
    out.gain.setValueAtTime(1.22, now);
    merge.connect(hip);
    hip.connect(masterLp);
    masterLp.connect(presence);
    presence.connect(bite);
    bite.connect(hs);
    hs.connect(out);
    out.connect(ctx.destination);
  }

  private playPlayerHurtFallback(kind: PlayerHurtKind, vol: number): void {
    if (!this.audioContext || this.settings.muted) return;
    const ctx = this.audioContext;
    const now = ctx.currentTime;
    const v = vol * 1.2;

    const merge = ctx.createGain();
    merge.gain.value = 1;

    const base =
      kind === 'acid'
        ? 118
        : kind === 'needle'
          ? 280
          : kind === 'boss'
            ? 95
            : kind === 'charge'
              ? 72
              : kind === 'projectile'
                ? 195
                : 155;
    const end =
      kind === 'acid'
        ? 62
        : kind === 'needle'
          ? 420
          : kind === 'boss'
            ? 48
            : kind === 'charge'
              ? 38
              : kind === 'projectile'
                ? 340
                : 210;

    const body = ctx.createOscillator();
    const bGain = ctx.createGain();
    body.type = 'triangle';
    body.frequency.setValueAtTime(base, now);
    body.frequency.exponentialRampToValueAtTime(Math.max(36, end * 0.35), now + 0.14);
    bGain.gain.setValueAtTime(v * (kind === 'charge' ? 0.85 : 0.55), now);
    bGain.gain.exponentialRampToValueAtTime(0.01, now + 0.22);
    body.connect(bGain);
    bGain.connect(merge);

    const tick = ctx.createOscillator();
    const tGain = ctx.createGain();
    tick.type = 'triangle';
    tick.frequency.setValueAtTime(380 + Math.random() * 90, now);
    tick.frequency.exponentialRampToValueAtTime(120, now + 0.055);
    tGain.gain.setValueAtTime(v * 0.1, now);
    tGain.gain.exponentialRampToValueAtTime(0.008, now + 0.08);
    tick.connect(tGain);
    tGain.connect(merge);

    const pf = ctx.createBiquadFilter();
    pf.type = 'lowpass';
    pf.frequency.setValueAtTime(2400, now);
    pf.Q.setValueAtTime(0.65, now);
    merge.connect(pf);
    pf.connect(ctx.destination);
    body.start(now);
    body.stop(now + 0.24);
    tick.start(now);
    tick.stop(now + 0.09);
  }

  /**
   * Gun fallback: pressure + tunnel tone — smoother than 8-bit crush; longer, darker tail for
   * suspense (not arcade “pew”).
   */
  private playOrbShootFallback(vol: number): void {
    if (!this.audioContext || this.settings.muted) return;
    const ctx = this.audioContext;
    const now = ctx.currentTime;
    const v = vol * 2.15;

    const merge = ctx.createGain();
    merge.gain.value = 1;

    const len = Math.floor(ctx.sampleRate * 0.1);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      const t = i / len;
      const env = Math.pow(Math.sin(Math.PI * t), 0.85) * Math.exp(-2.35 * t);
      let x = (Math.random() * 2 - 1) * env;
      x = Math.tanh(x * 1.65) * 0.78;
      ch[i] = i ? ch[i - 1] * 0.42 + x * 0.58 : x;
    }

    const noiseSrc = ctx.createBufferSource();
    noiseSrc.buffer = buf;
    const nGain = ctx.createGain();
    nGain.gain.setValueAtTime(0.0001, now);
    nGain.gain.linearRampToValueAtTime(v * 0.58, now + 0.006);
    nGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
    const nLp = ctx.createBiquadFilter();
    nLp.type = 'lowpass';
    nLp.frequency.setValueAtTime(2800, now);
    nLp.frequency.exponentialRampToValueAtTime(900, now + 0.07);
    noiseSrc.connect(nGain);
    nGain.connect(nLp);
    nLp.connect(merge);

    const tunnel = ctx.createOscillator();
    const tGain = ctx.createGain();
    tunnel.type = 'sine';
    tunnel.frequency.setValueAtTime(108 + Math.random() * 10, now);
    tunnel.frequency.exponentialRampToValueAtTime(66, now + 0.09);
    tGain.gain.setValueAtTime(0.0001, now);
    tGain.gain.linearRampToValueAtTime(v * 0.22, now + 0.012);
    tGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);
    tunnel.connect(tGain);
    tGain.connect(merge);

    const plorp = ctx.createOscillator();
    const plGain = ctx.createGain();
    plorp.type = 'sine';
    plorp.frequency.setValueAtTime(172 + Math.random() * 14, now);
    plorp.frequency.exponentialRampToValueAtTime(108, now + 0.07);
    plGain.gain.setValueAtTime(0.0001, now);
    plGain.gain.linearRampToValueAtTime(v * 0.48, now + 0.005);
    plGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.11);
    plorp.connect(plGain);
    plGain.connect(merge);

    const squelch = ctx.createOscillator();
    const sqGain = ctx.createGain();
    squelch.type = 'triangle';
    squelch.frequency.setValueAtTime(218 + Math.random() * 20, now);
    squelch.frequency.exponentialRampToValueAtTime(142, now + 0.055);
    sqGain.gain.setValueAtTime(0.0001, now);
    sqGain.gain.linearRampToValueAtTime(v * 0.24, now + 0.004);
    sqGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);
    squelch.connect(sqGain);
    sqGain.connect(merge);

    const sub = ctx.createOscillator();
    const sGain = ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(78, now);
    sub.frequency.exponentialRampToValueAtTime(52, now + 0.09);
    sGain.gain.setValueAtTime(0.0001, now);
    sGain.gain.linearRampToValueAtTime(v * 0.38, now + 0.014);
    sGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
    sub.connect(sGain);
    sGain.connect(merge);

    const peak = ctx.createBiquadFilter();
    peak.type = 'peaking';
    peak.frequency.setValueAtTime(380, now);
    peak.Q.setValueAtTime(0.75, now);
    peak.gain.setValueAtTime(3.5, now);

    const shelf = ctx.createBiquadFilter();
    shelf.type = 'lowshelf';
    shelf.frequency.setValueAtTime(140, now);
    shelf.gain.setValueAtTime(4.5, now);

    const presence = ctx.createBiquadFilter();
    presence.type = 'peaking';
    presence.frequency.setValueAtTime(410, now);
    presence.Q.setValueAtTime(0.9, now);
    presence.gain.setValueAtTime(5.2, now);

    const masterLp = ctx.createBiquadFilter();
    masterLp.type = 'lowpass';
    masterLp.frequency.setValueAtTime(6800, now);
    masterLp.Q.setValueAtTime(0.7, now);

    const dry = ctx.createGain();
    const wet = ctx.createGain();
    const dly = ctx.createDelay(0.12);
    dly.delayTime.setValueAtTime(0.042, now);
    const fb = ctx.createGain();
    fb.gain.value = 0.22;
    dly.connect(fb);
    fb.connect(dly);

    merge.connect(peak);
    peak.connect(shelf);
    shelf.connect(masterLp);
    masterLp.connect(dry);
    masterLp.connect(dly);
    dry.connect(ctx.destination);
    dly.connect(wet);
    wet.connect(ctx.destination);

    dry.gain.setValueAtTime(0.88, now);
    wet.gain.setValueAtTime(0.22, now);

    noiseSrc.start(now);
    noiseSrc.stop(now + 0.12);
    tunnel.start(now);
    tunnel.stop(now + 0.15);
    plorp.start(now);
    plorp.stop(now + 0.12);
    squelch.start(now);
    squelch.stop(now + 0.1);
    sub.start(now);
    sub.stop(now + 0.17);
  }

  /** Enemy killed — insect wail + airy breakup; sub-only is de-emphasized vs “knock”. */
  private playEnemyDeathHorror(vol: number): void {
    if (!this.audioContext || this.settings.muted) return;
    const ctx = this.audioContext;
    const now = ctx.currentTime;
    const v = vol * 2.05;

    const merge = ctx.createGain();
    merge.gain.value = 1;

    const len = Math.floor(ctx.sampleRate * 0.42);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const ch = buf.getChannelData(0);
    let carry = 0;
    for (let i = 0; i < len; i++) {
      const t = i / len;
      const env = Math.pow(1 - t, 1.4) * Math.exp(-1.1 * t);
      carry += (Math.random() * 2 - 1) * 0.06;
      carry *= 0.988;
      const x = Math.tanh((carry + (Math.random() * 2 - 1) * 0.45) * env);
      ch[i] = x * 0.78;
    }

    const crumble = ctx.createBufferSource();
    crumble.buffer = buf;
    const cG = ctx.createGain();
    cG.gain.setValueAtTime(0.0001, now);
    cG.gain.linearRampToValueAtTime(v * 0.48, now + 0.04);
    cG.gain.exponentialRampToValueAtTime(0.0001, now + 0.48);
    const cHp = ctx.createBiquadFilter();
    cHp.type = 'highpass';
    cHp.frequency.setValueAtTime(450, now);
    const cLp = ctx.createBiquadFilter();
    cLp.type = 'lowpass';
    cLp.frequency.setValueAtTime(5200, now);
    cLp.frequency.exponentialRampToValueAtTime(900, now + 0.38);
    crumble.connect(cG);
    cG.connect(cHp);
    cHp.connect(cLp);
    cLp.connect(merge);

    // Main “death cry” — mid/high triangle fall (bug-like, not bass drop)
    const body = ctx.createOscillator();
    const bG = ctx.createGain();
    body.type = 'triangle';
    body.frequency.setValueAtTime(380 + Math.random() * 45, now);
    body.frequency.exponentialRampToValueAtTime(95, now + 0.35);
    bG.gain.setValueAtTime(0.0001, now);
    bG.gain.linearRampToValueAtTime(v * 0.58, now + 0.018);
    bG.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);
    const bBpf = ctx.createBiquadFilter();
    bBpf.type = 'bandpass';
    bBpf.frequency.setValueAtTime(1100, now);
    bBpf.Q.setValueAtTime(1.2, now);
    body.connect(bG);
    bG.connect(bBpf);
    bBpf.connect(merge);

    // Quiet undertow only — was reading as dull thump
    const sub = ctx.createOscillator();
    const sG = ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(72, now);
    sub.frequency.exponentialRampToValueAtTime(38, now + 0.48);
    sG.gain.setValueAtTime(0.0001, now);
    sG.gain.linearRampToValueAtTime(v * 0.32, now + 0.06);
    sG.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);
    sub.connect(sG);
    sG.connect(merge);

    // Stridulation burst — short high chirps as life fades
    for (let k = 0; k < 4; k++) {
      const t0 = now + 0.06 + k * 0.07;
      const chirp = ctx.createOscillator();
      const chG = ctx.createGain();
      chirp.type = 'triangle';
      chirp.frequency.setValueAtTime(2200 + Math.random() * 400, t0);
      chirp.frequency.exponentialRampToValueAtTime(520, t0 + 0.035);
      chG.gain.setValueAtTime(0.0001, t0);
      chG.gain.linearRampToValueAtTime(v * 0.09, t0 + 0.0015);
      chG.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.045);
      const chLp = ctx.createBiquadFilter();
      chLp.type = 'lowpass';
      chLp.frequency.setValueAtTime(4800, t0);
      chirp.connect(chG);
      chG.connect(chLp);
      chLp.connect(merge);
      chirp.start(t0);
      chirp.stop(t0 + 0.052);
    }

    const pres = ctx.createBiquadFilter();
    pres.type = 'peaking';
    pres.frequency.setValueAtTime(1800, now);
    pres.Q.setValueAtTime(0.75, now);
    pres.gain.setValueAtTime(8, now);

    const air = ctx.createBiquadFilter();
    air.type = 'highshelf';
    air.frequency.setValueAtTime(3800, now);
    air.gain.setValueAtTime(5.5, now);

    const outLp = ctx.createBiquadFilter();
    outLp.type = 'lowpass';
    outLp.frequency.setValueAtTime(8800, now);
    merge.connect(pres);
    pres.connect(air);
    air.connect(outLp);
    outLp.connect(ctx.destination);

    crumble.start(now);
    crumble.stop(now + 0.5);
    body.start(now);
    body.stop(now + 0.48);
    sub.start(now);
    sub.stop(now + 0.55);
  }

  /** Silk / tension — filtered bed, not a clean beep. */
  private playWebTense(vol: number): void {
    if (!this.audioContext || this.settings.muted) return;
    const ctx = this.audioContext;
    const now = ctx.currentTime;
    const v = vol * 1.4;

    const len = Math.floor(ctx.sampleRate * 0.22);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      const t = i / len;
      const env = Math.pow(Math.sin(Math.PI * t), 0.6) * 0.55;
      ch[i] = (Math.random() * 2 - 1) * env;
    }
    for (let i = 1; i < len; i++) {
      ch[i] = ch[i] * 0.25 + ch[i - 1] * 0.75;
    }

    const n = ctx.createBufferSource();
    n.buffer = buf;
    const nG = ctx.createGain();
    nG.gain.setValueAtTime(0.0001, now);
    nG.gain.linearRampToValueAtTime(v * 0.35, now + 0.08);
    nG.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(480, now);
    n.connect(nG);
    nG.connect(lp);

    const hum = ctx.createOscillator();
    const hG = ctx.createGain();
    hum.type = 'sine';
    hum.frequency.setValueAtTime(58 + Math.random() * 6, now);
    hG.gain.setValueAtTime(0.0001, now);
    hG.gain.linearRampToValueAtTime(v * 0.18, now + 0.12);
    hG.gain.exponentialRampToValueAtTime(0.0001, now + 0.26);
    hum.connect(hG);

    const merge = ctx.createGain();
    merge.gain.value = 1;
    lp.connect(merge);
    hG.connect(merge);
    merge.connect(ctx.destination);

    n.start(now);
    hum.start(now);
    hum.stop(now + 0.28);
    n.stop(now + 0.3);
  }

  /** Rush / charge air — band noise + thump, not a bright arcade sweep. */
  private playDashWhoosh(vol: number): void {
    if (!this.audioContext || this.settings.muted) return;
    const ctx = this.audioContext;
    const now = ctx.currentTime;
    const v = vol * 1.78;

    const len = Math.floor(ctx.sampleRate * 0.08);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      const t = i / len;
      const env = Math.exp(-4.2 * t);
      ch[i] = (Math.random() * 2 - 1) * env;
    }

    const ns = ctx.createBufferSource();
    ns.buffer = buf;
    const nG = ctx.createGain();
    nG.gain.setValueAtTime(0.0001, now);
    nG.gain.linearRampToValueAtTime(v * 0.52, now + 0.012);
    nG.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);
    const bpf = ctx.createBiquadFilter();
    bpf.type = 'bandpass';
    bpf.frequency.setValueAtTime(420, now);
    bpf.frequency.exponentialRampToValueAtTime(220, now + 0.06);
    bpf.Q.setValueAtTime(1.1, now);
    ns.connect(nG);
    nG.connect(bpf);

    const th = ctx.createOscillator();
    const tG = ctx.createGain();
    th.type = 'sine';
    th.frequency.setValueAtTime(52, now);
    th.frequency.exponentialRampToValueAtTime(34, now + 0.11);
    tG.gain.setValueAtTime(0.0001, now);
    tG.gain.linearRampToValueAtTime(v * 0.62, now + 0.018);
    tG.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
    th.connect(tG);

    const merge = ctx.createGain();
    bpf.connect(merge);
    tG.connect(merge);
    merge.connect(ctx.destination);

    ns.start(now);
    th.start(now);
    ns.stop(now + 0.1);
    th.stop(now + 0.17);
  }

  // Fallback synthesized sounds
  private playFallbackSound(effect: SoundEffect, volume: number): void {
    if (!this.audioContext || this.settings.muted) return;
    
    const ctx = this.audioContext;
    const now = ctx.currentTime;
    const vol =
      volume *
      this.settings.sfxVolume *
      this.settings.masterVolume *
      SFX_SYNTH_LEVEL *
      SFX_SYNTH_PERCEIVED_BOOST;

    if (effect === 'SFX_SHOOT') {
      this.playOrbShootFallback(vol);
      return;
    }
    if (effect === 'SFX_ENEMY_DEATH') {
      this.playEnemyDeathHorror(vol);
      return;
    }
    if (effect === 'SFX_WEB') {
      this.playWebTense(vol);
      return;
    }
    if (effect === 'SFX_DASH') {
      this.playDashWhoosh(vol);
      return;
    }
    
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    switch (effect) {
      case 'SFX_HIT':
        oscillator.type = 'triangle';
        oscillator.frequency.setValueAtTime(165, now);
        oscillator.frequency.exponentialRampToValueAtTime(48, now + 0.12);
        gainNode.gain.setValueAtTime(vol * 1.05, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.14);
        oscillator.start(now);
        oscillator.stop(now + 0.15);
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
        
      case 'SFX_ENEMY_SPIT':
        oscillator.type = 'triangle';
        oscillator.frequency.setValueAtTime(142 + Math.random() * 35, now);
        oscillator.frequency.exponentialRampToValueAtTime(48, now + 0.14);
        gainNode.gain.setValueAtTime(vol * 0.88, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.17);
        oscillator.start(now);
        oscillator.stop(now + 0.18);
        break;

      case 'SFX_ENEMY_NEEDLE':
        oscillator.type = 'triangle';
        oscillator.frequency.setValueAtTime(520 + Math.random() * 120, now);
        oscillator.frequency.exponentialRampToValueAtTime(160, now + 0.05);
        gainNode.gain.setValueAtTime(vol * 0.48, now);
        gainNode.gain.exponentialRampToValueAtTime(0.008, now + 0.07);
        oscillator.start(now);
        oscillator.stop(now + 0.075);
        break;
        
      case 'SFX_BOSS_ROAR':
        oscillator.type = 'sawtooth';
        oscillator.frequency.setValueAtTime(80, now);
        oscillator.frequency.setValueAtTime(60, now + 0.2);
        oscillator.frequency.setValueAtTime(100, now + 0.4);
        oscillator.frequency.setValueAtTime(40, now + 0.6);
        gainNode.gain.setValueAtTime(vol * 2.15, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.8);
        oscillator.start(now);
        oscillator.stop(now + 0.8);
        break;

      case 'SFX_ENEMY_SKITTER':
        oscillator.type = 'triangle';
        oscillator.frequency.setValueAtTime(310 + Math.random() * 140, now);
        oscillator.frequency.exponentialRampToValueAtTime(95, now + 0.08);
        gainNode.gain.setValueAtTime(vol * 0.72, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        oscillator.start(now);
        oscillator.stop(now + 0.1);
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
      (track === 'MUSIC_GAME' || track === 'MUSIC_BOSS' || track === 'MUSIC_WATER') &&
      this.currentMusic === null
    ) {
      return false;
    }
    if (track === 'MUSIC_MENU' && this.menuHtmlActive) return true;
    if (this.currentMusic !== null) return true;
    if (
      (track === 'MUSIC_GAME' || track === 'MUSIC_BOSS' || track === 'MUSIC_WATER') &&
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
    const targetVol = 0.018 * this.settings.masterVolume;
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
    const v = this.settings.muted ? 0 : 0.0065 * this.settings.masterVolume;
    gainNode.gain.setValueAtTime(v, this.audioContext.currentTime);
  }

  private refreshMenuTvBuzzVolume(): void {
    if (!this.menuTvBuzz?.gain || !this.audioContext) return;
    const v = this.settings.muted ? 0 : 0.0065 * this.settings.masterVolume;
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

  /** Chapter 2 non-boss: subtle fluorescent buzz with random gain dips (no MP3 required). */
  startFluorescentArcHum(): void {
    if (typeof window === 'undefined') return;
    if (!this.audioContext || !this.isInitialized || this.settings.muted) return;
    if (this.fluorescentHum) return;

    const ctx = this.audioContext;
    const g = ctx.createGain();
    const m = this.settings.masterVolume * this.settings.musicVolume;
    const baseVol = 0.011 * m;
    g.gain.value = baseVol;

    const freqs = [100, 200, 50];
    const types: OscillatorType[] = ['square', 'square', 'triangle'];
    const oscillators: OscillatorNode[] = [];
    for (let i = 0; i < freqs.length; i++) {
      const o = ctx.createOscillator();
      o.type = types[i];
      o.frequency.value = freqs[i];
      o.detune.value = (i - 1) * 4;
      o.connect(g);
      oscillators.push(o);
    }
    g.connect(ctx.destination);
    for (const o of oscillators) o.start(0);
    this.fluorescentHum = { gain: g, oscillators };

    const tick = () => {
      if (!this.fluorescentHum || !this.audioContext) {
        this.fluorescentRaf = null;
        return;
      }
      const t = this.audioContext.currentTime;
      const mm = this.settings.masterVolume * this.settings.musicVolume;
      const b = 0.011 * mm;
      if (Math.random() < 0.014) {
        this.fluorescentHum.gain.gain.cancelScheduledValues(t);
        this.fluorescentHum.gain.gain.setValueAtTime(this.fluorescentHum.gain.gain.value, t);
        this.fluorescentHum.gain.gain.linearRampToValueAtTime(b * 0.22, t + 0.02);
        const up = t + 0.05 + Math.random() * 0.07;
        this.fluorescentHum.gain.gain.linearRampToValueAtTime(b, up);
      } else {
        const wobble = b * (0.92 + Math.random() * 0.1);
        this.fluorescentHum.gain.gain.setTargetAtTime(wobble, t, 0.12);
      }
      this.fluorescentRaf = window.requestAnimationFrame(tick);
    };
    this.fluorescentRaf = window.requestAnimationFrame(tick);
  }

  stopFluorescentArcHum(): void {
    if (this.fluorescentRaf !== null) {
      cancelAnimationFrame(this.fluorescentRaf);
      this.fluorescentRaf = null;
    }
    if (!this.fluorescentHum) return;
    for (const o of this.fluorescentHum.oscillators) {
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
      this.fluorescentHum.gain.disconnect();
    } catch {
      // ignore
    }
    this.fluorescentHum = null;
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

  /**
   * After a run (game over / victory → main menu): cancel gameplay fade, ensure audio is
   * initialized, then switch to menu music so horror/game buffers cannot play over standby.
   */
  async returnToMainMenuFromRun(): Promise<void> {
    this.pendingGameplayMusicFadeInMs = null;
    await this.initialize().catch(() => undefined);
    await this.resume().catch(() => undefined);
    await this.playMusic('MUSIC_MENU');
  }

  private async runPlayMusic(track: MusicTrack): Promise<void> {
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
      (track === 'MUSIC_GAME' || track === 'MUSIC_BOSS' || track === 'MUSIC_WATER');
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
    this.stopFluorescentArcHum();
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
      this.stopRainPitter();
      this.stopRainWindow();
      this.stopOminousRandoms();
    } else if (track === 'MUSIC_GAME' || track === 'MUSIC_WATER') {
      this.startHorrorAmbience(false);
      this.startRainWindow();
      this.startRainPitter();
      this.startOminousRandoms();
    } else if (track === 'MUSIC_BOSS') {
      this.startHorrorAmbience(true);
      this.stopRainPitter();
      this.stopRainWindow();
      this.stopOminousRandoms();
    }
  }

  private startRainWindow(): void {
    if (this.rainWindow) return;
    if (!this.audioContext || !this.isInitialized || this.settings.muted) return;
    const ctx = this.audioContext;

    const dur = 2.4;
    const n = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const ch = buf.getChannelData(0);
    let lp = 0;
    for (let i = 0; i < n; i++) {
      // Slightly smoothed noise (less "static", more "sheet").
      const x = (Math.random() * 2 - 1) * 0.55;
      lp = lp * 0.92 + x * 0.08;
      // Gentle amplitude flutter.
      const t = i / ctx.sampleRate;
      const flutter = 0.82 + 0.18 * Math.sin(t * 2.1) + 0.1 * Math.sin(t * 5.7);
      ch[i] = lp * flutter;
    }

    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const g = ctx.createGain();
    const now = ctx.currentTime;
    const v = 0.016 * this.settings.masterVolume * this.settings.musicVolume;
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(v, now + 1.2);

    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.setValueAtTime(1200, now);
    hp.Q.setValueAtTime(0.7, now);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(2600, now);
    bp.Q.setValueAtTime(0.8, now);
    const lpF = ctx.createBiquadFilter();
    lpF.type = 'lowpass';
    lpF.frequency.setValueAtTime(7200, now);
    lpF.Q.setValueAtTime(0.7, now);

    src.connect(g);
    g.connect(hp);
    hp.connect(bp);
    bp.connect(lpF);
    lpF.connect(ctx.destination);
    src.start(0);
    this.rainWindow = { source: src, gain: g };
  }

  private stopRainWindow(): void {
    if (!this.rainWindow) return;
    try {
      this.rainWindow.source.stop();
    } catch {
      // ignore
    }
    try {
      this.rainWindow.gain.disconnect();
    } catch {
      // ignore
    }
    this.rainWindow = null;
  }

  private startOminousRandoms(): void {
    if (this.omenTimerId !== null) return;
    if (typeof window === 'undefined') return;
    if (!this.audioContext || !this.isInitialized || this.settings.muted) return;

    const scheduleNext = () => {
      // 22–70s, slightly biased long.
      const u = Math.random();
      const sec = 22 + (1 - u * u) * 48;
      this.omenTimerId = window.setTimeout(() => {
        this.omenTimerId = null;
        this.playOminousOneShot();
        scheduleNext();
      }, sec * 1000);
    };
    scheduleNext();
  }

  private stopOminousRandoms(): void {
    if (this.omenTimerId === null) return;
    window.clearTimeout(this.omenTimerId);
    this.omenTimerId = null;
  }

  private playOminousOneShot(): void {
    if (!this.audioContext || this.settings.muted) return;
    // Only during runs.
    if (this.currentMusicTrack !== 'MUSIC_GAME' && this.currentMusicTrack !== 'MUSIC_WATER') return;
    this.ensureAudioContextRunning();
    const ctx = this.audioContext;
    const now = ctx.currentTime;
    const base = 0.11 * this.settings.masterVolume * this.settings.musicVolume;
    if (base <= 0) return;

    const pick = Math.random();
    if (pick < 0.45) {
      // Distant moan (subtle).
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(48 + Math.random() * 10, now);
      o.frequency.exponentialRampToValueAtTime(34 + Math.random() * 6, now + 1.6);
      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(base * 0.14, now + 0.6);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 2.2);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(320, now);
      o.connect(g);
      g.connect(lp);
      lp.connect(ctx.destination);
      o.start(now);
      o.stop(now + 2.3);
    } else if (pick < 0.78) {
      // Scrape/creak.
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(120 + Math.random() * 30, now);
      o.frequency.exponentialRampToValueAtTime(60 + Math.random() * 20, now + 0.7);
      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(base * 0.1, now + 0.04);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.85);
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(520 + Math.random() * 220, now);
      bp.Q.setValueAtTime(1.8, now);
      o.connect(g);
      g.connect(bp);
      bp.connect(ctx.destination);
      o.start(now);
      o.stop(now + 0.9);
    } else {
      // Whispery breath (noise).
      const len = Math.floor(ctx.sampleRate * 0.6);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const ch = buf.getChannelData(0);
      for (let i = 0; i < len; i++) {
        const t = i / len;
        const env = Math.sin(Math.PI * t) * Math.exp(-0.9 * t);
        ch[i] = (Math.random() * 2 - 1) * env;
      }
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(base * 0.06, now + 0.06);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.75);
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(1400 + Math.random() * 500, now);
      bp.Q.setValueAtTime(2.2, now);
      src.connect(g);
      g.connect(bp);
      bp.connect(ctx.destination);
      src.start(now);
      src.stop(now + 0.8);
    }
  }

  private startRainPitter(): void {
    if (this.rainPitterIntervalId !== null) return;
    if (!this.audioContext || !this.isInitialized || this.settings.muted) return;
    const ctx = this.audioContext;

    const tick = () => {
      if (!this.audioContext || this.settings.muted) return;
      if (this.currentMusicTrack !== 'MUSIC_GAME' && this.currentMusicTrack !== 'MUSIC_WATER') return;
      // Light window taps over the rain bed.
      if (Math.random() > 0.62) return;

      const now = ctx.currentTime;
      const v = 0.018 * this.settings.masterVolume * this.settings.musicVolume;
      if (v <= 0) return;

      const len = Math.floor(ctx.sampleRate * 0.022);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const ch = buf.getChannelData(0);
      for (let i = 0; i < len; i++) {
        const t = i / len;
        const env = Math.exp(-14 * t);
        ch[i] = (Math.random() * 2 - 1) * env;
      }
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(v * (0.7 + Math.random() * 0.6), now + 0.002);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.03);
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(3600 + Math.random() * 2600, now);
      bp.Q.setValueAtTime(9 + Math.random() * 4, now);
      src.connect(g);
      g.connect(bp);
      bp.connect(ctx.destination);
      src.start(now);
      src.stop(now + 0.035);
    };

    this.rainPitterIntervalId = window.setInterval(tick, 110);
  }

  private stopRainPitter(): void {
    if (this.rainPitterIntervalId === null) return;
    window.clearInterval(this.rainPitterIntervalId);
    this.rainPitterIntervalId = null;
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
    this.stopRainPitter();
    this.stopRainWindow();
    this.stopOminousRandoms();
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
      (track !== 'MUSIC_GAME' && track !== 'MUSIC_BOSS' && track !== 'MUSIC_WATER')
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
      this.playBuffer(buffer, v * SFX_BUFFER_LEVEL, 1);
    } else {
      this.playFallbackSound('SFX_ENEMY_SKITTER', scale * 0.85);
    }
  }

  /** Base gain for scripted boss intro stingers (synth). */
  private bossIntroSfxVol(mult = 1): number {
    if (!this.isInitialized || this.settings.muted) return 0;
    return (
      mult *
      this.settings.sfxVolume *
      this.settings.masterVolume *
      SFX_SYNTH_LEVEL *
      SFX_SYNTH_PERCEIVED_BOOST
    );
  }

  /** Sector 12 — silk, weight, growl, chitter, roar, exhale. */
  playBossIntroBroodmotherCue(cue: number): void {
    if (!this.audioContext || !this.isInitialized || this.settings.muted) return;
    this.ensureAudioContextRunning();
    const ctx = this.audioContext;
    const now = ctx.currentTime;
    const v = this.bossIntroSfxVol(1);
    if (v <= 0) return;

    switch (cue) {
      case 0:
        this.playWebTense(v * 0.58);
        break;
      case 1: {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(58, now);
        o.frequency.exponentialRampToValueAtTime(38, now + 0.11);
        g.gain.setValueAtTime(0.0001, now);
        g.gain.linearRampToValueAtTime(v * 0.95, now + 0.014);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);
        o.connect(g);
        g.connect(ctx.destination);
        o.start(now);
        o.stop(now + 0.22);
        break;
      }
      case 2: {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(92, now);
        o.frequency.exponentialRampToValueAtTime(48, now + 0.38);
        g.gain.setValueAtTime(0.0001, now);
        g.gain.linearRampToValueAtTime(v * 0.42, now + 0.04);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.setValueAtTime(420, now);
        bp.Q.setValueAtTime(1.8, now);
        o.connect(g);
        g.connect(bp);
        bp.connect(ctx.destination);
        o.start(now);
        o.stop(now + 0.48);
        break;
      }
      case 3: {
        for (let k = 0; k < 3; k++) {
          const t0 = now + k * 0.055;
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.type = 'triangle';
          o.frequency.setValueAtTime(260 + Math.random() * 80, t0);
          o.frequency.exponentialRampToValueAtTime(110, t0 + 0.04);
          g.gain.setValueAtTime(0.0001, t0);
          g.gain.linearRampToValueAtTime(v * 0.2, t0 + 0.002);
          g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.06);
          o.connect(g);
          g.connect(ctx.destination);
          o.start(t0);
          o.stop(t0 + 0.07);
        }
        break;
      }
      case 4: {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(78, now);
        o.frequency.linearRampToValueAtTime(52, now + 0.18);
        o.frequency.linearRampToValueAtTime(105, now + 0.42);
        o.frequency.exponentialRampToValueAtTime(36, now + 0.88);
        g.gain.setValueAtTime(0.0001, now);
        g.gain.linearRampToValueAtTime(v * 1.85, now + 0.05);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 0.95);
        const pk = ctx.createBiquadFilter();
        pk.type = 'peaking';
        pk.frequency.setValueAtTime(340, now);
        pk.Q.setValueAtTime(0.9, now);
        pk.gain.setValueAtTime(7, now);
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.setValueAtTime(2800, now);
        o.connect(g);
        g.connect(pk);
        pk.connect(lp);
        lp.connect(ctx.destination);
        o.start(now);
        o.stop(now + 1);
        break;
      }
      case 5: {
        const len = Math.floor(ctx.sampleRate * 0.2);
        const buf = ctx.createBuffer(1, len, ctx.sampleRate);
        const ch = buf.getChannelData(0);
        for (let i = 0; i < len; i++) {
          const t = i / len;
          const e = Math.pow(1 - t, 1.6);
          ch[i] = (Math.random() * 2 - 1) * e * 0.85;
        }
        const n = ctx.createBufferSource();
        n.buffer = buf;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, now);
        g.gain.linearRampToValueAtTime(v * 0.38, now + 0.06);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);
        const hp = ctx.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.setValueAtTime(900, now);
        n.connect(g);
        g.connect(hp);
        hp.connect(ctx.destination);
        n.start(now);
        n.stop(now + 0.22);
        break;
      }
      default:
        break;
    }
  }

  /** Finale — pressure, bubbles, scrape, moan, surge, tail ping. */
  playBossIntroMatriarchCue(cue: number): void {
    if (!this.audioContext || !this.isInitialized || this.settings.muted) return;
    this.ensureAudioContextRunning();
    const ctx = this.audioContext;
    const now = ctx.currentTime;
    const v = this.bossIntroSfxVol(1);
    if (v <= 0) return;

    switch (cue) {
      case 0: {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(28, now);
        o.frequency.exponentialRampToValueAtTime(44, now + 0.55);
        g.gain.setValueAtTime(0.0001, now);
        g.gain.linearRampToValueAtTime(v * 0.72, now + 0.35);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 0.75);
        o.connect(g);
        g.connect(ctx.destination);
        o.start(now);
        o.stop(now + 0.8);
        const ping = ctx.createOscillator();
        const pg = ctx.createGain();
        ping.type = 'sine';
        ping.frequency.setValueAtTime(880, now + 0.42);
        ping.frequency.exponentialRampToValueAtTime(320, now + 0.52);
        pg.gain.setValueAtTime(0.0001, now + 0.4);
        pg.gain.linearRampToValueAtTime(v * 0.12, now + 0.43);
        pg.gain.exponentialRampToValueAtTime(0.0001, now + 0.58);
        ping.connect(pg);
        pg.connect(ctx.destination);
        ping.start(now + 0.4);
        ping.stop(now + 0.62);
        break;
      }
      case 1: {
        const len = Math.floor(ctx.sampleRate * 0.24);
        const buf = ctx.createBuffer(1, len, ctx.sampleRate);
        const ch = buf.getChannelData(0);
        for (let i = 0; i < len; i++) {
          const t = i / len;
          const e = Math.sin(Math.PI * t) * Math.exp(-2.2 * t);
          ch[i] = (Math.random() * 2 - 1) * e * 0.9;
        }
        const n = ctx.createBufferSource();
        n.buffer = buf;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, now);
        g.gain.linearRampToValueAtTime(v * 0.48, now + 0.04);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 0.26);
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.setValueAtTime(720, now);
        bp.Q.setValueAtTime(3.2, now);
        n.connect(g);
        g.connect(bp);
        bp.connect(ctx.destination);
        n.start(now);
        n.stop(now + 0.28);
        break;
      }
      case 2: {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(195, now);
        o.frequency.exponentialRampToValueAtTime(48, now + 0.32);
        g.gain.setValueAtTime(0.0001, now);
        g.gain.linearRampToValueAtTime(v * 0.35, now + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 0.38);
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.setValueAtTime(380, now);
        bp.Q.setValueAtTime(2.4, now);
        o.connect(g);
        g.connect(bp);
        bp.connect(ctx.destination);
        o.start(now);
        o.stop(now + 0.42);
        break;
      }
      case 3: {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'triangle';
        o.frequency.setValueAtTime(118, now);
        o.frequency.exponentialRampToValueAtTime(42, now + 0.62);
        g.gain.setValueAtTime(0.0001, now);
        g.gain.linearRampToValueAtTime(v * 0.52, now + 0.08);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 0.78);
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.setValueAtTime(520, now);
        o.connect(g);
        g.connect(lp);
        lp.connect(ctx.destination);
        o.start(now);
        o.stop(now + 0.82);
        break;
      }
      case 4: {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(52, now);
        o.frequency.exponentialRampToValueAtTime(38, now + 0.22);
        o.frequency.linearRampToValueAtTime(92, now + 0.48);
        o.frequency.exponentialRampToValueAtTime(28, now + 1.05);
        g.gain.setValueAtTime(0.0001, now);
        g.gain.linearRampToValueAtTime(v * 2.05, now + 0.08);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 1.12);
        const pk = ctx.createBiquadFilter();
        pk.type = 'peaking';
        pk.frequency.setValueAtTime(260, now);
        pk.Q.setValueAtTime(0.85, now);
        pk.gain.setValueAtTime(8, now);
        const len = Math.floor(ctx.sampleRate * 0.45);
        const buf = ctx.createBuffer(1, len, ctx.sampleRate);
        const ch = buf.getChannelData(0);
        for (let i = 0; i < len; i++) {
          const t = i / len;
          const e = Math.pow(Math.sin(Math.PI * t), 0.5) * Math.exp(-1.8 * t);
          ch[i] = (Math.random() * 2 - 1) * e;
        }
        const n = ctx.createBufferSource();
        n.buffer = buf;
        const ng = ctx.createGain();
        ng.gain.setValueAtTime(0.0001, now + 0.05);
        ng.gain.linearRampToValueAtTime(v * 0.55, now + 0.12);
        ng.gain.exponentialRampToValueAtTime(0.0001, now + 0.48);
        const hp = ctx.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.setValueAtTime(1400, now);
        const hs = ctx.createBiquadFilter();
        hs.type = 'highshelf';
        hs.frequency.setValueAtTime(2400, now);
        hs.gain.setValueAtTime(4, now);
        o.connect(g);
        g.connect(pk);
        pk.connect(ctx.destination);
        n.connect(ng);
        ng.connect(hp);
        hp.connect(hs);
        hs.connect(ctx.destination);
        o.start(now);
        n.start(now);
        o.stop(now + 1.15);
        n.stop(now + 0.52);
        break;
      }
      case 5: {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(1240, now);
        o.frequency.exponentialRampToValueAtTime(180, now + 0.35);
        g.gain.setValueAtTime(0.0001, now);
        g.gain.linearRampToValueAtTime(v * 0.22, now + 0.008);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.setValueAtTime(900, now);
        bp.Q.setValueAtTime(4, now);
        o.connect(g);
        g.connect(bp);
        bp.connect(ctx.destination);
        o.start(now);
        o.stop(now + 0.45);
        break;
      }
      default:
        break;
    }
  }

  /** Short 8-bit terminal tick for sector-0 story captions. */
  playSector0IntroTextBlip(): void {
    if (!this.audioContext || !this.isInitialized || this.settings.muted) return;
    this.ensureAudioContextRunning();
    const ctx = this.audioContext;
    const now = ctx.currentTime;
    const v = this.bossIntroSfxVol(0.55);
    if (v <= 0) return;

    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'square';
    o.frequency.setValueAtTime(165 + Math.random() * 48, now);
    o.frequency.exponentialRampToValueAtTime(82, now + 0.038);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(v * 0.95, now + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.055);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(1800, now);
    lp.frequency.exponentialRampToValueAtTime(520, now + 0.045);
    o.connect(g);
    g.connect(lp);
    lp.connect(ctx.destination);
    o.start(now);
    o.stop(now + 0.07);
  }

  /** Tiny scared whimper loop for sector-0 opener (synth). */
  playSector0IntroScaredWhimper(): void {
    if (!this.audioContext || !this.isInitialized || this.settings.muted) return;
    this.ensureAudioContextRunning();
    const ctx = this.audioContext;
    const now = ctx.currentTime;
    const v = this.bossIntroSfxVol(0.62);
    if (v <= 0) return;

    const f0 = 240 + Math.random() * 50;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(f0, now);
    o.frequency.exponentialRampToValueAtTime(155, now + 0.05);
    o.frequency.linearRampToValueAtTime(168, now + 0.12);
    o.frequency.exponentialRampToValueAtTime(110, now + 0.24);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(v * 0.72, now + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(380, now);
    bp.Q.setValueAtTime(1.2, now);
    o.connect(g);
    g.connect(bp);
    bp.connect(ctx.destination);
    o.start(now);
    o.stop(now + 0.32);
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
