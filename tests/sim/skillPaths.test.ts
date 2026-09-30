import { describe, expect, it } from 'vitest';
import { GameSimulation } from '../../src/sim/GameSimulation';
import {
  clearSkillPath,
  getSkillPathDefinition,
  hasSkillPath,
  needsSkillPath,
  SKILL_PATHS,
} from '../../src/sim/skillPaths';
import { createDefaultState } from '../../src/sim/state';
import { SKILL_IDS } from '../../src/sim/upgradeCatalog';

describe('skill path catalog', () => {
  it('defines exactly two distinct routes for every skill', () => {
    expect(Object.keys(SKILL_PATHS)).toEqual(SKILL_IDS);

    for (const skill of SKILL_IDS) {
      expect(Object.keys(SKILL_PATHS[skill])).toEqual(['a', 'b']);
      expect(SKILL_PATHS[skill].a.nameZh).not.toBe(SKILL_PATHS[skill].b.nameZh);
      expect(SKILL_PATHS[skill].a.nameEn).not.toBe(SKILL_PATHS[skill].b.nameEn);
      expect(getSkillPathDefinition(skill, 'a')).toBe(SKILL_PATHS[skill].a);
      expect(getSkillPathDefinition(skill, 'b')).toBe(SKILL_PATHS[skill].b);
    }
  });

  it('tracks and clears a selected route only after level three', () => {
    const state = createDefaultState();
    const player = state.player;
    player.upgradeLevels['thunder-ring'] = 2;

    expect(needsSkillPath(player, 'thunder-ring')).toBe(false);
    player.upgradeLevels['thunder-ring'] = 3;
    expect(needsSkillPath(player, 'thunder-ring')).toBe(true);

    player.skillPaths['thunder-ring'] = 'b';
    expect(hasSkillPath(player, 'thunder-ring')).toBe(true);
    expect(hasSkillPath(player, 'thunder-ring', 'a')).toBe(false);
    expect(hasSkillPath(player, 'thunder-ring', 'b')).toBe(true);
    expect(needsSkillPath(player, 'thunder-ring')).toBe(false);

    clearSkillPath(player, 'thunder-ring');
    expect(hasSkillPath(player, 'thunder-ring')).toBe(false);
  });

  it('creates independent empty route maps for both players', () => {
    const state = createDefaultState();
    expect(state.player.skillPaths).toEqual({});

    new GameSimulation(state).enableLocalCoop();

    expect(state.partner?.skillPaths).toEqual({});
    expect(state.partner?.skillPaths).not.toBe(state.player.skillPaths);
  });
});
