import { describe, expect, it } from 'vitest';
import {
  getBossDisplayName,
  getBossTypeForWave,
  createBossPrimaryHazards,
  createBossSecondaryHazards,
  isPointInsideBossHazard,
} from '../../src/sim/bossSkills';
import type { BossHazard, BossType, Enemy } from '../../src/sim/types';

describe('boss skills', () => {
  it('intensifies thunder and blood-moon skills after an arena objective fails', () => {
    const thunder = makeBoss('thunder', 1, 1);
    thunder.bossArenaEnraged = true;
    let id = 1;
    const lightning = createBossPrimaryHazards(thunder, { x: 640, y: 360 }, () => id++, () => 0.5);
    expect(lightning).toHaveLength(5);
    expect(lightning[0].telegraphRemainingMs).toBe(800);

    const moon = makeBoss('blood-moon', 2, 1);
    moon.bossArenaEnraged = true;
    expect(createBossSecondaryHazards(moon, { x: 640, y: 360 }, () => id++)[0].healBossFraction).toBe(0.07);
  });
  it('rotates through three boss types deterministically', () => {
    expect(Array.from({ length: 6 }, (_, index) => getBossTypeForWave(index + 1))).toEqual([
      'crimson',
      'thunder',
      'blood-moon',
      'crimson',
      'thunder',
      'blood-moon',
    ]);
  });

  it('provides a distinct Chinese display name for each boss', () => {
    expect(getBossDisplayName('crimson')).toBe('赤煞劫主');
    expect(getBossDisplayName('thunder')).toBe('雷狱劫主');
    expect(getBossDisplayName('blood-moon')).toBe('血月劫主');
  });

  it('detects points inside circle, line, charge, and ring hazards', () => {
    const base: Omit<BossHazard, 'kind'> = {
      id: 1,
      ownerBossId: 2,
      bossType: 'crimson',
      x: 100,
      y: 100,
      endX: 300,
      endY: 100,
      radius: 50,
      startRadius: 40,
      endRadius: 200,
      bandWidth: 24,
      lineWidth: 80,
      telegraphRemainingMs: 0,
      activeRemainingMs: 500,
      activeDurationMs: 1000,
      damageMultiplier: 1,
      hasDamagedPlayer: false,
    };

    expect(isPointInsideBossHazard({ ...base, kind: 'circle' }, { x: 145, y: 100 })).toBe(true);
    expect(isPointInsideBossHazard({ ...base, kind: 'line' }, { x: 200, y: 115 })).toBe(true);
    expect(isPointInsideBossHazard({ ...base, kind: 'charge' }, { x: 200, y: 130 })).toBe(true);
    expect(isPointInsideBossHazard({ ...base, kind: 'ring' }, { x: 220, y: 100 })).toBe(true);
    expect(isPointInsideBossHazard({ ...base, kind: 'ring' }, { x: 100, y: 100 })).toBe(false);
  });

  it('creates phase-specific crimson and thunder primary skills', () => {
    let id = 1;
    const nextId = () => id++;
    const random = () => 0.5;
    const crimson = createBossPrimaryHazards(
      makeBoss('crimson', 2, 1),
      { x: 500, y: 300 },
      nextId,
      random,
    );
    const thunder = createBossPrimaryHazards(
      makeBoss('thunder', 2, 2),
      { x: 500, y: 300 },
      nextId,
      random,
    );

    expect(crimson.map((hazard) => hazard.kind)).toEqual(['charge', 'ring']);
    expect(crimson[0].telegraphRemainingMs).toBe(900);
    expect(crimson[1].telegraphRemainingMs).toBe(1500);
    expect(thunder.filter((hazard) => hazard.kind === 'circle')).toHaveLength(5);
    expect(thunder.filter((hazard) => hazard.kind === 'line')).toHaveLength(2);
  });

  it('creates blood-moon tide and three healing seals in phase two', () => {
    let id = 1;
    const boss = makeBoss('blood-moon', 2, 1);

    const primary = createBossPrimaryHazards(
      boss,
      { x: 500, y: 300 },
      () => id++,
      () => 0.5,
    );
    const secondary = createBossSecondaryHazards(
      boss,
      { x: 500, y: 300 },
      () => id++,
    );

    expect(primary).toHaveLength(1);
    expect(primary[0]).toEqual(expect.objectContaining({
      kind: 'ring',
      telegraphRemainingMs: 800,
      startRadius: 35,
      endRadius: 260,
    }));
    expect(secondary).toHaveLength(3);
    expect(secondary.every((hazard) => hazard.healBossFraction === 0.04)).toBe(true);
  });

  it('turns every boss into a distinct final-phase pattern', () => {
    let id = 1;
    const player = { x: 500, y: 300 };
    const crimson = createBossPrimaryHazards(makeBoss('crimson', 3, 2), player, () => id++, () => 0.5);
    const thunder = createBossPrimaryHazards(makeBoss('thunder', 3, 2), player, () => id++, () => 0.5);
    const moon = createBossSecondaryHazards(makeBoss('blood-moon', 3, 2), player, () => id++);

    expect(crimson).toHaveLength(3);
    expect(thunder.filter((hazard) => hazard.kind === 'circle')).toHaveLength(7);
    expect(moon).toHaveLength(5);
  });
});

function makeBoss(type: BossType, phase: 1 | 2 | 3, castCount: number): Enemy {
  return {
    id: 50,
    x: 200,
    y: 300,
    radius: 42,
    hp: 600,
    maxHp: 600,
    speed: 52,
    damage: 20,
    experience: 60,
    kind: 'boss',
    archetype: 'melee',
    bossWave: 1,
    bossType: type,
    bossPhase: phase,
    bossSkillTimerMs: 0,
    bossSecondaryTimerMs: 0,
    bossCastCount: castCount,
    slowMultiplier: 1,
    slowUntilMs: 0,
    freezeUntilMs: 0,
    nextFreezeAllowedMs: 0,
  };
}
