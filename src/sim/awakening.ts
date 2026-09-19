import { getUpgradeKind } from './upgradeCatalog';
import type { Player, UpgradeId } from './types';

export const AWAKENING_REQUIREMENTS: Partial<Record<UpgradeId, UpgradeId>> = {};

export function getAwakeningRequirement(upgrade: UpgradeId): UpgradeId | null {
  return AWAKENING_REQUIREMENTS[upgrade] ?? null;
}

export function isUpgradeAwakened(player: Player, upgrade: UpgradeId): boolean {
  const level = player.upgradeLevels[upgrade];
  if (getUpgradeKind(upgrade) === 'enhancement') return level >= 4;
  return level >= 6;
}

export function getAwakenedSkills(player: Player): UpgradeId[] {
  return player.equippedSkills.filter((upgrade) => isUpgradeAwakened(player, upgrade));
}
