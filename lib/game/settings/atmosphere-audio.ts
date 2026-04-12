/**
 * Universal atmosphere audio — edit this file in the repo; values are not exposed in-game.
 * Master volume and mute (main menu) still apply on top at runtime.
 * Add MP3s under `public/audio/ambience/` and `public/audio/sfx/` per `public/audio/README.txt`.
 */
export interface AtmosphereAudioSettings {
  /** 0–1. Looping white-noise / static bed during gameplay & boss. */
  whiteNoiseVolume: number;
  /** 0–1. Looping cave / drip bed (layers with white noise). */
  caveVolume: number;
  /** Proximity chitin / leg one-shots when enemies move near the player. */
  enemySkitterEnabled: boolean;
  /** 0–1. Scales skitter SFX (with master × SFX volume). */
  enemySkitterVolume: number;
}

export const ATMOSPHERE_AUDIO_SETTINGS: AtmosphereAudioSettings = {
  whiteNoiseVolume: 0,
  caveVolume: 0,
  enemySkitterEnabled: true,
  enemySkitterVolume: 0.55,
};
