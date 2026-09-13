import type { CombatEvent } from '../sim/types';

export type EffectKind =
  | 'trail'
  | 'impact'
  | 'damage-number'
  | 'kill'
  | 'damage'
  | 'heal'
  | 'siege'
  | 'shield'
  | 'lightning'
  | 'fire'
  | 'level'
  | 'boss'
  | 'awakening'
  | 'meteor'
  | 'dodge'
  | 'frost'
  | 'shield-break'
  | 'chest'
  | 'reward'
  | 'character-unlock'
  | 'boss-cast'
  | 'boss-skill'
  | 'boss-phase'
  | 'boss-heal'
  | 'boss-objective'
  | 'star'
  | 'reprisal'
  | 'soul-pin'
  | 'ranged-windup'
  | 'enemy-shot'
  | 'bullet-break'
  | 'active-cast'
  | 'active-level'
  | 'elite'
  | 'tribulation'
  | 'tribulation-choice'
  | 'tribulation-seal'
  | 'objective'
  | 'objective-field'
  | 'synergy'
  | 'glyph'
  | 'frost-domain'
  | 'rift-return'
  | 'star-pull';

export interface EffectSpec {
  kind: EffectKind;
  durationMs: number;
  event: CombatEvent;
}

export const EFFECT_BUDGETS = { low: 45, medium: 90, high: 160 } as const;

export function isCriticalEffect(kind: EffectKind): boolean {
  return kind === 'ranged-windup'
    || kind === 'boss-cast'
    || kind === 'boss-skill'
    || kind === 'boss-phase'
    || kind === 'siege';
}

export function createEffectSpecs(events: CombatEvent[]): EffectSpec[] {
  return events.map((event) => {
    switch (event.type) {
      case 'projectile-fired':
        return { kind: 'trail', durationMs: 220, event };
      case 'projectile-hit':
        return { kind: 'impact', durationMs: 440, event };
      case 'damage-dealt':
        return { kind: 'damage-number', durationMs: 520, event };
      case 'enemy-killed':
        return { kind: 'kill', durationMs: 620, event };
      case 'player-damaged':
        return { kind: 'damage', durationMs: 500, event };
      case 'player-healed':
        return { kind: 'heal', durationMs: 620, event };
      case 'siege-pressure':
        return { kind: 'siege', durationMs: 900, event };
      case 'glyph-volley':
        return { kind: 'glyph', durationMs: event.ritual === 'bolt' ? 420 : 680, event };
      case 'shield-blocked':
        return { kind: 'shield', durationMs: 420, event };
      case 'chain-lightning':
        return { kind: 'lightning', durationMs: 180, event };
      case 'fire-burst':
        return { kind: 'fire', durationMs: 520, event };
      case 'level-up':
        return { kind: 'level', durationMs: 1050, event };
      case 'boss-spawned':
        return { kind: 'boss', durationMs: 2100, event };
      case 'boss-objective-spawned':
        return { kind: 'boss-objective', durationMs: 1200, event };
      case 'boss-objective-resolved':
        return { kind: 'boss-objective', durationMs: 1100, event };
      case 'skill-awakened':
        return { kind: 'awakening', durationMs: 2300, event };
      case 'meteor-strike':
        return { kind: 'meteor', durationMs: 620, event };
      case 'dodge':
        return { kind: 'dodge', durationMs: 360, event };
      case 'frost-hit':
        return { kind: 'frost', durationMs: event.frozen ? 760 : 440, event };
      case 'shield-broken':
        return { kind: 'shield-break', durationMs: 620, event };
      case 'chest-dropped':
        return { kind: 'chest', durationMs: 900, event };
      case 'dao-yun-earned':
      case 'spirit-ore-earned':
        return { kind: 'reward', durationMs: 780, event };
      case 'boss-reward-burst':
        return { kind: 'reward', durationMs: 1200, event };
      case 'hidden-character-unlocked':
        return { kind: 'character-unlock', durationMs: 2200, event };
      case 'boss-cast-started':
        return { kind: 'boss-cast', durationMs: 900, event };
      case 'boss-skill-activated':
        return { kind: 'boss-skill', durationMs: 700, event };
      case 'boss-phase-changed':
        return { kind: 'boss-phase', durationMs: 1800, event };
      case 'boss-healed':
        return { kind: 'boss-heal', durationMs: 700, event };
      case 'star-volley':
        return { kind: 'star', durationMs: 520, event };
      case 'bullet-reprisal':
        return { kind: 'reprisal', durationMs: 440, event };
      case 'soul-pinned':
        return { kind: 'soul-pin', durationMs: event.awakened ? 760 : 360, event };
      case 'frost-domain':
        return { kind: 'frost-domain', durationMs: event.awakened ? 1180 : 860, event };
      case 'rift-return':
        return { kind: 'rift-return', durationMs: event.awakened ? 680 : 500, event };
      case 'star-pull':
        return { kind: 'star-pull', durationMs: event.awakened ? 1180 : 860, event };
      case 'ranged-windup':
        return { kind: 'ranged-windup', durationMs: 520, event };
      case 'enemy-bullet-fired':
        return { kind: 'enemy-shot', durationMs: 180, event };
      case 'enemy-bullet-broken':
        return { kind: 'bullet-break', durationMs: 320, event };
      case 'active-skill-cast':
        return {
          kind: 'active-cast',
          durationMs: event.skill === 'talisman-ruin' ? 680 : event.skill === 'dimension-step' ? 840 : 980,
          event,
        };
      case 'active-skill-leveled':
        return { kind: 'active-level', durationMs: 1100, event };
      case 'elite-squad-spawned':
        return { kind: 'elite', durationMs: 1000, event };
      case 'elite-effect':
        return { kind: 'elite', durationMs: 620, event };
      case 'tribulation-changed':
        return { kind: 'tribulation', durationMs: 1500, event };
      case 'tribulation-choice-offered':
        return { kind: 'tribulation-choice', durationMs: 1100, event };
      case 'tribulation-choice-selected':
        return { kind: 'tribulation-choice', durationMs: 850, event };
      case 'tribulation-seal-gained':
        return { kind: 'tribulation-seal', durationMs: 1200, event };
      case 'tribulation-seal-triggered':
        return { kind: 'tribulation-seal', durationMs: 620, event };
      case 'objective-spawned':
        return { kind: 'objective', durationMs: 1200, event };
      case 'objective-resolved':
        return { kind: 'objective', durationMs: 1000, event };
      case 'objective-field-activated':
        return { kind: 'objective-field', durationMs: 1300, event };
      case 'synergy-triggered':
        return { kind: 'synergy', durationMs: 680, event };
    }
  });
}
