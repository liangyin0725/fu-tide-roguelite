import { describe, expect, it } from 'vitest';
import { GameSimulation } from '../../src/sim/GameSimulation';
import { createDefaultState } from '../../src/sim/state';

function objectiveState() {
  const state = createDefaultState();
  state.elapsedMs = 389_999;
  state.nextObjectiveAtMs = 390_000;
  state.nextBossAtMs = 9_999_999;
  state.nextEliteSquadAtMs = 9_999_999;
  state.spawnTimerMs = -100_000;
  state.player.attackCooldownMs = 99_999;
  return state;
}

describe('tribulation stage objective chains', () => {
  it('starts a three-step stationary objective chain with a forty-five second first deadline', () => {
    const state = objectiveState();
    const sim = new GameSimulation(state);

    sim.update(1, { x: 0, y: 0 });

    const objective = state.enemies.find((enemy) => enemy.id === state.activeObjectiveId);
    expect(objective?.objectiveKind).toBe('thunder-pillar');
    expect(objective?.speed).toBe(0);
    expect(state.objectiveExpiresAtMs).toBe(435_000);
    expect(state.objectiveChainStep).toBe(1);
    expect(sim.consumeEvents()).toContainEqual(expect.objectContaining({ type: 'objective-spawned' }));
  });

  it('advances to the next objective after completing the first link', () => {
    const state = objectiveState();
    const sim = new GameSimulation(state);
    sim.update(1, { x: 0, y: 0 });
    const objective = state.enemies.find((enemy) => enemy.id === state.activeObjectiveId)!;
    objective.hp = 0;

    sim.update(1, { x: 0, y: 0 });

    expect(state.phase).toBe('objective-route');
    expect(state.activeObjectiveId).toBeNull();
    sim.chooseObjectiveRoute('secure');
    const nextObjective = state.enemies.find((enemy) => enemy.id === state.activeObjectiveId);
    expect(nextObjective?.objectiveKind).toBe('blood-well');
    expect(state.objectiveChainStep).toBe(2);
    expect(state.runStats.objectivesCompleted).toBe(1);
    expect(state.player.experience).toBe(state.player.experienceToNext * 0.2);
    expect(sim.consumeEvents()).toContainEqual(expect.objectContaining({
      type: 'objective-resolved',
      success: true,
    }));
  });

  it('adds elite guardians and upgrades the final reward on the risk route', () => {
    const state = objectiveState();
    const sim = new GameSimulation(state);
    sim.update(1, { x: 0, y: 0 });
    state.enemies.find((enemy) => enemy.id === state.activeObjectiveId)!.hp = 0;
    sim.update(1, { x: 0, y: 0 });

    sim.chooseObjectiveRoute('risk');

    expect(state.phase).toBe('playing');
    expect(state.objectiveChainRiskLevel).toBe(1);
    expect(state.enemies.filter((enemy) => enemy.eliteAffix)).toHaveLength(3);

    state.enemies.find((enemy) => enemy.id === state.activeObjectiveId)!.hp = 0;
    sim.update(1, { x: 0, y: 0 });
    sim.chooseObjectiveRoute('secure');
    state.enemies.find((enemy) => enemy.id === state.activeObjectiveId)!.hp = 0;
    sim.update(1, { x: 0, y: 0 });

    expect(state.chests).toHaveLength(2);
  });

  it('drops an event chest after completing the third link', () => {
    const state = objectiveState();
    const sim = new GameSimulation(state);
    sim.update(1, { x: 0, y: 0 });
    for (let step = 1; step <= 3; step += 1) {
      const objective = state.enemies.find((enemy) => enemy.id === state.activeObjectiveId)!;
      objective.hp = 0;
      sim.update(1, { x: 0, y: 0 });
      if (step < 3) sim.chooseObjectiveRoute('secure');
    }

    expect(state.objectiveChainStep).toBe(0);
    expect(state.activeObjectiveId).toBeNull();
    expect(state.chests).toHaveLength(1);
    expect(state.runStats.objectivesCompleted).toBe(3);
    expect(sim.consumeEvents()).toContainEqual(expect.objectContaining({ type: 'chest-dropped' }));
  });

  it('spawns an extra elite squad when the objective expires', () => {
    const state = objectiveState();
    const sim = new GameSimulation(state);
    sim.update(1, { x: 0, y: 0 });
    state.elapsedMs = state.objectiveExpiresAtMs - 1;

    sim.update(1, { x: 0, y: 0 });

    expect(state.activeObjectiveId).toBeNull();
    expect(state.eliteSquadWave).toBe(1);
    expect(state.enemies.some((enemy) => enemy.eliteAffix)).toBe(true);
    expect(sim.consumeEvents()).toContainEqual(expect.objectContaining({
      type: 'objective-resolved',
      success: false,
    }));
  });
});
