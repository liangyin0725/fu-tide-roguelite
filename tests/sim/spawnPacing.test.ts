import { describe, expect, it } from 'vitest';
import {
  getBossStats,
  getNextExperienceRequirement,
  getNormalEnemyExperience,
  getNormalSpawnInterval,
} from '../../src/sim/spawnPacing';
import { getRangedSpawnRatio } from '../../src/sim/enemyProjectiles';

describe('spawn pacing', () => {
  it('slightly increases opening enemy density without changing the late-game floor', () => {
    expect(getNormalSpawnInterval(0, 0)).toBe(1050);
    expect(getNormalSpawnInterval(3_600_000, 0)).toBe(380);
  });

  it('caps the late-game normal spawn rate', () => {
    expect(getNormalSpawnInterval(3_600_000, 0)).toBe(380);
  });

  it('slows normal spawns during the boss arrival window', () => {
    expect(getNormalSpawnInterval(300_000, 330_000)).toBe(570);
  });

  it('scales boss stats by wave', () => {
    expect(getBossStats(1)).toEqual({
      hp: 1560,
      damage: 20,
      speed: 52,
      experience: 60,
    });
    expect(getBossStats(3)).toEqual({
      hp: 3120,
      damage: 26,
      speed: 56,
      experience: 100,
    });
  });

  it('increases normal-enemy experience at five-minute boundaries', () => {
    expect(getNormalEnemyExperience(299_999)).toBe(3);
    expect(getNormalEnemyExperience(300_000)).toBeCloseTo(3.6);
    expect(getNormalEnemyExperience(600_000)).toBeCloseTo(4.32);
  });

  it('slows requirement growth from level twelve onward', () => {
    expect(getNextExperienceRequirement(100, 11)).toBe(126);
    expect(getNextExperienceRequirement(100, 12)).toBe(118);
  });

  it('keeps the ranged share below the normal-enemy cap', () => {
    expect(getRangedSpawnRatio(600_000)).toBeGreaterThan(0);
    expect(getRangedSpawnRatio(3_600_000)).toBeLessThanOrEqual(0.35);
  });
});
