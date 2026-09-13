import { describe, expect, it } from 'vitest';
import { createEliteSquadBlueprint } from '../../src/sim/eliteSquads';
import { GameSimulation } from '../../src/sim/GameSimulation';
import { createDefaultState } from '../../src/sim/state';
import { dealPlayerDamage } from '../../src/sim/combatStats';

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

    sim.update(3000, { x: 0, y: 0 });

    expect(ally.hp).toBe(52);
  });

  it('lets iron-wall elites protect nearby squadmates from player damage', () => {
    const state = createDefaultState();
    const sim = new GameSimulation(state);
    sim.spawnEnemy({ x: 500, y: 300, hp: 100, speed: 0, eliteAffix: 'iron-wall', squadId: 1 });
    const escort = sim.spawnEnemy({ x: 560, y: 300, hp: 100, speed: 0, squadId: 1 });

    dealPlayerDamage(state, escort, 100, 'flying-sword');

    expect(escort.hp).toBe(25);
  });

  it('makes haste elites periodically rush toward the player', () => {
    const state = createDefaultState();
    state.nextBossAtMs = 9_999_999;
    state.nextEliteSquadAtMs = 9_999_999;
    state.spawnTimerMs = -100_000;
    state.player.x = 800;
    state.player.y = 300;
    const sim = new GameSimulation(state);
    const elite = sim.spawnEnemy({ x: 500, y: 300, hp: 100, speed: 0, eliteAffix: 'haste' });

    sim.update(2800, { x: 0, y: 0 });

    expect(elite.x).toBeGreaterThan(600);
    expect(sim.consumeEvents()).toContainEqual(expect.objectContaining({
      type: 'elite-effect', affix: 'haste',
    }));
  });

  it('lets suppressors lock nearby active skills even when they are ready', () => {
    const state = createDefaultState();
    state.nextBossAtMs = 9_999_999;
    state.nextEliteSquadAtMs = 9_999_999;
    state.spawnTimerMs = -100_000;
    const sim = new GameSimulation(state);
    sim.spawnEnemy({ x: state.player.x + 80, y: state.player.y, hp: 100, speed: 0, eliteAffix: 'suppressor' });

    sim.update(2200, { x: 0, y: 0 });

    expect(state.player.activeCooldownRemainingMs).toBeGreaterThan(0);
    expect(sim.consumeEvents()).toContainEqual(expect.objectContaining({
      type: 'elite-effect', affix: 'suppressor',
    }));
  });
});
