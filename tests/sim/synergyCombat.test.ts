import { describe, expect, it } from 'vitest';
import { GameSimulation } from '../../src/sim/GameSimulation';
import { createDefaultState } from '../../src/sim/state';
import { applyUpgrade } from '../../src/sim/upgrades';

describe('synergy combat effects', () => {
  it('chains thunder-ring damage to enemies outside the ring once per second', () => {
    const state = createDefaultState();
    applyUpgrade(state, 'thunder-ring');
    applyUpgrade(state, 'chain-lightning');
    state.player.attackCooldownMs = 99_999;
    state.spawnTimerMs = -100_000;
    const sim = new GameSimulation(state);
    sim.spawnEnemy({ x: state.player.x + 20, y: state.player.y, hp: 100, speed: 0 });
    const outside = sim.spawnEnemy({ x: state.player.x + 100, y: state.player.y, hp: 100, speed: 0 });

    sim.update(1000, { x: 0, y: 0 });

    expect(outside.hp).toBeLessThan(100);
    expect(sim.consumeEvents()).toContainEqual(expect.objectContaining({
      type: 'synergy-triggered',
      synergy: 'thunder-resonance',
    }));
  });

  it('expands and strengthens fire bursts against frost-controlled targets', () => {
    const state = createDefaultState();
    for (let level = 0; level < 6; level += 1) applyUpgrade(state, 'fire-burst');
    applyUpgrade(state, 'frost-seal');
    state.spawnTimerMs = -100_000;
    state.player.attackCooldownMs = 99_999;
    const sim = new GameSimulation(state);
    const primary = sim.spawnEnemy({ x: state.player.x + 80, y: state.player.y, hp: 500, speed: 0 });
    const outer = sim.spawnEnemy({ x: primary.x + 190, y: primary.y, hp: 500, speed: 0 });
    state.projectiles.push(projectileAt(primary.x, primary.y));

    sim.update(1, { x: 0, y: 0 });

    expect(outer.hp).toBeLessThan(500);
    expect(outer.freezeUntilMs).toBeGreaterThan(state.elapsedMs);
    expect(sim.consumeEvents()).toContainEqual(expect.objectContaining({
      type: 'synergy-triggered',
      synergy: 'frostfire-calamity',
    }));
  });

  it('turns the sword wheel into a continuous bullet ward with stronger reprisal', () => {
    const state = createDefaultState();
    applyUpgrade(state, 'orbiting-blades');
    applyUpgrade(state, 'bullet-reprisal');
    state.spawnTimerMs = -100_000;
    state.player.attackCooldownMs = 99_999;
    const sim = new GameSimulation(state);
    const enemy = sim.spawnEnemy({ x: state.player.x, y: state.player.y + 70, hp: 100, speed: 0 });
    state.enemyProjectiles.push({
      id: 999,
      ownerId: enemy.id,
      kind: 'bolt',
      x: state.player.x,
      y: state.player.y + state.player.orbitingBladeRadius,
      vx: 0,
      vy: 0,
      radius: 6,
      damage: 10,
      ttlMs: 1000,
      homingMs: 0,
      turnRate: 0,
    });

    sim.update(1, { x: 0, y: 0 });

    expect(state.enemyProjectiles).toHaveLength(0);
    expect(enemy.hp).toBeLessThanOrEqual(73);
    expect(state.projectiles).toContainEqual(expect.objectContaining({ source: 'reprisal' }));
    expect(sim.consumeEvents()).toContainEqual(expect.objectContaining({
      type: 'synergy-triggered',
      synergy: 'sword-ward',
    }));
  });

  it('launches four star projectiles from each meteor impact', () => {
    const state = createDefaultState();
    applyUpgrade(state, 'meteor-seal');
    applyUpgrade(state, 'north-star');
    state.player.meteorTimerMs = state.player.meteorCooldownMs - 1;
    state.player.attackCooldownMs = 99_999;
    state.spawnTimerMs = -100_000;
    const sim = new GameSimulation(state);
    sim.spawnEnemy({ x: state.player.x + 120, y: state.player.y, hp: 500, speed: 0 });

    sim.update(2, { x: 0, y: 0 });

    expect(state.projectiles.filter((projectile) => projectile.kind === 'star')).toHaveLength(8);
    expect(sim.consumeEvents()).toContainEqual(expect.objectContaining({
      type: 'synergy-triggered',
      synergy: 'starfall-convergence',
    }));
  });

  it('restores shield and shortens the active skill cooldown', () => {
    const state = createDefaultState();
    applyUpgrade(state, 'golden-shield');
    applyUpgrade(state, 'spirit-jade');
    state.player.activeSkill = 'talisman-ruin';
    state.player.shield = 0;
    state.spawnTimerMs = -100_000;
    const sim = new GameSimulation(state);

    sim.update(1, { move: { x: 0, y: 0 }, aim: { x: 1, y: 0 }, activate: true });

    expect(state.player.shield).toBe(10);
    expect(state.player.activeCooldownRemainingMs).toBeCloseTo(18_000 * 0.92 * 0.65);
    expect(state.player.invulnerableMs).toBeGreaterThan(0);
    expect(sim.consumeEvents()).toContainEqual(expect.objectContaining({
      type: 'synergy-triggered',
      synergy: 'immortal-echo',
    }));
  });

  it('raises soul-pin chance against bosses and deals execution damage', () => {
    const state = createDefaultState();
    for (let level = 0; level < 6; level += 1) applyUpgrade(state, 'soul-pin');
    applyUpgrade(state, 'boss-slayer');
    state.randomState = 0;
    state.player.attackCooldownMs = 99_999;
    state.spawnTimerMs = -100_000;
    const sim = new GameSimulation(state);
    const boss = sim.spawnEnemy({
      x: state.player.x + 100,
      y: state.player.y,
      hp: 1000,
      speed: 0,
      kind: 'boss',
      bossWave: 1,
    });
    boss.bossSkillTimerMs = 3_000;
    state.projectiles.push(projectileAt(boss.x, boss.y));

    sim.update(1, { x: 0, y: 0 });

    expect(boss.hp).toBeLessThan(920);
    expect(boss.bossSkillTimerMs).toBe(0);
    expect(sim.consumeEvents()).toContainEqual(expect.objectContaining({
      type: 'synergy-triggered',
      synergy: 'soul-execution',
    }));
  });

  it('turns the void bell into a solar eclipse burst', () => {
    const state = createDefaultState();
    applyUpgrade(state, 'solar-ray');
    applyUpgrade(state, 'void-bell');
    state.player.voidBellTimerMs = state.player.voidBellCooldownMs - 1;
    state.player.attackCooldownMs = 99_999;
    state.spawnTimerMs = -100_000;
    const sim = new GameSimulation(state);
    const target = sim.spawnEnemy({ x: state.player.x + 60, y: state.player.y, hp: 300, speed: 0 });

    sim.update(2, { x: 0, y: 0 });

    expect(target.hp).toBeLessThanOrEqual(300 - state.player.voidBellDamage - state.player.solarRayDamage * 1.2);
    expect(target.solarMarkUntilMs).toBeGreaterThan(state.elapsedMs);
    expect(sim.consumeEvents()).toContainEqual(expect.objectContaining({
      type: 'synergy-triggered',
      synergy: 'eclipse-sanctum',
    }));
  });

  it('makes sword rain strike with solar follow-through and restore a golden shield', () => {
    const state = createDefaultState();
    applyUpgrade(state, 'solar-ray');
    applyUpgrade(state, 'spirit-sword-rain');
    applyUpgrade(state, 'golden-shield');
    state.player.shield = state.player.maxShield - 2;
    state.player.shieldBreakReady = false;
    state.player.swordRainTimerMs = state.player.swordRainCooldownMs - 1;
    state.player.attackCooldownMs = 99_999;
    state.spawnTimerMs = -100_000;
    const sim = new GameSimulation(state);
    const target = sim.spawnEnemy({ x: state.player.x + 80, y: state.player.y, hp: 500, speed: 0 });

    sim.update(2, { x: 0, y: 0 });

    expect(target.hp).toBeLessThan(350);
    expect(state.player.shield).toBe(state.player.maxShield);
    expect(state.player.shieldBreakReady).toBe(true);
    expect(target.solarMarkUntilMs).toBeGreaterThan(state.elapsedMs);
    expect(sim.consumeEvents()).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'synergy-triggered', synergy: 'sunblade-cascade' }),
      expect.objectContaining({ type: 'synergy-triggered', synergy: 'gilded-sword-rain' }),
    ]));
  });

  it('lets the frozen void bell shatter nearby bullets before awakening', () => {
    const state = createDefaultState();
    applyUpgrade(state, 'frost-seal');
    applyUpgrade(state, 'void-bell');
    state.player.voidBellTimerMs = state.player.voidBellCooldownMs - 1;
    state.player.attackCooldownMs = 99_999;
    state.spawnTimerMs = -100_000;
    const sim = new GameSimulation(state);
    const enemy = sim.spawnEnemy({ x: state.player.x + 60, y: state.player.y, hp: 100, speed: 0 });
    state.enemyProjectiles.push({
      id: 901, ownerId: enemy.id, kind: 'bolt', x: state.player.x + 30, y: state.player.y,
      vx: 0, vy: 0, radius: 6, damage: 10, ttlMs: 1_000, homingMs: 0, turnRate: 0,
    });

    sim.update(2, { x: 0, y: 0 });

    expect(state.enemyProjectiles).toHaveLength(0);
    expect(enemy.freezeUntilMs).toBeGreaterThan(state.elapsedMs);
    expect(sim.consumeEvents()).toContainEqual(expect.objectContaining({
      type: 'synergy-triggered',
      synergy: 'frozen-knell',
    }));
  });
});

function projectileAt(x: number, y: number) {
  return {
    id: 10_000,
    targetId: -1,
    x,
    y,
    vx: 0,
    vy: 0,
    radius: 7,
    damage: 0,
    ttlMs: 1000,
    pierceRemaining: 0,
    hitEnemyIds: [],
  };
}
