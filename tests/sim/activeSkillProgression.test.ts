import { describe, expect, it } from 'vitest';
import { tryActivateActiveSkill } from '../../src/sim/activeSkills';
import { GameSimulation } from '../../src/sim/GameSimulation';
import { createDefaultState } from '../../src/sim/state';

describe('active skill progression', () => {
  it('adds a level-four aftershock to talisman ruin', () => {
    const state = createDefaultState();
    state.player.activeSkill = 'talisman-ruin';
    state.player.activeSkillLevel = 4;
    state.enemies.push(enemy(1, state.player.x + 180, state.player.y));
    state.enemies.push(enemy(2, state.player.x + 180, state.player.y + 70));

    tryActivateActiveSkill(state, { x: 1, y: 0 });

    expect(state.enemies[1].hp).toBeLessThan(500);
  });

  it('damages enemies along a level-four dimension step', () => {
    const state = createDefaultState();
    state.player.activeSkill = 'dimension-step';
    state.player.activeSkillLevel = 4;
    state.enemies.push(enemy(1, state.player.x + 120, state.player.y));

    tryActivateActiveSkill(state, { x: 1, y: 0 });

    expect(state.enemies[0].hp).toBeLessThan(500);
  });

  it('damages nearby enemies when casting a level-four tai-chi ward', () => {
    const state = createDefaultState();
    state.player.activeSkill = 'tai-chi-ward';
    state.player.activeSkillLevel = 4;
    state.enemies.push(enemy(1, state.player.x + 100, state.player.y));

    tryActivateActiveSkill(state, { x: 1, y: 0 });

    expect(state.enemies[0].hp).toBeLessThan(500);
    expect(state.player.activeBarrierRadius).toBe(175);
  });

  it('levels the selected active skill after defeating a boss', () => {
    const state = createDefaultState();
    state.player.activeSkill = 'dimension-step';
    state.player.activeSkillLevel = 1;
    state.player.experienceToNext = 1_000_000;
    const sim = new GameSimulation(state);
    sim.spawnEnemy({ x: state.player.x, y: state.player.y, hp: 0, speed: 0, damage: 0, kind: 'boss', bossWave: 1 });

    sim.update(1, { x: 0, y: 0 });

    expect(state.player.activeSkillLevel).toBe(2);
    expect(sim.consumeEvents()).toContainEqual(expect.objectContaining({
      type: 'active-skill-leveled',
      skill: 'dimension-step',
      level: 2,
    }));
  });
});

function enemy(id: number, x: number, y: number) {
  return {
    id, x, y, radius: 16, hp: 500, maxHp: 500, speed: 0, damage: 0,
    experience: 0, kind: 'normal' as const, archetype: 'melee' as const,
    slowMultiplier: 1, slowUntilMs: 0, freezeUntilMs: 0, nextFreezeAllowedMs: 0,
  };
}
