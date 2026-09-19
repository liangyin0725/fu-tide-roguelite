import { describe, expect, it } from 'vitest';
import { isUpgradeAwakened } from '../../src/sim/awakening';
import { GameSimulation } from '../../src/sim/GameSimulation';
import { createDefaultState } from '../../src/sim/state';
import { applyUpgrade } from '../../src/sim/upgrades';

describe('resonant awakenings', () => {
  it('keeps meteor seal at its level-five form until its matching enhancement is equipped', () => {
    const state = createDefaultState();
    let result;

    for (let level = 0; level < 6; level += 1) result = applyUpgrade(state, 'meteor-seal');

    expect(result?.awakened).toBe(false);
    expect(isUpgradeAwakened(state.player, 'meteor-seal')).toBe(false);
    expect(state.player).toMatchObject({ meteorCooldownMs: 4200, meteorCount: 1, meteorDamage: 85 });

    applyUpgrade(state, 'boss-slayer');

    expect(isUpgradeAwakened(state.player, 'meteor-seal')).toBe(true);
    expect(state.player).toMatchObject({ meteorCooldownMs: 3600, meteorCount: 3, meteorDamage: 105 });
  });

  it.each([
    ['spirit-sword-rain', 'multi-swords'],
    ['rift-return', 'piercing-swords'],
    ['solar-ray', 'faster-swords'],
  ] as const)('requires %s to pair with %s before it awakens', (skill, enhancement) => {
    const state = createDefaultState();
    for (let level = 0; level < 6; level += 1) applyUpgrade(state, skill);

    expect(isUpgradeAwakened(state.player, skill)).toBe(false);
    applyUpgrade(state, enhancement);
    expect(isUpgradeAwakened(state.player, skill)).toBe(true);
  });

  it('plays the deferred awakening when a treasure supplies the matching enhancement', () => {
    const state = createDefaultState();
    for (let level = 0; level < 6; level += 1) applyUpgrade(state, 'meteor-seal');
    state.phase = 'treasure';
    state.treasureChoices = ['boss-slayer'];
    const sim = new GameSimulation(state);

    sim.chooseTreasure('boss-slayer');

    expect(state.phase).toBe('awakening');
    expect(state.awakeningNotice?.upgrade).toBe('meteor-seal');
  });
});
