import type {
  CharacterId,
  MetaProgression,
  MetaUnlockId,
  PathNodeId,
  Player,
  RelicForgeRanks,
  RelicId,
  TalentId,
} from '../sim/types';
import { CHARACTER_IDS } from '../sim/characters';

export const META_STORAGE_KEY = 'fu-tide-dongfu-v1';
export const RELIC_FORGE_COSTS = [2, 4, 7] as const;

export interface TalentDefinition {
  id: TalentId;
  characterId: CharacterId;
  name: string;
  effect: string;
  cost: number;
  prerequisite?: TalentId;
}

export const TALENTS: TalentDefinition[] = [
  { id: 'xuan-jian:sword-intent', characterId: 'xuan-jian', name: '剑意初凝', effect: '飞剑伤害 +8%', cost: 1 },
  { id: 'xuan-jian:swift-sword', characterId: 'xuan-jian', name: '御剑疾行', effect: '攻击间隔 -8%', cost: 2, prerequisite: 'xuan-jian:sword-intent' },
  { id: 'xuan-jian:breach-edge', characterId: 'xuan-jian', name: '破界锋芒', effect: '飞剑穿透 +1', cost: 3, prerequisite: 'xuan-jian:swift-sword' },
  { id: 'lei-zhuan:thunder-body', characterId: 'lei-zhuan', name: '引雷入体', effect: '术法伤害 +8%', cost: 1 },
  { id: 'lei-zhuan:thunder-field', characterId: 'lei-zhuan', name: '雷域扩张', effect: '雷环与太虚钟范围 +12%', cost: 2, prerequisite: 'lei-zhuan:thunder-body' },
  { id: 'lei-zhuan:spirit-echo', characterId: 'lei-zhuan', name: '灵息回响', effect: '经验获取 +10%', cost: 3, prerequisite: 'lei-zhuan:thunder-field' },
  { id: 'shou-yi:root-guard', characterId: 'shou-yi', name: '守元固本', effect: '最大生命 +10%', cost: 1 },
  { id: 'shou-yi:jade-armor', characterId: 'shou-yi', name: '玄甲常驻', effect: '开局获得 20 点护盾', cost: 2, prerequisite: 'shou-yi:root-guard' },
  { id: 'shou-yi:evergreen', characterId: 'shou-yi', name: '生生不息', effect: '生命恢复 +0.6/秒', cost: 3, prerequisite: 'shou-yi:jade-armor' },
];

export interface PathNodeDefinition {
  id: PathNodeId;
  name: string;
  effect: string;
  cost: number;
  prerequisite?: PathNodeId;
}

export interface RelicDefinition {
  id: RelicId;
  characterId: CharacterId;
  name: string;
  effect: string;
  cost: number;
  prerequisite: TalentId;
}

export const PATH_NODES: PathNodeDefinition[] = [
  { id: 'path:life-root', name: '生机根脉', effect: '最大生命 +8%', cost: 1 },
  { id: 'path:swift-current', name: '御风行脉', effect: '移动速度 +6%', cost: 2, prerequisite: 'path:life-root' },
  { id: 'path:seer-eye', name: '观微灵台', effect: '经验获取 +8%，拾取范围 +18', cost: 3, prerequisite: 'path:swift-current' },
  { id: 'path:war-sigil', name: '破劫战印', effect: '全部伤害 +8%', cost: 4, prerequisite: 'path:seer-eye' },
];

export const RELICS: RelicDefinition[] = [
  { id: 'xuan-jian:star-forged-edge', characterId: 'xuan-jian', name: '铸星剑锋', effect: '飞剑伤害 +18%，穿透 +1', cost: 5, prerequisite: 'xuan-jian:breach-edge' },
  { id: 'lei-zhuan:storm-crown', characterId: 'lei-zhuan', name: '引劫雷冠', effect: '术法伤害 +16%，雷链额外命中 1 个目标', cost: 5, prerequisite: 'lei-zhuan:spirit-echo' },
  { id: 'shou-yi:jade-heart', characterId: 'shou-yi', name: '镇岳玉心', effect: '最大生命 +12%，护盾上限 +24，恢复 +0.4/秒', cost: 5, prerequisite: 'shou-yi:evergreen' },
];

const talentById = new Map(TALENTS.map((talent) => [talent.id, talent]));
const pathNodeById = new Map(PATH_NODES.map((node) => [node.id, node]));
const relicById = new Map(RELICS.map((relic) => [relic.id, relic]));

export function createDefaultMetaProgression(): MetaProgression {
  return {
    version: 3,
    daoYun: 0,
    spiritOre: 0,
    relicForgeRanks: {},
    unlockedTalentIds: [],
    unlockedPathNodeIds: [],
    unlockedRelicIds: [],
    equippedRelicIds: [],
    unlockedCharacterIds: [],
  };
}

export function loadMetaProgression(storage: Storage): MetaProgression {
  const serialized = storage.getItem(META_STORAGE_KEY);
  if (!serialized) return createDefaultMetaProgression();

  try {
    const value: unknown = JSON.parse(serialized);
    return parseMetaProgression(value) ?? createDefaultMetaProgression();
  } catch {
    return createDefaultMetaProgression();
  }
}

export function saveMetaProgression(storage: Storage, progression: MetaProgression): void {
  storage.setItem(META_STORAGE_KEY, JSON.stringify(progression));
}

export function tryUnlockTalent(
  progression: MetaProgression,
  unlockId: MetaUnlockId,
): { progression: MetaProgression; unlocked: boolean } {
  const talent = talentById.get(unlockId as TalentId);
  if (talent) return unlock(progressionsForTalents(progression), talent, 'unlockedTalentIds');
  const node = pathNodeById.get(unlockId as PathNodeId);
  if (node) return unlock(progressionsForPaths(progression), node, 'unlockedPathNodeIds');
  const relic = relicById.get(unlockId as RelicId);
  if (relic) return unlock(progressionsForRelics(progression), relic, 'unlockedRelicIds');
  return { progression, unlocked: false };
}

export function toggleRelic(progression: MetaProgression, relicId: RelicId): MetaProgression {
  if (!progression.unlockedRelicIds.includes(relicId)) return progression;
  const equippedRelicIds = progression.equippedRelicIds.includes(relicId)
    ? progression.equippedRelicIds.filter((id) => id !== relicId)
    : [...progression.equippedRelicIds.filter((id) => relicById.get(id)?.characterId !== relicById.get(relicId)?.characterId), relicId];
  return { ...progression, equippedRelicIds };
}

export function earnDaoYun(progression: MetaProgression, amount: number): MetaProgression {
  return { ...progression, daoYun: Math.max(0, progression.daoYun + Math.max(0, amount)) };
}

export function earnSpiritOre(progression: MetaProgression, amount: number): MetaProgression {
  return { ...progression, spiritOre: Math.max(0, progression.spiritOre + Math.max(0, amount)) };
}

export function tryForgeRelic(
  progression: MetaProgression,
  relicId: RelicId,
): { progression: MetaProgression; forged: boolean } {
  if (!progression.unlockedRelicIds.includes(relicId) || !progression.equippedRelicIds.includes(relicId)) {
    return { progression, forged: false };
  }
  const currentRank = progression.relicForgeRanks[relicId] ?? 0;
  const cost = RELIC_FORGE_COSTS[currentRank];
  if (cost === undefined || progression.spiritOre < cost) return { progression, forged: false };
  return {
    forged: true,
    progression: {
      ...progression,
      spiritOre: progression.spiritOre - cost,
      relicForgeRanks: { ...progression.relicForgeRanks, [relicId]: currentRank + 1 },
    },
  };
}

export function unlockCharacter(progression: MetaProgression, character: CharacterId): MetaProgression {
  if (!CHARACTER_IDS.includes(character) || progression.unlockedCharacterIds.includes(character)) return progression;
  return { ...progression, unlockedCharacterIds: [...progression.unlockedCharacterIds, character] };
}

export function applyMetaTalents(player: Player): void {
  if (!player.characterId) return;
  const talents = new Set(player.metaTalentIds);
  const paths = new Set(player.metaPathNodeIds);
  const relics = new Set(player.metaRelicIds);

  if (paths.has('path:life-root')) player.maxHp *= 1.08;
  if (paths.has('path:swift-current')) player.speed *= 1.06;
  if (paths.has('path:seer-eye')) {
    player.experienceMultiplier *= 1.08;
    player.pickupRadius += 18;
  }
  if (paths.has('path:war-sigil')) applyAllDamageMultiplier(player, 1.08);

  if (player.characterId === 'xuan-jian') {
    if (talents.has('xuan-jian:sword-intent')) player.attackDamage *= 1.08;
    if (talents.has('xuan-jian:swift-sword')) player.attackCooldownMs *= 0.92;
    if (talents.has('xuan-jian:breach-edge')) player.projectilePierce += 1;
    if (relics.has('xuan-jian:star-forged-edge')) {
      player.attackDamage *= 1.18;
      player.projectilePierce += 1;
      const forgeRank = player.metaRelicForgeRanks['xuan-jian:star-forged-edge'] ?? 0;
      player.projectileCount += forgeRank;
      if (forgeRank >= 2) player.projectilePierce += forgeRank;
      if (forgeRank >= 3) player.attackCooldownMs *= 0.86;
    }
  }

  if (player.characterId === 'lei-zhuan') {
    if (talents.has('lei-zhuan:thunder-body')) {
      player.arcaneDamageMultiplier *= 1.08;
      player.thunderDamagePerSecond *= 1.08;
      player.chainLightningDamage *= 1.08;
      player.fireBurstDamage *= 1.08;
      player.meteorDamage *= 1.08;
      player.northStarDamage *= 1.08;
      player.solarRayDamage *= 1.08;
      player.voidBellDamage *= 1.08;
      player.swordRainDamage *= 1.08;
      player.bulletReprisalDamage *= 1.08;
    }
    if (talents.has('lei-zhuan:thunder-field')) {
      player.thunderRadius *= 1.12;
      player.voidBellRadius *= 1.12;
    }
    if (talents.has('lei-zhuan:spirit-echo')) player.experienceMultiplier *= 1.1;
    if (relics.has('lei-zhuan:storm-crown')) {
      applyArcaneDamageMultiplier(player, 1.16);
      player.chainLightningTargets += 1;
      const forgeRank = player.metaRelicForgeRanks['lei-zhuan:storm-crown'] ?? 0;
      player.chainLightningTargets += forgeRank;
      if (forgeRank >= 2) player.thunderRadius += 42;
      if (forgeRank >= 3) player.stormNetRootMs = Math.max(player.stormNetRootMs, 700);
    }
  }

  if (player.characterId === 'shou-yi') {
    if (talents.has('shou-yi:root-guard')) player.maxHp *= 1.1;
    if (talents.has('shou-yi:jade-armor')) player.maxShield += 20;
    if (talents.has('shou-yi:evergreen')) player.hpRegenPerSecond += 0.6;
    if (relics.has('shou-yi:jade-heart')) {
      player.maxHp *= 1.12;
      player.maxShield += 24;
      player.hpRegenPerSecond += 0.4;
      const forgeRank = player.metaRelicForgeRanks['shou-yi:jade-heart'] ?? 0;
      player.maxShield += forgeRank * 12;
      if (forgeRank >= 1) {
        player.shieldBreakReady = true;
        player.shieldBreakDamage = Math.max(player.shieldBreakDamage, forgeRank * 30);
      }
    }
  }
}

function applyArcaneDamageMultiplier(player: Player, multiplier: number): void {
  player.arcaneDamageMultiplier *= multiplier;
  player.thunderDamagePerSecond *= multiplier;
  player.chainLightningDamage *= multiplier;
  player.fireBurstDamage *= multiplier;
  player.meteorDamage *= multiplier;
  player.northStarDamage *= multiplier;
  player.solarRayDamage *= multiplier;
  player.voidBellDamage *= multiplier;
  player.swordRainDamage *= multiplier;
  player.bulletReprisalDamage *= multiplier;
}

function applyAllDamageMultiplier(player: Player, multiplier: number): void {
  player.attackDamage *= multiplier;
  applyArcaneDamageMultiplier(player, multiplier);
  player.orbitingBladeDamagePerSecond *= multiplier;
}

function progressionsForTalents(progression: MetaProgression): MetaProgression { return progression; }
function progressionsForPaths(progression: MetaProgression): MetaProgression { return progression; }
function progressionsForRelics(progression: MetaProgression): MetaProgression { return progression; }

function unlock<T extends { id: string; cost: number; prerequisite?: string }, K extends 'unlockedTalentIds' | 'unlockedPathNodeIds' | 'unlockedRelicIds'>(
  progression: MetaProgression,
  item: T,
  key: K,
): { progression: MetaProgression; unlocked: boolean } {
  const unlockedIds = progression[key] as string[];
  const prerequisiteUnlocked = !item.prerequisite || progression.unlockedTalentIds.includes(item.prerequisite as TalentId)
    || progression.unlockedPathNodeIds.includes(item.prerequisite as PathNodeId);
  if (unlockedIds.includes(item.id) || !prerequisiteUnlocked || progression.daoYun < item.cost) {
    return { progression, unlocked: false };
  }
  return {
    unlocked: true,
    progression: { ...progression, daoYun: progression.daoYun - item.cost, [key]: [...unlockedIds, item.id] } as MetaProgression,
  };
}

function parseMetaProgression(value: unknown): MetaProgression | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  if (!Number.isSafeInteger(record.daoYun) || (record.daoYun as number) < 0 || !Array.isArray(record.unlockedTalentIds)) return null;
  const talentIds = record.unlockedTalentIds;
  if (!talentIds.every((id): id is TalentId => typeof id === 'string' && talentById.has(id as TalentId))
    || new Set(talentIds).size !== talentIds.length) return null;
  if (record.version === 1) {
    return { ...createDefaultMetaProgression(), daoYun: record.daoYun as number, unlockedTalentIds: talentIds };
  }
  const pathIds = record.unlockedPathNodeIds;
  const relicIds = record.unlockedRelicIds;
  const equippedRelicIds = record.equippedRelicIds;
  const characterIds = record.unlockedCharacterIds ?? [];
  if ((record.version !== 2 && record.version !== 3) || !Array.isArray(pathIds) || !Array.isArray(relicIds) || !Array.isArray(equippedRelicIds) || !Array.isArray(characterIds)) return null;
  if (!pathIds.every((id): id is PathNodeId => typeof id === 'string' && pathNodeById.has(id as PathNodeId))
    || !relicIds.every((id): id is RelicId => typeof id === 'string' && relicById.has(id as RelicId))
    || !equippedRelicIds.every((id): id is RelicId => typeof id === 'string' && (relicIds as RelicId[]).includes(id as RelicId))
    || !characterIds.every((id): id is CharacterId => typeof id === 'string' && CHARACTER_IDS.includes(id as CharacterId))
    || new Set(pathIds).size !== pathIds.length
    || new Set(relicIds).size !== relicIds.length
    || new Set(equippedRelicIds).size !== equippedRelicIds.length
    || new Set(characterIds).size !== characterIds.length) return null;
  if (record.version === 2) {
    return {
      ...createDefaultMetaProgression(),
      daoYun: record.daoYun as number,
      unlockedTalentIds: talentIds,
      unlockedPathNodeIds: pathIds,
      unlockedRelicIds: relicIds,
      equippedRelicIds,
      unlockedCharacterIds: characterIds,
    };
  }
  const spiritOre = record.spiritOre;
  const forgeRanks = record.relicForgeRanks;
  if (!Number.isSafeInteger(spiritOre) || (spiritOre as number) < 0 || !isValidForgeRanks(forgeRanks, relicIds as RelicId[])) return null;
  return {
    version: 3,
    daoYun: record.daoYun as number,
    spiritOre: spiritOre as number,
    relicForgeRanks: forgeRanks as RelicForgeRanks,
    unlockedTalentIds: talentIds,
    unlockedPathNodeIds: pathIds,
    unlockedRelicIds: relicIds,
    equippedRelicIds,
    unlockedCharacterIds: characterIds,
  };
}

function isValidForgeRanks(value: unknown, unlockedRelics: RelicId[]): value is RelicForgeRanks {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return Object.entries(value).every(([id, rank]) => (
    relicById.has(id as RelicId)
    && unlockedRelics.includes(id as RelicId)
    && Number.isSafeInteger(rank)
    && (rank as number) >= 0
    && (rank as number) <= RELIC_FORGE_COSTS.length
  ));
}
