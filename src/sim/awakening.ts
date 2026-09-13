import { getUpgradeKind } from './upgradeCatalog';
import type { Player, UpgradeId } from './types';

export const AWAKENING_REQUIREMENTS: Partial<Record<UpgradeId, UpgradeId>> = {
  'meteor-seal': 'boss-slayer',
  'spirit-sword-rain': 'multi-swords',
  'rift-return': 'piercing-swords',
  'solar-ray': 'faster-swords',
};

export function getAwakeningRequirement(upgrade: UpgradeId): UpgradeId | null {
  return AWAKENING_REQUIREMENTS[upgrade] ?? null;
}

export function isUpgradeAwakened(player: Player, upgrade: UpgradeId): boolean {
  const level = player.upgradeLevels[upgrade];
  if (getUpgradeKind(upgrade) === 'enhancement') return level >= 4;
  if (level < 6) return false;
  const requirement = getAwakeningRequirement(upgrade);
  return requirement === null || (
    player.upgradeLevels[requirement] > 0
    && player.equippedEnhancements.includes(requirement)
  );
}

export function getAwakenedSkills(player: Player): UpgradeId[] {
  return player.equippedSkills.filter((upgrade) => isUpgradeAwakened(player, upgrade));
}
