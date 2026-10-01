import { describe, expect, it } from 'vitest';
import { GameSimulation } from '../../src/sim/GameSimulation';
import { createDefaultState } from '../../src/sim/state';
import { applyUpgrade } from '../../src/sim/upgrades';

function setup(path: 'a' | 'b', level = 3) {
  const state = createDefaultState();
  state.player.skillPaths['thunder-ring'] = path;
  for (let i = 0; i < level; i++) applyUpgrade(state, 'thunder-ring');
  state.spawnTimerMs = -1e6;
  state.player.attackCooldownMs = 1e6;
  state.awakeningGlyphTimerMs = -1e6;
  const sim = new GameSimulation(state);
  const enemy = sim.spawnEnemy({ x: state.player.x + 70, y: state.player.y, hp: 10000, speed: 0 });
  return { state, sim, enemy };
}

describe('thunder routes', () => {
  it('periodically knocks back nearby normal enemies on route A', () => {
    const { sim, enemy } = setup('a');
    const before = enemy.x;
    sim.update(2000, { x: 0, y: 0 });
    expect(enemy.x).toBeGreaterThan(before);
    expect(sim.consumeEvents()).toContainEqual(expect.objectContaining({ type: 'thunder-path-wave', path: 'a' }));
  });

  it('travels beyond the passive ring on route B and does not repeat hits', () => {
    const { state, sim, enemy } = setup('b');
    enemy.x = state.player.x + 180;
    sim.update(2000, { x: 0, y: 0 });
    sim.update(400, { x: 0, y: 0 });
    expect(enemy.hp).toBeLessThan(10000);
    const hp = enemy.hp;
    sim.update(50, { x: 0, y: 0 });
    expect(enemy.hp).toBe(hp);
  });

  it('hits again on an awakened return sweep', () => {
    const { state, sim, enemy } = setup('b', 6);
    enemy.x = state.player.x + 320;
    sim.update(1500, { x: 0, y: 0 });
    for (let i = 0; i < 10; i++) sim.update(50, { x: 0, y: 0 });
    const first = enemy.hp;
    for (let i = 0; i < 14; i++) sim.update(50, { x: 0, y: 0 });
    expect(enemy.hp).toBeLessThan(first);
  });
});
