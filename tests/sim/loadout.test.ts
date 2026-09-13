import { describe, expect, it } from 'vitest';
import { createDefaultState } from '../../src/sim/state';
import {
  canEquipUpgrade,
  MAX_ENHANCEMENT_SLOTS,
  MAX_SKILL_SLOTS,
  recalculatePlayerBuild,
} from '../../src/sim/loadout';
import {
  ENHANCEMENT_IDS,
  getUpgradeMaxLevel,
  SKILL_IDS,
} from '../../src/sim/upgradeCatalog';
import { applyInsight, createUpgradeChoices } from '../../src/sim/upgrades';

describe('split skill and enhancement loadout', () => {
  it('defines fifteen skills at level six and ten enhancements at level four', () => {
    expect(SKILL_IDS).toHaveLength(15);
    expect(ENHANCEMENT_IDS).toHaveLength(10);
    expect(new Set([...SKILL_IDS, ...ENHANCEMENT_IDS])).toHaveLength(25);
    expect(getUpgradeMaxLevel('thunder-ring')).toBe(6);
    expect(getUpgradeMaxLevel('faster-swords')).toBe(4);
  });

  it('enforces five skill slots and six enhancement slots independently', () => {
    const state = createDefaultState();
    state.player.equippedSkills = SKILL_IDS.slice(0, MAX_SKILL_SLOTS);
    state.player.equippedEnhancements = ENHANCEMENT_IDS.slice(0, MAX_ENHANCEMENT_SLOTS);

    expect(canEquipUpgrade(state.player, SKILL_IDS[MAX_SKILL_SLOTS])).toBe(false);
    expect(canEquipUpgrade(state.player, ENHANCEMENT_IDS[MAX_ENHANCEMENT_SLOTS])).toBe(false);
    expect(canEquipUpgrade(state.player, state.player.equippedSkills[0])).toBe(true);
    expect(canEquipUpgrade(state.player, state.player.equippedEnhancements[0])).toBe(true);
  });

  it('removes derived bonuses after an enhancement leaves the loadout', () => {
    const state = createDefaultState();
    state.player.equippedEnhancements = ['swift-steps'];
    state.player.upgradeLevels['swift-steps'] = 4;
    recalculatePlayerBuild(state.player);
    expect(state.player.speed).toBeGreaterThan(245);

    state.player.equippedEnhancements = [];
    state.player.upgradeLevels['swift-steps'] = 0;
    recalculatePlayerBuild(state.player);

    expect(state.player.speed).toBe(245);
    expect(state.player.dodgeChance).toBe(0);
  });

  it('turns life-drain into chance-based small healing that grows by level', () => {
    const state = createDefaultState();
    state.player.equippedEnhancements = ['life-drain'];
    const expected = [
      { level: 1, healing: 2, chance: 0.18 },
      { level: 2, healing: 2, chance: 0.27 },
      { level: 3, healing: 3, chance: 0.36 },
      { level: 4, healing: 4, chance: 0.45 },
    ];

    for (const tier of expected) {
      state.player.upgradeLevels['life-drain'] = tier.level;
      recalculatePlayerBuild(state.player);
      expect(state.player.lifeOnKill).toBe(tier.healing);
      expect(state.player.lifeOnKillChance).toBeCloseTo(tier.chance);
    }
  });

  it('keeps transient combat progress while rebuilding attributes', () => {
    const state = createDefaultState();
    state.player.hp = 37;
    state.player.attackTimerMs = 410;
    state.player.experience = 5;
    state.player.equippedEnhancements = ['heavier-swords'];
    state.player.upgradeLevels['heavier-swords'] = 2;

    recalculatePlayerBuild(state.player);

    expect(state.player.hp).toBe(37);
    expect(state.player.attackTimerMs).toBe(410);
    expect(state.player.experience).toBe(5);
    expect(state.player.attackDamage).toBe(34);
  });

  it('offers repeatable insight choices only after both rows are complete', () => {
    const state = createDefaultState();
    state.player.equippedSkills = SKILL_IDS.slice(0, MAX_SKILL_SLOTS);
    state.player.equippedEnhancements = ENHANCEMENT_IDS.slice(0, MAX_ENHANCEMENT_SLOTS);
    for (const id of state.player.equippedSkills) state.player.upgradeLevels[id] = 6;
    for (const id of state.player.equippedEnhancements) state.player.upgradeLevels[id] = 4;

    const choices = createUpgradeChoices(state);

    expect(choices).toHaveLength(3);
    expect(choices.every((choice) => choice.startsWith('insight:'))).toBe(true);
    const oldDamage = state.player.attackDamage;
    applyInsight(state, 'insight:damage');
    expect(state.player.attackDamage).toBeGreaterThan(oldDamage);
  });
});
