import { describe, expect, it } from 'vitest';
import { GameSimulation } from '../../src/sim/GameSimulation';
import { createDefaultState } from '../../src/sim/state';
import { dealPlayerDamage } from '../../src/sim/combatStats';
import { recalculatePlayerBuild } from '../../src/sim/loadout';

describe('co-op damage ownership', () => {
  it('uses P2 origin, stats and ownership for the North Star awakening volley', () => {
    const state = createDefaultState();
    const sim = new GameSimulation(state);
    sim.enableLocalCoop();
    const p2 = state.partner!;
    p2.x += 200;
    p2.equippedSkills = ['north-star'];
    p2.skillPaths['north-star'] = 'a';
    p2.upgradeLevels['north-star'] = 5;
    state.phase = 'upgrade'; state.pendingUpgradePlayerId = 'p2'; state.upgradeChoices = ['north-star'];
    sim.chooseUpgrade('north-star');
    sim.update(1500, { x: 0, y: 0 });
    expect(state.projectiles).toHaveLength(p2.northStarShotCount);
    for (const shot of state.projectiles) expect(shot).toMatchObject({ x: p2.x, y: p2.y, damage: p2.northStarDamage, playerId: 'p2' });
  });

  it('keeps P2 traveling-ring damage independent of P1 boss bonuses', () => {
    const run = (p1Multiplier: number) => {
      const state = createDefaultState();
      const sim = new GameSimulation(state); sim.enableLocalCoop();
      const p2 = state.partner!;
      p2.equippedSkills = ['thunder-ring']; p2.skillPaths['thunder-ring'] = 'b';
      p2.upgradeLevels['thunder-ring'] = 3; recalculatePlayerBuild(p2);
      state.player.attackDamage = 0; p2.attackDamage = 0;
      state.player.bossDamageMultiplier = p1Multiplier; p2.bossDamageMultiplier = 1;
      const boss = sim.spawnEnemy({ x: p2.x + p2.thunderRadius + 70, y: p2.y, kind: 'boss', hp: 100000, speed: 0, damage: 0 });
      for (let frame = 0; frame < 60; frame++) sim.update(50, { x: 0, y: 0 });
      return 100000 - boss.hp;
    };
    const damage = run(1);
    expect(damage).toBeGreaterThan(0);
    expect(run(4)).toBe(damage);
  });
  it('uses the actual attacker boss multiplier', () => {
    const state = createDefaultState();
    const sim = new GameSimulation(state);
    sim.enableLocalCoop();
    const boss = sim.spawnEnemy({ x: 0, y: 0, kind: 'boss', hp: 1000 });
    state.player.bossDamageMultiplier = 4;
    state.partner!.bossDamageMultiplier = 1;
    expect(dealPlayerDamage(state, boss, 20, 'solar-ray', state.partner!)).toBe(20);
    expect(dealPlayerDamage(state, boss, 20, 'solar-ray')).toBe(80);
  });

  it('does not let a derived projectile proc primary on-hit skills', () => {
    const state = createDefaultState();
    const sim = new GameSimulation(state);
    state.player.fireBurstDamage = 50;
    state.player.fireBurstChance = 1;
    const target = sim.spawnEnemy({ x: state.player.x + 40, y: state.player.y, speed: 0, hp: 1000 });
    state.projectiles.push({ id: state.nextId++, targetId: target.id, x: state.player.x, y: state.player.y,
      vx: 800, vy: 0, radius: 7, damage: 10, ttlMs: 1000, pierceRemaining: 0, hitEnemyIds: [], derived: true });
    sim.update(50, { x: 0, y: 0 });
    expect(sim.consumeEvents().some(e => e.type === 'fire-burst' || e.type === 'skill-path-trigger')).toBe(false);
  });
});
