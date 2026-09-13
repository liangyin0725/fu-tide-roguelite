import type { Arena, BossObjectiveKind, BossType, Enemy, Vector } from './types';

export function getBossObjectiveKind(bossType: BossType): BossObjectiveKind {
  if (bossType === 'crimson') return 'crimson-anchor';
  if (bossType === 'thunder') return 'storm-pylon';
  return 'blood-well';
}

export function getBossObjectiveHp(wave: number): number {
  return 320 + Math.max(1, wave) * 130;
}

export function getBossObjectivePosition(boss: Pick<Enemy, 'x' | 'y' | 'radius'>, arena: Arena): Vector {
  const distance = 240;
  return {
    x: Math.max(52, Math.min(arena.width - 52, boss.x + distance)),
    y: Math.max(52, Math.min(arena.height - 52, boss.y - distance * 0.45)),
  };
}
