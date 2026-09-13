import { describe, expect, it } from 'vitest';
import { getTribulationAt, TRIBULATION_MODIFIERS } from '../../src/sim/tribulations';
import { GameSimulation } from '../../src/sim/GameSimulation';
import { createDefaultState } from '../../src/sim/state';

describe('endless tribulations', () => {
  it('cycles thunder, blood moon, and frost every five minutes after minute five', () => {
    expect(getTribulationAt(299_999)).toBe('calm');
    expect(getTribulationAt(300_000)).toBe('thunder');
    expect(getTribulationAt(600_000)).toBe('blood-moon');
    expect(getTribulationAt(900_000)).toBe('frost');
    expect(getTribulationAt(1_200_000)).toBe('thunder');
  });

  it('defines restrained modifiers that change pressure instead of enemy count', () => {
    expect(TRIBULATION_MODIFIERS.thunder.enemyProjectileSpeed).toBe(1.2);
    expect(TRIBULATION_MODIFIERS['blood-moon']).toMatchObject({ enemyDamage: 1.15, experience: 1.2 });
    expect(TRIBULATION_MODIFIERS.frost).toMatchObject({ playerSpeed: 0.9, enemySpeed: 0.85, freezeDuration: 1.25 });
  });

  it('switches stage and emits a transition event at the boundary', () => {
    const state = createDefaultState();
    state.elapsedMs = 299_999;
    state.nextBossAtMs = 9_999_999;
    state.nextEliteSquadAtMs = 9_999_999;
    state.spawnTimerMs = -100_000;
    const sim = new GameSimulation(state);

    sim.update(2, { x: 0, y: 0 });

    expect(state.tribulation).toBe('thunder');
    expect(sim.consumeEvents()).toContainEqual(expect.objectContaining({
      type: 'tribulation-changed',
      tribulation: 'thunder',
    }));
  });

  it('starts a themed objective chain thirty seconds into each new map phase', () => {
    const state = createDefaultState();
    state.elapsedMs = 329_999;
    state.nextBossAtMs = 9_999_999;
    state.nextEliteSquadAtMs = 9_999_999;
    state.spawnTimerMs = -100_000;

    new GameSimulation(state).update(1, { x: 0, y: 0 });

    expect(state.tribulation).toBe('thunder');
    expect(state.enemies.find((enemy) => enemy.id === state.activeObjectiveId)?.objectiveKind).toBe('thunder-pillar');
  });

  it('pauses for exactly one choice fifteen seconds into a tribulation', () => {
    const state = createDefaultState();
    state.elapsedMs = 314_999;
    state.tribulation = 'thunder';
    state.nextBossAtMs = 9_999_999;
    state.nextEliteSquadAtMs = 9_999_999;
    state.spawnTimerMs = -100_000;
    const sim = new GameSimulation(state);

    sim.update(1, { x: 0, y: 0 });

    expect(state.phase).toBe('tribulation-choice');
    expect(state.tribulationChoices).toEqual(['thunder-conduit', 'thunder-seal']);
    expect(sim.consumeEvents()).toContainEqual(expect.objectContaining({
      type: 'tribulation-choice-offered',
      tribulation: 'thunder',
    }));

    sim.update(1000, { x: 1, y: 0 });
    expect(state.elapsedMs).toBe(315_000);
  });

  it('offers another choice five minutes after the previous one', () => {
    const state = createDefaultState();
    state.elapsedMs = 314_999;
    state.tribulation = 'thunder';
    state.nextBossAtMs = 9_999_999;
    state.nextEliteSquadAtMs = 9_999_999;
    state.spawnTimerMs = -100_000;
    const sim = new GameSimulation(state);

    sim.update(1, { x: 0, y: 0 });
    sim.chooseTribulationChoice('thunder-seal');
    state.elapsedMs = 614_999;
    sim.update(1, { x: 0, y: 0 });

    expect(state.phase).toBe('tribulation-choice');
    expect(state.tribulationChoices).toEqual(['blood-pact', 'blood-calm']);
    expect(state.nextTribulationChoiceAtMs).toBe(915_000);
  });

  it('applies frost movement and blood-moon experience modifiers in combat', () => {
    const frost = createDefaultState();
    frost.elapsedMs = 900_000;
    frost.tribulation = 'frost';
    frost.nextBossAtMs = 9_999_999;
    frost.nextEliteSquadAtMs = 9_999_999;
    frost.spawnTimerMs = -100_000;
    const startX = frost.player.x;
    new GameSimulation(frost).update(1000, { x: 1, y: 0 });
    expect(frost.player.x - startX).toBeCloseTo(245 * 0.9);

    const blood = createDefaultState();
    blood.elapsedMs = 600_000;
    blood.tribulation = 'blood-moon';
    blood.nextBossAtMs = 9_999_999;
    blood.nextEliteSquadAtMs = 9_999_999;
    blood.spawnTimerMs = -100_000;
    const sim = new GameSimulation(blood);
    sim.spawnEnemy({ x: 800, y: 600, hp: 0, speed: 0, experience: 10 });
    sim.update(1, { x: 0, y: 0 });
    expect(blood.shards[0].value).toBe(12);
  });
});
