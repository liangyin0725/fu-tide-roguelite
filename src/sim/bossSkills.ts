import type { BossHazard, BossPhase, BossType, Enemy, Vector } from './types';

export const BOSS_TYPES = ['crimson', 'thunder', 'blood-moon'] as const satisfies readonly BossType[];

const BOSS_NAMES: Record<BossType, string> = {
  crimson: '赤煞劫主',
  thunder: '雷狱劫主',
  'blood-moon': '血月劫主',
};

export function getBossTypeForWave(wave: number): BossType {
  return BOSS_TYPES[(Math.max(1, wave) - 1) % BOSS_TYPES.length];
}

export function getBossDisplayName(type: BossType): string {
  return BOSS_NAMES[type];
}

export function getBossPhaseTwoSkillName(type: BossType): string {
  if (type === 'crimson') return '赤煞震环';
  if (type === 'thunder') return '雷狱交叉';
  return '噬生血印';
}

export function getBossPhaseSkillName(type: BossType, phase: BossPhase): string {
  if (phase === 1) return '试探攻势';
  if (phase === 2) return getBossPhaseTwoSkillName(type);
  if (type === 'crimson') return '血煞冲阵';
  if (type === 'thunder') return '万雷天牢';
  return '血月葬潮';
}

export function getBossPrimaryCooldown(type: BossType, phase: BossPhase): number {
  if (type === 'thunder') {
    return phase === 3 ? 3200 : phase === 2 ? 4800 : 6500;
  }
  return phase === 3 ? 3600 : phase === 2 ? 5200 : 7000;
}

export function getBossSecondaryCooldown(type: BossType, phase: BossPhase = 2): number {
  return type === 'blood-moon' ? phase === 3 ? 5200 : 9000 : Number.POSITIVE_INFINITY;
}

export function createBossPrimaryHazards(
  boss: Enemy,
  player: Vector,
  takeId: () => number,
  random: () => number,
): BossHazard[] {
  const type = boss.bossType ?? 'crimson';
  const phase = boss.bossPhase ?? 1;
  if (type === 'crimson') {
    const direction = normalize({ x: player.x - boss.x, y: player.y - boss.y });
    const endX = boss.x + direction.x * 520;
    const endY = boss.y + direction.y * 520;
    const hazards = [makeHazard({
      id: takeId(),
      ownerBossId: boss.id,
      bossType: type,
      kind: 'charge',
      x: boss.x,
      y: boss.y,
      endX,
      endY,
        lineWidth: boss.bossArenaEnraged ? 96 : 80,
      telegraphRemainingMs: 900,
      activeRemainingMs: 600,
      activeDurationMs: 600,
      damageMultiplier: 1.25,
    })];
    if (phase >= 2) {
      hazards.push(makeHazard({
        id: takeId(),
        ownerBossId: boss.id,
        bossType: type,
        kind: 'ring',
        x: endX,
        y: endY,
        endX,
        endY,
        startRadius: 40,
        endRadius: phase === 3 ? 320 : boss.bossArenaEnraged ? 276 : 230,
        bandWidth: phase === 3 ? 34 : boss.bossArenaEnraged ? 29 : 24,
        telegraphRemainingMs: phase === 3 ? 1000 : 1500,
        activeRemainingMs: 900,
        activeDurationMs: 900,
        damageMultiplier: 0.75,
      }));
    }
    if (phase === 3) {
      hazards.push(makeHazard({
        id: takeId(), ownerBossId: boss.id, bossType: type, kind: 'charge',
        x: boss.x, y: boss.y, endX: player.x - direction.x * 120, endY: player.y - direction.y * 120,
        lineWidth: 68, telegraphRemainingMs: 650, activeRemainingMs: 520, activeDurationMs: 520, damageMultiplier: 1.1,
      }));
    }
    return hazards;
  }

  if (type === 'thunder') {
    const count = (phase === 3 ? 7 : phase === 2 ? 5 : 3) + (boss.bossArenaEnraged ? 2 : 0);
    const hazards: BossHazard[] = [];
    for (let index = 0; index < count; index += 1) {
      const angle = (index / count) * Math.PI * 2 + (random() - 0.5) * 0.4;
      const offset = 34 + random() * 86;
      hazards.push(makeHazard({
        id: takeId(),
        ownerBossId: boss.id,
        bossType: type,
        kind: 'circle',
        x: player.x + Math.cos(angle) * offset,
        y: player.y + Math.sin(angle) * offset,
        radius: 54,
        telegraphRemainingMs: boss.bossArenaEnraged ? 800 : 1000,
        activeRemainingMs: 140,
        activeDurationMs: 140,
        damageMultiplier: 1,
      }));
    }
    if (phase >= 2 && ((boss.bossCastCount ?? 0) % 2 === 0 || phase === 3)) {
      hazards.push(makeHazard({
        id: takeId(), ownerBossId: boss.id, bossType: type, kind: 'line',
        x: player.x - 300, y: player.y, endX: player.x + 300, endY: player.y,
        lineWidth: phase === 3 ? 38 : 28, telegraphRemainingMs: phase === 3 ? 650 : 900, activeRemainingMs: 160,
        activeDurationMs: 160, damageMultiplier: 0.8,
      }));
      hazards.push(makeHazard({
        id: takeId(), ownerBossId: boss.id, bossType: type, kind: 'line',
        x: player.x, y: player.y - 300, endX: player.x, endY: player.y + 300,
        lineWidth: phase === 3 ? 38 : 28, telegraphRemainingMs: phase === 3 ? 650 : 900, activeRemainingMs: 160,
        activeDurationMs: 160, damageMultiplier: 0.8,
      }));
    }
    return hazards;
  }

  const hazards = [makeHazard({
    id: takeId(),
    ownerBossId: boss.id,
    bossType: type,
    kind: 'ring',
    x: boss.x,
    y: boss.y,
    endX: boss.x,
    endY: boss.y,
    startRadius: 35,
    endRadius: phase === 3 ? 320 : 260,
    bandWidth: phase === 3 ? 34 : 26,
    telegraphRemainingMs: phase === 3 ? 600 : 800,
    activeRemainingMs: 1200,
    activeDurationMs: 1200,
    damageMultiplier: 1,
  })];
  if (phase === 3) {
    hazards.push(makeHazard({
      id: takeId(), ownerBossId: boss.id, bossType: type, kind: 'ring', x: player.x, y: player.y,
      endX: player.x, endY: player.y, startRadius: 260, endRadius: 42, bandWidth: 28,
      telegraphRemainingMs: 900, activeRemainingMs: 1100, activeDurationMs: 1100, damageMultiplier: 1.15,
    }));
  }
  return hazards;
}

export function createBossSecondaryHazards(
  boss: Enemy,
  player: Vector,
  takeId: () => number,
): BossHazard[] {
  if (boss.bossType !== 'blood-moon' || (boss.bossPhase ?? 1) < 2) {
    return [];
  }
  const count = boss.bossPhase === 3 ? 5 : 3;
  return Array.from({ length: count }, (_, index) => {
    const angle = index * (Math.PI * 2 / count);
    return makeHazard({
      id: takeId(),
      ownerBossId: boss.id,
      bossType: 'blood-moon',
      kind: 'circle',
      x: player.x + Math.cos(angle) * 92,
      y: player.y + Math.sin(angle) * 92,
      radius: 62,
      telegraphRemainingMs: 1200,
      activeRemainingMs: 180,
      activeDurationMs: 180,
      damageMultiplier: 1.1,
      healBossFraction: boss.bossPhase === 3 ? 0.08 : boss.bossArenaEnraged ? 0.07 : 0.04,
    });
  });
}

export function getBossHazardRadius(hazard: BossHazard): number {
  if (hazard.kind !== 'ring') {
    return hazard.radius;
  }
  const progress = 1 - hazard.activeRemainingMs / Math.max(1, hazard.activeDurationMs);
  return hazard.startRadius + (hazard.endRadius - hazard.startRadius) * clamp(progress, 0, 1);
}

export type BossTelegraphPattern = 'crimson-slash' | 'thunder-mark' | 'blood-seal';

export function getBossHazardTelegraphPattern(hazard: BossHazard): BossTelegraphPattern {
  if (hazard.bossType === 'thunder') return 'thunder-mark';
  if (hazard.bossType === 'blood-moon') return 'blood-seal';
  return 'crimson-slash';
}

export function isPointInsideBossHazard(hazard: BossHazard, point: Vector): boolean {
  if (hazard.kind === 'circle') {
    return Math.hypot(point.x - hazard.x, point.y - hazard.y) <= hazard.radius;
  }
  if (hazard.kind === 'ring') {
    const radius = getBossHazardRadius(hazard);
    return Math.abs(Math.hypot(point.x - hazard.x, point.y - hazard.y) - radius) <= hazard.bandWidth / 2;
  }
  return segmentDistance(hazard, { x: hazard.endX, y: hazard.endY }, point) <= hazard.lineWidth / 2;
}

function segmentDistance(start: Vector, end: Vector, point: Vector): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) {
    return Math.hypot(point.x - start.x, point.y - start.y);
  }
  const t = clamp(((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared, 0, 1);
  return Math.hypot(point.x - (start.x + dx * t), point.y - (start.y + dy * t));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function makeHazard(
  values: Pick<BossHazard, 'id' | 'ownerBossId' | 'bossType' | 'kind' | 'x' | 'y'> &
    Partial<Omit<BossHazard, 'id' | 'ownerBossId' | 'bossType' | 'kind' | 'x' | 'y'>>,
): BossHazard {
  return {
    endX: values.x,
    endY: values.y,
    radius: 0,
    startRadius: 0,
    endRadius: 0,
    bandWidth: 0,
    lineWidth: 0,
    telegraphRemainingMs: 0,
    activeRemainingMs: 100,
    activeDurationMs: 100,
    damageMultiplier: 1,
    hasDamagedPlayer: false,
    ...values,
  };
}

function normalize(vector: Vector): Vector {
  const length = Math.hypot(vector.x, vector.y);
  return length === 0 ? { x: 1, y: 0 } : { x: vector.x / length, y: vector.y / length };
}
