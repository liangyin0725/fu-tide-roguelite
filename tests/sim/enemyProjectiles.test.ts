import { describe, expect, it } from 'vitest';
import {
  getRangedSpawnRatio,
  updateEnemyProjectiles,
} from '../../src/sim/enemyProjectiles';
import { createDefaultState } from '../../src/sim/state';

describe('enemy projectiles', () => {
  it('ramps ranged enemies without exceeding thirty-five percent', () => {
    expect(getRangedSpawnRatio(0)).toBe(0);
    expect(getRangedSpawnRatio(60_000)).toBe(0);
    expect(getRangedSpawnRatio(900_000)).toBeCloseTo(0.35);
    expect(getRangedSpawnRatio(3_600_000)).toBe(0.35);
  });

  it('turns a homing soul orb by no more than its configured rate', () => {
    const state = createDefaultState();
    state.player.x = 480;
    state.player.y = 560;
    state.enemyProjectiles.push({
      id: 1,
      ownerId: 2,
      kind: 'soul-orb',
      x: 480,
      y: 360,
      vx: 180,
      vy: 0,
      radius: 8,
      damage: 10,
      ttlMs: 5000,
      homingMs: 2800,
      turnRate: 1,
    });

    updateEnemyProjectiles(state, 100, () => undefined);

    const angle = Math.atan2(state.enemyProjectiles[0].vy, state.enemyProjectiles[0].vx);
    expect(angle).toBeGreaterThan(0);
    expect(angle).toBeLessThanOrEqual(0.10001);
  });

  it('lets orbiting blades break a bullet before shield or health damage', () => {
    const state = createDefaultState();
    state.player.orbitingBladeCount = 6;
    state.player.orbitingBladeRadius = 62;
    state.player.shield = 20;
    state.player.maxShield = 20;
    state.enemyProjectiles.push({
      id: 1,
      ownerId: 2,
      kind: 'bolt',
      x: state.player.x + 62,
      y: state.player.y,
      vx: 0,
      vy: 0,
      radius: 6,
      damage: 12,
      ttlMs: 1000,
      homingMs: 0,
      turnRate: 0,
    });
    let damageCalls = 0;

    const events = updateEnemyProjectiles(state, 16, () => { damageCalls += 1; });

    expect(state.enemyProjectiles).toHaveLength(0);
    expect(damageCalls).toBe(0);
    expect(state.player.shield).toBe(20);
    expect(state.runStats.bulletsBlocked).toBe(1);
    expect(events).toContainEqual(expect.objectContaining({
      type: 'enemy-bullet-broken',
      by: 'blade',
    }));
  });

  it('lets a completed frost core deny bullets near the player', () => {
    const state = createDefaultState();
    state.elapsedMs = 10_000;
    state.objectiveFieldExpiresAtMs['frost-core'] = 28_000;
    state.enemyProjectiles.push({
      id: 1,
      ownerId: 2,
      kind: 'bolt',
      x: state.player.x + 100,
      y: state.player.y,
      vx: 0,
      vy: 0,
      radius: 6,
      damage: 12,
      ttlMs: 1000,
      homingMs: 0,
      turnRate: 0,
    });

    const events = updateEnemyProjectiles(state, 16, () => undefined);

    expect(state.enemyProjectiles).toHaveLength(0);
    expect(events).toContainEqual(expect.objectContaining({ type: 'enemy-bullet-broken', by: 'barrier' }));
  });
});
