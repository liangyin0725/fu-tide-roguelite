import type { UpgradeId } from './types';

export type UpgradeKind = 'skill' | 'enhancement';

export const SKILL_IDS = [
  'thunder-ring',
  'chain-lightning',
  'fire-burst',
  'golden-shield',
  'frost-seal',
  'orbiting-blades',
  'meteor-seal',
  'north-star',
  'bullet-reprisal',
  'soul-pin',
  'solar-ray',
  'void-bell',
  'spirit-sword-rain',
  'storm-net',
  'mirror-sigil',
  'frost-domain',
  'rift-return',
  'star-pull',
] as const satisfies readonly UpgradeId[];

export const ENHANCEMENT_IDS = [
  'faster-swords',
  'heavier-swords',
  'multi-swords',
  'piercing-swords',
  'life-drain',
  'soul-banner',
  'swift-steps',
  'vital-breath',
  'boss-slayer',
  'spirit-jade',
] as const satisfies readonly UpgradeId[];

export const UPGRADE_IDS = [...SKILL_IDS, ...ENHANCEMENT_IDS] as const;

const SKILL_SET = new Set<UpgradeId>(SKILL_IDS);

export function getUpgradeKind(upgrade: UpgradeId): UpgradeKind {
  return SKILL_SET.has(upgrade) ? 'skill' : 'enhancement';
}

export function getUpgradeMaxLevel(upgrade: UpgradeId): 4 | 6 {
  return getUpgradeKind(upgrade) === 'skill' ? 6 : 4;
}
