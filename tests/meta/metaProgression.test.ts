import { beforeEach, describe, expect, it } from 'vitest';
import {
  loadMetaProgression,
  toggleRelic,
  tryForgeRelic,
  tryUnlockTalent,
  unlockCharacter,
} from '../../src/meta/metaProgression';

describe('meta progression', () => {
  const storage = new MemoryStorage();

  beforeEach(() => {
    storage.clear();
  });

  it('falls back to a zero-balance progression for invalid storage', () => {
    storage.setItem('fu-tide-dongfu-v1', '{broken');

    expect(loadMetaProgression(storage)).toMatchObject({
      version: 3,
      daoYun: 0,
      spiritOre: 0,
      relicForgeRanks: {},
      unlockedTalentIds: [],
      unlockedPathNodeIds: [],
      unlockedRelicIds: [],
      equippedRelicIds: [],
      unlockedCharacterIds: [],
    });
  });

  it('requires the previous talent and pays its fixed cost once', () => {
    const first = tryUnlockTalent(
      { version: 3, daoYun: 3, spiritOre: 0, relicForgeRanks: {}, unlockedTalentIds: [], unlockedPathNodeIds: [], unlockedRelicIds: [], equippedRelicIds: [], unlockedCharacterIds: [] },
      'xuan-jian:sword-intent',
    );

    expect(first).toEqual({
      unlocked: true,
      progression: {
        version: 3,
        daoYun: 2,
        spiritOre: 0,
        relicForgeRanks: {},
        unlockedTalentIds: ['xuan-jian:sword-intent'],
        unlockedPathNodeIds: [],
        unlockedRelicIds: [],
        equippedRelicIds: [],
        unlockedCharacterIds: [],
      },
    });

    const second = tryUnlockTalent(first.progression, 'xuan-jian:swift-sword');
    expect(second.unlocked).toBe(true);
    expect(tryUnlockTalent(second.progression, 'xuan-jian:sword-intent').progression.daoYun).toBe(0);
  });

  it('persists the hidden character unlock once and migrates older version-two saves', () => {
    storage.setItem('fu-tide-dongfu-v1', JSON.stringify({
      version: 2,
      daoYun: 2,
      unlockedTalentIds: [],
      unlockedPathNodeIds: [],
      unlockedRelicIds: [],
      equippedRelicIds: [],
    }));

    const migrated = loadMetaProgression(storage);
    expect(migrated.unlockedCharacterIds).toEqual([]);
    const unlocked = unlockCharacter(migrated, 'jing-po');
    expect(unlocked.unlockedCharacterIds).toEqual(['jing-po']);
    expect(unlockCharacter(unlocked, 'jing-po')).toBe(unlocked);
  });

  it('migrates existing talent data and lets a completed route equip its character relic', () => {
    storage.setItem('fu-tide-dongfu-v1', JSON.stringify({
      version: 1,
      daoYun: 8,
      unlockedTalentIds: ['xuan-jian:sword-intent', 'xuan-jian:swift-sword', 'xuan-jian:breach-edge'],
    }));
    const migrated = loadMetaProgression(storage);
    const relic = tryUnlockTalent(migrated, 'xuan-jian:star-forged-edge');

    expect(relic.unlocked).toBe(true);
    expect(relic.progression.unlockedRelicIds).toEqual(['xuan-jian:star-forged-edge']);
    expect(toggleRelic(relic.progression, 'xuan-jian:star-forged-edge').equippedRelicIds)
      .toEqual(['xuan-jian:star-forged-edge']);
  });

  it('spends spirit ore to forge an equipped relic through its three ranks', () => {
    const progression: import('../../src/sim/types').MetaProgression = {
      version: 3 as const,
      daoYun: 0,
      spiritOre: 13,
      relicForgeRanks: {},
      unlockedTalentIds: [],
      unlockedPathNodeIds: [],
      unlockedRelicIds: ['xuan-jian:star-forged-edge'],
      equippedRelicIds: ['xuan-jian:star-forged-edge'],
      unlockedCharacterIds: [],
    };

    const first = tryForgeRelic(progression, 'xuan-jian:star-forged-edge');
    const second = tryForgeRelic(first.progression, 'xuan-jian:star-forged-edge');
    const third = tryForgeRelic(second.progression, 'xuan-jian:star-forged-edge');

    expect(first.forged).toBe(true);
    expect(third.progression).toMatchObject({ spiritOre: 0, relicForgeRanks: { 'xuan-jian:star-forged-edge': 3 } });
    expect(tryForgeRelic(third.progression, 'xuan-jian:star-forged-edge').forged).toBe(false);
  });
});

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
