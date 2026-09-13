import { describe, expect, it } from 'vitest';
import { createEliteSquadBlueprint } from '../../src/sim/eliteSquads';
import { GameSimulation } from '../../src/sim/GameSimulation';
import { createDefaultState } from '../../src/sim/state';

describe('elite squads', () => {
  it('builds one rotating elite leader and four escorts', () => {
    const squad = createEliteSquadBlueprint(1);
    expect(squad).toHaveLength(5);
    expect(squad.filter((member) => member.eliteAffix)).toHaveLength(1);
    expect(createEliteSquadBlueprint(1)[0].eliteAffix).toBe('iron-wall');
    expect(createEliteSquadBlueprint(2)[0].eliteAffix).toBe('haste');
    expect(createEliteSquadBlueprint(3)[0].eliteAffix).toBe('mender');
    expect(createEliteSquadBlueprint(4)[0].eliteAffix).toBe('suppressor');
  });

  it('spawns a five-enemy formation on the late-game schedule', () => {
    const state = createDefaultState();
    state.elapsedMs = 329_999;
    state.nextEliteSquadAtMs = 330_000;
    state.nextBossAtMs = 9_999_999;
    state.spawnTimerMs = -100_000;
    const sim = new GameSimulation(state);

    sim.update(2, { x: 0, y: 0 });

    expect(state.enemies.filter((enemy) => enemy.squadId === 1)).toHaveLength(5);
    expect(state.enemies.find((enemy) => enemy.eliteAffix)?.maxHp).toBeGreaterThan(50);
  });

  it('lets menders periodically heal nearby allies', () => {
    const state = createDefaultState();
    state.nextBossAtMs = 9_999_999;
    state.nextEliteSquadAtMs = 9_999_999;
    state.spawnTimerMs = -100_000;
    const sim = new GameSimulation(state);
    sim.spawnEnemy({ x: 500, y: 300, hp: 200, speed: 0, eliteAffix: 'mender' });
    const ally = sim.spawnEnemy({ x: 540, y: 300, hp: 100, speed: 0 });
    ally.hp = 40;

    sim.update(4000, { x: 0, y: 0 });

    expect(ally.hp).toBeGreaterThan(40);
  });
});
