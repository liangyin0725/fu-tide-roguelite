import { describe, expect, it } from 'vitest';
import { canMergeDamage } from '../../src/render/damageMerging';
import type { CombatEvent } from '../../src/sim/types';

const event = { type: 'damage-dealt', x: 0, y: 0, amount: 8, source: 'fire', targetId: 1 } as const;
describe('damage merging', () => {
  it('merges only the same target and source within 120ms', () => {
    expect(canMergeDamage(event, event, 119)).toBe(true);
    expect(canMergeDamage(event, event, 121)).toBe(false);
    expect(canMergeDamage(event, { ...event, targetId: 2 }, 50)).toBe(false);
    expect(canMergeDamage(event, { ...event, source: 'thunder' }, 50)).toBe(false);
    expect(canMergeDamage(event, { ...event, burst: true } as CombatEvent, 50)).toBe(false);
    expect(canMergeDamage(event, { ...event, targetId: undefined }, 50)).toBe(false);
  });
});
