import { describe, expect, it } from 'vitest';
import {
  resolveActiveAim,
  tryActivateActiveSkill,
} from '../../src/sim/activeSkills';
import { createDefaultState } from '../../src/sim/state';
import { recalculatePlayerBuild } from '../../src/sim/loadout';

describe('active skills', () => {
  it('keeps talisman ruin purely offensive and leaves bullets intact', () => {
    const state = createDefaultState();
    state.player.activeSkill = 'talisman-ruin';
    state.enemyProjectiles.push({
      id: 1, ownerId: 2, kind: 'bolt', x: 520, y: 360,
      vx: 0, vy: 0, radius: 6, damage: 10, ttlMs: 1000, homingMs: 0, turnRate: 0,
    });
    state.enemies.push({
      id: 2, x: 560, y: 360, radius: 16, hp: 200, maxHp: 200, speed: 0,
      damage: 0, experience: 0, kind: 'normal', archetype: 'melee',
      slowMultiplier: 1, slowUntilMs: 0, freezeUntilMs: 0, nextFreezeAllowedMs: 0,
    });

    tryActivateActiveSkill(state, { x: 1, y: 0 });

    expect(state.enemies[0].hp).toBeLessThan(200);
    expect(state.enemyProjectiles).toHaveLength(1);
  });

  it('clamps dimension step and destroys only bullets on its path', () => {
    const state = createDefaultState();
    state.player.activeSkill = 'dimension-step';
    state.player.x = state.arena.width - 20;
    state.enemyProjectiles.push({
      id: 1, ownerId: 2, kind: 'bolt', x: state.arena.width - 8, y: state.player.y,
      vx: 0, vy: 0, radius: 6, damage: 10, ttlMs: 1000, homingMs: 0, turnRate: 0,
    });

    const events = tryActivateActiveSkill(state, { x: 1, y: 0 });

    expect(state.player.x).toBeLessThanOrEqual(state.arena.width - state.player.radius);
    expect(state.player.invulnerableMs).toBeGreaterThan(0);
    expect(state.enemyProjectiles).toHaveLength(0);
    expect(events).toContainEqual(expect.objectContaining({ by: 'dash' }));
  });

  it('uses last movement and then upward as deterministic aim fallbacks', () => {
    const state = createDefaultState();
    state.player.lastMoveDirection = { x: -1, y: 0 };
    expect(resolveActiveAim(state, { x: 0, y: 0 }, 'manual')).toEqual({ x: -1, y: 0 });
    state.player.lastMoveDirection = { x: 0, y: 0 };
    expect(resolveActiveAim(state, { x: 0, y: 0 }, 'manual')).toEqual({ x: 0, y: -1 });
  });

  it('applies lei-zhuan arcane talent damage to talisman ruin', () => {
    const state = createDefaultState();
    state.player.characterId = 'lei-zhuan';
    state.player.metaTalentIds = ['lei-zhuan:thunder-body'];
    state.player.activeSkill = 'talisman-ruin';
    recalculatePlayerBuild(state.player);
    state.enemies.push({
      id: 2, x: state.player.x + 160, y: state.player.y, radius: 16, hp: 200, maxHp: 200, speed: 0,
      damage: 0, experience: 0, kind: 'normal', archetype: 'melee',
      slowMultiplier: 1, slowUntilMs: 0, freezeUntilMs: 0, nextFreezeAllowedMs: 0,
    });

    tryActivateActiveSkill(state, { x: 1, y: 0 });

    expect(state.enemies[0].hp).toBeCloseTo(200 - 140 * 1.08);
  });
});
