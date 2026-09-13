import { describe, expect, it } from 'vitest';
import { GameSimulation } from '../../src/sim/GameSimulation';
import { createDefaultState } from '../../src/sim/state';
import { applyUpgrade } from '../../src/sim/upgrades';
import { SKILL_IDS } from '../../src/sim/upgradeCatalog';

describe('new six-level skills', () => {
  it('offers the new storm net and mirror sigil skills', () => {
    expect(SKILL_IDS).toContain('storm-net');
    expect(SKILL_IDS).toContain('mirror-sigil');
    expect(SKILL_IDS).toContain('frost-domain');
    expect(SKILL_IDS).toContain('rift-return');
    expect(SKILL_IDS).toContain('star-pull');
  });

  it('casts frost domain, rift return, and star pull through the simulation loop', () => {
    const state = createDefaultState();
    applyUpgrade(state, 'frost-domain');
    applyUpgrade(state, 'rift-return');
    applyUpgrade(state, 'star-pull');
    state.player.frostDomainTimerMs = state.player.frostDomainCooldownMs;
    state.player.riftReturnTimerMs = state.player.riftReturnCooldownMs;
    state.player.starPullTimerMs = state.player.starPullCooldownMs;
    state.player.attackCooldownMs = 99_999;
    state.spawnTimerMs = -100_000;
    state.nextBossAtMs = 9_999_999;
    state.nextEliteSquadAtMs = 9_999_999;
    const sim = new GameSimulation(state);
    const target = sim.spawnEnemy({ x: state.player.x + 80, y: state.player.y, hp: 1_000, speed: 0 });

    sim.update(1, { x: 0, y: 0 });

    expect(target.hp).toBeLessThan(920);
    expect(sim.consumeEvents()).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'frost-domain' }),
      expect.objectContaining({ type: 'rift-return' }),
      expect.objectContaining({ type: 'star-pull' }),
    ]));
  });
  it.each(['solar-ray', 'void-bell', 'spirit-sword-rain'] as const)('awakens %s at level six', (skill) => {
    const state = createDefaultState();
    let result;
    for (let level = 0; level < 6; level += 1) result = applyUpgrade(state, skill);
    expect(result?.awakened).toBe(true);
    expect(state.player.upgradeLevels[skill]).toBe(6);
  });

  it('casts all three new skills through the simulation loop', () => {
    const state = createDefaultState();
    applyUpgrade(state, 'solar-ray');
    applyUpgrade(state, 'void-bell');
    applyUpgrade(state, 'spirit-sword-rain');
    state.player.solarRayTimerMs = state.player.solarRayCooldownMs;
    state.player.voidBellTimerMs = state.player.voidBellCooldownMs;
    state.player.swordRainTimerMs = state.player.swordRainCooldownMs;
    state.player.attackCooldownMs = 99_999;
    state.spawnTimerMs = -100_000;
    state.nextBossAtMs = 9_999_999;
    state.nextEliteSquadAtMs = 9_999_999;
    const sim = new GameSimulation(state);
    const target = sim.spawnEnemy({ x: state.player.x + 80, y: state.player.y, hp: 1000, speed: 0 });

    sim.update(1, { x: 0, y: 0 });

    expect(target.hp).toBeLessThan(900);
  });
});
