import type { UpgradeId, UpgradeLevels } from '../sim/types';

export interface AwakenedSkillGlyph {
  upgrade: UpgradeId;
  color: number;
  symbol: 'diamond' | 'star' | 'ring' | 'flare';
}

const GLYPH_STYLES: Partial<Record<UpgradeId, Omit<AwakenedSkillGlyph, 'upgrade'>>> = {
  'thunder-ring': { color: 0x61f5ff, symbol: 'ring' },
  'chain-lightning': { color: 0x61f5ff, symbol: 'flare' },
  'fire-burst': { color: 0xff5a42, symbol: 'flare' },
  'golden-shield': { color: 0xf6d365, symbol: 'ring' },
  'frost-seal': { color: 0x8ffcff, symbol: 'diamond' },
  'orbiting-blades': { color: 0xf6d365, symbol: 'diamond' },
  'meteor-seal': { color: 0xff8a4c, symbol: 'flare' },
  'north-star': { color: 0xffffff, symbol: 'star' },
  'bullet-reprisal': { color: 0x8d7cff, symbol: 'ring' },
  'soul-pin': { color: 0xb89cff, symbol: 'diamond' },
  'solar-ray': { color: 0xf6d365, symbol: 'flare' },
  'void-bell': { color: 0x8d7cff, symbol: 'ring' },
  'storm-net': { color: 0x4edfff, symbol: 'flare' },
  'mirror-sigil': { color: 0xd4c8ff, symbol: 'diamond' },
  'spirit-sword-rain': { color: 0xe9fbff, symbol: 'star' },
};

export function getAwakenedSkillGlyphs(
  equippedSkills: UpgradeId[],
  upgradeLevels: UpgradeLevels,
): AwakenedSkillGlyph[] {
  return equippedSkills.flatMap((upgrade) => {
    const style = GLYPH_STYLES[upgrade];
    return style && upgradeLevels[upgrade] >= 6 ? [{ upgrade, ...style }] : [];
  });
}
