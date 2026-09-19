import { describe, expect, it } from 'vitest';
import { getAwakeningRequirement, isUpgradeAwakened } from '../../src/sim/awakening';
import { createDefaultState } from '../../src/sim/state';
import { applyUpgrade } from '../../src/sim/upgrades';

describe('skill awakenings', () => {
  it.each([
    'meteor-seal',
    'spirit-sword-rain',
    'rift-return',
    'solar-ray',
  ] as const)('awakens %s at level six without a matching enhancement', (skill) => {
    const state = createDefaultState();
    let result;

    for (let level = 0; level < 6; level += 1) result = applyUpgrade(state, skill);

    expect(result).toEqual({ previousLevel: 5, level: 6, awakened: true });
    expect(isUpgradeAwakened(state.player, skill)).toBe(true);
  });

  it.each([
    'meteor-seal',
    'spirit-sword-rain',
    'rift-return',
    'solar-ray',
  ] as const)('does not advertise a matching enhancement requirement for %s', (skill) => {
    expect(getAwakeningRequirement(skill)).toBeNull();
  });
});
