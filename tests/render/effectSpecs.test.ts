import { describe, expect, it } from 'vitest';
import {
  createEffectSpecs,
  EFFECT_BUDGETS,
  isCriticalEffect,
} from '../../src/render/effectSpecs';
import type { CombatEvent } from '../../src/sim/types';

describe('createEffectSpecs', () => {
  it('maps combat events to the intended visual effects', () => {
    const events: CombatEvent[] = [
      { type: 'projectile-hit', x: 10, y: 20 },
      { type: 'enemy-killed', x: 30, y: 40 },
      { type: 'chain-lightning', fromX: 1, fromY: 2, toX: 3, toY: 4 },
      { type: 'fire-burst', x: 50, y: 60, radius: 90 },
      { type: 'level-up', x: 70, y: 80, level: 2 },
      { type: 'boss-spawned', x: 400, y: 300, wave: 1 },
      { type: 'skill-awakened', x: 400, y: 300, upgrade: 'meteor-seal' },
      { type: 'meteor-strike', x: 500, y: 300, damage: 90 },
      { type: 'dodge', x: 300, y: 300 },
      { type: 'frost-hit', x: 250, y: 300, frozen: true },
      { type: 'shield-broken', x: 400, y: 300, radius: 120 },
      { type: 'chest-dropped', x: 600, y: 400, wave: 1 },
      { type: 'boss-reward-burst', x: 600, y: 400, wave: 1, experience: 120 },
      { type: 'boss-cast-started', x: 400, y: 300, bossType: 'crimson', kind: 'primary' },
      { type: 'boss-skill-activated', x: 400, y: 300, bossType: 'thunder', kind: 'circle' },
      { type: 'boss-phase-changed', x: 400, y: 300, bossId: 1, bossType: 'blood-moon', phase: 2 },
      { type: 'boss-healed', x: 400, y: 300, bossType: 'blood-moon', amount: 24 },
    ];

    const specs = createEffectSpecs(events);

    expect(specs.map((spec) => spec.kind)).toEqual([
      'impact',
      'kill',
      'lightning',
      'fire',
      'level',
      'boss',
      'awakening',
      'meteor',
      'dodge',
      'frost',
      'shield-break',
      'chest',
      'reward',
      'boss-cast',
      'boss-skill',
      'boss-phase',
      'boss-heal',
    ]);
  });

  it('maps bullet breaks and active casts to dedicated effects', () => {
    const specs = createEffectSpecs([
      { type: 'enemy-bullet-broken', x: 10, y: 20, by: 'blade' },
      { type: 'active-skill-cast', x: 30, y: 40, skill: 'tai-chi-ward', angle: 0 },
    ]);

    expect(specs.map((spec) => spec.kind)).toEqual(['bullet-break', 'active-cast']);
  });

  it('maps life-drain healing and siege pressure to distinct effects', () => {
    const specs = createEffectSpecs([
      { type: 'player-healed', x: 10, y: 20, amount: 3, source: 'life-drain' },
      { type: 'siege-pressure', x: 30, y: 40, enemyCount: 6 },
    ]);

    expect(specs.map((spec) => spec.kind)).toEqual(['heal', 'siege']);
    expect(isCriticalEffect('siege')).toBe(true);
  });

  it('maps synergy triggers to a dedicated effect', () => {
    const specs = createEffectSpecs([
      { type: 'synergy-triggered', x: 120, y: 220, synergy: 'frostfire-calamity' },
    ]);

    expect(specs.map((spec) => spec.kind)).toEqual(['synergy']);
  });

  it('maps tribulation choice events to their dedicated visual effect', () => {
    const specs = createEffectSpecs([
      { type: 'tribulation-choice-offered', x: 1, y: 2, tribulation: 'thunder' },
      { type: 'tribulation-choice-selected', x: 1, y: 2, choice: 'blood-pact' },
    ]);

    expect(specs.map((spec) => spec.kind)).toEqual(['tribulation-choice', 'tribulation-choice']);
  });

  it('maps dao-yun rewards to a reward effect', () => {
    const specs = createEffectSpecs([
      { type: 'dao-yun-earned', x: 120, y: 220, wave: 1, amount: 1 },
    ]);

    expect(specs.map((spec) => spec.kind)).toEqual(['reward']);
  });

  it('maps real damage events to floating damage-number effects', () => {
    const specs = createEffectSpecs([
      {
        type: 'damage-dealt',
        x: 120,
        y: 220,
        amount: 48,
        source: 'flying-sword',
      } as CombatEvent,
    ]);

    expect(specs.map((spec) => spec.kind)).toEqual(['damage-number']);
    expect(specs[0].durationMs).toBe(520);
  });

  it('holds combat impacts long enough for each hit and kill to read clearly', () => {
    const specs = createEffectSpecs([
      { type: 'projectile-hit', x: 120, y: 220 },
      { type: 'boss-spawned', x: 120, y: 220, wave: 1 },
      { type: 'boss-cast-started', x: 120, y: 220, bossType: 'crimson', kind: 'primary' },
      { type: 'boss-skill-activated', x: 120, y: 220, bossType: 'crimson', kind: 'circle' },
      { type: 'boss-phase-changed', x: 120, y: 220, bossId: 1, bossType: 'crimson', phase: 2 },
    ]);

    expect(specs.map((spec) => spec.durationMs)).toEqual([440, 2100, 900, 700, 1800]);
  });

  it('gives ordinary kills and player damage stronger feedback windows', () => {
    const specs = createEffectSpecs([
      { type: 'enemy-killed', x: 120, y: 220 },
      { type: 'player-damaged', x: 120, y: 220, amount: 9 },
    ]);

    expect(specs.map((spec) => spec.durationMs)).toEqual([620, 500]);
  });

  it('holds awakening effects long enough for the upgraded transformation to read', () => {
    const specs = createEffectSpecs([
      { type: 'skill-awakened', x: 400, y: 300, upgrade: 'meteor-seal' },
    ]);

    expect(specs[0].durationMs).toBe(2300);
  });

  it('reserves every effect tier for critical attack warnings', () => {
    expect(EFFECT_BUDGETS).toEqual({ low: 45, medium: 90, high: 160 });
    expect(isCriticalEffect('ranged-windup')).toBe(true);
    expect(isCriticalEffect('boss-skill')).toBe(true);
    expect(isCriticalEffect('trail')).toBe(false);
  });
});
