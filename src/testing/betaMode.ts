export const BETA_MODE_PASSPHRASE = '作者真厉害';

export function isBetaModePassphrase(value: string): boolean {
  return value.trim() === BETA_MODE_PASSPHRASE;
}
import type { GameState } from '../sim/types';
import { SKILL_IDS } from '../sim/upgradeCatalog';
import type { SkillId } from '../sim/skillPaths';


export function canLaunchBetaLoadout(state: GameState): boolean {
  return state.betaSkillSelections.length > 0 && state.betaSkillSelections.every((skill) => {
    if (!SKILL_IDS.includes(skill as SkillId)) return false;
    const level = state.betaSkillLevels[skill];
    const path = state.betaSkillPaths[skill as SkillId];
    return Number.isInteger(level) && level >= 1 && level <= 6
      && (level < 3 || path === 'a' || path === 'b');
  });
}
