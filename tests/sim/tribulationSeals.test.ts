import { describe, expect, it } from 'vitest';
import { GameSimulation } from '../../src/sim/GameSimulation';
import { createDefaultState } from '../../src/sim/state';

describe('tribulation seals', () => {
  it('permanently grants the matching seal when a tribulation choice is selected', () => {
    const state = createDefaultState();
    state.phase = 'tribulation-choice';
    state.tribulation = 'thunder';
    state.tribulationChoices = ['thunder-conduit'];
    const sim = new GameSimulation(state);

    sim.chooseTribulationChoice('thunder-conduit');

    expect((state as unknown as { tribulationSealRanks?: Record<string, number> }).tribulationSealRanks)
      .toMatchObject({ thunder: 1, blood: 0, frost: 0 });
    expect(sim.consumeEvents()).toContainEqual(expect.objectContaining({
      type: 'tribulation-seal-gained',
      seal: 'thunder',
      rank: 1,
    }));
  });

  it('chains lightning from every fourth sword hit with Thunder Seal', () => {
    const state = createDefaultState();
    state.tribulationSealRanks.thunder = 1;
    state.player.attackDamage = 20;
    const sim = new GameSimulation(state);
    const primary = sim.spawnEnemy({ x: 620, y: 360, hp: 200, speed: 0 });
    const secondary = sim.spawnEnemy({ x: 700, y: 360, hp: 200, speed: 0 });

    for (let index = 0; index < 4; index += 1) {
      state.projectiles.push({
        id: state.nextId++, targetId: primary.id, x: primary.x, y: primary.y,
        vx: 0, vy: 0, radius: 7, damage: 20, ttlMs: 100, pierceRemaining: 0, hitEnemyIds: [],
        source: 'flying-sword',
      });
      sim.update(16, { x: 0, y: 0 });
    }

    expect(secondary.hp).toBeLessThan(200);
    expect(sim.consumeEvents()).toContainEqual(expect.objectContaining({
      type: 'tribulation-seal-triggered', seal: 'thunder',
    }));
  });

  it('detonates Blood Echo after three elite kills', () => {
    const state = createDefaultState();
    state.tribulationSealRanks.blood = 1;
    state.player.hp = 40;
    state.player.attackDamage = 20;
    const sim = new GameSimulation(state);
    const victim = sim.spawnEnemy({ x: state.player.x + 120, y: state.player.y, hp: 200, speed: 0 });

    for (let index = 0; index < 3; index += 1) {
      const elite = sim.spawnEnemy({
        x: state.player.x + 1000, y: state.player.y, hp: 1, speed: 0, eliteAffix: 'haste',
      });
      elite.hp = 0;
      sim.update(16, { x: 0, y: 0 });
    }

    expect(state.player.hp).toBeGreaterThan(40);
    expect(victim.hp).toBeLessThan(200);
    expect(sim.consumeEvents()).toContainEqual(expect.objectContaining({
      type: 'tribulation-seal-triggered', seal: 'blood',
    }));
  });

  it('creates a Frost Mirror on freeze and reflects an enemy bullet', () => {
    const state = createDefaultState();
    state.tribulationSealRanks.frost = 1;
    state.player.frostSlowPercent = 0.2;
    state.player.frostFreezeMs = 1_000;
    const sim = new GameSimulation(state);
    const enemy = sim.spawnEnemy({ x: 620, y: 360, hp: 200, speed: 0 });
    state.projectiles.push({
      id: state.nextId++, targetId: enemy.id, x: enemy.x, y: enemy.y,
      vx: 0, vy: 0, radius: 7, damage: 1, ttlMs: 100, pierceRemaining: 0, hitEnemyIds: [],
      source: 'flying-sword',
    });

    sim.update(16, { x: 0, y: 0 });
    const mirror = (state as unknown as { frostSealMirror?: { x: number; y: number } }).frostSealMirror;
    expect(mirror).toMatchObject({ x: enemy.x, y: enemy.y });

    state.enemyProjectiles.push({
      id: state.nextId++, ownerId: enemy.id, kind: 'bolt', x: enemy.x, y: enemy.y,
      vx: 0, vy: 0, radius: 6, damage: 8, ttlMs: 1000, homingMs: 0, turnRate: 0,
    });
    sim.update(16, { x: 0, y: 0 });

    expect(state.enemyProjectiles).toHaveLength(0);
    expect(state.projectiles.some((projectile) => projectile.source === 'reprisal')).toBe(true);
  });
});
