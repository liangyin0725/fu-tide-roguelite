import type { CombatEvent, DamageSource, Enemy, GameState, Player } from './types';
import { CoreSkillPathRuntime } from './coreSkillPathRuntime';
import { AdvancedSkillPathRuntime } from './advancedSkillPathRuntime';

export interface SkillPathContext {
  state: GameState;
  player: Player;
  deltaMs: number;
  events: CombatEvent[];
  damage: (enemy: Enemy, amount: number, source: DamageSource) => void;
}

export class SkillPathRuntime {
  private readonly core = new CoreSkillPathRuntime();
  private readonly advanced = new AdvancedSkillPathRuntime();

  public update(context: SkillPathContext): void {
    this.core.update(context);
    this.advanced.update(context);
  }
}
