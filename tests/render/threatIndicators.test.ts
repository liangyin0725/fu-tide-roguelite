import { describe, expect, it } from 'vitest';
import { getThreatIndicators } from '../../src/render/threatIndicators';
import { createDefaultState } from '../../src/sim/state';
import type { BossHazard, Enemy } from '../../src/sim/types';

const view = { x: 1000, y: 2000, width: 400, height: 200 };

function enemy(id: number, overrides: Partial<Enemy> = {}): Enemy {
  return {
    id, x: 1600, y: 2100, radius: 20, hp: 100, maxHp: 100,
    speed: 0, damage: 1, experience: 1, kind: 'boss', archetype: 'melee',
    slowMultiplier: 1, slowUntilMs: 0, freezeUntilMs: 0, nextFreezeAllowedMs: 0,
    ...overrides,
  };
}

function hazard(id: number, overrides: Partial<BossHazard> = {}): BossHazard {
  return {
    id, ownerBossId: 99, bossType: 'crimson', kind: 'circle',
    x: 1600, y: 2100, endX: 1600, endY: 2100, radius: 100,
    startRadius: 0, endRadius: 0, bandWidth: 20, lineWidth: 20,
    telegraphRemainingMs: 0, activeRemainingMs: 500, activeDurationMs: 1000,
    damageMultiplier: 1, hasDamagedPlayer: false, ...overrides,
  };
}

describe('getThreatIndicators', () => {
  it.each([
    [1600, 2100, 1372, 2100, 0],
    [800, 2100, 1028, 2100, Math.PI],
    [1200, 1800, 1200, 2028, -Math.PI / 2],
    [1200, 2400, 1200, 2172, Math.PI / 2],
    [1600, 2300, 1344, 2172, Math.atan2(200, 400)],
    [800, 1900, 1056, 2028, Math.atan2(-200, -400)],
  ])('projects target (%s, %s) to the inset world edge', (x, y, edgeX, edgeY, angle) => {
    const state = createDefaultState();
    state.enemies = [enemy(1, { x, y })];
    state.player.x = -999;
    const [indicator] = getThreatIndicators(state, view);
    expect(indicator.id).toBe('boss:1');
    expect(indicator.kind).toBe('boss');
    expect(indicator.x).toBeCloseTo(edgeX);
    expect(indicator.y).toBeCloseTo(edgeY);
    expect(indicator.angle).toBeCloseTo(angle);
    expect(indicator.distance).toBeCloseTo(Math.hypot(x - 1200, y - 2100));
  });

  it('uses the full viewport, including its boundary, for visibility', () => {
    const state = createDefaultState();
    state.enemies = [
      enemy(1, { x: 1001 }), enemy(2, { x: 1000 }), enemy(3, { x: 1400 }),
      enemy(4, { x: 1200, y: 2000 }), enemy(5, { x: 1200, y: 2200 }),
      enemy(6, { x: 1400.01 }),
    ];
    expect(getThreatIndicators(state, view).map((item) => item.id)).toEqual(['boss:6']);
  });

  it('only includes living bosses and enemies matching either active objective ID', () => {
    const state = createDefaultState();
    state.activeObjectiveId = 3;
    state.activeBossObjectiveId = 4;
    state.enemies = [enemy(1), enemy(2, { kind: 'normal' }),
      enemy(3, { kind: 'normal' }), enemy(4, { kind: 'normal' }),
      enemy(5, { hp: 0 }), enemy(6, { hp: -1 }),
      enemy(7, { kind: 'normal', objectiveKind: 'thunder-pillar' })];
    expect(getThreatIndicators(state, view).map(({ id, kind }) => ({ id, kind }))).toEqual([
      { id: 'boss:1', kind: 'boss' }, { id: 'objective:3', kind: 'objective' },
      { id: 'objective:4', kind: 'objective' },
    ]);
    state.activeObjectiveId = 5;
    state.activeBossObjectiveId = 404;
    expect(getThreatIndicators(state, view).map((item) => item.id)).toEqual(['boss:1']);
  });

  it('does not duplicate a boss referenced by both objective IDs', () => {
    const state = createDefaultState();
    state.enemies = [enemy(1)];
    state.activeObjectiveId = state.activeBossObjectiveId = 1;
    expect(getThreatIndicators(state, view).map((item) => item.id)).toEqual(['objective:1']);
  });

  it('shares world geometry for objectives and hazard centers and follows the camera', () => {
    const state = createDefaultState();
    state.enemies = [enemy(1, { kind: 'normal', x: 800, y: 1900 })];
    state.activeBossObjectiveId = 1;
    state.bossHazards = [hazard(2, { x: 800, y: 1900 })];
    const indicators = getThreatIndicators(state, view);
    expect(indicators.map(({ id, kind }) => ({ id, kind }))).toEqual([
      { id: 'objective:1', kind: 'objective' }, { id: 'hazard:2', kind: 'hazard' },
    ]);
    for (const indicator of indicators) {
      expect(indicator.x).toBeCloseTo(1056);
      expect(indicator.y).toBeCloseTo(2028);
      expect(indicator.angle).toBeCloseTo(Math.atan2(-200, -400));
      expect(indicator.distance).toBeCloseTo(Math.hypot(400, 200));
    }
    expect(getThreatIndicators(state, { ...view, x: 700, y: 1800 })).toEqual([]);
    expect(getThreatIndicators(state, view)).toEqual(indicators);
    state.enemies[0].hp = 0;
    state.bossHazards = [];
    expect(getThreatIndicators(state, view)).toEqual([]);
  });

  it('includes only active hazards at the inclusive size thresholds', () => {
    const state = createDefaultState();
    state.bossHazards = [
      hazard(1), hazard(2, { radius: 99.99 }),
      hazard(3, { telegraphRemainingMs: 1 }), hazard(4, { activeRemainingMs: 0 }),
      hazard(5, { activeRemainingMs: -1 }), hazard(6, { telegraphRemainingMs: -1 }),
      hazard(7, { kind: 'line', radius: 0, endX: 1720, endY: 2260 }),
      hazard(8, { kind: 'line', radius: 0, endX: 1799.99 }),
      hazard(9, { kind: 'charge', radius: 0, endX: 1800 }),
      hazard(10, { x: 1200 }),
    ];
    expect(getThreatIndicators(state, view).map((item) => item.id)).toEqual([
      'hazard:1', 'hazard:6', 'hazard:7', 'hazard:9',
    ]);
  });

  it('uses the current expanding or contracting ring radius, not its eventual size', () => {
    const state = createDefaultState();
    state.bossHazards = [
      hazard(1, { kind: 'ring', radius: 0, startRadius: 0, endRadius: 200 }),
      hazard(2, { kind: 'ring', radius: 0, startRadius: 0, endRadius: 198 }),
      hazard(3, { kind: 'ring', radius: 0, startRadius: 200, endRadius: 0 }),
    ];
    expect(getThreatIndicators(state, view).map((item) => item.id)).toEqual(['hazard:1', 'hazard:3']);
    state.bossHazards[0].activeRemainingMs = 501;
    state.bossHazards[2].activeRemainingMs = 499;
    expect(getThreatIndicators(state, view)).toEqual([]);
  });

  it('recomputes stable IDs without retaining dead, removed, inactive, or visible objects', () => {
    const state = createDefaultState();
    const boss = enemy(1);
    const objective = enemy(2, { kind: 'normal' });
    const danger = hazard(3);
    state.enemies = [boss, objective];
    state.activeObjectiveId = 2;
    state.bossHazards = [danger];
    const ids = () => getThreatIndicators(state, view).map((item) => item.id);
    expect(ids()).toEqual(['boss:1', 'objective:2', 'hazard:3']);
    boss.x = objective.x = danger.x = 1200;
    expect(ids()).toEqual([]);
    boss.x = objective.x = danger.x = 1600;
    expect(ids()).toEqual(['boss:1', 'objective:2', 'hazard:3']);
    state.activeObjectiveId = null;
    boss.hp = 0;
    danger.activeRemainingMs = 0;
    expect(ids()).toEqual([]);
    state.enemies = [];
    state.bossHazards = [];
    expect(ids()).toEqual([]);
  });

  it.each([
    [view, 10, 1390, 2100],
    [view, -10, 1400, 2100],
    [{ x: 1000, y: 2000, width: 20, height: 10 }, 28, 1010, 2005],
    [{ x: 1000, y: 2000, width: 0, height: 0 }, 28, 1000, 2000],
  ])('clamps the margin for custom and tiny views', (rect, margin, x, y) => {
    const state = createDefaultState();
    state.enemies = [enemy(1, { y: rect.y + rect.height / 2 })];
    const [indicator] = getThreatIndicators(state, rect, margin);
    expect(indicator.x).toBeCloseTo(x);
    expect(indicator.y).toBeCloseTo(y);
    expect(Number.isFinite(indicator.angle)).toBe(true);
    expect(Number.isFinite(indicator.distance)).toBe(true);
  });

  it('does not mutate game state or view, cap live threats, or accumulate across calls', () => {
    const state = createDefaultState();
    state.enemies = Array.from({ length: 50 }, (_, index) => enemy(index + 1));
    state.bossHazards = Array.from({ length: 50 }, (_, index) => hazard(index + 1));
    const before = structuredClone(state);
    const rect = Object.freeze({ ...view });
    const result = getThreatIndicators(state, rect);
    expect(result).toHaveLength(100);
    expect(new Set(result.map((item) => item.id)).size).toBe(100);
    expect(getThreatIndicators(state, rect)).toEqual(result);
    expect(state).toEqual(before);
    state.enemies.splice(0);
    state.bossHazards.splice(0);
    expect(getThreatIndicators(state, rect)).toEqual([]);
  });
});
