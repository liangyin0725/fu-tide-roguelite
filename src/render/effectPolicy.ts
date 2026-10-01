import type { EffectLevel } from '../settings/gameSettings';
import type { EffectKind, EffectSpec } from './effectSpecs';

export type EffectPriority = 'critical' | 'combat' | 'ambient';
export const EFFECT_FRAME_BUDGETS = {
  low: { combat: 20, ambient: 8, damageNumbers: 20 },
  medium: { combat: 36, ambient: 16, damageNumbers: 36 },
  high: { combat: 64, ambient: 28, damageNumbers: 52 },
} as const;

export function getEffectPriority(kind: EffectKind): EffectPriority {
  if (['ranged-windup', 'boss-cast', 'boss-skill', 'boss-phase', 'boss-objective', 'boss',
    'damage', 'siege', 'objective', 'objective-field', 'enemy-shot'].includes(kind)) return 'critical';
  if (['impact', 'bullet-break', 'damage-number', 'dodge'].includes(kind)) return 'ambient';
  return 'combat';
}

export function getEffectImportance(spec: EffectSpec): number {
  if (spec.kind === 'awakening' || spec.kind === 'synergy' || spec.kind === 'skill-path' || spec.event.type === 'thunder-path-wave') return 3;
  if (spec.kind === 'kill' || spec.kind === 'active-cast' || ('awakened' in spec.event && spec.event.awakened)) return 2;
  return spec.kind === 'trail' ? 0 : 1;
}

export function selectEffectsForFrame(specs: EffectSpec[], level: EffectLevel): EffectSpec[] {
  const budget = EFFECT_FRAME_BUDGETS[level];
  const ordered = [...specs].sort((a, b) => getEffectImportance(b) - getEffectImportance(a));
  const counts = { combat: 0, ambient: 0, damageNumbers: 0 };
  const identities = new Set<string>();
  return ordered.filter((spec) => {
    if (spec.identityKey) {
      if (identities.has(spec.identityKey)) return false;
      identities.add(spec.identityKey);
    }
    if (spec.kind === 'damage-number') return counts.damageNumbers++ < budget.damageNumbers;
    const priority = getEffectPriority(spec.kind);
    if (priority === 'critical') return true;
    return counts[priority]++ < budget[priority];
  });
}
