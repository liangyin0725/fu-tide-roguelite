import { describe, expect, it } from 'vitest';
import { createDefaultState } from '../../src/sim/state';
import {
  getActiveSynergies,
  getSynergiesActivatedByUpgrade,
  SYNERGY_IDS,
} from '../../src/sim/synergies';

describe('synergy catalog', () => {
  it('defines ten unique two-part synergies', () => {
    expect(SYNERGY_IDS).toHaveLength(10);
    expect(new Set(SYNERGY_IDS)).toHaveLength(10);
  });

  it('activates the new solar, void, frost, and sword-rain combinations', () => {
    const state = createDefaultState();
    state.player.equippedSkills = [
      'solar-ray',
      'void-bell',
      'spirit-sword-rain',
      'frost-seal',
      'golden-shield',
    ];
    for (const skill of state.player.equippedSkills) state.player.upgradeLevels[skill] = 1;

    expect(getActiveSynergies(state.player)).toEqual(expect.arrayContaining([
      'eclipse-sanctum',
      'sunblade-cascade',
      'frozen-knell',
      'gilded-sword-rain',
    ]));
  });

  it('activates a synergy only when both required abilities are equipped', () => {
    const state = createDefaultState();
    state.player.equippedSkills = ['thunder-ring', 'chain-lightning'];
    state.player.upgradeLevels['thunder-ring'] = 1;
    state.player.upgradeLevels['chain-lightning'] = 1;

    expect(getActiveSynergies(state.player)).toContain('thunder-resonance');

    state.player.equippedSkills.pop();
    expect(getActiveSynergies(state.player)).not.toContain('thunder-resonance');
  });

  it('previews the synergy completed by a pending upgrade', () => {
    const state = createDefaultState();
    state.player.equippedSkills = ['fire-burst'];
    state.player.upgradeLevels['fire-burst'] = 1;

    expect(getSynergiesActivatedByUpgrade(state.player, 'frost-seal')).toEqual(['frostfire-calamity']);
    expect(getSynergiesActivatedByUpgrade(state.player, 'north-star')).toEqual([]);
  });
});
