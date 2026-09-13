import type { Player, UpgradeId } from './types';
import { getEquippedForKind, recalculatePlayerBuild } from './loadout';
import { getUpgradeKind, getUpgradeMaxLevel, type UpgradeKind } from './upgradeCatalog';

export interface UpgradePreview {
  kind: UpgradeKind;
  currentLevel: number;
  nextLevel: number;
  maxLevel: number;
  awakens: boolean;
  lines: string[];
}

interface Metric {
  label: string;
  key: NumericPlayerKey;
  scale?: number;
  suffix?: string;
}

type NumericPlayerKey = {
  [K in keyof Player]: Player[K] extends number ? K : never;
}[keyof Player];

const METRICS: Record<UpgradeId, Metric[]> = {
  'faster-swords': [{ label: '攻击间隔', key: 'attackCooldownMs', scale: 0.001, suffix: '秒' }],
  'heavier-swords': [{ label: '飞剑伤害', key: 'attackDamage' }],
  'multi-swords': [{ label: '飞剑数量', key: 'projectileCount' }],
  'piercing-swords': [{ label: '穿透次数', key: 'projectilePierce' }],
  'thunder-ring': [
    { label: '雷环范围', key: 'thunderRadius' },
    { label: '每秒伤害', key: 'thunderDamagePerSecond' },
  ],
  'storm-net': [
    { label: '雷击伤害', key: 'stormNetDamage' },
    { label: '雷击目标', key: 'stormNetTargets' },
  ],
  'mirror-sigil': [
    { label: '反击伤害', key: 'mirrorSigilDamage' },
    { label: '反照范围', key: 'mirrorSigilRadius' },
  ],
  'chain-lightning': [
    { label: '连锁伤害', key: 'chainLightningDamage' },
    { label: '连锁目标', key: 'chainLightningTargets' },
  ],
  'fire-burst': [
    { label: '爆炎伤害', key: 'fireBurstDamage' },
    { label: '触发概率', key: 'fireBurstChance', scale: 100, suffix: '%' },
    { label: '爆炎范围', key: 'fireBurstRadius' },
  ],
  'golden-shield': [
    { label: '护盾上限', key: 'maxShield' },
    { label: '破盾震击', key: 'shieldBreakDamage' },
  ],
  'life-drain': [
    { label: '触发回复', key: 'lifeOnKill' },
    { label: '触发概率', key: 'lifeOnKillChance', scale: 100, suffix: '%' },
  ],
  'soul-banner': [
    { label: '拾取范围', key: 'pickupRadius' },
    { label: '经验倍率', key: 'experienceMultiplier', scale: 100, suffix: '%' },
  ],
  'swift-steps': [
    { label: '移动速度', key: 'speed' },
    { label: '闪避概率', key: 'dodgeChance', scale: 100, suffix: '%' },
  ],
  'vital-breath': [
    { label: '最大生命', key: 'maxHp' },
    { label: '每秒回复', key: 'hpRegenPerSecond' },
  ],
  'frost-seal': [
    { label: '减速幅度', key: 'frostSlowPercent', scale: 100, suffix: '%' },
    { label: '冻结时长', key: 'frostFreezeMs', scale: 0.001, suffix: '秒' },
  ],
  'orbiting-blades': [
    { label: '剑轮数量', key: 'orbitingBladeCount' },
    { label: '每秒伤害', key: 'orbitingBladeDamagePerSecond' },
    { label: '剑轮范围', key: 'orbitingBladeRadius' },
  ],
  'meteor-seal': [
    { label: '天火间隔', key: 'meteorCooldownMs', scale: 0.001, suffix: '秒' },
    { label: '天火数量', key: 'meteorCount' },
    { label: '单枚伤害', key: 'meteorDamage' },
  ],
  'boss-slayer': [{ label: '劫主伤害', key: 'bossDamageMultiplier', scale: 100, suffix: '%' }],
  'north-star': [
    { label: '星芒间隔', key: 'northStarCooldownMs', scale: 0.001, suffix: '秒' },
    { label: '星芒伤害', key: 'northStarDamage' },
    { label: '星芒数量', key: 'northStarShotCount' },
    { label: '穿透次数', key: 'northStarPierce' },
  ],
  'bullet-reprisal': [
    { label: '反击伤害', key: 'bulletReprisalDamage' },
    { label: '反击范围', key: 'bulletReprisalRadius' },
    { label: '连锁目标', key: 'bulletReprisalChains' },
  ],
  'spirit-jade': [
    { label: '主动冷却倍率', key: 'activeCooldownMultiplier', scale: 100, suffix: '%' },
    { label: '施放回复', key: 'activeCastHeal' },
    { label: '施放护盾', key: 'activeCastShield' },
  ],
  'soul-pin': [
    { label: '定身概率', key: 'soulPinChance', scale: 100, suffix: '%' },
    { label: '定身时长', key: 'soulPinRootMs', scale: 0.001, suffix: '秒' },
    { label: '击退强度', key: 'soulPinKnockback' },
    { label: '镇魂脉冲', key: 'soulPinPulseCooldownMs', scale: 0.001, suffix: '秒' },
  ],
  'solar-ray': [
    { label: '剑光间隔', key: 'solarRayCooldownMs', scale: 0.001, suffix: '秒' },
    { label: '剑光伤害', key: 'solarRayDamage' },
    { label: '剑光射程', key: 'solarRayRange' },
  ],
  'void-bell': [
    { label: '钟鸣间隔', key: 'voidBellCooldownMs', scale: 0.001, suffix: '秒' },
    { label: '钟鸣伤害', key: 'voidBellDamage' },
    { label: '钟鸣范围', key: 'voidBellRadius' },
  ],
  'spirit-sword-rain': [
    { label: '剑瀑间隔', key: 'swordRainCooldownMs', scale: 0.001, suffix: '秒' },
    { label: '单剑伤害', key: 'swordRainDamage' },
    { label: '灵剑数量', key: 'swordRainCount' },
  ],
};

export function createUpgradePreview(player: Player, upgrade: UpgradeId): UpgradePreview {
  const currentLevel = player.upgradeLevels[upgrade];
  const maxLevel = getUpgradeMaxLevel(upgrade);
  const nextLevel = Math.min(maxLevel, currentLevel + 1);
  const current = clonePlayer(player);
  const next = clonePlayer(player);
  recalculatePlayerBuild(current);
  const equipped = getEquippedForKind(next, getUpgradeKind(upgrade));
  if (!equipped.includes(upgrade)) equipped.push(upgrade);
  next.upgradeLevels[upgrade] = nextLevel;
  recalculatePlayerBuild(next);

  return {
    kind: getUpgradeKind(upgrade),
    currentLevel,
    nextLevel,
    maxLevel,
    awakens: currentLevel < maxLevel && nextLevel === maxLevel,
    lines: METRICS[upgrade]
      .map((metric) => formatMetric(metric, current, next))
      .filter((line): line is string => line !== null),
  };
}

function clonePlayer(player: Player): Player {
  return {
    ...player,
    lastMoveDirection: { ...player.lastMoveDirection },
    equippedSkills: [...player.equippedSkills],
    equippedEnhancements: [...player.equippedEnhancements],
    insightLevels: { ...player.insightLevels },
    upgradeLevels: { ...player.upgradeLevels },
  };
}

function formatMetric(metric: Metric, current: Player, next: Player): string | null {
  const scale = metric.scale ?? 1;
  const before = Number(current[metric.key]) * scale;
  const after = Number(next[metric.key]) * scale;
  if (Math.abs(after - before) < 0.0001) return null;
  const suffix = metric.suffix ?? '';
  const delta = after - before;
  const deltaPrefix = delta > 0 ? '+' : '';
  return `${metric.label} ${formatNumber(before)}${suffix} → ${formatNumber(after)}${suffix}（${deltaPrefix}${formatNumber(delta)}${suffix}）`;
}

function formatNumber(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}
