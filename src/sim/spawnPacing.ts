export interface BossStats {
  hp: number;
  damage: number;
  speed: number;
  experience: number;
}

export function getNormalSpawnInterval(elapsedMs: number, slowdownUntilMs: number): number {
  const interval = Math.max(380, 1050 / (1 + elapsedMs / 120000));
  return elapsedMs < slowdownUntilMs ? interval * 1.5 : interval;
}

export function getNormalEnemyExperience(elapsedMs: number): number {
  const fiveMinuteWindows = Math.floor(Math.max(0, elapsedMs) / 300_000);
  return 3 * 1.2 ** fiveMinuteWindows;
}

export function getNextExperienceRequirement(previous: number, reachedLevel: number): number {
  const growthPercent = reachedLevel >= 12 ? 114 : 122;
  return Math.floor((previous * growthPercent + 400) / 100);
}

export function getBossStats(wave: number): BossStats {
  const growth = Math.max(0, wave - 1);
  return {
    hp: 1400 + growth * 700,
    damage: 20 + growth * 3,
    speed: 52 + Math.min(28, growth * 2),
    experience: 60 + growth * 20,
  };
}
