import { describe, expect, it } from 'vitest';
import { selectEffectsForFrame } from '../../src/render/effectPolicy';
import { createEffectSpecs } from '../../src/render/effectSpecs';
import type { CombatEvent } from '../../src/sim/types';

describe('effect admission priorities', () => {
  it('deduplicates explicit identities and gives damage labels a separate budget', () => {
    const danger = createEffectSpecs([{ type: 'player-damaged', x: 0, y: 0, amount: 10 }])[0];
    danger.identityKey = 'player-hit:p1';
    const numbers = createEffectSpecs(Array.from({ length: 40 }, (_, id) => ({
      type: 'damage-dealt' as const, x: 0, y: 0, amount: 1, source: 'thunder' as const, targetId: id,
    })));
    const selected = selectEffectsForFrame([danger, danger, ...numbers], 'low');
    expect(selected.filter(s => s.kind === 'damage')).toHaveLength(1);
    expect(selected.filter(s => s.kind === 'damage-number')).toHaveLength(20);
  });
  it('preserves danger and player feedback while restricting decoration', () => {
    const events: CombatEvent[] = Array.from({ length: 100 }, () => ({ type: 'projectile-hit', x: 0, y: 0 }));
    events.push({ type: 'player-damaged', x: 0, y: 0, amount: 10 });
    events.push({ type: 'boss-cast-started', x: 0, y: 0, bossType: 'crimson', kind: 'primary' });
    const selected = selectEffectsForFrame(createEffectSpecs(events), 'low');
    expect(selected.filter((s) => s.kind === 'impact')).toHaveLength(8);
    expect(selected.some((s) => s.kind === 'damage')).toBe(true);
    expect(selected.some((s) => s.kind === 'boss-cast')).toBe(true);
  });

  it('reserves combat budget for awakening and route mechanics before trails', () => {
    const events: CombatEvent[] = Array.from({ length: 100 }, () => ({ type: 'projectile-fired', x: 0, y: 0, angle: 0 }));
    events.push({ type: 'skill-awakened', x: 0, y: 0, upgrade: 'thunder-ring' });
    const selected = selectEffectsForFrame(createEffectSpecs(events), 'low');
    expect(selected).toHaveLength(20);
    expect(selected.some((s) => s.kind === 'awakening')).toBe(true);
  });
});
