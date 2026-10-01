import type { CombatEvent } from '../sim/types';

export function canMergeDamage(previous: CombatEvent, incoming: CombatEvent, ageMs: number): boolean {
  return previous.type === 'damage-dealt' && incoming.type === 'damage-dealt'
    && previous.targetId !== undefined && incoming.targetId === previous.targetId
    && incoming.source === previous.source && !previous.burst && !incoming.burst && ageMs <= 120;
}
