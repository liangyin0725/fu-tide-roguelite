import { describe, expect, it } from 'vitest';
import {
  DEFAULT_GAME_SETTINGS,
  loadGameSettings,
  saveGameSettings,
  scaleSimulationDelta,
} from '../../src/settings/gameSettings';

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  public get length(): number {
    return this.values.size;
  }

  public clear(): void {
    this.values.clear();
  }

  public getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  public key(index: number): string | null {
    return [...this.values.keys()][index] ?? null;
  }

  public removeItem(key: string): void {
    this.values.delete(key);
  }

  public setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

describe('game settings', () => {
  it('round-trips validated settings', () => {
    const storage = new MemoryStorage();
    const settings = {
      ...DEFAULT_GAME_SETTINGS,
      gameSpeed: 1.25 as const,
      aimMode: 'manual' as const,
    };

    saveGameSettings(storage, settings);

    expect(loadGameSettings(storage)).toEqual(settings);
  });

  it('falls back to defaults for corrupt or invalid data', () => {
    const storage = new MemoryStorage();
    storage.setItem('fu-tide-settings-v1', '{broken');
    expect(loadGameSettings(storage)).toEqual(DEFAULT_GAME_SETTINGS);

    storage.setItem('fu-tide-settings-v1', JSON.stringify({ ...DEFAULT_GAME_SETTINGS, gameSpeed: 4 }));
    expect(loadGameSettings(storage)).toEqual(DEFAULT_GAME_SETTINGS);
  });

  it('clamps persisted volume values', () => {
    const storage = new MemoryStorage();
    storage.setItem('fu-tide-settings-v1', JSON.stringify({
      ...DEFAULT_GAME_SETTINGS,
      musicVolume: 2,
      soundVolume: -1,
    }));

    expect(loadGameSettings(storage)).toMatchObject({ musicVolume: 1, soundVolume: 0 });
  });

  it('migrates saved settings from before beta mode without resetting preferences', () => {
    const storage = new MemoryStorage();
    const { betaModeUnlocked: _ignored, ...legacy } = DEFAULT_GAME_SETTINGS;
    storage.setItem('fu-tide-settings-v1', JSON.stringify({ ...legacy, aimMode: 'manual', musicVolume: 0.35 }));

    expect(loadGameSettings(storage)).toMatchObject({
      aimMode: 'manual',
      musicVolume: 0.35,
      betaModeUnlocked: false,
    });
  });

  it('scales simulation time for every supported speed', () => {
    expect(scaleSimulationDelta(40, 0.75)).toBe(30);
    expect(scaleSimulationDelta(40, 1)).toBe(40);
    expect(scaleSimulationDelta(40, 1.25)).toBe(50);
  });
});
