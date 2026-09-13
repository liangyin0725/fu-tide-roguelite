import type { TribulationType } from './types';

export interface TribulationModifiers {
  enemyProjectileSpeed: number;
  thunderDamage: number;
  enemyDamage: number;
  experience: number;
  playerSpeed: number;
  enemySpeed: number;
  freezeDuration: number;
}

const BASE: TribulationModifiers = {
  enemyProjectileSpeed: 1,
  thunderDamage: 1,
  enemyDamage: 1,
  experience: 1,
  playerSpeed: 1,
  enemySpeed: 1,
  freezeDuration: 1,
};

export const TRIBULATION_MODIFIERS: Record<TribulationType, TribulationModifiers> = {
  calm: BASE,
  thunder: { ...BASE, enemyProjectileSpeed: 1.2, thunderDamage: 1.25 },
  'blood-moon': { ...BASE, enemyDamage: 1.15, experience: 1.2 },
  frost: { ...BASE, playerSpeed: 0.9, enemySpeed: 0.85, freezeDuration: 1.25 },
};

export const TRIBULATION_NAMES: Record<TribulationType, string> = {
  calm: '常夜',
  thunder: '九霄雷劫',
  'blood-moon': '血月灾变',
  frost: '玄霜寒潮',
};

const FIRST_TRIBULATION_AT_MS = 300_000;
const TRIBULATION_DURATION_MS = 300_000;

export function getTribulationAt(elapsedMs: number): TribulationType {
  if (elapsedMs < FIRST_TRIBULATION_AT_MS) return 'calm';
  const cycle = Math.floor((elapsedMs - FIRST_TRIBULATION_AT_MS) / TRIBULATION_DURATION_MS) % 3;
  return (['thunder', 'blood-moon', 'frost'] as const)[cycle];
}

export function getTribulationEndMs(elapsedMs: number): number {
  if (elapsedMs < FIRST_TRIBULATION_AT_MS) return FIRST_TRIBULATION_AT_MS;
  return (Math.floor((elapsedMs - FIRST_TRIBULATION_AT_MS) / TRIBULATION_DURATION_MS) + 1)
    * TRIBULATION_DURATION_MS + FIRST_TRIBULATION_AT_MS;
}
