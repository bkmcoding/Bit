/**
 * Video / performance preferences (localStorage). Audio stays on AudioManager.
 */
export type ClientGraphicsSettings = {
  /** When true, frame pacing never runs faster than 60 FPS (saves GPU on high-Hz panels). */
  fpsLimitEnabled: boolean;
  /** When true, skip WebGL post and use the 2D buffer + CPU overlay path. */
  lowQualityMode: boolean;
};

const STORAGE_KEY = 'bit_client_graphics_v1';

export const DEFAULT_CLIENT_GRAPHICS: ClientGraphicsSettings = {
  fpsLimitEnabled: false,
  lowQualityMode: false,
};

export function loadClientGraphicsSettings(): ClientGraphicsSettings {
  if (typeof window === 'undefined') return { ...DEFAULT_CLIENT_GRAPHICS };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_CLIENT_GRAPHICS };
    const p = JSON.parse(raw) as Record<string, unknown>;
    return {
      fpsLimitEnabled:
        typeof p.fpsLimitEnabled === 'boolean' ? p.fpsLimitEnabled : DEFAULT_CLIENT_GRAPHICS.fpsLimitEnabled,
      lowQualityMode:
        typeof p.lowQualityMode === 'boolean' ? p.lowQualityMode : DEFAULT_CLIENT_GRAPHICS.lowQualityMode,
    };
  } catch {
    return { ...DEFAULT_CLIENT_GRAPHICS };
  }
}

export function saveClientGraphicsSettings(s: ClientGraphicsSettings): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}
