import { describe, expect, it } from 'vitest';
import { canLaunchBetaLoadout } from '../../src/testing/betaMode';
import { createDefaultState } from '../../src/sim/state';

describe('beta route validation', () => {
  it('requires routes only for selected skills at level three or above', () => {
    const state = createDefaultState();
    state.betaSkillSelections = ['thunder-ring'];
    state.betaSkillLevels['thunder-ring'] = 2;
    expect(canLaunchBetaLoadout(state)).toBe(true);
    state.betaSkillLevels['thunder-ring'] = 3;
    expect(canLaunchBetaLoadout(state)).toBe(false);
    state.betaSkillPaths['thunder-ring'] = 'b';
    expect(canLaunchBetaLoadout(state)).toBe(true);
    state.betaSkillSelections = [];
    expect(canLaunchBetaLoadout(state)).toBe(false);
  });
});
