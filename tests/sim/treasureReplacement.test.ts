import { describe, expect, it } from 'vitest';
import { GameSimulation } from '../../src/sim/GameSimulation';
import { createDefaultState } from '../../src/sim/state';
import { ENHANCEMENT_IDS, SKILL_IDS } from '../../src/sim/upgradeCatalog';

describe('same-category treasure replacement', () => {
  it('replaces only a skill slot when a new skill is selected', () => {
    const state = createDefaultState();
    state.player.equippedSkills = SKILL_IDS.slice(0, 5);
    state.player.equippedEnhancements = ENHANCEMENT_IDS.slice(0, 3);
    for (const id of [...state.player.equippedSkills, ...state.player.equippedEnhancements]) {
      state.player.upgradeLevels[id] = 1;
    }
    const originalEnhancements = [...state.player.equippedEnhancements];
    const replacement = SKILL_IDS[5];
    const removed = state.player.equippedSkills[1];
    state.phase = 'treasure';
    state.treasureChoices = [replacement];
    const sim = new GameSimulation(state);

    sim.chooseTreasure(replacement);
    expect(state.phase).toBe('treasure-replace');
    sim.confirmTreasureReplacement(1);

    expect(state.player.equippedSkills[1]).toBe(replacement);
    expect(state.player.equippedEnhancements).toEqual(originalEnhancements);
    expect(state.player.upgradeLevels[removed]).toBe(0);
    expect(state.player.upgradeLevels[replacement]).toBe(1);
  });

  it('replaces only an enhancement slot when that row is full', () => {
    const state = createDefaultState();
    state.player.equippedSkills = SKILL_IDS.slice(0, 2);
    state.player.equippedEnhancements = ENHANCEMENT_IDS.slice(0, 6);
    for (const id of [...state.player.equippedSkills, ...state.player.equippedEnhancements]) {
      state.player.upgradeLevels[id] = 1;
    }
    const originalSkills = [...state.player.equippedSkills];
    const replacement = ENHANCEMENT_IDS[6];
    state.phase = 'treasure';
    state.treasureChoices = [replacement];
    const sim = new GameSimulation(state);

    sim.chooseTreasure(replacement);
    sim.confirmTreasureReplacement(4);

    expect(state.player.equippedSkills).toEqual(originalSkills);
    expect(state.player.equippedEnhancements[4]).toBe(replacement);
  });
});
