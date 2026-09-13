import { describe, expect, it } from 'vitest';
import { createDefaultState } from '../../src/sim/state';
import { applyUpgrade } from '../../src/sim/upgrades';
import { SKILL_IDS } from '../../src/sim/upgradeCatalog';
import { getAwakeningRequirement, isUpgradeAwakened } from '../../src/sim/awakening';

describe('six-level skill progression', () => {
  it('increases every skill at levels one through five and awakens only at six', () => {
    for (const skill of SKILL_IDS) {
      const state = createDefaultState();
      const results = Array.from({ length: 7 }, () => applyUpgrade(state, skill));

      expect(results.slice(0, 5).every((result) => !result.awakened), skill).toBe(true);
      const requirement = getAwakeningRequirement(skill);
      expect(results[5], skill).toEqual({ previousLevel: 5, level: 6, awakened: requirement === null });
      if (requirement) {
        applyUpgrade(state, requirement);
        expect(isUpgradeAwakened(state.player, skill), skill).toBe(true);
      }
      expect(results[6], skill).toEqual({ previousLevel: 6, level: 6, awakened: false });
    }
  });

  it('gives representative skills a real level-five increase before awakening', () => {
    const state = createDefaultState();
    for (let level = 0; level < 4; level += 1) applyUpgrade(state, 'thunder-ring');
    const levelFourRadius = state.player.thunderRadius;
    applyUpgrade(state, 'thunder-ring');
    expect(state.player.thunderRadius).toBeGreaterThan(levelFourRadius);

    for (let level = 0; level < 5; level += 1) applyUpgrade(state, 'meteor-seal');
    expect(state.player.meteorCooldownMs).toBe(4200);
    expect(state.player.meteorDamage).toBe(85);
    applyUpgrade(state, 'boss-slayer');
    applyUpgrade(state, 'meteor-seal');
    expect(state.player).toMatchObject({ meteorCooldownMs: 3600, meteorCount: 3, meteorDamage: 105 });
  });

  it('raises thunder ring damage at every level and gives awakening a decisive jump', () => {
    const state = createDefaultState();
    const damages: number[] = [];

    for (let level = 0; level < 6; level += 1) {
      applyUpgrade(state, 'thunder-ring');
      damages.push(state.player.thunderDamagePerSecond);
    }

    expect(damages).toEqual([18, 22, 26, 30, 34, 50]);
  });

  it('keeps enhancements on their four-level awakening path', () => {
    const state = createDefaultState();
    const results = Array.from({ length: 5 }, () => applyUpgrade(state, 'heavier-swords'));

    expect(results[3]).toEqual({ previousLevel: 3, level: 4, awakened: true });
    expect(results[4]).toEqual({ previousLevel: 4, level: 4, awakened: false });
  });
});
