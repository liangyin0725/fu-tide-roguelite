import type { GlyphFormation } from './glyphFormations';

export type GamePhase = 'menu' | 'dongfu' | 'character-choice' | 'coop-character-choice' | 'active-choice' | 'coop-active-choice' | 'beta-loadout' | 'playing' | 'upgrade' | 'treasure' | 'treasure-replace' | 'awakening' | 'tribulation-choice' | 'objective-route' | 'lost';

export type UpgradeId =
  | 'faster-swords'
  | 'heavier-swords'
  | 'multi-swords'
  | 'piercing-swords'
  | 'thunder-ring'
  | 'chain-lightning'
  | 'fire-burst'
  | 'golden-shield'
  | 'life-drain'
  | 'soul-banner'
  | 'swift-steps'
  | 'vital-breath'
  | 'frost-seal'
  | 'orbiting-blades'
  | 'meteor-seal'
  | 'boss-slayer'
  | 'north-star'
  | 'bullet-reprisal'
  | 'spirit-jade'
  | 'soul-pin'
  | 'solar-ray'
  | 'void-bell'
  | 'spirit-sword-rain'
  | 'storm-net'
  | 'mirror-sigil'
  | 'frost-domain'
  | 'rift-return'
  | 'star-pull';

export type UpgradeLevels = Record<UpgradeId, number>;

export type InsightId = 'insight:damage' | 'insight:vitality' | 'insight:speed' | 'insight:pickup';
export type UpgradeChoice = UpgradeId | InsightId;

export type BossType = 'crimson' | 'thunder' | 'blood-moon';
export type BossPhase = 1 | 2 | 3;
export type BossObjectiveKind = 'crimson-anchor' | 'storm-pylon' | 'blood-well';
export type EnemyArchetype = 'melee' | 'crossbow' | 'talisman' | 'soul-lamp';
export type EliteAffix = 'iron-wall' | 'haste' | 'mender' | 'suppressor';
export type TribulationType = 'calm' | 'thunder' | 'blood-moon' | 'frost';
export type TribulationSealId = 'thunder' | 'blood' | 'frost';
export type TribulationSealRanks = Record<TribulationSealId, number>;
export type TribulationChoiceId =
  | 'thunder-conduit'
  | 'thunder-seal'
  | 'blood-pact'
  | 'blood-calm'
  | 'frost-edge'
  | 'frost-ward';
export type ObjectiveKind = 'thunder-pillar' | 'blood-well' | 'frost-core';
export type ObjectiveFieldExpiresAtMs = Record<ObjectiveKind, number>;
export type ObjectiveRouteId = 'secure' | 'risk';
export type DamageSource =
  | 'flying-sword' | 'thunder' | 'chain' | 'fire' | 'orbit' | 'meteor'
  | 'north-star' | 'reprisal' | 'soul' | 'active' | 'solar-ray' | 'void-bell' | 'sword-rain' | 'glyph';
export type ActiveSkillId = 'talisman-ruin' | 'dimension-step' | 'tai-chi-ward';
export type CharacterId = 'xuan-jian' | 'lei-zhuan' | 'shou-yi' | 'jing-po';
export type TalentId =
  | 'xuan-jian:sword-intent'
  | 'xuan-jian:swift-sword'
  | 'xuan-jian:breach-edge'
  | 'lei-zhuan:thunder-body'
  | 'lei-zhuan:thunder-field'
  | 'lei-zhuan:spirit-echo'
  | 'shou-yi:root-guard'
  | 'shou-yi:jade-armor'
  | 'shou-yi:evergreen';

export type PathNodeId = 'path:life-root' | 'path:swift-current' | 'path:seer-eye' | 'path:war-sigil';
export type RelicId = 'xuan-jian:star-forged-edge' | 'lei-zhuan:storm-crown' | 'shou-yi:jade-heart';
export type MetaUnlockId = TalentId | PathNodeId | RelicId;
export type RelicForgeRanks = Partial<Record<RelicId, number>>;

export interface MetaProgression {
  version: 3;
  daoYun: number;
  spiritOre: number;
  relicForgeRanks: RelicForgeRanks;
  unlockedTalentIds: TalentId[];
  unlockedPathNodeIds: PathNodeId[];
  unlockedRelicIds: RelicId[];
  equippedRelicIds: RelicId[];
  unlockedCharacterIds: CharacterId[];
}
export type SynergyId =
  | 'thunder-resonance'
  | 'frostfire-calamity'
  | 'sword-ward'
  | 'starfall-convergence'
  | 'immortal-echo'
  | 'soul-execution'
  | 'eclipse-sanctum'
  | 'sunblade-cascade'
  | 'frozen-knell'
  | 'gilded-sword-rain';

export interface Vector {
  x: number;
  y: number;
}

export interface PlayerInput {
  move: Vector;
  aim: Vector;
  activate: boolean;
  aimMode?: 'auto' | 'manual';
}

export interface SimulationInput extends PlayerInput {
  partner?: PlayerInput;
}

export interface Arena {
  width: number;
  height: number;
}

export interface Player {
  characterId: CharacterId | null;
  x: number;
  y: number;
  radius: number;
  hp: number;
  maxHp: number;
  speed: number;
  level: number;
  experience: number;
  experienceToNext: number;
  attackDamage: number;
  attackCooldownMs: number;
  attackTimerMs: number;
  invulnerableMs: number;
  projectileCount: number;
  projectilePierce: number;
  thunderRadius: number;
  thunderDamagePerSecond: number;
  chainLightningDamage: number;
  chainLightningTargets: number;
  fireBurstDamage: number;
  fireBurstChance: number;
  fireBurstRadius: number;
  shield: number;
  maxShield: number;
  shieldBreakDamage: number;
  shieldBreakReady: boolean;
  lifeOnKill: number;
  lifeOnKillChance: number;
  hpRegenPerSecond: number;
  pickupRadius: number;
  experienceMultiplier: number;
  arcaneDamageMultiplier: number;
  dodgeChance: number;
  frostSlowPercent: number;
  frostFreezeMs: number;
  orbitingBladeCount: number;
  orbitingBladeDamagePerSecond: number;
  orbitingBladeRadius: number;
  meteorCooldownMs: number;
  meteorTimerMs: number;
  meteorCount: number;
  meteorDamage: number;
  bossDamageMultiplier: number;
  northStarCooldownMs: number;
  northStarTimerMs: number;
  northStarDamage: number;
  northStarShotCount: number;
  northStarPierce: number;
  bulletReprisalDamage: number;
  bulletReprisalRadius: number;
  bulletReprisalChains: number;
  activeCooldownMultiplier: number;
  activeCastHeal: number;
  activeCastShield: number;
  soulPinChance: number;
  soulPinRootMs: number;
  soulPinKnockback: number;
  soulPinPulseCooldownMs: number;
  soulPinPulseTimerMs: number;
  solarRayCooldownMs: number;
  solarRayTimerMs: number;
  solarRayDamage: number;
  solarRayRange: number;
  voidBellCooldownMs: number;
  voidBellTimerMs: number;
  voidBellDamage: number;
  voidBellRadius: number;
  voidBellBreaksBullets: boolean;
  swordRainCooldownMs: number;
  swordRainTimerMs: number;
  swordRainDamage: number;
  swordRainCount: number;
  stormNetCooldownMs: number;
  stormNetTimerMs: number;
  stormNetDamage: number;
  stormNetTargets: number;
  stormNetRootMs: number;
  mirrorSigilCooldownMs: number;
  mirrorSigilTimerMs: number;
  mirrorSigilDamage: number;
  mirrorSigilRadius: number;
  mirrorSigilChains: number;
  frostDomainCooldownMs: number;
  frostDomainTimerMs: number;
  frostDomainRadius: number;
  frostDomainDamage: number;
  frostDomainFreezeMs: number;
  riftReturnCooldownMs: number;
  riftReturnTimerMs: number;
  riftReturnDamage: number;
  riftReturnRange: number;
  riftReturnEchoes: number;
  starPullCooldownMs: number;
  starPullTimerMs: number;
  starPullRadius: number;
  starPullDamage: number;
  starPullForce: number;
  starPullBreaksBullets: boolean;
  activeBarrierRemainingMs: number;
  activeBarrierRadius: number;
  activeSkill: ActiveSkillId | null;
  activeSkillLevel: number;
  activeCooldownRemainingMs: number;
  lastMoveDirection: Vector;
  equippedSkills: UpgradeId[];
  equippedEnhancements: UpgradeId[];
  skillSlotLimit: number;
  enhancementSlotLimit: number;
  upgradeChoiceSalt: number;
  metaTalentIds: TalentId[];
  metaPathNodeIds: PathNodeId[];
  metaRelicIds: RelicId[];
  metaRelicForgeRanks: RelicForgeRanks;
  insightLevels: Record<InsightId, number>;
  upgradeLevels: UpgradeLevels;
}

export interface CoopPlayer extends Player {
  id: 'p2';
  downed: boolean;
  downedUntilMs: number;
  reviveProgressMs: number;
}

export interface CoopTarget {
  id: 'p1' | 'p2';
  x: number;
  y: number;
  downed: boolean;
}

export interface Enemy {
  id: number;
  x: number;
  y: number;
  radius: number;
  hp: number;
  maxHp: number;
  speed: number;
  damage: number;
  experience: number;
  kind: 'normal' | 'boss';
  archetype: EnemyArchetype;
  rangedAttackTimerMs?: number;
  rangedTelegraphing?: boolean;
  bossWave?: number;
  bossType?: BossType;
  bossPhase?: BossPhase;
  bossSkillTimerMs?: number;
  bossSecondaryTimerMs?: number;
  bossCastCount?: number;
  ownerBossId?: number;
  bossObjectiveKind?: BossObjectiveKind;
  bossArenaResolved?: boolean;
  bossArenaEnraged?: boolean;
  bossArenaVulnerableUntilMs?: number;
  bossArenaStunnedUntilMs?: number;
  slowMultiplier: number;
  slowUntilMs: number;
  freezeUntilMs: number;
  nextFreezeAllowedMs: number;
  solarMarkUntilMs?: number;
  eliteAffix?: EliteAffix;
  eliteTimerMs?: number;
  squadId?: number;
  objectiveKind?: ObjectiveKind;
}

export interface Projectile {
  id: number;
  targetId: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  damage: number;
  ttlMs: number;
  pierceRemaining: number;
  hitEnemyIds: number[];
  kind?: 'sword' | 'star' | 'glyph';
  source?: DamageSource;
}

export interface ExperienceShard {
  id: number;
  x: number;
  y: number;
  radius: number;
  value: number;
}

export type EnemyProjectileKind = 'bolt' | 'fan-seal' | 'soul-orb';

export interface EnemyProjectile {
  id: number;
  ownerId: number;
  kind: EnemyProjectileKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  damage: number;
  ttlMs: number;
  homingMs: number;
  turnRate: number;
}

export interface FrostSealMirror {
  x: number;
  y: number;
  expiresAtMs: number;
}

export type BossHazardKind = 'charge' | 'circle' | 'line' | 'ring';

export interface BossHazard {
  id: number;
  ownerBossId: number;
  bossType: BossType;
  kind: BossHazardKind;
  x: number;
  y: number;
  endX: number;
  endY: number;
  radius: number;
  startRadius: number;
  endRadius: number;
  bandWidth: number;
  lineWidth: number;
  telegraphRemainingMs: number;
  activeRemainingMs: number;
  activeDurationMs: number;
  damageMultiplier: number;
  hasDamagedPlayer: boolean;
  healBossFraction?: number;
}

export interface TreasureChest {
  id: number;
  x: number;
  y: number;
  radius: number;
  wave: number;
}

export interface GameState {
  arena: Arena;
  phase: GamePhase;
  elapsedMs: number;
  spawnTimerMs: number;
  nextBossAtMs: number;
  bossWave: number;
  bossesDefeated: number;
  runDaoYunEarned: number;
  runSpiritOreEarned: number;
  nextSpiritOreAtMs: number;
  bossSlowdownUntilMs: number;
  nextEliteSquadAtMs: number;
  eliteSquadWave: number;
  tribulation: TribulationType;
  tribulationChoices: TribulationChoiceId[];
  activeTribulationChoiceId: TribulationChoiceId | null;
  tribulationSealRanks: TribulationSealRanks;
  thunderSealHits: number;
  bloodSealEliteKills: number;
  frostSealMirror: FrostSealMirror | null;
  nextTribulationChoiceAtMs: number;
  nextObjectiveAtMs: number;
  activeObjectiveId: number | null;
  objectiveExpiresAtMs: number;
  objectiveChainStep: 0 | 1 | 2 | 3;
  objectiveChainTribulation: TribulationType | null;
  objectiveRoutePendingStep: 0 | 2 | 3;
  objectiveChainRiskLevel: number;
  objectiveFieldExpiresAtMs: ObjectiveFieldExpiresAtMs;
  activeBossObjectiveId: number | null;
  bossObjectiveExpiresAtMs: number;
  resolvedBloodWellBossId: number | null;
  runStats: RunStats;
  kills: number;
  nextId: number;
  runSeed: number;
  randomState: number;
  siegeActive: boolean;
  siegeEnemyCount: number;
  siegePulseTimerMs: number;
  coopEnabled: boolean;
  partner: CoopPlayer | null;
  playerDowned: boolean;
  playerDownedUntilMs: number;
  playerReviveProgressMs: number;
  coopUpgradeQueue: Array<'p1' | 'p2'>;
  pendingUpgradePlayerId: 'p1' | 'p2';
  lastCoopUpgradeChoices: UpgradeChoice[];
  player: Player;
  enemies: Enemy[];
  projectiles: Projectile[];
  enemyProjectiles: EnemyProjectile[];
  shards: ExperienceShard[];
  chests: TreasureChest[];
  bossHazards: BossHazard[];
  upgradeChoices: UpgradeChoice[];
  treasureChoices: UpgradeId[];
  treasureWave: number | null;
  pendingTreasureUpgrade: UpgradeId | null;
  awakeningNotice: AwakeningNotice | null;
  awakeningRemainingMs: number;
  pendingAwakeningSurge: UpgradeId | null;
  awakeningGlyphTimerMs: number;
  awakeningGlyphVolleyCount: number;
  betaSkillSelections: UpgradeId[];
  betaSkillLevels: UpgradeLevels;
  betaActiveSkill: ActiveSkillId;
  betaActiveSkillLevel: number;
  betaStartElapsedMs: number;
}

export interface RunStats {
  damageBySource: Record<DamageSource, number>;
  bulletsBlocked: number;
  elitesDefeated: number;
  objectivesCompleted: number;
}

export interface AwakeningNotice {
  upgrade: UpgradeId;
  skillName: string;
  awakeningName: string;
  summary: string[];
}

export interface EnemySpawnOptions {
  x: number;
  y: number;
  hp?: number;
  speed?: number;
  experience?: number;
  damage?: number;
  radius?: number;
  kind?: 'normal' | 'boss';
  archetype?: EnemyArchetype;
  bossWave?: number;
  bossType?: BossType;
  eliteAffix?: EliteAffix;
  squadId?: number;
  objectiveKind?: ObjectiveKind;
}

export type CombatEvent =
  | { type: 'projectile-fired'; x: number; y: number; angle: number }
  | { type: 'projectile-hit'; x: number; y: number }
  | { type: 'damage-dealt'; x: number; y: number; amount: number; source: DamageSource }
  | { type: 'enemy-killed'; x: number; y: number }
  | { type: 'player-damaged'; x: number; y: number; amount: number }
  | { type: 'player-healed'; x: number; y: number; amount: number; source: 'life-drain' }
  | { type: 'siege-pressure'; x: number; y: number; enemyCount: number }
  | { type: 'glyph-volley'; x: number; y: number; count: number; ritual: 'bolt' | 'burst' | 'control' | 'ward'; formation: GlyphFormation }
  | { type: 'level-up'; x: number; y: number; level: number }
  | { type: 'shield-blocked'; x: number; y: number; amount: number }
  | { type: 'chain-lightning'; fromX: number; fromY: number; toX: number; toY: number; awakened?: boolean; style?: 'storm-net' | 'solar-ray' }
  | { type: 'fire-burst'; x: number; y: number; radius: number; awakened?: boolean }
  | { type: 'boss-spawned'; x: number; y: number; wave: number }
  | { type: 'boss-objective-spawned'; x: number; y: number; bossType: BossType; objective: BossObjectiveKind; expiresAtMs: number }
  | { type: 'boss-objective-resolved'; x: number; y: number; bossType: BossType; objective: BossObjectiveKind; success: boolean }
  | { type: 'skill-awakened'; x: number; y: number; upgrade: UpgradeId }
  | { type: 'meteor-strike'; x: number; y: number; damage: number; awakened?: boolean; style?: 'sword-rain' }
  | { type: 'dodge'; x: number; y: number }
  | { type: 'frost-hit'; x: number; y: number; frozen: boolean; style?: 'soul-pin' }
  | { type: 'shield-broken'; x: number; y: number; radius: number }
  | { type: 'chest-dropped'; x: number; y: number; wave: number }
  | { type: 'dao-yun-earned'; x: number; y: number; wave: number; amount: 1 }
  | { type: 'spirit-ore-earned'; x: number; y: number; source: 'survival' | 'boss' | 'objective'; amount: number }
  | { type: 'hidden-character-unlocked'; x: number; y: number; character: 'jing-po' }
  | { type: 'boss-reward-burst'; x: number; y: number; wave: number; experience: number }
  | {
      type: 'boss-phase-changed';
      x: number;
      y: number;
      bossId: number;
      bossType: BossType;
      phase: 2 | 3;
    }
  | { type: 'boss-skill-activated'; x: number; y: number; bossType: BossType; kind: BossHazardKind }
  | { type: 'boss-cast-started'; x: number; y: number; bossType: BossType; kind: 'primary' | 'secondary' }
  | { type: 'boss-healed'; x: number; y: number; bossType: BossType; amount: number }
  | { type: 'star-volley'; x: number; y: number; count: number; awakened?: boolean }
  | { type: 'bullet-reprisal'; x: number; y: number; radius: number; awakened?: boolean; style?: 'mirror-sigil' | 'void-bell' }
  | { type: 'soul-pinned'; x: number; y: number; awakened: boolean }
  | { type: 'frost-domain'; x: number; y: number; radius: number; awakened: boolean }
  | { type: 'rift-return'; fromX: number; fromY: number; toX: number; toY: number; awakened: boolean }
  | { type: 'star-pull'; x: number; y: number; radius: number; awakened: boolean }
  | { type: 'ranged-windup'; x: number; y: number; archetype: Exclude<EnemyArchetype, 'melee'> }
  | { type: 'enemy-bullet-fired'; x: number; y: number; archetype: Exclude<EnemyArchetype, 'melee'> }
  | { type: 'enemy-bullet-broken'; x: number; y: number; by: 'blade' | 'barrier' | 'dash' | 'mirror' }
  | { type: 'active-skill-cast'; x: number; y: number; skill: ActiveSkillId; angle: number }
  | { type: 'active-skill-leveled'; x: number; y: number; skill: ActiveSkillId; level: number }
  | { type: 'elite-squad-spawned'; x: number; y: number; affix: EliteAffix; squadId: number }
  | { type: 'elite-effect'; x: number; y: number; affix: EliteAffix }
  | { type: 'tribulation-changed'; x: number; y: number; tribulation: TribulationType }
  | { type: 'tribulation-choice-offered'; x: number; y: number; tribulation: Exclude<TribulationType, 'calm'> }
  | { type: 'tribulation-choice-selected'; x: number; y: number; choice: TribulationChoiceId }
  | { type: 'tribulation-seal-gained'; x: number; y: number; seal: TribulationSealId; rank: number }
  | { type: 'tribulation-seal-triggered'; x: number; y: number; seal: TribulationSealId }
  | { type: 'objective-spawned'; x: number; y: number; objective: ObjectiveKind; expiresAtMs: number }
  | { type: 'objective-resolved'; x: number; y: number; objective: ObjectiveKind; success: boolean }
  | { type: 'objective-field-activated'; x: number; y: number; objective: ObjectiveKind; expiresAtMs: number }
  | { type: 'synergy-triggered'; x: number; y: number; synergy: SynergyId };
