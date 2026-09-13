import type {
  GameState,
  InsightId,
  UpgradeChoice,
  UpgradeId,
  UpgradeLevels,
} from './types';
import {
  canEquipUpgrade,
  getEquippedForKind,
  recalculatePlayerBuild,
} from './loadout';
import {
  getUpgradeKind,
  getUpgradeMaxLevel,
  UPGRADE_IDS,
} from './upgradeCatalog';

export { UPGRADE_IDS } from './upgradeCatalog';

export type UpgradeCategory = 'offense' | 'arcane' | 'defense' | 'utility';

export interface UpgradeLabel {
  name: string;
  description: string;
  symbol: string;
  category: UpgradeCategory;
  awakeningName: string;
  awakeningSummary: string[];
}

export interface UpgradeResult {
  previousLevel: number;
  level: number;
  awakened: boolean;
}

export const INSIGHT_LABELS: Record<InsightId, { name: string; description: string; symbol: string }> = {
  'insight:damage': { name: '悟道·锋芒', description: '飞剑伤害永久提高 5 点', symbol: '锋' },
  'insight:vitality': { name: '悟道·炼体', description: '最大生命永久提高 12 点', symbol: '体' },
  'insight:speed': { name: '悟道·御风', description: '移动速度永久提高 4%', symbol: '风' },
  'insight:pickup': { name: '悟道·聚灵', description: '拾取范围永久提高 14', symbol: '灵' },
};

const INSIGHT_IDS = Object.keys(INSIGHT_LABELS) as InsightId[];

export const UPGRADE_LABELS: Record<UpgradeId, UpgradeLabel> = {
  'faster-swords': {
    name: '疾风飞剑',
    description: '飞剑冷却缩短 18%',
    symbol: '剑',
    category: 'offense',
    awakeningName: '无间剑域',
    awakeningSummary: ['攻击间隔额外缩短 40%', '最低攻击间隔降至 120ms'],
  },
  'heavier-swords': {
    name: '镇煞剑诀',
    description: '飞剑伤害提高 8 点',
    symbol: '斩',
    category: 'offense',
    awakeningName: '一剑破劫',
    awakeningSummary: ['飞剑伤害额外提高 36 点'],
  },
  'multi-swords': {
    name: '分光剑影',
    description: '每次额外发射一把飞剑',
    symbol: '影',
    category: 'offense',
    awakeningName: '万剑归宗',
    awakeningSummary: ['额外增加 2 把飞剑', '最多同时发射 6 把'],
  },
  'piercing-swords': {
    name: '透骨剑炁',
    description: '飞剑额外穿透一个敌人',
    symbol: '贯',
    category: 'offense',
    awakeningName: '洞彻万象',
    awakeningSummary: ['额外增加 4 次穿透', '最多穿透 7 个敌人'],
  },
  'thunder-ring': {
    name: '护身雷环',
    description: '扩大雷环范围，灼伤贴身敌人',
    symbol: '雷',
    category: 'arcane',
    awakeningName: '九霄雷狱',
    awakeningSummary: ['范围额外扩大 70', '雷环伤害提升至每秒 50'],
  },
  'chain-lightning': {
    name: '五雷连引',
    description: '飞剑命中时连锁附近敌人',
    symbol: '引',
    category: 'arcane',
    awakeningName: '雷动九天',
    awakeningSummary: ['伤害额外提高 24', '连锁目标提升至 4 个'],
  },
  'fire-burst': {
    name: '爆炎符',
    description: '飞剑命中时可能引发范围爆炎',
    symbol: '炎',
    category: 'arcane',
    awakeningName: '焚天劫火',
    awakeningSummary: ['触发率提升至 100%', '爆炎范围 140，伤害额外提高 36'],
  },
  'golden-shield': {
    name: '金光护体',
    description: '获得可抵挡伤害的护盾',
    symbol: '护',
    category: 'defense',
    awakeningName: '不灭金身',
    awakeningSummary: ['护盾上限额外提高 80', '护盾破碎时释放震击'],
  },
  'life-drain': {
    name: '饮露回生',
    description: '击杀敌人时有概率恢复少量生命',
    symbol: '生',
    category: 'defense',
    awakeningName: '生生不息',
    awakeningSummary: ['触发率提升至 45%', '每次触发恢复 4 生命'],
  },
  'soul-banner': {
    name: '摄魂幡',
    description: '扩大经验拾取范围',
    symbol: '摄',
    category: 'utility',
    awakeningName: '万魂朝宗',
    awakeningSummary: ['拾取范围提升至 220', '经验获取提升 35%'],
  },
  'swift-steps': {
    name: '踏罡步',
    description: '移动速度提高 12%',
    symbol: '行',
    category: 'utility',
    awakeningName: '咫尺天涯',
    awakeningSummary: ['移动速度额外提高 30%', '25% 概率闪避接触伤害'],
  },
  'vital-breath': {
    name: '调息回元',
    description: '最大生命提高并恢复 20 点',
    symbol: '元',
    category: 'defense',
    awakeningName: '玄元不灭',
    awakeningSummary: ['最大生命额外提高 70', '回满生命并每秒恢复 1 点'],
  },
  'frost-seal': {
    name: '玄冰符',
    description: '飞剑令敌人减速 1.5 秒',
    symbol: '冰',
    category: 'arcane',
    awakeningName: '万里冰封',
    awakeningSummary: ['普通敌人冻结 1 秒', '劫主承受 30% 减速'],
  },
  'orbiting-blades': {
    name: '绕身剑轮',
    description: '召唤绕身飞剑持续切割敌人',
    symbol: '轮',
    category: 'offense',
    awakeningName: '六道剑轮',
    awakeningSummary: ['剑轮增至 6 把', '范围 82，每秒伤害 48'],
  },
  'meteor-seal': {
    name: '天火陨印',
    description: '周期召来天火轰击敌人',
    symbol: '陨',
    category: 'arcane',
    awakeningName: '三星坠世',
    awakeningSummary: ['每 4 秒降下 3 枚天火', '每枚造成 90 点伤害'],
  },
  'boss-slayer': {
    name: '斩劫诀',
    description: '对劫主造成更多伤害',
    symbol: '劫',
    category: 'offense',
    awakeningName: '破劫飞升',
    awakeningSummary: ['对劫主伤害提升至 200%'],
  },
  'north-star': {
    name: '北斗星芒',
    description: '周期向八方发射星芒',
    symbol: '斗',
    category: 'arcane',
    awakeningName: '斗转星河',
    awakeningSummary: ['形成两轮旋转星阵', '星芒伤害与穿透大幅提高'],
  },
  'bullet-reprisal': {
    name: '破魔真炁',
    description: '击碎弹幕时释放反击冲击',
    symbol: '破',
    category: 'defense',
    awakeningName: '破魔回响',
    awakeningSummary: ['冲击范围与伤害大幅提高', '反击连锁附近敌人'],
  },
  'spirit-jade': {
    name: '聚灵玉',
    description: '缩短主动技能冷却',
    symbol: '玉',
    category: 'utility',
    awakeningName: '灵台不竭',
    awakeningSummary: ['主动技能冷却进一步缩短', '施放时恢复生命与护盾'],
  },
  'soul-pin': {
    name: '地煞钉魂',
    description: '攻击可能击退并短暂定身',
    symbol: '钉',
    category: 'arcane',
    awakeningName: '万魂镇岳',
    awakeningSummary: ['周期定住附近普通怪', '劫主改为大幅减速'],
  },
  'solar-ray': {
    name: '日轮剑光', description: '周期灼击最近的远处敌人', symbol: '日', category: 'arcane',
    awakeningName: '大日贯空', awakeningSummary: ['剑光间隔大幅缩短', '伤害与射程大幅提高'],
  },
  'void-bell': {
    name: '太虚钟', description: '周期震伤附近敌人', symbol: '钟', category: 'defense',
    awakeningName: '万法皆寂', awakeningSummary: ['震波范围与伤害大幅提高', '震波击碎范围内弹幕'],
  },
  'spirit-sword-rain': {
    name: '灵泉剑瀑', description: '周期降下多段灵剑', symbol: '瀑', category: 'offense',
    awakeningName: '天河倒悬', awakeningSummary: ['灵剑数量提升至 8', '伤害与施放频率大幅提高'],
  },
  'storm-net': {
    name: '天罡雷网', description: '周期雷击多个远处敌人', symbol: '网', category: 'arcane',
    awakeningName: '雷网镇界', awakeningSummary: ['雷击目标大幅增加', '被击中的敌人短暂定身'],
  },
  'mirror-sigil': {
    name: '玄镜符', description: '周期拦截弹幕并反击施法者', symbol: '镜', category: 'defense',
    awakeningName: '万象反照', awakeningSummary: ['反击扩散至附近敌人', '反照范围与伤害大幅提高'],
  },
};

export const AWAKENING_SURGE_SUMMARIES: Partial<Record<UpgradeId, string>> = {
  'thunder-ring': '雷狱震击撕裂近处敌群',
  'chain-lightning': '连续雷链贯穿最近敌群',
  'fire-burst': '劫火从脚下爆发并焚尽近敌',
  'golden-shield': '护盾回满并释放护体震波',
  'frost-seal': '大范围冻结敌群，劫主陷入迟滞',
  'orbiting-blades': '剑轮斩碎近身弹幕并横扫包围圈',
  'meteor-seal': '密集陨星连坠最近敌群',
  'north-star': '双层星阵立刻齐射八方',
  'bullet-reprisal': '反击震波清空近处弹幕',
  'soul-pin': '魂钉定住周遭敌群，劫主被压制',
  'solar-ray': '三道日轮剑光贯穿最近敌群',
  'void-bell': '钟鸣扩张并清除近处弹幕',
  'spirit-sword-rain': '灵剑瀑布骤落最近敌群',
};

export function createEmptyUpgradeLevels(): UpgradeLevels {
  return Object.fromEntries(UPGRADE_IDS.map((id) => [id, 0])) as UpgradeLevels;
}

export function createUpgradeChoices(state: GameState): UpgradeChoice[] {
  const available = getAvailable(state).filter((id) => canEquipUpgrade(state.player, id));
  if (available.length === 0) {
    const offset = (state.player.level + state.bossesDefeated) % INSIGHT_IDS.length;
    return [0, 1, 2].map((index) => INSIGHT_IDS[(offset + index) % INSIGHT_IDS.length]);
  }
  const owned = available.filter((id) => state.player.upgradeLevels[id] > 0);
  const fresh = available.filter((id) => state.player.upgradeLevels[id] === 0);
  const choices: UpgradeId[] = [];
  let seed = choiceSeed(state, 0x9e3779b9);

  if (owned.length > 0) {
    seed = addSeededChoice(choices, owned, seed);
  }
  if (fresh.length > 0) {
    seed = addSeededChoice(choices, fresh, seed);
  }
  addSeededChoices(choices, available, seed, 3);
  return choices;
}

export function isInsightChoice(choice: UpgradeChoice): choice is InsightId {
  return choice.startsWith('insight:');
}

export function applyInsight(state: GameState, insight: InsightId): void {
  state.player.insightLevels[insight] += 1;
  recalculatePlayerBuild(state.player);
}

export function createTreasureChoices(state: GameState): UpgradeId[] {
  const available = getAvailable(state);
  const owned = available
    .filter((id) => state.player.upgradeLevels[id] > 0)
    .sort((a, b) => {
      const aRemaining = getUpgradeMaxLevel(a) - state.player.upgradeLevels[a];
      const bRemaining = getUpgradeMaxLevel(b) - state.player.upgradeLevels[b];
      return aRemaining - bRemaining;
    });
  const fresh = available.filter((id) => state.player.upgradeLevels[id] === 0);
  const choices: UpgradeId[] = [];
  let seed = choiceSeed(state, 0x85ebca6b);

  for (const pool of [owned, fresh]) {
    while (choices.length < 3 && pool.some((id) => !choices.includes(id))) {
      seed = addSeededChoice(choices, pool, seed);
    }
  }
  return choices;
}

export function applyUpgrade(state: GameState, upgrade: UpgradeId): UpgradeResult {
  const currentLevel = state.player.upgradeLevels[upgrade];
  const maxLevel = getUpgradeMaxLevel(upgrade);
  if (currentLevel >= maxLevel || !canEquipUpgrade(state.player, upgrade)) {
    return { previousLevel: currentLevel, level: currentLevel, awakened: false };
  }
  const level = currentLevel + 1;
  const awakened = level === maxLevel;
  const equipped = getEquippedForKind(state.player, getUpgradeKind(upgrade));
  if (currentLevel === 0 && !equipped.includes(upgrade)) {
    equipped.push(upgrade);
  }
  const previousHp = state.player.hp;
  state.player.upgradeLevels[upgrade] = level;
  recalculatePlayerBuild(state.player);
  if (upgrade === 'golden-shield') {
    state.player.shield = state.player.maxShield;
  } else if (upgrade === 'vital-breath') {
    state.player.hp = awakened
      ? state.player.maxHp
      : Math.min(state.player.maxHp, previousHp + 20);
  }
  return { previousLevel: currentLevel, level, awakened };
}

function getAvailable(state: GameState): UpgradeId[] {
  return UPGRADE_IDS.filter((id) => state.player.upgradeLevels[id] < getUpgradeMaxLevel(id));
}

function choiceSeed(state: GameState, salt: number): number {
  return (state.runSeed + state.player.level * salt + state.bossesDefeated * 0xc2b2ae35) >>> 0;
}

function nextSeed(seed: number): number {
  return (Math.imul(seed, 1664525) + 1013904223) >>> 0;
}

function addSeededChoice(choices: UpgradeId[], pool: UpgradeId[], seed: number): number {
  const candidates = pool.filter((id) => !choices.includes(id));
  if (candidates.length === 0) {
    return seed;
  }
  const next = nextSeed(seed);
  choices.push(candidates[next % candidates.length]);
  return next;
}

function addSeededChoices(
  choices: UpgradeId[],
  pool: UpgradeId[],
  initialSeed: number,
  limit: number,
): void {
  let seed = initialSeed;
  while (choices.length < Math.min(limit, pool.length)) {
    seed = addSeededChoice(choices, pool, seed);
  }
}
