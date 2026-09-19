import type { Player, UpgradeId } from './types';
import { getUpgradeKind, type UpgradeKind } from './upgradeCatalog';
import { isUpgradeAwakened } from './awakening';
import { applyMetaTalents } from '../meta/metaProgression';

export const MAX_SKILL_SLOTS = 5;
export const MAX_ENHANCEMENT_SLOTS = 6;

export function getEquippedForKind(player: Player, kind: UpgradeKind): UpgradeId[] {
  return kind === 'skill' ? player.equippedSkills : player.equippedEnhancements;
}

export function getLoadoutSlotLimit(player: Player, kind: UpgradeKind): number {
  return kind === 'skill'
    ? player.skillSlotLimit ?? MAX_SKILL_SLOTS
    : player.enhancementSlotLimit ?? MAX_ENHANCEMENT_SLOTS;
}

export function getAllEquipped(player: Player): UpgradeId[] {
  return [...player.equippedSkills, ...player.equippedEnhancements];
}

export function canEquipUpgrade(player: Player, upgrade: UpgradeId): boolean {
  const kind = getUpgradeKind(upgrade);
  const equipped = getEquippedForKind(player, kind);
  const limit = getLoadoutSlotLimit(player, kind);
  return equipped.includes(upgrade) || equipped.length < limit;
}

export function recalculatePlayerBuild(player: Player): void {
  const currentHp = player.hp;
  const currentShield = player.shield;
  resetDerivedStats(player);
  for (const upgrade of getAllEquipped(player)) {
    applyUpgradeLevelEffects(player, upgrade, player.upgradeLevels[upgrade]);
  }
  player.attackDamage += player.insightLevels['insight:damage'] * 5;
  player.maxHp += player.insightLevels['insight:vitality'] * 12;
  player.speed *= 1 + player.insightLevels['insight:speed'] * 0.04;
  player.pickupRadius += player.insightLevels['insight:pickup'] * 14;
  if (player.characterId === 'xuan-jian') {
    player.attackDamage *= 1.1;
  } else if (player.characterId === 'lei-zhuan') {
    player.maxHp *= 0.9;
    player.thunderDamagePerSecond *= 1.2;
    player.chainLightningDamage *= 1.2;
    player.fireBurstDamage *= 1.2;
    player.meteorDamage *= 1.2;
    player.northStarDamage *= 1.2;
  } else if (player.characterId === 'shou-yi') {
    player.maxHp *= 1.25;
    player.maxShield *= 1.25;
    player.speed *= 0.95;
  } else if (player.characterId === 'jing-po') {
    player.maxHp *= 0.9;
    player.bulletReprisalDamage *= 1.4;
    player.bulletReprisalRadius *= 1.6;
    player.bulletReprisalChains += 1;
    player.mirrorSigilDamage *= 1.4;
    player.mirrorSigilRadius *= 1.18;
    player.mirrorSigilChains += 1;
    player.mirrorSigilCooldownMs *= 0.6;
    player.voidBellCooldownMs *= 0.88;
  }
  applyMetaTalents(player);
  applySkillCooldownReduction(player);
  player.hp = Math.min(currentHp, player.maxHp);
  player.shield = Math.min(currentShield, player.maxShield);
  if (!player.equippedSkills.includes('north-star')) player.northStarTimerMs = 0;
  if (!player.equippedSkills.includes('soul-pin')) player.soulPinPulseTimerMs = 0;
  if (!player.equippedSkills.includes('meteor-seal')) player.meteorTimerMs = 0;
}

function resetDerivedStats(player: Player): void {
  player.maxHp = 100;
  player.speed = 245;
  player.attackDamage = 18;
  player.attackCooldownMs = 650;
  player.projectileCount = 1;
  player.projectilePierce = 0;
  player.thunderRadius = 0;
  player.thunderDamagePerSecond = 10;
  player.chainLightningDamage = 0;
  player.chainLightningTargets = 1;
  player.fireBurstDamage = 0;
  player.fireBurstChance = 0;
  player.fireBurstRadius = 90;
  player.maxShield = 0;
  player.shieldBreakDamage = 0;
  player.shieldBreakReady = false;
  player.lifeOnKill = 0;
  player.lifeOnKillChance = 0;
  player.hpRegenPerSecond = 0;
  player.pickupRadius = 34;
  player.experienceMultiplier = 1;
  player.arcaneDamageMultiplier = 1;
  player.dodgeChance = 0;
  player.frostSlowPercent = 0;
  player.frostFreezeMs = 0;
  player.orbitingBladeCount = 0;
  player.orbitingBladeDamagePerSecond = 0;
  player.orbitingBladeRadius = 62;
  player.meteorCooldownMs = 0;
  player.meteorCount = 0;
  player.meteorDamage = 0;
  player.bossDamageMultiplier = 1;
  player.northStarCooldownMs = 0;
  player.northStarDamage = 0;
  player.northStarShotCount = 0;
  player.northStarPierce = 0;
  player.bulletReprisalDamage = 0;
  player.bulletReprisalRadius = 0;
  player.bulletReprisalChains = 0;
  player.skillCooldownReduction = 0;
  player.activeCooldownMultiplier = 1;
  player.activeCastHeal = 0;
  player.activeCastShield = 0;
  player.soulPinChance = 0;
  player.soulPinRootMs = 0;
  player.soulPinKnockback = 0;
  player.soulPinPulseCooldownMs = 0;
  player.solarRayCooldownMs = 0;
  player.solarRayDamage = 0;
  player.solarRayRange = 0;
  player.voidBellCooldownMs = 0;
  player.voidBellDamage = 0;
  player.voidBellRadius = 0;
  player.voidBellBreaksBullets = false;
  player.swordRainCooldownMs = 0;
  player.swordRainDamage = 0;
  player.swordRainCount = 0;
  player.stormNetCooldownMs = 0;
  player.stormNetDamage = 0;
  player.stormNetTargets = 0;
  player.stormNetRootMs = 0;
  player.mirrorSigilCooldownMs = 0;
  player.mirrorSigilDamage = 0;
  player.mirrorSigilRadius = 0;
  player.mirrorSigilChains = 0;
  player.frostDomainCooldownMs = 0;
  player.frostDomainRadius = 0;
  player.frostDomainDamage = 0;
  player.frostDomainFreezeMs = 0;
  player.riftReturnCooldownMs = 0;
  player.riftReturnDamage = 0;
  player.riftReturnRange = 0;
  player.riftReturnEchoes = 0;
  player.starPullCooldownMs = 0;
  player.starPullRadius = 0;
  player.starPullDamage = 0;
  player.starPullForce = 0;
  player.starPullBreaksBullets = false;
}

export function applyUpgradeLevelEffects(player: Player, upgrade: UpgradeId, level: number): void {
  if (level <= 0) return;
  const skillAwakened = isUpgradeAwakened(player, upgrade);
  const skillLevel = Math.min(level, 5);
  const enhancementAwakened = level >= 4;
  const enhancementLevels = Math.min(level, 3);
  switch (upgrade) {
    case 'faster-swords':
      player.skillCooldownReduction = Math.min(0.32, level * 0.08);
      break;
    case 'heavier-swords':
      player.attackDamage = 18 + enhancementLevels * 8 + (enhancementAwakened ? 36 : 0);
      break;
    case 'multi-swords':
      player.projectileCount = Math.min(6, 1 + enhancementLevels + (enhancementAwakened ? 2 : 0));
      break;
    case 'piercing-swords':
      player.projectilePierce = Math.min(7, enhancementLevels + (enhancementAwakened ? 4 : 0));
      break;
    case 'thunder-ring':
      player.thunderRadius = Math.min(level, 5) * 38 + (skillAwakened ? 70 : 0);
      player.thunderDamagePerSecond = Math.min(level, 5) * 4 + 14 + (skillAwakened ? 16 : 0);
      break;
    case 'chain-lightning':
      player.chainLightningDamage = Math.min(level, 5) * 8 + (skillAwakened ? 24 : 0);
      player.chainLightningTargets = skillAwakened ? 4 : 1;
      break;
    case 'fire-burst':
      player.fireBurstDamage = Math.min(level, 5) * 12 + (skillAwakened ? 36 : 0);
      player.fireBurstChance = skillAwakened ? 1 : Math.min(0.75, level * 0.15);
      player.fireBurstRadius = skillAwakened ? 140 : 90;
      break;
    case 'golden-shield':
      player.maxShield = Math.min(level, 5) * 20 + (skillAwakened ? 80 : 0);
      player.shieldBreakReady = player.maxShield > 0;
      player.shieldBreakDamage = skillAwakened ? 80 : 0;
      break;
    case 'life-drain':
      player.lifeOnKill = enhancementAwakened ? 4 : [0, 2, 2, 3][enhancementLevels];
      player.lifeOnKillChance = enhancementAwakened ? 0.45 : [0, 0.18, 0.27, 0.36][enhancementLevels];
      break;
    case 'soul-banner':
      player.pickupRadius = enhancementAwakened ? 220 : Math.min(220, 34 + enhancementLevels * 28);
      player.experienceMultiplier = enhancementAwakened ? 1.35 : 1;
      break;
    case 'swift-steps':
      player.speed = 245 * 1.12 ** enhancementLevels * (enhancementAwakened ? 1.3 : 1);
      player.dodgeChance = enhancementAwakened ? 0.25 : 0;
      break;
    case 'vital-breath':
      player.maxHp = 100 + enhancementLevels * 18 + (enhancementAwakened ? 70 : 0);
      player.hpRegenPerSecond = enhancementAwakened ? 1 : 0;
      break;
    case 'frost-seal':
      player.frostSlowPercent = skillAwakened ? 0.34 : [0.12, 0.18, 0.24, 0.27, 0.3][level - 1] ?? 0;
      player.frostFreezeMs = skillAwakened ? 1000 : 0;
      break;
    case 'orbiting-blades':
      player.orbitingBladeCount = skillAwakened ? 8 : [2, 3, 4, 5, 6][level - 1] ?? 0;
      player.orbitingBladeDamagePerSecond = skillAwakened ? 60 : [12, 18, 24, 30, 36][level - 1] ?? 0;
      player.orbitingBladeRadius = skillAwakened ? 88 : 62;
      break;
    case 'meteor-seal':
      player.meteorCooldownMs = skillAwakened ? 3600 : [7000, 6000, 5000, 4600, 4200][skillLevel - 1] ?? 0;
      player.meteorCount = skillAwakened ? 3 : 1;
      player.meteorDamage = skillAwakened ? 105 : [35, 50, 65, 75, 85][skillLevel - 1] ?? 0;
      break;
    case 'boss-slayer':
      player.bossDamageMultiplier = enhancementAwakened ? 2 : [1.15, 1.3, 1.45][enhancementLevels - 1] ?? 1;
      break;
    case 'north-star':
      player.northStarCooldownMs = skillAwakened ? 3800 : [6000, 5400, 4800, 4500, 4200][level - 1] ?? 0;
      player.northStarDamage = skillAwakened ? 44 : [12, 18, 24, 29, 34][level - 1] ?? 0;
      player.northStarShotCount = skillAwakened ? 16 : 8;
      player.northStarPierce = skillAwakened ? 3 : [0, 1, 2, 2, 2][level - 1] ?? 0;
      break;
    case 'bullet-reprisal':
      player.bulletReprisalDamage = skillAwakened ? 52 : [12, 18, 26, 32, 38][level - 1] ?? 0;
      player.bulletReprisalRadius = skillAwakened ? 108 : [58, 66, 74, 82, 90][level - 1] ?? 0;
      player.bulletReprisalChains = skillAwakened ? 3 : 0;
      break;
    case 'spirit-jade':
      player.activeCooldownMultiplier = enhancementAwakened ? 0.65 : [0.92, 0.84, 0.76][enhancementLevels - 1] ?? 1;
      player.activeCastHeal = enhancementAwakened ? 5 : 0;
      player.activeCastShield = enhancementAwakened ? 12 : 0;
      break;
    case 'soul-pin':
      player.soulPinChance = skillAwakened ? 0.25 : [0.06, 0.1, 0.14, 0.17, 0.2][level - 1] ?? 0;
      player.soulPinRootMs = skillAwakened ? 650 : [180, 240, 320, 400, 480][level - 1] ?? 0;
      player.soulPinKnockback = skillAwakened ? 36 : [16, 20, 24, 28, 32][level - 1] ?? 0;
      player.soulPinPulseCooldownMs = skillAwakened ? 5000 : 0;
      break;
    case 'solar-ray':
      player.solarRayCooldownMs = skillAwakened ? 3000 : [5000, 4600, 4200, 3900, 3600][skillLevel - 1] ?? 0;
      player.solarRayDamage = skillAwakened ? 110 : [35, 45, 55, 65, 75][skillLevel - 1] ?? 0;
      player.solarRayRange = skillAwakened ? 600 : [420, 450, 480, 510, 540][skillLevel - 1] ?? 0;
      break;
    case 'void-bell':
      player.voidBellCooldownMs = skillAwakened ? 3800 : [7000, 6400, 5800, 5200, 4700][level - 1] ?? 0;
      player.voidBellDamage = skillAwakened ? 90 : [20, 30, 40, 50, 60][level - 1] ?? 0;
      player.voidBellRadius = skillAwakened ? 200 : [100, 115, 130, 145, 160][level - 1] ?? 0;
      player.voidBellBreaksBullets = skillAwakened;
      break;
    case 'spirit-sword-rain':
      player.swordRainCooldownMs = skillAwakened ? 3200 : [6000, 5500, 5000, 4500, 4000][skillLevel - 1] ?? 0;
      player.swordRainDamage = skillAwakened ? 55 : [18, 24, 30, 36, 42][skillLevel - 1] ?? 0;
      player.swordRainCount = skillAwakened ? 8 : [3, 4, 5, 6, 7][skillLevel - 1] ?? 0;
      break;
    case 'storm-net':
      player.stormNetCooldownMs = skillAwakened ? 3800 : [8000, 7000, 6200, 5500, 4800][level - 1] ?? 0;
      player.stormNetDamage = skillAwakened ? 70 : [18, 26, 34, 42, 50][level - 1] ?? 0;
      player.stormNetTargets = skillAwakened ? 6 : [2, 2, 3, 3, 4][level - 1] ?? 0;
      player.stormNetRootMs = skillAwakened ? 600 : 0;
      break;
    case 'mirror-sigil':
      player.mirrorSigilCooldownMs = skillAwakened ? 3600 : [7200, 6500, 5800, 5200, 4600][level - 1] ?? 0;
      player.mirrorSigilDamage = skillAwakened ? 85 : [18, 26, 34, 42, 52][level - 1] ?? 0;
      player.mirrorSigilRadius = skillAwakened ? 220 : [105, 120, 140, 160, 180][level - 1] ?? 0;
      player.mirrorSigilChains = skillAwakened ? 2 : 0;
      break;
    case 'frost-domain':
      player.frostDomainCooldownMs = skillAwakened ? 3600 : [7200, 6400, 5800, 5200, 4400][level - 1] ?? 0;
      player.frostDomainRadius = skillAwakened ? 220 : [110, 130, 150, 170, 190][level - 1] ?? 0;
      player.frostDomainDamage = skillAwakened ? 72 : [18, 26, 34, 42, 52][level - 1] ?? 0;
      player.frostDomainFreezeMs = skillAwakened ? 950 : level >= 4 ? 420 : 0;
      break;
    case 'rift-return':
      player.riftReturnCooldownMs = skillAwakened ? 3000 : [6800, 6000, 5300, 4600, 3800][skillLevel - 1] ?? 0;
      player.riftReturnDamage = skillAwakened ? 86 : [24, 34, 44, 54, 66][skillLevel - 1] ?? 0;
      player.riftReturnRange = skillAwakened ? 620 : [360, 410, 460, 510, 560][skillLevel - 1] ?? 0;
      player.riftReturnEchoes = skillAwakened ? 2 : 0;
      break;
    case 'star-pull':
      player.starPullCooldownMs = skillAwakened ? 3800 : [8500, 7400, 6500, 5600, 4800][level - 1] ?? 0;
      player.starPullRadius = skillAwakened ? 230 : [120, 140, 160, 180, 200][level - 1] ?? 0;
      player.starPullDamage = skillAwakened ? 96 : [24, 34, 44, 54, 66][level - 1] ?? 0;
      player.starPullForce = skillAwakened ? 190 : [72, 92, 112, 132, 152][level - 1] ?? 0;
      player.starPullBreaksBullets = skillAwakened;
      break;
  }
}

function applySkillCooldownReduction(player: Player): void {
  const multiplier = 1 - player.skillCooldownReduction;
  player.activeCooldownMultiplier *= multiplier;

  const cooldownKeys = [
    'meteorCooldownMs',
    'northStarCooldownMs',
    'soulPinPulseCooldownMs',
    'solarRayCooldownMs',
    'voidBellCooldownMs',
    'swordRainCooldownMs',
    'stormNetCooldownMs',
    'mirrorSigilCooldownMs',
    'frostDomainCooldownMs',
    'riftReturnCooldownMs',
    'starPullCooldownMs',
  ] as const;
  for (const key of cooldownKeys) {
    player[key] *= multiplier;
  }
}
