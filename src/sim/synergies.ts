import type { Player, SynergyId, UpgradeId } from './types';

export interface SynergyDefinition {
  name: string;
  symbol: string;
  requires: readonly [UpgradeId, UpgradeId];
  description: string;
}

export const SYNERGIES: Record<SynergyId, SynergyDefinition> = {
  'thunder-resonance': {
    name: '雷狱共鸣',
    symbol: '鸣',
    requires: ['thunder-ring', 'chain-lightning'],
    description: '雷环每秒额外连锁四名敌人，连锁伤害提高 20%',
  },
  'frostfire-calamity': {
    name: '冰火劫',
    symbol: '劫',
    requires: ['fire-burst', 'frost-seal'],
    description: '爆炎会冻结波及的普通怪，并打断它们的追击节奏',
  },
  'sword-ward': {
    name: '万剑护阵',
    symbol: '阵',
    requires: ['orbiting-blades', 'bullet-reprisal'],
    description: '剑轮形成连续挡弹环，被斩碎的弹幕会化为反射剑光',
  },
  'starfall-convergence': {
    name: '星火坠世',
    symbol: '星',
    requires: ['meteor-seal', 'north-star'],
    description: '每枚天火命中后向八方发射强化星芒',
  },
  'immortal-echo': {
    name: '不灭回响',
    symbol: '回',
    requires: ['golden-shield', 'spirit-jade'],
    description: '施放主动技能后获得短暂无敌，并恢复护盾',
  },
  'soul-execution': {
    name: '镇魂斩劫',
    symbol: '镇',
    requires: ['soul-pin', 'boss-slayer'],
    description: '钉魂命中劫主会中断其蓄力，并清除正在展开的劫术',
  },
  'eclipse-sanctum': {
    name: '日蚀禁界',
    symbol: '蚀',
    requires: ['solar-ray', 'void-bell'],
    description: '虚空铃会烙下日蚀印记，日轮命中印记者引发范围坍缩',
  },
  'sunblade-cascade': {
    name: '天光剑瀑',
    symbol: '瀑',
    requires: ['solar-ray', 'spirit-sword-rain'],
    description: '灵剑雨会烙下日蚀印记，日轮可引爆全部落剑印记',
  },
  'frozen-knell': {
    name: '寒渊禁钟',
    symbol: '禁',
    requires: ['frost-seal', 'void-bell'],
    description: '虚空铃冻结波及目标，并可在未觉醒时击碎范围内弹幕',
  },
  'gilded-sword-rain': {
    name: '金阙剑雨',
    symbol: '阙',
    requires: ['golden-shield', 'spirit-sword-rain'],
    description: '灵剑雨补满护盾时重铸金身，并重新启用破盾震击',
  },
};

export const SYNERGY_IDS = Object.keys(SYNERGIES) as SynergyId[];

export function hasSynergy(player: Player, synergy: SynergyId): boolean {
  return SYNERGIES[synergy].requires.every((upgrade) => isEquipped(player, upgrade));
}

export function getActiveSynergies(player: Player): SynergyId[] {
  return SYNERGY_IDS.filter((synergy) => hasSynergy(player, synergy));
}

export function getSynergiesActivatedByUpgrade(player: Player, pending: UpgradeId): SynergyId[] {
  const active = new Set(getActiveSynergies(player));
  return SYNERGY_IDS.filter((synergy) => {
    if (active.has(synergy) || !SYNERGIES[synergy].requires.includes(pending)) return false;
    return SYNERGIES[synergy].requires.every(
      (upgrade) => upgrade === pending || isEquipped(player, upgrade),
    );
  });
}

function isEquipped(player: Player, upgrade: UpgradeId): boolean {
  return player.upgradeLevels[upgrade] > 0
    && (player.equippedSkills.includes(upgrade) || player.equippedEnhancements.includes(upgrade));
}
