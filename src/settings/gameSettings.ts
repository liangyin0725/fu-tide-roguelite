export type AimMode = 'auto' | 'manual';
export type GameSpeed = 0.75 | 1 | 1.25;
export type EffectLevel = 'low' | 'medium' | 'high';

export interface GameSettings {
  version: 1;
  aimMode: AimMode;
  gameSpeed: GameSpeed;
  musicVolume: number;
  soundVolume: number;
  screenShake: boolean;
  damageNumbers: boolean;
  effectLevel: EffectLevel;
  joystickOpacity: EffectLevel;
  betaModeUnlocked: boolean;
}

export const SETTINGS_STORAGE_KEY = 'fu-tide-settings-v1';

export const DEFAULT_GAME_SETTINGS: GameSettings = {
  version: 1,
  aimMode: 'auto',
  gameSpeed: 1,
  musicVolume: 0.7,
  soundVolume: 0.8,
  screenShake: true,
  damageNumbers: true,
  effectLevel: 'high',
  joystickOpacity: 'medium',
  betaModeUnlocked: false,
};

export function loadGameSettings(storage: Storage): GameSettings {
  const raw = storage.getItem(SETTINGS_STORAGE_KEY);
  if (!raw) {
    return { ...DEFAULT_GAME_SETTINGS };
  }

  try {
    const value = JSON.parse(raw) as Partial<GameSettings>;
    const migrated = { ...value, betaModeUnlocked: value.betaModeUnlocked ?? false };
    if (!isValidSettings(migrated)) {
      return { ...DEFAULT_GAME_SETTINGS };
    }
    return {
      ...migrated,
      musicVolume: clampVolume(migrated.musicVolume),
      soundVolume: clampVolume(migrated.soundVolume),
    };
  } catch {
    return { ...DEFAULT_GAME_SETTINGS };
  }
}

export function saveGameSettings(storage: Storage, settings: GameSettings): void {
  storage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
}

export function scaleSimulationDelta(deltaMs: number, speed: GameSpeed): number {
  return deltaMs * speed;
}

function isValidSettings(value: Partial<GameSettings>): value is GameSettings {
  return value.version === 1
    && (value.aimMode === 'auto' || value.aimMode === 'manual')
    && (value.gameSpeed === 0.75 || value.gameSpeed === 1 || value.gameSpeed === 1.25)
    && typeof value.musicVolume === 'number'
    && Number.isFinite(value.musicVolume)
    && typeof value.soundVolume === 'number'
    && Number.isFinite(value.soundVolume)
    && typeof value.screenShake === 'boolean'
    && typeof value.damageNumbers === 'boolean'
    && isEffectLevel(value.effectLevel)
    && isEffectLevel(value.joystickOpacity)
    && typeof value.betaModeUnlocked === 'boolean';
}

function isEffectLevel(value: unknown): value is EffectLevel {
  return value === 'low' || value === 'medium' || value === 'high';
}

function clampVolume(value: number): number {
  return Math.max(0, Math.min(1, value));
}
