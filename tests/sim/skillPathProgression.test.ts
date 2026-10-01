import { describe, expect, it } from 'vitest';
import { getAwakenedSkills, isUpgradeAwakened } from '../../src/sim/awakening';
import { GameSimulation } from '../../src/sim/GameSimulation';
import type { SkillPathKey } from '../../src/sim/skillPaths';
import { createDefaultState } from '../../src/sim/state';
import { applyUpgrade } from '../../src/sim/upgrades';

describe('skill path progression', () => {
  it('presents P2 route awakening at P2 and resumes the next queued upgrade', () => {
    const state = createDefaultState();
    const sim = new GameSimulation(state);
    sim.enableLocalCoop();
    const p2 = state.partner!;
    p2.equippedSkills = ['thunder-ring'];
    p2.upgradeLevels['thunder-ring'] = 5;
    p2.skillPaths['thunder-ring'] = 'b';
    p2.x += 200;
    state.phase = 'upgrade';
    state.pendingUpgradePlayerId = 'p2';
    state.upgradeChoices = ['thunder-ring'];
    state.coopUpgradeQueue = ['p1'];
    sim.chooseUpgrade('thunder-ring');
    expect(state.phase).toBe('awakening');
    expect(state.awakeningNotice?.awakeningName).toBe('往返游雷');
    expect(sim.consumeEvents()).toContainEqual(expect.objectContaining({ type: 'skill-awakened', x: p2.x, y: p2.y }));
    sim.update(1500, { x: 0, y: 0 });
    expect(state.phase).toBe('upgrade');
    expect(state.pendingUpgradePlayerId).toBe('p1');
  });
  it('offers missing routes before an older configured build enters combat', () => {
    const state = createDefaultState();
    state.player.equippedSkills = ['fire-burst'];
    state.player.upgradeLevels['fire-burst'] = 4;
    const sim = new GameSimulation(state);
    sim.update(50, { x: 0, y: 0 });
    expect(state.phase).toBe('skill-path-choice');
    expect(state.elapsedMs).toBe(0);
    expect(state.pendingSkillPath?.skill).toBe('fire-burst');
  });
  it('pauses exactly once for a route when a skill reaches level three', () => {
    const state = createDefaultState();
    const sim = new GameSimulation(state);
    applyUpgrade(state, 'thunder-ring');
    applyUpgrade(state, 'thunder-ring');
    state.phase = 'upgrade';
    state.upgradeChoices = ['thunder-ring'];

    sim.chooseUpgrade('thunder-ring');

    expect(state.phase).toBe('skill-path-choice');
    expect(state.pendingSkillPath).toMatchObject({
      playerId: 'p1',
      skill: 'thunder-ring',
      resumePhase: 'playing',
    });

    sim.chooseSkillPath('b');

    expect(state.player.skillPaths['thunder-ring']).toBe('b');
    expect(state.pendingSkillPath).toBeNull();
    expect(state.phase).toBe('playing');

    state.phase = 'upgrade';
    state.upgradeChoices = ['thunder-ring'];
    sim.chooseUpgrade('thunder-ring');
    expect(state.phase).toBe('playing');
    expect(state.pendingSkillPath).toBeNull();
  });

  it('ignores invalid or stale route choices', () => {
    const state = createDefaultState();
    const sim = new GameSimulation(state);
    state.player.upgradeLevels['thunder-ring'] = 3;
    state.phase = 'skill-path-choice';
    state.pendingSkillPath = {
      playerId: 'p1',
      skill: 'thunder-ring',
      resumePhase: 'playing',
    };

    sim.chooseSkillPath('invalid' as SkillPathKey);
    expect(state.player.skillPaths['thunder-ring']).toBeUndefined();
    expect(state.phase).toBe('skill-path-choice');

    state.player.upgradeLevels['thunder-ring'] = 2;
    sim.chooseSkillPath('a');
    expect(state.player.skillPaths['thunder-ring']).toBeUndefined();
  });

  it('requires a route and matching enhancement before awakening', () => {
    const state = createDefaultState();
    for (let level = 0; level < 6; level += 1) applyUpgrade(state, 'meteor-seal');
    applyUpgrade(state, 'boss-slayer');

    expect(isUpgradeAwakened(state.player, 'meteor-seal')).toBe(false);

    state.player.skillPaths['meteor-seal'] = 'a';

    expect(isUpgradeAwakened(state.player, 'meteor-seal')).toBe(true);
    expect(getAwakenedSkills(state.player)).toContain('meteor-seal');
  });

  it('resumes both queued co-op upgrades after independent route choices', () => {
    const state = createDefaultState();
    const sim = new GameSimulation(state);
    sim.enableLocalCoop();
    state.player.upgradeLevels['thunder-ring'] = 2;
    state.player.equippedSkills = ['thunder-ring'];
    state.partner!.upgradeLevels['fire-burst'] = 2;
    state.partner!.equippedSkills = ['fire-burst'];
    state.phase = 'upgrade';
    state.pendingUpgradePlayerId = 'p1';
    state.upgradeChoices = ['thunder-ring'];
    state.coopUpgradeQueue = ['p2'];

    sim.chooseUpgrade('thunder-ring');
    expect(state.phase).toBe('skill-path-choice');
    expect(state.pendingSkillPath?.playerId).toBe('p1');

    sim.chooseSkillPath('a');
    expect(state.phase).toBe('upgrade');
    expect(state.pendingUpgradePlayerId).toBe('p2');

    state.upgradeChoices = ['fire-burst'];
    sim.chooseUpgrade('fire-burst');
    expect(state.phase).toBe('skill-path-choice');
    expect(state.pendingSkillPath?.playerId).toBe('p2');

    sim.chooseSkillPath('b');
    expect(state.player.skillPaths['thunder-ring']).toBe('a');
    expect(state.partner!.skillPaths['fire-burst']).toBe('b');
    expect(state.phase).toBe('playing');
    expect(state.coopUpgradeQueue).toEqual([]);
  });
});
