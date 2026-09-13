import {
  CONTACT_DAMAGE_COOLDOWN_MS,
  COOP_ARENA_HEIGHT,
  COOP_ARENA_WIDTH,
  PROJECTILE_SPEED,
  PROJECTILE_TTL_MS,
} from './constants';
import {
  applyUpgrade,
  applyInsight,
  createTreasureChoices,
  createUpgradeChoices,
  isInsightChoice,
  UPGRADE_LABELS,
} from './upgrades';
import {
  getBossStats,
  getNextExperienceRequirement,
  getNormalEnemyExperience,
  getNormalSpawnInterval,
} from './spawnPacing';
import {
  createBossPrimaryHazards,
  createBossSecondaryHazards,
  getBossPrimaryCooldown,
  getBossSecondaryCooldown,
  getBossTypeForWave,
  isPointInsideBossHazard,
} from './bossSkills';
import {
  getEquippedForKind,
  getLoadoutSlotLimit,
  recalculatePlayerBuild,
} from './loadout';
import { getUpgradeKind } from './upgradeCatalog';
import { getAwakenedSkills, isUpgradeAwakened } from './awakening';
import { hasSynergy } from './synergies';
import { createEliteSquadBlueprint } from './eliteSquads';
import { getTribulationAt, TRIBULATION_DURATION_MS, TRIBULATION_MODIFIERS } from './tribulations';
import { getTribulationChoices, getTribulationChoiceModifiers } from './tribulationChoices';
import {
  getRangedSpawnRatio,
  updateEnemyProjectiles,
  updateRangedAttacks,
} from './enemyProjectiles';
import { resolveActiveAim, tryActivateActiveSkill } from './activeSkills';
import { dealPlayerDamage } from './combatStats';
import { getBossObjectiveHp, getBossObjectiveKind, getBossObjectivePosition } from './bossArena';
import { getGlyphFormation, getGlyphFormationPosition, type GlyphFormation } from './glyphFormations';
import type {
  ActiveSkillId,
  CombatEvent,
  DamageSource,
  Enemy,
  EnemySpawnOptions,
  GameState,
  ObjectiveKind,
  ObjectiveRouteId,
  Player,
  TribulationChoiceId,
  UpgradeId,
  UpgradeChoice,
  SimulationInput,
  Vector,
} from './types';

export class GameSimulation {
  public readonly state: GameState;
  private events: CombatEvent[] = [];
  private thunderSynergyTimerMs = 0;

  public constructor(state: GameState) {
    this.state = state;
  }

  public start(): void {
    if (this.state.phase === 'menu') {
      this.state.phase = 'character-choice';
    }
  }

  public startLocalCoop(): void {
    if (this.state.phase !== 'menu') return;
    this.enableLocalCoop();
    this.state.phase = 'character-choice';
  }

  public chooseCharacter(character: import('./types').CharacterId): void {
    if (this.state.phase === 'character-choice') {
      this.configureCharacter(this.state.player, character);
      this.state.phase = this.state.coopEnabled ? 'coop-character-choice' : 'active-choice';
    } else if (this.state.phase === 'coop-character-choice' && this.state.partner) {
      this.configureCharacter(this.state.partner, character);
      this.state.phase = 'active-choice';
    }
  }

  public chooseActiveSkill(skill: ActiveSkillId): void {
    if (this.state.phase === 'active-choice') {
      this.configureActiveSkill(this.state.player, skill);
      this.state.phase = this.state.coopEnabled ? 'coop-active-choice' : 'playing';
    } else if (this.state.phase === 'coop-active-choice' && this.state.partner) {
      this.configureActiveSkill(this.state.partner, skill);
      this.state.phase = 'playing';
    }
  }

  public consumeEvents(): CombatEvent[] {
    const events = this.events;
    this.events = [];
    return events;
  }

  public enableLocalCoop(): void {
    if (this.state.coopEnabled) return;
    const player = this.state.player;
    this.state.coopEnabled = true;
    this.state.arena.width = COOP_ARENA_WIDTH;
    this.state.arena.height = COOP_ARENA_HEIGHT;
    player.skillSlotLimit = 4;
    player.enhancementSlotLimit = 4;
    this.state.nextCoopUpgradePlayerId = 'p1';
    this.state.partner = {
      ...player,
      id: 'p2',
      characterId: null,
      x: Math.min(this.state.arena.width - player.radius, player.x + 80),
      y: player.y,
      lastMoveDirection: { ...player.lastMoveDirection },
      equippedSkills: [],
      equippedEnhancements: [],
      skillSlotLimit: 4,
      enhancementSlotLimit: 4,
      upgradeChoiceSalt: 0x9e3779b9,
      metaTalentIds: [...player.metaTalentIds],
      metaPathNodeIds: [...player.metaPathNodeIds],
      metaRelicIds: [...player.metaRelicIds],
      metaRelicForgeRanks: { ...player.metaRelicForgeRanks },
      insightLevels: { ...player.insightLevels },
      upgradeLevels: Object.fromEntries(
        Object.keys(player.upgradeLevels).map((upgrade) => [upgrade, 0]),
      ) as typeof player.upgradeLevels,
      downed: false,
      downedUntilMs: 0,
      reviveProgressMs: 0,
    };
  }

  public getNearestLivingPlayer(origin: Vector): import('./types').CoopTarget | null {
    const targets: import('./types').CoopTarget[] = [{
      id: 'p1', x: this.state.player.x, y: this.state.player.y, downed: this.state.playerDowned,
    }];
    if (this.state.partner) targets.push(this.state.partner);
    return targets
      .filter((target) => !target.downed)
      .sort((left, right) => distance(left, origin) - distance(right, origin))[0] ?? null;
  }

  private getNearestLivingPlayerEntity(origin: Vector): Player | import('./types').CoopPlayer {
    const players: Array<Player | import('./types').CoopPlayer> = this.state.playerDowned ? [] : [this.state.player];
    if (this.state.partner && !this.state.partner.downed) players.push(this.state.partner);
    return players.sort((left, right) => distance(left, origin) - distance(right, origin))[0] ?? this.state.player;
  }

  private configureCharacter(player: Player, character: import('./types').CharacterId): void {
    player.characterId = character;
    recalculatePlayerBuild(player);
    player.hp = player.maxHp;
    player.shield = player.maxShield;
  }

  private configureActiveSkill(player: Player, skill: ActiveSkillId): void {
    player.activeSkill = skill;
    player.activeSkillLevel = 1;
    player.activeCooldownRemainingMs = 0;
  }

  private showNextCoopUpgradeOrResume(): void {
    const nextPlayerId = this.state.coopUpgradeQueue.shift();
    if (!nextPlayerId) {
      this.state.phase = 'playing';
      return;
    }
    const player = nextPlayerId === 'p2' ? this.state.partner : this.state.player;
    if (!player) {
      this.showNextCoopUpgradeOrResume();
      return;
    }
    this.state.pendingUpgradePlayerId = nextPlayerId;
    const excludedChoices = nextPlayerId === 'p2' ? this.state.lastCoopUpgradeChoices : [];
    const otherPlayer = nextPlayerId === 'p2' ? this.state.player : this.state.partner;
    this.state.upgradeChoices = createUpgradeChoices(
      this.state,
      player,
      excludedChoices,
      otherPlayer?.equippedSkills ?? [],
    );
    if (nextPlayerId === 'p1') this.state.lastCoopUpgradeChoices = [...this.state.upgradeChoices];
    this.state.phase = this.state.upgradeChoices.length > 0 ? 'upgrade' : 'playing';
  }

  private updateCoopRevives(deltaMs: number): void {
    const partner = this.state.partner;
    if (!this.state.coopEnabled || !partner) return;
    if (this.state.playerDowned && !partner.downed) {
      this.state.playerReviveProgressMs = distance(this.state.player, partner) <= 54
        ? this.state.playerReviveProgressMs + deltaMs
        : 0;
      if (this.state.playerReviveProgressMs >= 3_000) {
        this.state.playerDowned = false;
        this.state.playerDownedUntilMs = 0;
        this.state.playerReviveProgressMs = 0;
        this.state.player.hp = this.state.player.maxHp * 0.35;
        this.state.player.invulnerableMs = 1_200;
        this.events.push({ type: 'player-healed', x: this.state.player.x, y: this.state.player.y, amount: this.state.player.hp, source: 'life-drain' });
      }
    }
    if (partner.downed && !this.state.playerDowned) {
      partner.reviveProgressMs = distance(this.state.player, partner) <= 54
        ? partner.reviveProgressMs + deltaMs
        : 0;
      if (partner.reviveProgressMs >= 3_000) {
        partner.downed = false;
        partner.downedUntilMs = 0;
        partner.reviveProgressMs = 0;
        partner.hp = partner.maxHp * 0.35;
        partner.invulnerableMs = 1_200;
        this.events.push({ type: 'player-healed', x: partner.x, y: partner.y, amount: partner.hp, source: 'life-drain' });
      }
    }
  }

  public update(deltaMs: number, input: Vector | SimulationInput): void {
    if (this.state.phase === 'awakening') {
      this.state.awakeningRemainingMs = Math.max(
        0,
        this.state.awakeningRemainingMs - deltaMs,
      );
      if (this.state.awakeningRemainingMs === 0) {
        const upgrade = this.state.pendingAwakeningSurge;
        this.state.phase = 'playing';
        this.state.awakeningNotice = null;
        this.state.pendingAwakeningSurge = null;
        if (upgrade) {
          this.triggerAwakeningSurge(upgrade);
        }
      }
      return;
    }
    if (this.state.phase !== 'playing') {
      return;
    }
    const resolvedInput: SimulationInput = 'move' in input
      ? input
      : { move: input, aim: { x: 0, y: 0 }, activate: false, aimMode: 'manual' };

    this.state.elapsedMs += deltaMs;
    this.updateTribulationSeals();
    this.awardSurvivalSpiritOre();
    this.updateTribulation();
    if (this.offerTribulationChoice()) return;
    if (!this.state.playerDowned) this.state.player.attackTimerMs += deltaMs;
    if (this.state.partner && !this.state.partner.downed) {
      this.state.partner.attackTimerMs += deltaMs;
    }
    this.state.player.invulnerableMs = Math.max(0, this.state.player.invulnerableMs - deltaMs);
    this.state.player.activeCooldownRemainingMs = Math.max(
      0,
      this.state.player.activeCooldownRemainingMs - deltaMs,
    );
    this.state.player.activeBarrierRemainingMs = Math.max(
      0,
      this.state.player.activeBarrierRemainingMs - deltaMs,
    );
    if (!this.state.playerDowned) {
      this.state.player.hp = Math.min(
        this.state.player.maxHp,
        this.state.player.hp + this.state.player.hpRegenPerSecond * (deltaMs / 1000),
      );
    }
    if (this.state.partner && !this.state.partner.downed) {
      this.state.partner.invulnerableMs = Math.max(0, this.state.partner.invulnerableMs - deltaMs);
      this.state.partner.activeCooldownRemainingMs = Math.max(
        0,
        this.state.partner.activeCooldownRemainingMs - deltaMs,
      );
      this.state.partner.activeBarrierRemainingMs = Math.max(
        0,
        this.state.partner.activeBarrierRemainingMs - deltaMs,
      );
      this.state.partner.hp = Math.min(
        this.state.partner.maxHp,
        this.state.partner.hp + this.state.partner.hpRegenPerSecond * (deltaMs / 1000),
      );
    }

    this.spawnDueBosses();
    this.spawnEliteSquads();
    this.updateStageObjective();
    this.updateBossArenaObjective();
    this.updateBossPhases();
    this.updateBossSkills(deltaMs);
    this.updateBossHazards(deltaMs);
    if (!this.state.playerDowned) this.movePlayer(this.state.player, deltaMs, resolvedInput.move);
    if (this.state.partner && !this.state.partner.downed) {
      this.movePlayer(this.state.partner, deltaMs, resolvedInput.partner?.move ?? { x: 0, y: 0 });
    }
    this.updateCoopRevives(deltaMs);
    if (resolvedInput.activate) {
      const aim = resolveActiveAim(
        this.state,
        resolvedInput.aim,
        resolvedInput.aimMode ?? 'auto',
      );
      this.events.push(...tryActivateActiveSkill(this.state, aim));
    }
    if (this.state.partner && !this.state.partner.downed && resolvedInput.partner?.activate) {
      const aim = resolveActiveAim(this.state, resolvedInput.partner.aim, resolvedInput.partner.aimMode ?? 'auto', this.state.partner);
      this.events.push(...tryActivateActiveSkill(this.state, aim, this.state.partner));
    }
    this.spawnWave(deltaMs);
    this.moveEnemies(deltaMs);
    this.updateSiegePressure(deltaMs);
    this.updateEliteEffects(deltaMs);
    this.events.push(...updateRangedAttacks(this.state, deltaMs, () => this.takeId()));
    this.events.push(...updateEnemyProjectiles(
      this.state,
      deltaMs,
      (amount, player) => { this.applyDamageToPlayer(player ?? this.state.player, amount); },
      () => this.takeId(),
    ));
    this.applyThunderRing(deltaMs);
    this.applyOrbitingBlades(deltaMs);
    this.castMeteors(deltaMs);
    this.moveProjectiles(deltaMs);
    this.castNorthStar(deltaMs);
    this.castSoulPinPulse(deltaMs);
    this.castSolarRay(deltaMs);
    this.castVoidBell(deltaMs);
    this.castSwordRain(deltaMs);
    this.castStormNet(deltaMs);
    this.castMirrorSigil(deltaMs);
    this.castFrostDomain(this.state.player, deltaMs);
    this.castRiftReturn(this.state.player, deltaMs);
    this.castStarPull(this.state.player, deltaMs);
    if (this.state.partner && !this.state.partner.downed) {
      this.castFrostDomain(this.state.partner, deltaMs);
      this.castRiftReturn(this.state.partner, deltaMs);
      this.castStarPull(this.state.partner, deltaMs);
    }
    this.castAwakeningGlyphs(deltaMs);
    if (!this.state.playerDowned) this.fireAtNearestEnemy(this.state.player);
    if (this.state.partner && !this.state.partner.downed) {
      this.fireAtNearestEnemy(this.state.partner);
    }
    this.collectExperience();
    this.collectTreasureChests();
    this.checkEndStates();
  }

  public spawnEnemy(options: EnemySpawnOptions): Enemy {
    const baseHp = options.hp ?? 24;
    const eliteHpMultiplier = options.eliteAffix === 'iron-wall'
      ? 3.4
      : options.eliteAffix ? 2.5 : 1;
    const hp = baseHp * eliteHpMultiplier;
    const baseSpeed = options.speed ?? 88;
    const eliteSpeedMultiplier = options.eliteAffix === 'haste'
      ? 1.7
      : options.eliteAffix === 'iron-wall' ? 0.85 : 1;
    const enemy: Enemy = {
      id: this.takeId(),
      x: options.x,
      y: options.y,
      radius: options.radius ?? 16,
      hp,
      maxHp: hp,
      speed: baseSpeed * eliteSpeedMultiplier,
      damage: (options.damage ?? 9) * (options.eliteAffix ? 1.4 : 1),
      experience: (options.experience ?? 3) * (options.eliteAffix ? 3.5 : 1),
      kind: options.kind ?? 'normal',
      archetype: options.kind === 'boss' ? 'melee' : options.archetype ?? 'melee',
      rangedAttackTimerMs: 0,
      rangedTelegraphing: false,
      bossWave: options.bossWave,
      bossType: options.kind === 'boss'
        ? options.bossType ?? getBossTypeForWave(options.bossWave ?? 1)
        : undefined,
      bossPhase: options.kind === 'boss' ? 1 : undefined,
      bossSkillTimerMs: options.kind === 'boss' ? 0 : undefined,
      bossSecondaryTimerMs: options.kind === 'boss' ? 0 : undefined,
      bossCastCount: options.kind === 'boss' ? 0 : undefined,
      slowMultiplier: 1,
      slowUntilMs: 0,
      freezeUntilMs: 0,
      nextFreezeAllowedMs: 0,
      eliteAffix: options.eliteAffix,
      eliteTimerMs: 0,
      squadId: options.squadId,
      objectiveKind: options.objectiveKind,
    };
    this.state.enemies.push(enemy);
    return enemy;
  }

  public chooseUpgrade(upgrade: UpgradeChoice): void {
    if (this.state.phase !== 'upgrade' || !this.state.upgradeChoices.includes(upgrade)) {
      return;
    }

    const player = this.state.pendingUpgradePlayerId === 'p2' ? this.state.partner : this.state.player;
    if (!player) return;
    if (isInsightChoice(upgrade)) {
      applyInsight(this.state, upgrade, player);
      this.state.upgradeChoices = [];
      this.showNextCoopUpgradeOrResume();
      return;
    }

    const otherPlayer = this.state.pendingUpgradePlayerId === 'p2' ? this.state.player : this.state.partner;
    if (
      this.state.coopEnabled
      && getUpgradeKind(upgrade) === 'skill'
      && (otherPlayer?.upgradeLevels[upgrade] ?? 0) > 0
    ) return;

    const awakenedBefore = new Set(getAwakenedSkills(player));
    const result = applyUpgrade(this.state, upgrade, player);
    const newlyAwakenedSkill = getAwakenedSkills(player).find((skill) => !awakenedBefore.has(skill));
    this.state.upgradeChoices = [];
    const awakeningUpgrade = newlyAwakenedSkill ?? (result.awakened ? upgrade : null);
    if (awakeningUpgrade && player === this.state.player) {
      this.beginAwakening(awakeningUpgrade);
    } else {
      this.showNextCoopUpgradeOrResume();
    }
  }

  public chooseTribulationChoice(choice: TribulationChoiceId): void {
    if (
      this.state.phase !== 'tribulation-choice'
      || !this.state.tribulationChoices.includes(choice)
    ) return;
    const seal = this.state.tribulation === 'blood-moon'
      ? 'blood'
      : this.state.tribulation;
    if (seal !== 'calm') {
      const rank = ++this.state.tribulationSealRanks[seal];
      this.events.push({
        type: 'tribulation-seal-gained',
        x: this.state.player.x,
        y: this.state.player.y,
        seal,
        rank,
      });
    }
    this.state.activeTribulationChoiceId = choice;
    this.state.tribulationChoices = [];
    while (this.state.nextTribulationChoiceAtMs <= this.state.elapsedMs) {
      this.state.nextTribulationChoiceAtMs += TRIBULATION_DURATION_MS;
    }
    this.state.phase = 'playing';
    this.events.push({
      type: 'tribulation-choice-selected',
      x: this.state.player.x,
      y: this.state.player.y,
      choice,
    });
  }

  public chooseObjectiveRoute(route: ObjectiveRouteId): void {
    if (this.state.phase !== 'objective-route' || this.state.objectiveRoutePendingStep === 0) return;
    this.state.objectiveRoutePendingStep = 0;
    this.state.phase = 'playing';
    this.spawnObjectiveChainLink();
    const objective = this.state.enemies.find((enemy) => enemy.id === this.state.activeObjectiveId);
    if (!objective) return;
    if (route === 'secure') {
      this.state.objectiveExpiresAtMs += 12_000;
      this.state.player.hp = Math.min(this.state.player.maxHp, this.state.player.hp + this.state.player.maxHp * 0.12);
      this.state.player.shield = Math.min(this.state.player.maxShield, this.state.player.shield + this.state.player.maxShield * 0.12);
      return;
    }
    this.state.objectiveChainRiskLevel += 1;
    this.spawnObjectiveRouteGuardians(objective);
  }

  private updateTribulationSeals(): void {
    const mirror = this.state.frostSealMirror;
    if (mirror && this.state.elapsedMs >= mirror.expiresAtMs) {
      this.state.frostSealMirror = null;
    }
  }

  private triggerThunderSeal(primary: Enemy): void {
    const rank = this.state.tribulationSealRanks.thunder;
    if (rank <= 0) return;
    this.state.thunderSealHits += 1;
    const threshold = Math.max(2, 5 - rank);
    if (this.state.thunderSealHits < threshold) return;
    this.state.thunderSealHits = 0;
    const target = this.state.enemies
      .filter((enemy) => enemy.id !== primary.id && enemy.hp > 0)
      .filter((enemy) => distance(enemy, primary) <= 180)
      .sort((left, right) => distance(left, primary) - distance(right, primary))[0];
    if (!target) return;
    this.dealDamage(target, this.state.player.attackDamage * 1.25, 'chain');
    this.events.push({
      type: 'chain-lightning',
      fromX: primary.x,
      fromY: primary.y,
      toX: target.x,
      toY: target.y,
    });
    this.events.push({ type: 'tribulation-seal-triggered', x: primary.x, y: primary.y, seal: 'thunder' });
  }

  private triggerBloodSeal(): void {
    const rank = this.state.tribulationSealRanks.blood;
    if (rank <= 0) return;
    this.state.bloodSealEliteKills += 1;
    const threshold = Math.max(1, 4 - rank);
    if (this.state.bloodSealEliteKills < threshold) return;
    this.state.bloodSealEliteKills = 0;
    const player = this.state.player;
    const radius = 185 + (rank - 1) * 20;
    for (const enemy of this.state.enemies) {
      if (enemy.hp > 0 && distance(enemy, player) <= radius) {
        this.dealDamage(enemy, player.attackDamage * 2.5, 'fire');
      }
    }
    const bulletCount = this.state.enemyProjectiles.length;
    this.state.enemyProjectiles = this.state.enemyProjectiles.filter(
      (bullet) => distance(bullet, player) > radius,
    );
    this.state.runStats.bulletsBlocked += bulletCount - this.state.enemyProjectiles.length;
    player.hp = Math.min(player.maxHp, player.hp + 6 + rank * 2);
    this.events.push({ type: 'fire-burst', x: player.x, y: player.y, radius });
    this.events.push({ type: 'tribulation-seal-triggered', x: player.x, y: player.y, seal: 'blood' });
  }

  private createFrostSealMirror(enemy: Enemy): void {
    const rank = this.state.tribulationSealRanks.frost;
    if (rank <= 0 || enemy.kind !== 'normal') return;
    this.state.frostSealMirror = {
      x: enemy.x,
      y: enemy.y,
      expiresAtMs: this.state.elapsedMs + 6000 + (rank - 1) * 1000,
    };
    this.events.push({ type: 'tribulation-seal-triggered', x: enemy.x, y: enemy.y, seal: 'frost' });
  }

  public chooseTreasure(upgrade: UpgradeId): void {
    if (this.state.phase !== 'treasure' || !this.state.treasureChoices.includes(upgrade)) {
      return;
    }

    const player = this.state.player;
    const kind = getUpgradeKind(upgrade);
    const equipped = getEquippedForKind(player, kind);
    const limit = getLoadoutSlotLimit(player, kind);
    const isEquipped = equipped.includes(upgrade);
    if (!isEquipped && equipped.length >= limit) {
      this.state.pendingTreasureUpgrade = upgrade;
      this.state.phase = 'treasure-replace';
      return;
    }

    const awakenedBefore = new Set(getAwakenedSkills(player));
    const result = applyUpgrade(this.state, upgrade);
    const newlyAwakenedSkill = getAwakenedSkills(player).find((skill) => !awakenedBefore.has(skill));
    this.state.treasureChoices = [];
    this.state.treasureWave = null;
    const awakeningUpgrade = newlyAwakenedSkill ?? (result.awakened ? upgrade : null);
    if (awakeningUpgrade) {
      this.beginAwakening(awakeningUpgrade);
    } else {
      this.state.phase = 'playing';
    }
  }

  public confirmTreasureReplacement(slotIndex: number): void {
    const pending = this.state.pendingTreasureUpgrade;
    const player = this.state.player;
    const equipped = pending
      ? getEquippedForKind(player, getUpgradeKind(pending))
      : [];
    if (
      this.state.phase !== 'treasure-replace' ||
      !pending ||
      slotIndex < 0 ||
      slotIndex >= equipped.length
    ) {
      return;
    }
    const awakenedBefore = new Set(getAwakenedSkills(player));
    const removed = equipped[slotIndex];
    player.upgradeLevels[removed] = 0;
    player.upgradeLevels[pending] = 1;
    equipped[slotIndex] = pending;
    recalculatePlayerBuild(player);
    const newlyAwakenedSkill = getAwakenedSkills(player).find((skill) => !awakenedBefore.has(skill));
    this.state.pendingTreasureUpgrade = null;
    this.state.treasureChoices = [];
    this.state.treasureWave = null;
    if (newlyAwakenedSkill) {
      this.beginAwakening(newlyAwakenedSkill);
    } else {
      this.state.phase = 'playing';
    }
  }

  public cancelTreasureReplacement(): void {
    if (this.state.phase !== 'treasure-replace') return;
    this.state.pendingTreasureUpgrade = null;
    this.state.phase = 'treasure';
  }

  private movePlayer(player: Player, deltaMs: number, input: Vector): void {
    const direction = normalize(input);
    if (direction.x !== 0 || direction.y !== 0) {
      player.lastMoveDirection = direction;
    }
    const distance = player.speed
      * TRIBULATION_MODIFIERS[this.state.tribulation].playerSpeed
      * getTribulationChoiceModifiers(this.state.activeTribulationChoiceId).playerSpeed
      * (deltaMs / 1000);
    player.x = clamp(player.x + direction.x * distance, 0, this.state.arena.width);
    player.y = clamp(player.y + direction.y * distance, 0, this.state.arena.height);
  }

  private spawnWave(deltaMs: number): void {
    this.state.spawnTimerMs += deltaMs;
    const interval = getNormalSpawnInterval(
      this.state.elapsedMs,
      this.state.bossSlowdownUntilMs,
    );
    let normalCount = this.state.enemies.filter((enemy) => enemy.kind === 'normal').length;
    let spawned = 0;

    while (
      this.state.spawnTimerMs >= interval &&
      normalCount < 160 &&
      spawned < 4
    ) {
      this.state.spawnTimerMs -= interval;
      const angle = (this.state.elapsedMs * 0.002 + this.state.nextId * 1.91) % (Math.PI * 2);
      const margin = 70;
      const x = clamp(this.state.player.x + Math.cos(angle) * 650, -margin, this.state.arena.width + margin);
      const y = clamp(this.state.player.y + Math.sin(angle) * 440, -margin, this.state.arena.height + margin);
      const hp = 18 + Math.floor(this.state.elapsedMs / 45000) * 5;
      const speed = 76 + Math.min(54, this.state.elapsedMs / 5000);
      const rangedTypes = ['crossbow', 'talisman', 'soul-lamp'] as const;
      const ranged = this.nextRandom() < getRangedSpawnRatio(this.state.elapsedMs);
      const archetype = ranged
        ? rangedTypes[Math.floor(this.nextRandom() * rangedTypes.length)]
        : 'melee';
      this.spawnEnemy({
        x,
        y,
        hp,
        speed,
        experience: getNormalEnemyExperience(this.state.elapsedMs),
        archetype,
      });
      normalCount += 1;
      spawned += 1;
    }
  }

  private spawnEliteSquads(): void {
    while (
      this.state.elapsedMs >= this.state.nextEliteSquadAtMs
      && this.state.enemies.filter((enemy) => enemy.kind === 'normal').length <= 150
    ) {
      this.state.eliteSquadWave += 1;
      const squadId = this.state.eliteSquadWave;
      const angle = (squadId * 2.31 + this.state.nextId * 0.47) % (Math.PI * 2);
      const anchor = {
        x: clamp(this.state.player.x + Math.cos(angle) * 580, 40, this.state.arena.width - 40),
        y: clamp(this.state.player.y + Math.sin(angle) * 400, 40, this.state.arena.height - 40),
      };
      const baseHp = 42 + Math.floor(this.state.elapsedMs / 60_000) * 7;
      const blueprint = createEliteSquadBlueprint(squadId);
      for (const member of blueprint) {
        this.spawnEnemy({
          x: clamp(anchor.x + member.offsetX, 30, this.state.arena.width - 30),
          y: clamp(anchor.y + member.offsetY, 30, this.state.arena.height - 30),
          hp: baseHp,
          speed: 92 + Math.min(40, this.state.elapsedMs / 20_000),
          damage: 11 + Math.floor(this.state.elapsedMs / 300_000) * 2,
          experience: getNormalEnemyExperience(this.state.elapsedMs) * 1.5,
          archetype: member.archetype,
          eliteAffix: member.eliteAffix,
          squadId,
          radius: member.eliteAffix ? 22 : 16,
        });
      }
      const leader = this.state.enemies.find((enemy) => enemy.squadId === squadId && enemy.eliteAffix);
      if (leader?.eliteAffix) {
        this.events.push({
          type: 'elite-squad-spawned',
          x: leader.x,
          y: leader.y,
          affix: leader.eliteAffix,
          squadId,
        });
      }
      this.state.nextEliteSquadAtMs += 45_000;
    }
  }

  private updateEliteEffects(deltaMs: number): void {
    for (const elite of this.state.enemies) {
      if (!elite.eliteAffix || elite.hp <= 0) continue;
      elite.eliteTimerMs = (elite.eliteTimerMs ?? 0) + deltaMs;
      if (elite.eliteAffix === 'mender' && elite.eliteTimerMs >= 3000) {
        elite.eliteTimerMs %= 3000;
        for (const ally of this.state.enemies) {
          if (ally.hp > 0 && distance(ally, elite) <= 180) {
            ally.hp = Math.min(ally.maxHp, ally.hp + ally.maxHp * 0.12);
          }
        }
        this.events.push({ type: 'elite-effect', x: elite.x, y: elite.y, affix: 'mender' });
      }
      if (elite.eliteAffix === 'haste' && elite.eliteTimerMs >= 2800) {
        elite.eliteTimerMs %= 2800;
        const target = this.getNearestLivingPlayerEntity(elite);
        const dx = target.x - elite.x;
        const dy = target.y - elite.y;
        const length = Math.hypot(dx, dy) || 1;
        elite.x = clamp(elite.x + dx / length * 130, elite.radius, this.state.arena.width - elite.radius);
        elite.y = clamp(elite.y + dy / length * 130, elite.radius, this.state.arena.height - elite.radius);
        this.events.push({ type: 'elite-effect', x: elite.x, y: elite.y, affix: 'haste' });
      }
      if (elite.eliteAffix === 'suppressor' && elite.eliteTimerMs >= 2200) {
        elite.eliteTimerMs %= 2200;
        const players = [
          !this.state.playerDowned ? this.state.player : null,
          this.state.partner && !this.state.partner.downed ? this.state.partner : null,
        ].filter((player): player is Player => player !== null);
        const affected = players.filter((player) => distance(elite, player) <= 220);
        for (const player of affected) {
          player.activeCooldownRemainingMs = Math.max(player.activeCooldownRemainingMs, 1200);
        }
        if (affected.length > 0) {
          this.events.push({ type: 'elite-effect', x: elite.x, y: elite.y, affix: 'suppressor' });
        }
      }
    }
  }

  private updateTribulation(): void {
    const next = getTribulationAt(this.state.elapsedMs);
    if (next === this.state.tribulation) return;
    this.state.tribulation = next;
    this.state.activeTribulationChoiceId = null;
    this.state.tribulationChoices = [];
    this.events.push({
      type: 'tribulation-changed',
      x: this.state.player.x,
      y: this.state.player.y,
      tribulation: next,
    });
  }

  private offerTribulationChoice(): boolean {
    while (this.state.nextTribulationChoiceAtMs < this.state.elapsedMs - 1_000) {
      this.state.nextTribulationChoiceAtMs += TRIBULATION_DURATION_MS;
    }
    if (
      this.state.tribulation === 'calm'
      || this.state.elapsedMs < this.state.nextTribulationChoiceAtMs
    ) return false;
    const tribulation = this.state.tribulation;
    this.state.tribulationChoices = getTribulationChoices(tribulation);
    this.state.nextTribulationChoiceAtMs += TRIBULATION_DURATION_MS;
    this.state.phase = 'tribulation-choice';
    this.events.push({
      type: 'tribulation-choice-offered',
      x: this.state.player.x,
      y: this.state.player.y,
      tribulation,
    });
    return true;
  }

  private updateStageObjective(): void {
    if (
      this.state.activeObjectiveId !== null
      && this.state.elapsedMs >= this.state.objectiveExpiresAtMs
    ) {
      const objective = this.state.enemies.find(
        (enemy) => enemy.id === this.state.activeObjectiveId,
      );
      if (objective?.objectiveKind) {
        this.events.push({
          type: 'objective-resolved',
          x: objective.x,
          y: objective.y,
          objective: objective.objectiveKind,
          success: false,
        });
      }
      this.state.enemies = this.state.enemies.filter(
        (enemy) => enemy.id !== this.state.activeObjectiveId,
      );
      this.state.activeObjectiveId = null;
      this.state.objectiveExpiresAtMs = 0;
      this.resetObjectiveChain();
      this.state.nextEliteSquadAtMs = Math.min(
        this.state.nextEliteSquadAtMs,
        this.state.elapsedMs,
      );
      this.spawnEliteSquads();
    }

    if (
      this.state.activeObjectiveId !== null
      || this.state.elapsedMs < this.state.nextObjectiveAtMs
    ) {
      return;
    }

    this.state.objectiveChainStep = 1;
    this.state.objectiveChainTribulation = this.state.tribulation;
    this.state.objectiveChainRiskLevel = 0;
    this.state.nextObjectiveAtMs += 300_000;
    this.spawnObjectiveChainLink();
  }

  private spawnObjectiveChainLink(): void {
    const step = this.state.objectiveChainStep;
    if (step === 0) return;
    const objectiveKind = this.getObjectiveChainKinds()[step - 1];
    const angle = (this.state.nextId * 1.73 + this.state.elapsedMs * 0.0003 + step * 0.8) % (Math.PI * 2);
    const objective = this.spawnEnemy({
      x: clamp(this.state.player.x + Math.cos(angle) * 430, 70, this.state.arena.width - 70),
      y: clamp(this.state.player.y + Math.sin(angle) * 300, 70, this.state.arena.height - 70),
      hp: 420 + Math.floor(this.state.elapsedMs / 300_000) * 180 + (step - 1) * 140,
      speed: 0,
      damage: 0,
      experience: 0,
      radius: 30,
      archetype: 'talisman',
      objectiveKind,
    });
    this.state.activeObjectiveId = objective.id;
    this.state.objectiveExpiresAtMs = this.state.elapsedMs + 45_000 - (step - 1) * 5_000;
    this.events.push({
      type: 'objective-spawned',
      x: objective.x,
      y: objective.y,
      objective: objectiveKind,
      expiresAtMs: this.state.objectiveExpiresAtMs,
    });
  }

  private getObjectiveChainKinds(): readonly [ObjectiveKind, ObjectiveKind, ObjectiveKind] {
    const tribulation = this.state.objectiveChainTribulation;
    if (tribulation === 'blood-moon') return ['blood-well', 'frost-core', 'thunder-pillar'];
    if (tribulation === 'frost') return ['frost-core', 'thunder-pillar', 'blood-well'];
    return ['thunder-pillar', 'blood-well', 'frost-core'];
  }

  private resetObjectiveChain(): void {
    this.state.objectiveChainStep = 0;
    this.state.objectiveChainTribulation = null;
    this.state.objectiveRoutePendingStep = 0;
    this.state.objectiveChainRiskLevel = 0;
  }

  private spawnObjectiveRouteGuardians(objective: Enemy): void {
    const squadId = ++this.state.eliteSquadWave;
    const affixes: import('./types').EliteAffix[] = ['iron-wall', 'haste', 'suppressor'];
    for (let index = 0; index < affixes.length; index += 1) {
      const angle = index * Math.PI * 2 / affixes.length;
      this.spawnEnemy({
        x: objective.x + Math.cos(angle) * 92,
        y: objective.y + Math.sin(angle) * 92,
        hp: 150 + this.state.objectiveChainStep * 55,
        speed: 86,
        damage: 14,
        experience: 8,
        radius: 21,
        archetype: index === 1 ? 'crossbow' : index === 2 ? 'talisman' : 'melee',
        eliteAffix: affixes[index],
        squadId,
      });
    }
    this.events.push({
      type: 'elite-squad-spawned',
      x: objective.x,
      y: objective.y,
      affix: 'suppressor',
      squadId,
    });
  }

  private spawnDueBosses(): void {
    while (this.state.elapsedMs >= this.state.nextBossAtMs) {
      this.state.bossWave += 1;
      const wave = this.state.bossWave;
      const stats = getBossStats(wave);
      const angle = (wave * 2.17 + this.state.nextId * 0.73) % (Math.PI * 2);
      const x = clamp(
        this.state.player.x + Math.cos(angle) * 560,
        60,
        this.state.arena.width - 60,
      );
      const y = clamp(
        this.state.player.y + Math.sin(angle) * 380,
        60,
        this.state.arena.height - 60,
      );
      const boss = this.spawnEnemy({
        x,
        y,
        hp: stats.hp,
        speed: stats.speed,
        damage: stats.damage,
        experience: stats.experience,
        radius: 42,
        kind: 'boss',
        bossWave: wave,
        bossType: getBossTypeForWave(wave),
      });
      this.events.push({ type: 'boss-spawned', x: boss.x, y: boss.y, wave });
      this.state.bossSlowdownUntilMs = this.state.elapsedMs + 30000;
      this.state.nextBossAtMs += 300000;
    }
  }

  private updateBossPhases(): void {
    for (const boss of this.state.enemies) {
      if (boss.kind !== 'boss') continue;
      const currentPhase = boss.bossPhase ?? 1;
      const nextPhase = currentPhase === 1 && boss.hp <= boss.maxHp * 0.65
        ? 2
        : currentPhase === 2 && boss.hp <= boss.maxHp * 0.3 ? 3 : null;
      if (!nextPhase) continue;
      boss.bossPhase = nextPhase;
      const bossType = boss.bossType ?? getBossTypeForWave(boss.bossWave ?? 1);
      boss.bossSkillTimerMs = getBossPrimaryCooldown(bossType, nextPhase) - 1000;
      boss.bossSecondaryTimerMs = getBossSecondaryCooldown(bossType, nextPhase) - 1000;
      this.state.bossHazards = this.state.bossHazards.filter(
        (hazard) => hazard.ownerBossId !== boss.id,
      );
      this.events.push({
        type: 'boss-phase-changed',
        x: boss.x,
        y: boss.y,
        bossId: boss.id,
        bossType,
        phase: nextPhase,
      });
      if (nextPhase === 2) {
        this.spawnBossArenaObjective(boss);
      } else {
        this.clearBossArenaObjective(boss.id);
      }
    }
  }

  private clearBossArenaObjective(bossId: number): void {
    const targetId = this.state.activeBossObjectiveId;
    const target = targetId === null ? undefined : this.state.enemies.find((enemy) => enemy.id === targetId);
    if (target?.ownerBossId === bossId) {
      this.state.enemies = this.state.enemies.filter((enemy) => enemy.id !== targetId);
      this.state.activeBossObjectiveId = null;
      this.state.bossObjectiveExpiresAtMs = 0;
    }
  }

  private spawnBossArenaObjective(boss: Enemy): void {
    if (this.state.activeBossObjectiveId !== null || boss.bossArenaResolved) return;
    const bossType = boss.bossType ?? 'crimson';
    const objective = this.spawnEnemy({
      ...getBossObjectivePosition(boss, this.state.arena),
      hp: getBossObjectiveHp(boss.bossWave ?? 1),
      speed: 0,
      damage: 0,
      experience: 0,
      radius: 30,
      archetype: 'talisman',
    });
    objective.ownerBossId = boss.id;
    objective.bossObjectiveKind = getBossObjectiveKind(bossType);
    boss.bossArenaResolved = true;
    this.state.activeBossObjectiveId = objective.id;
    this.state.bossObjectiveExpiresAtMs = this.state.elapsedMs + 22_000;
    this.events.push({
      type: 'boss-objective-spawned',
      x: objective.x,
      y: objective.y,
      bossType,
      objective: objective.bossObjectiveKind,
      expiresAtMs: this.state.bossObjectiveExpiresAtMs,
    });
  }

  private updateBossArenaObjective(): void {
    if (this.state.activeBossObjectiveId === null || this.state.elapsedMs < this.state.bossObjectiveExpiresAtMs) return;
    const target = this.state.enemies.find((enemy) => enemy.id === this.state.activeBossObjectiveId);
    const owner = target ? this.state.enemies.find((enemy) => enemy.id === target.ownerBossId) : undefined;
    if (target?.bossObjectiveKind && owner?.kind === 'boss') {
      owner.bossArenaEnraged = true;
      this.events.push({ type: 'boss-objective-resolved', x: target.x, y: target.y, bossType: owner.bossType ?? 'crimson', objective: target.bossObjectiveKind, success: false });
    }
    this.state.enemies = this.state.enemies.filter((enemy) => enemy.id !== this.state.activeBossObjectiveId);
    this.state.activeBossObjectiveId = null;
    this.state.bossObjectiveExpiresAtMs = 0;
  }

  private updateBossSkills(deltaMs: number): void {
    for (const boss of this.state.enemies) {
      if (boss.kind !== 'boss' || boss.hp <= 0) {
        continue;
      }
      if ((boss.bossArenaStunnedUntilMs ?? 0) > this.state.elapsedMs) continue;
      const bossType = boss.bossType ?? getBossTypeForWave(boss.bossWave ?? 1);
      const phase = boss.bossPhase ?? 1;
      boss.bossSkillTimerMs = (boss.bossSkillTimerMs ?? 0) + deltaMs;
      const primaryCooldown = getBossPrimaryCooldown(bossType, phase);
      if (boss.bossSkillTimerMs >= primaryCooldown) {
        boss.bossSkillTimerMs = 0;
        boss.bossCastCount = (boss.bossCastCount ?? 0) + 1;
        const hazards = createBossPrimaryHazards(
          boss,
          this.getNearestLivingPlayerEntity(boss),
          () => this.takeId(),
          () => this.nextRandom(),
        );
        this.state.bossHazards.push(...hazards);
        this.events.push({
          type: 'boss-cast-started',
          x: boss.x,
          y: boss.y,
          bossType,
          kind: 'primary',
        });
      }

      if (bossType === 'blood-moon' && phase >= 2) {
        boss.bossSecondaryTimerMs = (boss.bossSecondaryTimerMs ?? 0) + deltaMs;
        if (boss.bossSecondaryTimerMs >= getBossSecondaryCooldown(bossType, phase)) {
          boss.bossSecondaryTimerMs = 0;
          this.state.bossHazards.push(...createBossSecondaryHazards(
            boss,
            this.getNearestLivingPlayerEntity(boss),
            () => this.takeId(),
          ));
          this.events.push({
            type: 'boss-cast-started',
            x: boss.x,
            y: boss.y,
            bossType,
            kind: 'secondary',
          });
        }
      }
    }
  }

  private moveEnemies(deltaMs: number): void {
    for (const enemy of this.state.enemies) {
      if (enemy.objectiveKind || enemy.bossObjectiveKind) continue;
      if (enemy.kind === 'boss' && (enemy.bossArenaStunnedUntilMs ?? 0) > this.state.elapsedMs) continue;
      const targetPlayer = this.getNearestLivingPlayerEntity(enemy);
      const towardPlayer = normalize({
        x: targetPlayer.x - enemy.x,
        y: targetPlayer.y - enemy.y,
      });
      let direction = towardPlayer;
      if (enemy.kind === 'normal' && enemy.archetype !== 'melee') {
        const currentDistance = distance(enemy, targetPlayer);
        const preferred = enemy.archetype === 'talisman'
          ? 350
          : enemy.archetype === 'crossbow' ? 300 : 325;
        if (currentDistance < preferred - 45) {
          direction = { x: -towardPlayer.x, y: -towardPlayer.y };
        } else if (currentDistance <= preferred + 55) {
          direction = { x: 0, y: 0 };
        }
      }
      const frozen = this.state.elapsedMs < enemy.freezeUntilMs;
      const slowed = this.state.elapsedMs < enemy.slowUntilMs;
      const movementMultiplier = frozen ? 0 : slowed ? enemy.slowMultiplier : 1;
      const barrierSlow = targetPlayer.activeBarrierRemainingMs > 0
        && distance(enemy, targetPlayer) <= targetPlayer.activeBarrierRadius
        ? 0.55
        : 1;
      const tribulationSpeed = TRIBULATION_MODIFIERS[this.state.tribulation].enemySpeed;
      const choiceSpeed = getTribulationChoiceModifiers(this.state.activeTribulationChoiceId).enemySpeed;
      enemy.x += direction.x * enemy.speed * movementMultiplier * barrierSlow * tribulationSpeed * choiceSpeed * (deltaMs / 1000);
      enemy.y += direction.y * enemy.speed * movementMultiplier * barrierSlow * tribulationSpeed * choiceSpeed * (deltaMs / 1000);

      if (
        distance(enemy, targetPlayer) <= enemy.radius + targetPlayer.radius
      ) {
        this.applyDamageToPlayer(targetPlayer, enemy.damage);
      }
    }
    this.removeDeadEnemies();
  }

  private updateBossHazards(deltaMs: number): void {
    for (const hazard of this.state.bossHazards) {
      if (hazard.telegraphRemainingMs > 0) {
        hazard.telegraphRemainingMs = Math.max(0, hazard.telegraphRemainingMs - deltaMs);
        if (hazard.telegraphRemainingMs === 0) {
          this.events.push({
            type: 'boss-skill-activated',
            x: hazard.x,
            y: hazard.y,
            bossType: hazard.bossType,
            kind: hazard.kind,
          });
        }
        continue;
      }

      hazard.activeRemainingMs = Math.max(0, hazard.activeRemainingMs - deltaMs);
      const owner = this.state.enemies.find((enemy) => enemy.id === hazard.ownerBossId && enemy.hp > 0);
      if (owner && hazard.kind === 'charge') {
        const progress = 1 - hazard.activeRemainingMs / Math.max(1, hazard.activeDurationMs);
        owner.x = hazard.x + (hazard.endX - hazard.x) * progress;
        owner.y = hazard.y + (hazard.endY - hazard.y) * progress;
      }
      const hazardTarget = owner ? this.getNearestLivingPlayerEntity(hazard) : null;
      if (owner && hazardTarget && !hazard.hasDamagedPlayer && isPointInsideBossHazard(hazard, hazardTarget)) {
        hazard.hasDamagedPlayer = true;
        const hit = this.applyDamageToPlayer(hazardTarget, owner.damage * hazard.damageMultiplier);
        if (hit && hazard.healBossFraction) {
          const amount = owner.maxHp * hazard.healBossFraction;
          owner.hp = Math.min(owner.maxHp, owner.hp + amount);
          this.events.push({
            type: 'boss-healed',
            x: owner.x,
            y: owner.y,
            bossType: owner.bossType ?? 'blood-moon',
            amount,
          });
        }
      }
    }
    const liveBossIds = new Set(
      this.state.enemies.filter((enemy) => enemy.kind === 'boss' && enemy.hp > 0).map((enemy) => enemy.id),
    );
    this.state.bossHazards = this.state.bossHazards.filter(
      (hazard) => liveBossIds.has(hazard.ownerBossId) &&
        (hazard.telegraphRemainingMs > 0 || hazard.activeRemainingMs > 0),
    );
  }

  private applyDamageToPlayer(player: Player | import('./types').CoopPlayer, amount: number): boolean {
    if (player.invulnerableMs > 0) {
      return false;
    }
    if (this.nextRandom() < player.dodgeChance) {
      this.events.push({ type: 'dodge', x: player.x, y: player.y });
      player.invulnerableMs = CONTACT_DAMAGE_COOLDOWN_MS;
      return false;
    }
    amount *= TRIBULATION_MODIFIERS[this.state.tribulation].enemyDamage
      * getTribulationChoiceModifiers(this.state.activeTribulationChoiceId).enemyDamage;
    const shieldBefore = player.shield;
    const shieldDamage = Math.min(shieldBefore, amount);
    player.shield -= shieldDamage;
    const healthDamage = amount - shieldDamage;
    player.hp -= healthDamage;
    if (shieldDamage > 0) {
      this.events.push({
        type: 'shield-blocked',
        x: player.x,
        y: player.y,
        amount: shieldDamage,
      });
    }
    if (
      shieldBefore > 0 &&
      player.shield === 0 &&
      player.shieldBreakReady &&
      player.shieldBreakDamage > 0
    ) {
      player.shieldBreakReady = false;
      for (const target of this.state.enemies) {
        if (distance(target, player) <= 120) {
          this.dealDamage(target, player.shieldBreakDamage);
        }
      }
      this.events.push({
        type: 'shield-broken',
        x: player.x,
        y: player.y,
        radius: 120,
      });
    }
    if (healthDamage > 0) {
      this.events.push({
        type: 'player-damaged',
        x: player.x,
        y: player.y,
        amount: healthDamage,
      });
    }
    player.invulnerableMs = CONTACT_DAMAGE_COOLDOWN_MS;
    return true;
  }

  private applyThunderRing(deltaMs: number): void {
    if (this.state.player.thunderRadius <= 0) {
      return;
    }

    const damage = this.state.player.thunderDamagePerSecond
      * TRIBULATION_MODIFIERS[this.state.tribulation].thunderDamage
      * (deltaMs / 1000);
    for (const enemy of this.state.enemies) {
      if (distance(enemy, this.state.player) <= this.state.player.thunderRadius) {
        this.dealDamage(enemy, damage, 'thunder');
      }
    }
    if (hasSynergy(this.state.player, 'thunder-resonance')) {
      this.thunderSynergyTimerMs += deltaMs;
      if (this.thunderSynergyTimerMs >= 1000) {
        this.thunderSynergyTimerMs %= 1000;
        const origin = this.state.enemies
          .filter((enemy) => enemy.hp > 0 && distance(enemy, this.state.player) <= this.state.player.thunderRadius)
          .sort((a, b) => distance(a, this.state.player) - distance(b, this.state.player))[0];
        if (origin) {
          const targets = this.state.enemies
            .filter((enemy) => enemy.id !== origin.id && enemy.hp > 0 && distance(enemy, origin) <= 180)
            .sort((a, b) => distance(a, origin) - distance(b, origin))
            .slice(0, 4);
          const chainDamage = Math.max(12, this.state.player.chainLightningDamage * 1.2);
          for (const target of targets) {
            this.dealDamage(target, chainDamage, 'chain');
            this.events.push({
              type: 'chain-lightning',
              fromX: origin.x,
              fromY: origin.y,
              toX: target.x,
              toY: target.y,
            });
          }
          if (targets.length > 0) {
            this.events.push({ type: 'synergy-triggered', x: origin.x, y: origin.y, synergy: 'thunder-resonance' });
          }
        }
      }
    } else {
      this.thunderSynergyTimerMs = 0;
    }
    this.removeDeadEnemies();
  }

  private castAwakeningGlyphs(deltaMs: number): void {
    const player = this.state.player;
    const glyphs = getAwakenedSkills(player);
    if (glyphs.length === 0) {
      this.state.awakeningGlyphTimerMs = 0;
      this.state.awakeningGlyphVolleyCount = 0;
      return;
    }

    this.state.awakeningGlyphTimerMs += deltaMs;
    const formation = getGlyphFormation(glyphs);
    while (this.state.awakeningGlyphTimerMs >= 900) {
      this.state.awakeningGlyphTimerMs -= 900;
      const target = this.state.enemies
        .filter((enemy) => enemy.hp > 0)
        .sort((a, b) => distance(a, player) - distance(b, player))[0];
      if (!target) continue;

      for (let index = 0; index < glyphs.length; index += 1) {
        const { angle, radius } = getGlyphFormationPosition(
          formation,
          index,
          glyphs.length,
          this.state.elapsedMs,
        );
        const x = player.x + Math.cos(angle) * radius;
        const y = player.y + Math.sin(angle) * radius;
        const direction = Math.atan2(target.y - y, target.x - x);
        this.state.projectiles.push({
          id: this.takeId(),
          targetId: target.id,
          x,
          y,
          vx: Math.cos(direction) * PROJECTILE_SPEED * 0.78,
          vy: Math.sin(direction) * PROJECTILE_SPEED * 0.78,
          radius: 5,
          damage: player.attackDamage * 0.95,
          ttlMs: 900,
          pierceRemaining: 2,
          hitEnemyIds: [],
          kind: 'glyph',
          source: 'glyph',
        });
      }

      this.state.awakeningGlyphVolleyCount += 1;
      const ritual = this.state.awakeningGlyphVolleyCount % 2 === 0
        ? this.triggerGlyphRitual(glyphs, target, formation)
        : 'bolt';
      this.events.push({ type: 'glyph-volley', x: player.x, y: player.y, count: glyphs.length, ritual, formation });
    }
  }

  private triggerGlyphRitual(
    glyphs: UpgradeId[],
    target: Enemy,
    formation: GlyphFormation,
  ): 'burst' | 'control' | 'ward' {
    const player = this.state.player;
    if (formation === 'stormfire') {
      const targets = this.state.enemies
        .filter((enemy) => enemy.hp > 0 && distance(enemy, target) <= 118)
        .sort((a, b) => distance(a, target) - distance(b, target));
      for (const enemy of targets) {
        this.dealDamage(enemy, player.attackDamage * 0.85, 'glyph');
      }
      for (const enemy of targets.slice(1, 3)) {
        this.dealDamage(enemy, player.attackDamage * 0.48, 'glyph');
        this.events.push({ type: 'chain-lightning', fromX: target.x, fromY: target.y, toX: enemy.x, toY: enemy.y, awakened: true });
      }
      this.events.push({ type: 'fire-burst', x: target.x, y: target.y, radius: 118, awakened: true });
      return 'burst';
    }

    if (formation === 'frostbind') {
      const targets = this.state.enemies
        .filter((enemy) => enemy.hp > 0 && distance(enemy, target) <= 128)
        .sort((a, b) => distance(a, target) - distance(b, target))
        .slice(0, 3);
      for (const enemy of targets) {
        if (enemy.kind === 'boss') {
          enemy.slowMultiplier = Math.min(enemy.slowMultiplier, 0.62);
          enemy.slowUntilMs = this.state.elapsedMs + 950;
        } else {
          enemy.freezeUntilMs = Math.max(enemy.freezeUntilMs, this.state.elapsedMs + 950);
        }
        this.events.push({ type: 'frost-hit', x: enemy.x, y: enemy.y, frozen: enemy.kind !== 'boss' });
      }
      return 'control';
    }

    if (formation === 'mirror-ward') {
      const bullets = this.state.enemyProjectiles.filter((bullet) => distance(bullet, player) <= 190);
      this.state.enemyProjectiles = this.state.enemyProjectiles.filter((bullet) => distance(bullet, player) > 190);
      for (const bullet of bullets) {
        this.state.runStats.bulletsBlocked += 1;
        this.events.push({ type: 'enemy-bullet-broken', x: bullet.x, y: bullet.y, by: 'barrier' });
      }
      player.shield = Math.min(player.maxShield, player.shield + 5);
      return 'ward';
    }

    const controlGlyph = glyphs.some((upgrade) => (
      upgrade === 'frost-seal' || upgrade === 'soul-pin' || upgrade === 'storm-net'
    ));
    if (controlGlyph) {
      if (target.kind === 'boss') {
        target.slowMultiplier = Math.min(target.slowMultiplier, 0.7);
        target.slowUntilMs = this.state.elapsedMs + 700;
      } else {
        target.freezeUntilMs = Math.max(target.freezeUntilMs, this.state.elapsedMs + 700);
      }
      this.events.push({ type: 'frost-hit', x: target.x, y: target.y, frozen: target.kind !== 'boss' });
      return 'control';
    }

    const wardGlyph = glyphs.some((upgrade) => (
      upgrade === 'golden-shield' || upgrade === 'bullet-reprisal' || upgrade === 'void-bell' || upgrade === 'mirror-sigil'
    ));
    if (wardGlyph) {
      const bulletIndex = this.state.enemyProjectiles.findIndex((bullet) => distance(bullet, player) <= 150);
      if (bulletIndex >= 0) {
        const [bullet] = this.state.enemyProjectiles.splice(bulletIndex, 1);
        this.state.runStats.bulletsBlocked += 1;
        this.events.push({ type: 'enemy-bullet-broken', x: bullet.x, y: bullet.y, by: 'barrier' });
      }
      player.shield = Math.min(player.maxShield, player.shield + 3);
      return 'ward';
    }

    for (const enemy of this.state.enemies) {
      if (enemy.hp > 0 && distance(enemy, target) <= 72) {
        this.dealDamage(enemy, player.attackDamage * 0.85, 'glyph');
      }
    }
    this.events.push({ type: 'fire-burst', x: target.x, y: target.y, radius: 72, awakened: true });
    return 'burst';
  }

  private fireAtNearestEnemy(player: Player): void {
    if (player.attackTimerMs < player.attackCooldownMs || this.state.enemies.length === 0) {
      return;
    }

    const target = this.state.enemies
      .slice()
      .sort((a, b) => distance(a, player) - distance(b, player))[0];
    const direction = normalize({ x: target.x - player.x, y: target.y - player.y });
    const baseAngle = Math.atan2(direction.y, direction.x);
    const spread = 0.13;

    for (let index = 0; index < player.projectileCount; index += 1) {
      const angle = baseAngle + (index - (player.projectileCount - 1) / 2) * spread;
      this.state.projectiles.push({
        id: this.takeId(),
        targetId: target.id,
        x: player.x,
        y: player.y,
        vx: Math.cos(angle) * PROJECTILE_SPEED,
        vy: Math.sin(angle) * PROJECTILE_SPEED,
        radius: 7,
        damage: player.attackDamage,
        ttlMs: PROJECTILE_TTL_MS,
        pierceRemaining: this.state.player.projectilePierce,
        hitEnemyIds: [],
      });
      this.events.push({
        type: 'projectile-fired',
        x: player.x,
        y: player.y,
        angle,
      });
    }
    player.attackTimerMs = 0;
  }

  private moveProjectiles(deltaMs: number): void {
    for (const projectile of this.state.projectiles) {
      const previous = { x: projectile.x, y: projectile.y };
      projectile.x += projectile.vx * (deltaMs / 1000);
      projectile.y += projectile.vy * (deltaMs / 1000);
      projectile.ttlMs -= deltaMs;

      const hitCandidates = this.state.enemies
        .filter((enemy) => !projectile.hitEnemyIds.includes(enemy.id))
        .filter((enemy) => segmentDistance(previous, projectile, enemy) <= projectile.radius + enemy.radius)
        .sort((a, b) => distance(previous, a) - distance(previous, b));

      for (const enemy of hitCandidates) {
        const source = projectile.source ?? (projectile.kind === 'star' ? 'north-star' : 'flying-sword');
        this.dealDamage(
          enemy,
          projectile.damage,
          source,
        );
        projectile.hitEnemyIds.push(enemy.id);
        this.events.push({ type: 'projectile-hit', x: enemy.x, y: enemy.y });
        if (source === 'flying-sword') this.triggerThunderSeal(enemy);
        this.applyOnHitEffects(enemy);
        if (projectile.pierceRemaining <= 0) {
          projectile.ttlMs = 0;
          break;
        }
        projectile.pierceRemaining -= 1;
      }
    }

    this.state.projectiles = this.state.projectiles.filter((projectile) => projectile.ttlMs > 0);
    this.removeDeadEnemies();
  }

  private castNorthStar(deltaMs: number): void {
    const player = this.state.player;
    if (player.northStarCooldownMs <= 0) return;
    player.northStarTimerMs += deltaMs;
    if (player.northStarTimerMs < player.northStarCooldownMs) return;
    player.northStarTimerMs %= player.northStarCooldownMs;
    this.fireNorthStarVolley(player.northStarShotCount);
  }

  private fireNorthStarVolley(count: number): void {
    const player = this.state.player;
    for (let index = 0; index < count; index += 1) {
      const ringOffset = index >= 8 ? Math.PI / 8 : 0;
      const angle = (index % 8) * Math.PI / 4 + ringOffset;
      this.state.projectiles.push({
        id: this.takeId(),
        targetId: -1,
        x: player.x,
        y: player.y,
        vx: Math.cos(angle) * PROJECTILE_SPEED * 0.82,
        vy: Math.sin(angle) * PROJECTILE_SPEED * 0.82,
        radius: 6,
        damage: player.northStarDamage,
        ttlMs: PROJECTILE_TTL_MS,
        pierceRemaining: player.northStarPierce,
        hitEnemyIds: [],
        kind: 'star',
        source: 'north-star',
      });
    }
    this.events.push({
      type: 'star-volley',
      x: player.x,
      y: player.y,
      count,
      awakened: isUpgradeAwakened(player, 'north-star'),
    });
  }

  private castSoulPinPulse(deltaMs: number): void {
    const player = this.state.player;
    if (player.soulPinPulseCooldownMs <= 0) return;
    player.soulPinPulseTimerMs += deltaMs;
    if (player.soulPinPulseTimerMs < player.soulPinPulseCooldownMs) return;
    player.soulPinPulseTimerMs %= player.soulPinPulseCooldownMs;
    for (const enemy of this.state.enemies) {
      if (distance(enemy, player) > 220) continue;
      if (enemy.kind === 'boss') {
        enemy.slowMultiplier = Math.min(enemy.slowMultiplier, 0.55);
        enemy.slowUntilMs = this.state.elapsedMs + 1200;
      } else {
        enemy.freezeUntilMs = Math.max(enemy.freezeUntilMs, this.state.elapsedMs + 900);
      }
      this.events.push({ type: 'soul-pinned', x: enemy.x, y: enemy.y, awakened: true });
    }
  }

  private castSolarRay(deltaMs: number): void {
    const player = this.state.player;
    if (player.solarRayCooldownMs <= 0) return;
    player.solarRayTimerMs += deltaMs;
    if (player.solarRayTimerMs < player.solarRayCooldownMs) return;
    player.solarRayTimerMs %= player.solarRayCooldownMs;
    const target = this.state.enemies
      .filter((enemy) => enemy.hp > 0 && distance(enemy, player) <= player.solarRayRange)
      .sort((a, b) => distance(a, player) - distance(b, player))[0];
    if (!target) return;
    this.dealDamage(target, player.solarRayDamage, 'solar-ray');
    this.events.push({
      type: 'chain-lightning', fromX: player.x, fromY: player.y, toX: target.x, toY: target.y,
      awakened: isUpgradeAwakened(player, 'solar-ray'), style: 'solar-ray',
    });
    if ((target.solarMarkUntilMs ?? 0) > this.state.elapsedMs) {
      target.solarMarkUntilMs = 0;
      for (const enemy of this.state.enemies) {
        if (enemy.hp > 0 && distance(enemy, target) <= 120) {
          this.dealDamage(enemy, player.solarRayDamage * 0.7, 'solar-ray');
        }
      }
      this.events.push({ type: 'fire-burst', x: target.x, y: target.y, radius: 120, awakened: true });
      if (hasSynergy(player, 'eclipse-sanctum')) {
        this.events.push({ type: 'synergy-triggered', x: target.x, y: target.y, synergy: 'eclipse-sanctum' });
      }
      if (hasSynergy(player, 'sunblade-cascade')) {
        this.events.push({ type: 'synergy-triggered', x: target.x, y: target.y, synergy: 'sunblade-cascade' });
      }
    }
    this.removeDeadEnemies();
  }

  private castVoidBell(deltaMs: number): void {
    const player = this.state.player;
    if (player.voidBellCooldownMs <= 0) return;
    player.voidBellTimerMs += deltaMs;
    if (player.voidBellTimerMs < player.voidBellCooldownMs) return;
    player.voidBellTimerMs %= player.voidBellCooldownMs;
    const eclipseSanctum = hasSynergy(player, 'eclipse-sanctum');
    const frozenKnell = hasSynergy(player, 'frozen-knell');
    let affectedEnemies = 0;
    let brokenBullets = 0;
    for (const enemy of this.state.enemies) {
      if (distance(enemy, player) <= player.voidBellRadius) {
        this.dealDamage(enemy, player.voidBellDamage, 'void-bell');
        if (eclipseSanctum) {
          this.dealDamage(enemy, player.solarRayDamage * 1.2, 'solar-ray');
          enemy.solarMarkUntilMs = this.state.elapsedMs + 5_000;
        }
        if (frozenKnell) {
          enemy.slowMultiplier = Math.min(enemy.slowMultiplier, enemy.kind === 'boss' ? 0.55 : 0.2);
          enemy.slowUntilMs = Math.max(enemy.slowUntilMs, this.state.elapsedMs + 2200);
          if (enemy.kind !== 'boss') {
            enemy.freezeUntilMs = Math.max(enemy.freezeUntilMs, this.state.elapsedMs + 1000);
          }
          this.events.push({ type: 'frost-hit', x: enemy.x, y: enemy.y, frozen: enemy.kind !== 'boss', style: 'soul-pin' });
        }
        affectedEnemies += 1;
      }
    }
    if (player.voidBellBreaksBullets || frozenKnell) {
      this.state.enemyProjectiles = this.state.enemyProjectiles.filter((bullet) => {
        if (distance(bullet, player) > player.voidBellRadius) return true;
        this.state.runStats.bulletsBlocked += 1;
        brokenBullets += 1;
        this.events.push({ type: 'enemy-bullet-broken', x: bullet.x, y: bullet.y, by: 'barrier' });
        return false;
      });
    }
    this.events.push({
      type: 'bullet-reprisal', x: player.x, y: player.y, radius: player.voidBellRadius,
      awakened: isUpgradeAwakened(player, 'void-bell'), style: 'void-bell',
    });
    if (eclipseSanctum && affectedEnemies > 0) {
      this.events.push({ type: 'synergy-triggered', x: player.x, y: player.y, synergy: 'eclipse-sanctum' });
    }
    if (frozenKnell && (affectedEnemies > 0 || brokenBullets > 0)) {
      this.events.push({ type: 'synergy-triggered', x: player.x, y: player.y, synergy: 'frozen-knell' });
    }
    this.removeDeadEnemies();
  }

  private castSwordRain(deltaMs: number): void {
    const player = this.state.player;
    if (player.swordRainCooldownMs <= 0 || this.state.enemies.length === 0) return;
    player.swordRainTimerMs += deltaMs;
    if (player.swordRainTimerMs < player.swordRainCooldownMs) return;
    player.swordRainTimerMs %= player.swordRainCooldownMs;
    const targets = this.state.enemies.filter((enemy) => enemy.hp > 0)
      .sort((a, b) => distance(a, player) - distance(b, player));
    const sunbladeCascade = hasSynergy(player, 'sunblade-cascade');
    const gildedSwordRain = hasSynergy(player, 'gilded-sword-rain');
    let hits = 0;
    for (let index = 0; index < player.swordRainCount; index += 1) {
      const target = targets[index % targets.length];
      this.dealDamage(target, player.swordRainDamage, 'sword-rain');
      if (sunbladeCascade) {
        this.dealDamage(target, player.solarRayDamage * 1.1, 'solar-ray');
        target.solarMarkUntilMs = this.state.elapsedMs + 5_000;
        this.events.push({
          type: 'chain-lightning', fromX: player.x, fromY: player.y, toX: target.x, toY: target.y,
          awakened: isUpgradeAwakened(player, 'solar-ray'), style: 'solar-ray',
        });
      }
      if (gildedSwordRain) {
        const shieldBefore = player.shield;
        player.shield = Math.min(player.maxShield, player.shield + player.maxShield * 0.1);
        if (shieldBefore < player.maxShield && player.shield >= player.maxShield) {
          player.shieldBreakReady = true;
        }
      }
      this.events.push({
        type: 'meteor-strike', x: target.x, y: target.y, damage: player.swordRainDamage,
        awakened: isUpgradeAwakened(player, 'spirit-sword-rain'), style: 'sword-rain',
      });
      hits += 1;
    }
    if (sunbladeCascade && hits > 0) {
      this.events.push({ type: 'synergy-triggered', x: player.x, y: player.y, synergy: 'sunblade-cascade' });
    }
    if (gildedSwordRain && hits > 0) {
      this.events.push({ type: 'synergy-triggered', x: player.x, y: player.y, synergy: 'gilded-sword-rain' });
    }
    this.removeDeadEnemies();
  }

  private castStormNet(deltaMs: number): void {
    const player = this.state.player;
    if (player.stormNetCooldownMs <= 0) return;
    player.stormNetTimerMs += deltaMs;
    if (player.stormNetTimerMs < player.stormNetCooldownMs) return;
    player.stormNetTimerMs %= player.stormNetCooldownMs;
    const targets = this.state.enemies.filter((enemy) => enemy.hp > 0)
      .sort((a, b) => distance(a, player) - distance(b, player))
      .slice(0, player.stormNetTargets);
    let previous: { x: number; y: number } = player;
    for (const target of targets) {
      this.dealDamage(target, player.stormNetDamage, 'chain');
      if (player.stormNetRootMs > 0) {
        if (target.kind === 'boss') {
          target.slowMultiplier = Math.min(target.slowMultiplier, 0.6);
          target.slowUntilMs = this.state.elapsedMs + player.stormNetRootMs;
        } else {
          target.freezeUntilMs = Math.max(target.freezeUntilMs, this.state.elapsedMs + player.stormNetRootMs);
        }
      }
      this.events.push({ type: 'chain-lightning', fromX: previous.x, fromY: previous.y, toX: target.x, toY: target.y, awakened: player.stormNetRootMs > 0, style: 'storm-net' });
      previous = target;
    }
    this.removeDeadEnemies();
  }

  private castMirrorSigil(deltaMs: number): void {
    const player = this.state.player;
    if (player.mirrorSigilCooldownMs <= 0) return;
    player.mirrorSigilTimerMs += deltaMs;
    if (player.mirrorSigilTimerMs < player.mirrorSigilCooldownMs) return;
    player.mirrorSigilTimerMs %= player.mirrorSigilCooldownMs;
    const reflectedOwnerIds = new Set<number>();
    this.state.enemyProjectiles = this.state.enemyProjectiles.filter((bullet) => {
      if (distance(bullet, player) > player.mirrorSigilRadius) return true;
      reflectedOwnerIds.add(bullet.ownerId);
      this.state.runStats.bulletsBlocked += 1;
      this.events.push({ type: 'enemy-bullet-broken', x: bullet.x, y: bullet.y, by: 'barrier' });
      return false;
    });
    for (const ownerId of reflectedOwnerIds) {
      const owner = this.state.enemies.find((enemy) => enemy.id === ownerId);
      if (!owner) continue;
      this.dealDamage(owner, player.mirrorSigilDamage, 'reprisal');
      for (const nearby of this.state.enemies.filter((enemy) => enemy.id !== ownerId && distance(enemy, owner) <= 120).slice(0, player.mirrorSigilChains)) {
        this.dealDamage(nearby, player.mirrorSigilDamage * 0.65, 'reprisal');
      }
    }
    this.events.push({ type: 'bullet-reprisal', x: player.x, y: player.y, radius: player.mirrorSigilRadius, awakened: player.mirrorSigilChains > 0, style: 'mirror-sigil' });
    this.removeDeadEnemies();
  }

  private castFrostDomain(player: Player, deltaMs: number): void {
    if (player.frostDomainCooldownMs <= 0) return;
    player.frostDomainTimerMs += deltaMs;
    if (player.frostDomainTimerMs < player.frostDomainCooldownMs) return;
    player.frostDomainTimerMs %= player.frostDomainCooldownMs;
    const awakened = isUpgradeAwakened(player, 'frost-domain');
    for (const enemy of this.state.enemies) {
      if (enemy.hp <= 0 || distance(enemy, player) > player.frostDomainRadius) continue;
      this.dealDamage(enemy, player.frostDomainDamage, 'chain');
      if (enemy.kind === 'boss') {
        enemy.slowMultiplier = Math.min(enemy.slowMultiplier, awakened ? 0.48 : 0.72);
        enemy.slowUntilMs = Math.max(enemy.slowUntilMs, this.state.elapsedMs + 1000);
      } else if (player.frostDomainFreezeMs > 0) {
        enemy.freezeUntilMs = Math.max(enemy.freezeUntilMs, this.state.elapsedMs + player.frostDomainFreezeMs);
      } else {
        enemy.slowMultiplier = Math.min(enemy.slowMultiplier, 0.65);
        enemy.slowUntilMs = Math.max(enemy.slowUntilMs, this.state.elapsedMs + 1000);
      }
    }
    if (awakened) {
      this.state.enemyProjectiles = this.state.enemyProjectiles.filter((bullet) => {
        if (distance(bullet, player) > player.frostDomainRadius) return true;
        this.state.runStats.bulletsBlocked += 1;
        this.events.push({ type: 'enemy-bullet-broken', x: bullet.x, y: bullet.y, by: 'barrier' });
        return false;
      });
    }
    this.events.push({ type: 'frost-domain', x: player.x, y: player.y, radius: player.frostDomainRadius, awakened });
    this.removeDeadEnemies();
  }

  private castRiftReturn(player: Player, deltaMs: number): void {
    if (player.riftReturnCooldownMs <= 0) return;
    player.riftReturnTimerMs += deltaMs;
    if (player.riftReturnTimerMs < player.riftReturnCooldownMs) return;
    player.riftReturnTimerMs %= player.riftReturnCooldownMs;
    const target = this.state.enemies.filter((enemy) => enemy.hp > 0 && distance(enemy, player) <= player.riftReturnRange)
      .sort((left, right) => distance(left, player) - distance(right, player))[0];
    if (!target) return;
    const awakened = player.riftReturnEchoes > 0;
    this.dealDamage(target, player.riftReturnDamage, 'sword-rain');
    this.events.push({ type: 'rift-return', fromX: player.x, fromY: player.y, toX: target.x, toY: target.y, awakened: false });
    this.dealDamage(target, player.riftReturnDamage, 'sword-rain');
    this.events.push({ type: 'rift-return', fromX: target.x, fromY: target.y, toX: player.x, toY: player.y, awakened });
    if (awakened) {
      const echoes = this.state.enemies.filter((enemy) => enemy.hp > 0 && enemy.id !== target.id && distance(enemy, target) <= 180)
        .sort((left, right) => distance(left, target) - distance(right, target)).slice(0, player.riftReturnEchoes);
      for (const echo of echoes) {
        this.dealDamage(echo, player.riftReturnDamage * 0.7, 'sword-rain');
        this.events.push({ type: 'rift-return', fromX: player.x, fromY: player.y, toX: echo.x, toY: echo.y, awakened: true });
      }
    }
    this.removeDeadEnemies();
  }

  private castStarPull(player: Player, deltaMs: number): void {
    if (player.starPullCooldownMs <= 0) return;
    player.starPullTimerMs += deltaMs;
    if (player.starPullTimerMs < player.starPullCooldownMs) return;
    player.starPullTimerMs %= player.starPullCooldownMs;
    const center = this.state.enemies.filter((enemy) => enemy.hp > 0 && distance(enemy, player) <= 560)
      .sort((left, right) => distance(left, player) - distance(right, player))[0];
    if (!center) return;
    const awakened = player.starPullBreaksBullets;
    for (const enemy of this.state.enemies) {
      if (enemy.hp <= 0 || distance(enemy, center) > player.starPullRadius) continue;
      if (enemy.kind === 'boss') {
        enemy.slowMultiplier = Math.min(enemy.slowMultiplier, 0.6);
        enemy.slowUntilMs = Math.max(enemy.slowUntilMs, this.state.elapsedMs + 1100);
      } else {
        const direction = normalize({ x: center.x - enemy.x, y: center.y - enemy.y });
        enemy.x += direction.x * player.starPullForce;
        enemy.y += direction.y * player.starPullForce;
      }
      this.dealDamage(enemy, player.starPullDamage, 'meteor');
    }
    if (awakened) {
      this.state.enemyProjectiles = this.state.enemyProjectiles.filter((bullet) => {
        if (distance(bullet, center) > 28) return true;
        this.state.runStats.bulletsBlocked += 1;
        this.events.push({ type: 'enemy-bullet-broken', x: bullet.x, y: bullet.y, by: 'barrier' });
        return false;
      });
    }
    this.events.push({ type: 'star-pull', x: center.x, y: center.y, radius: player.starPullRadius, awakened });
    this.removeDeadEnemies();
  }

  private collectExperience(): void {
    const remaining = [];
    for (const shard of this.state.shards) {
      const pickedUpByPlayer = distance(shard, this.state.player) <= this.state.player.pickupRadius;
      const pickedUpByPartner = this.state.partner
        && !this.state.partner.downed
        && distance(shard, this.state.partner) <= this.state.partner.pickupRadius;
      if (pickedUpByPlayer || pickedUpByPartner) {
        const experience = shard.value
          * getTribulationChoiceModifiers(this.state.activeTribulationChoiceId).experience
          * (this.state.coopEnabled ? 1.25 : 1);
        this.state.player.experience += experience * this.state.player.experienceMultiplier;
        if (this.state.partner && !this.state.partner.downed) {
          this.state.partner.experience += experience * this.state.partner.experienceMultiplier;
        }
      } else {
        remaining.push(shard);
      }
    }
    this.state.shards = remaining;

    const levelUps: Array<'p1' | 'p2'> = [];
    this.collectPlayerLevels(this.state.player, 'p1', levelUps);
    if (this.state.partner && !this.state.partner.downed) {
      this.collectPlayerLevels(this.state.partner, 'p2', levelUps);
    }
    if (levelUps.length > 0) {
      const upgradeRecipients = this.state.coopEnabled
        ? levelUps.map(() => this.takeNextCoopUpgradePlayerId())
        : levelUps;
      this.state.coopUpgradeQueue.push(...upgradeRecipients);
      this.showNextCoopUpgradeOrResume();
    }
  }

  private takeNextCoopUpgradePlayerId(): 'p1' | 'p2' {
    const nextPlayerId = this.state.nextCoopUpgradePlayerId;
    this.state.nextCoopUpgradePlayerId = nextPlayerId === 'p1' ? 'p2' : 'p1';
    return nextPlayerId;
  }

  private collectPlayerLevels(player: Player, id: 'p1' | 'p2', queue: Array<'p1' | 'p2'>): void {
    while (player.experience >= player.experienceToNext) {
      player.experience -= player.experienceToNext;
      player.level += 1;
      player.experienceToNext = getNextExperienceRequirement(player.experienceToNext, player.level);
      queue.push(id);
      this.events.push({ type: 'level-up', x: player.x, y: player.y, level: player.level });
    }
  }

  private removeDeadEnemies(): void {
    const survivors = [];
    for (const enemy of this.state.enemies) {
      if (enemy.hp <= 0) {
        if (enemy.bossObjectiveKind) {
          const owner = this.state.enemies.find((candidate) => candidate.id === enemy.ownerBossId);
          if (owner?.kind === 'boss') {
            owner.bossArenaStunnedUntilMs = this.state.elapsedMs + 4000;
            owner.bossArenaVulnerableUntilMs = this.state.elapsedMs + 10_000;
            this.state.player.experience += this.state.player.experienceToNext * 0.5;
            for (let index = 0; index < 6; index += 1) {
              this.state.shards.push({ id: this.takeId(), x: enemy.x + Math.cos(index * Math.PI / 3) * 28, y: enemy.y + Math.sin(index * Math.PI / 3) * 28, radius: 8, value: 3 });
            }
            this.events.push({ type: 'boss-objective-resolved', x: enemy.x, y: enemy.y, bossType: owner.bossType ?? 'crimson', objective: enemy.bossObjectiveKind, success: true });
            if (owner.bossType === 'blood-moon' && enemy.bossObjectiveKind === 'blood-well') {
              this.state.resolvedBloodWellBossId = owner.id;
            }
          }
          this.state.activeBossObjectiveId = null;
          this.state.bossObjectiveExpiresAtMs = 0;
        } else if (enemy.objectiveKind) {
          this.state.activeObjectiveId = null;
          this.state.objectiveExpiresAtMs = 0;
          this.state.runStats.objectivesCompleted += 1;
          const isFinalLink = this.state.objectiveChainStep === 3;
          const experienceFraction = isFinalLink
            ? 0.65
            : this.state.objectiveChainStep === 2 ? 0.3 : 0.2;
          this.state.player.experience += this.state.player.experienceToNext * experienceFraction;
          this.state.player.hp = Math.min(
            this.state.player.maxHp,
            this.state.player.hp + this.state.player.maxHp * (isFinalLink ? 0.35 : 0.15),
          );
          this.state.player.shield = Math.min(
            this.state.player.maxShield,
            this.state.player.shield + this.state.player.maxShield * (isFinalLink ? 0.35 : 0.15),
          );
          const fieldExpiresAtMs = this.state.elapsedMs + 18_000;
          this.state.objectiveFieldExpiresAtMs[enemy.objectiveKind] = fieldExpiresAtMs;
          this.events.push({
            type: 'objective-resolved',
            x: enemy.x,
            y: enemy.y,
            objective: enemy.objectiveKind,
            success: true,
          });
          this.events.push({
            type: 'objective-field-activated',
            x: enemy.x,
            y: enemy.y,
            objective: enemy.objectiveKind,
            expiresAtMs: fieldExpiresAtMs,
          });
          if (isFinalLink) {
            this.events.push({ type: 'spirit-ore-earned', x: enemy.x, y: enemy.y, source: 'objective', amount: 1 });
            const chestCount = 1 + this.state.objectiveChainRiskLevel;
            for (let index = 0; index < chestCount; index += 1) {
              const angle = chestCount === 1 ? 0 : index * Math.PI * 2 / chestCount;
              const x = enemy.x + Math.cos(angle) * 32;
              const y = enemy.y + Math.sin(angle) * 32;
              this.state.chests.push({
                id: this.takeId(),
                x,
                y,
                radius: 20,
                wave: Math.max(1, this.state.bossWave),
              });
              this.events.push({ type: 'chest-dropped', x, y, wave: Math.max(1, this.state.bossWave) });
            }
            this.resetObjectiveChain();
          } else {
            this.state.objectiveChainStep = (this.state.objectiveChainStep + 1) as 2 | 3;
            this.state.objectiveRoutePendingStep = this.state.objectiveChainStep;
            this.state.phase = 'objective-route';
          }
        } else if (enemy.kind === 'boss') {
          this.state.kills += 1;
          this.state.bossesDefeated += 1;
          if (enemy.bossType === 'blood-moon' && this.state.resolvedBloodWellBossId === enemy.id) {
            this.events.push({ type: 'hidden-character-unlocked', x: enemy.x, y: enemy.y, character: 'jing-po' });
            this.state.resolvedBloodWellBossId = null;
          }
          const activeSkill = this.state.player.activeSkill;
          if (activeSkill && this.state.player.activeSkillLevel < 4) {
            this.state.player.activeSkillLevel += 1;
            this.events.push({
              type: 'active-skill-leveled',
              x: this.state.player.x,
              y: this.state.player.y,
              skill: activeSkill,
              level: this.state.player.activeSkillLevel,
            });
          }
          this.state.bossHazards = this.state.bossHazards.filter(
            (hazard) => hazard.ownerBossId !== enemy.id,
          );
          if (this.state.activeBossObjectiveId !== null) {
            const target = this.state.enemies.find((candidate) => candidate.id === this.state.activeBossObjectiveId);
            if (target?.ownerBossId === enemy.id) {
              this.state.activeBossObjectiveId = null;
              this.state.bossObjectiveExpiresAtMs = 0;
            }
          }
          this.dropBossRewards(enemy);
        } else {
          this.state.kills += 1;
          if (enemy.eliteAffix) {
            this.state.runStats.elitesDefeated += 1;
            this.triggerBloodSeal();
          }
          this.state.shards.push({
            id: this.takeId(),
            x: enemy.x,
            y: enemy.y,
            radius: 8,
            value: enemy.experience * TRIBULATION_MODIFIERS[this.state.tribulation].experience,
          });
        }
        const bloodHarvest = !enemy.objectiveKind
          && enemy.kind === 'normal'
          && this.hasObjectiveField('blood-well')
          && this.nextRandom() < 0.25;
        const lifeDrain = !enemy.objectiveKind
          && this.state.player.lifeOnKill > 0
          && this.state.player.hp < this.state.player.maxHp
          && this.nextRandom() < this.state.player.lifeOnKillChance;
        if (bloodHarvest || lifeDrain) {
          const oldHp = this.state.player.hp;
          this.state.player.hp = Math.min(
            this.state.player.maxHp,
            oldHp + (bloodHarvest ? 3 : this.state.player.lifeOnKill),
          );
          this.events.push({
            type: 'player-healed',
            x: this.state.player.x,
            y: this.state.player.y,
            amount: this.state.player.hp - oldHp,
            source: 'life-drain',
          });
        }
        this.events.push({ type: 'enemy-killed', x: enemy.x, y: enemy.y });
      } else {
        survivors.push(enemy);
      }
    }
    this.state.enemies = survivors;
  }

  private hasObjectiveField(objective: import('./types').ObjectiveKind): boolean {
    return this.state.elapsedMs < this.state.objectiveFieldExpiresAtMs[objective];
  }

  private updateSiegePressure(deltaMs: number): void {
    const nearbyThreats = this.state.enemies.filter((enemy) => (
      !enemy.objectiveKind
      && enemy.hp > 0
      && Math.hypot(enemy.x - this.state.player.x, enemy.y - this.state.player.y) <= 250
    )).length;
    this.state.siegeEnemyCount = nearbyThreats;

    const wasActive = this.state.siegeActive;
    if (!wasActive && nearbyThreats >= 6) this.state.siegeActive = true;
    if (wasActive && nearbyThreats <= 3) this.state.siegeActive = false;

    if (!this.state.siegeActive) {
      this.state.siegePulseTimerMs = 0;
      return;
    }

    this.state.siegePulseTimerMs += deltaMs;
    if (!wasActive || this.state.siegePulseTimerMs >= 1800) {
      this.state.siegePulseTimerMs = 0;
      this.events.push({
        type: 'siege-pressure',
        x: this.state.player.x,
        y: this.state.player.y,
        enemyCount: nearbyThreats,
      });
    }
  }

  private dropBossRewards(enemy: Enemy): void {
    const wave = enemy.bossWave ?? 1;
    const totalExperience = 120 + (wave - 1) * 40;
    this.state.chests.push({
      id: this.takeId(),
      x: enemy.x,
      y: enemy.y,
      radius: 20,
      wave,
    });
    for (let index = 0; index < 12; index += 1) {
      const angle = (index / 12) * Math.PI * 2;
      const radius = 34 + (index % 2) * 18;
      this.state.shards.push({
        id: this.takeId(),
        x: enemy.x + Math.cos(angle) * radius,
        y: enemy.y + Math.sin(angle) * radius,
        radius: 8,
        value: totalExperience / 12,
      });
    }
    this.events.push({ type: 'chest-dropped', x: enemy.x, y: enemy.y, wave });
    this.events.push({ type: 'dao-yun-earned', x: enemy.x, y: enemy.y, wave, amount: 1 });
    this.events.push({ type: 'spirit-ore-earned', x: enemy.x, y: enemy.y, source: 'boss', amount: 1 });
    this.events.push({
      type: 'boss-reward-burst',
      x: enemy.x,
      y: enemy.y,
      wave,
      experience: totalExperience,
    });
  }

  private awardSurvivalSpiritOre(): void {
    while (this.state.elapsedMs >= this.state.nextSpiritOreAtMs) {
      this.events.push({
        type: 'spirit-ore-earned',
        x: this.state.player.x,
        y: this.state.player.y,
        source: 'survival',
        amount: 1,
      });
      this.state.nextSpiritOreAtMs += 600000;
    }
  }

  private collectTreasureChests(): void {
    const chest = this.state.chests.find(
      (candidate) => distance(candidate, this.state.player) <= 42,
    );
    if (!chest) {
      return;
    }
    this.state.chests = this.state.chests.filter((candidate) => candidate.id !== chest.id);
    const choices = createTreasureChoices(this.state);
    if (choices.length === 0) {
      this.state.player.maxHp += 25;
      this.state.player.hp = this.state.player.maxHp;
      this.state.player.shield = this.state.player.maxShield;
      this.state.player.shieldBreakReady = this.state.player.maxShield > 0;
      return;
    }
    this.state.treasureChoices = choices;
    this.state.treasureWave = chest.wave;
    this.state.phase = 'treasure';
  }

  private applyOnHitEffects(primary: Enemy): void {
    const soulExecution = primary.kind === 'boss' && hasSynergy(this.state.player, 'soul-execution');
    const soulPinChance = this.state.player.soulPinChance + (soulExecution ? 0.18 : 0);
    if (soulPinChance > 0 && this.nextRandom() < soulPinChance) {
      const away = normalize({
        x: primary.x - this.state.player.x,
        y: primary.y - this.state.player.y,
      });
      primary.x += away.x * this.state.player.soulPinKnockback;
      primary.y += away.y * this.state.player.soulPinKnockback;
      if (primary.kind === 'normal') {
        primary.freezeUntilMs = Math.max(
          primary.freezeUntilMs,
          this.state.elapsedMs + this.state.player.soulPinRootMs,
        );
      } else {
        primary.slowMultiplier = Math.min(primary.slowMultiplier, 0.7);
        primary.slowUntilMs = this.state.elapsedMs + this.state.player.soulPinRootMs;
      }
      this.events.push({ type: 'soul-pinned', x: primary.x, y: primary.y, awakened: false });
      if (soulExecution) {
        this.dealDamage(primary, this.state.player.attackDamage * 4, 'soul');
        primary.bossSkillTimerMs = 0;
        primary.bossSecondaryTimerMs = 0;
        this.state.bossHazards = this.state.bossHazards.filter((hazard) => hazard.ownerBossId !== primary.id);
        this.events.push({ type: 'synergy-triggered', x: primary.x, y: primary.y, synergy: 'soul-execution' });
      }
    }
    if (this.state.player.frostSlowPercent > 0) {
      const bossSlowScale = primary.kind === 'boss' ? 0.5 : 1;
      primary.slowMultiplier = 1 - this.state.player.frostSlowPercent * bossSlowScale;
      primary.slowUntilMs = Math.max(primary.slowUntilMs, this.state.elapsedMs + 1500);
      let frozen = false;
      if (
        primary.kind === 'normal' &&
        this.state.player.frostFreezeMs > 0 &&
        this.state.elapsedMs >= primary.nextFreezeAllowedMs
      ) {
        primary.freezeUntilMs = this.state.elapsedMs
          + this.state.player.frostFreezeMs * TRIBULATION_MODIFIERS[this.state.tribulation].freezeDuration;
        primary.nextFreezeAllowedMs = this.state.elapsedMs + 4000;
        frozen = true;
      }
      this.events.push({ type: 'frost-hit', x: primary.x, y: primary.y, frozen });
      if (frozen) this.createFrostSealMirror(primary);
    }

    if (this.state.player.chainLightningDamage > 0) {
      const chained = this.state.enemies
        .filter((enemy) => enemy.id !== primary.id && enemy.hp > 0)
        .filter((enemy) => distance(enemy, primary) <= 150)
        .sort((a, b) => distance(a, primary) - distance(b, primary))
        .slice(0, this.state.player.chainLightningTargets + (this.hasObjectiveField('thunder-pillar') ? 1 : 0));
      for (const target of chained) {
        this.dealDamage(target, this.state.player.chainLightningDamage, 'chain');
        this.events.push({
          type: 'chain-lightning',
          fromX: primary.x,
          fromY: primary.y,
          toX: target.x,
          toY: target.y,
          awakened: isUpgradeAwakened(this.state.player, 'chain-lightning'),
        });
      }
    }

    if (
      this.state.player.fireBurstDamage > 0 &&
      this.nextRandom() < this.state.player.fireBurstChance
    ) {
      const frostfire = hasSynergy(this.state.player, 'frostfire-calamity')
        && (primary.slowUntilMs > this.state.elapsedMs || primary.freezeUntilMs > this.state.elapsedMs);
      const radius = this.state.player.fireBurstRadius + (frostfire ? 60 : 0);
      const fireDamage = this.state.player.fireBurstDamage * (frostfire ? 2.1 : 1);
      for (const enemy of this.state.enemies) {
        if (distance(enemy, primary) <= radius) {
          this.dealDamage(enemy, fireDamage, 'fire');
        }
      }
      this.events.push({
        type: 'fire-burst', x: primary.x, y: primary.y, radius,
        awakened: isUpgradeAwakened(this.state.player, 'fire-burst'),
      });
      if (frostfire) {
        for (const enemy of this.state.enemies) {
          if (enemy.hp <= 0 || distance(enemy, primary) > radius) continue;
          if (enemy.kind === 'boss') {
            enemy.slowMultiplier = Math.min(enemy.slowMultiplier, 0.55);
            enemy.slowUntilMs = Math.max(enemy.slowUntilMs, this.state.elapsedMs + 900);
          } else {
            enemy.freezeUntilMs = Math.max(enemy.freezeUntilMs, this.state.elapsedMs + 900);
          }
          this.events.push({ type: 'frost-hit', x: enemy.x, y: enemy.y, frozen: enemy.kind !== 'boss' });
        }
        this.events.push({ type: 'synergy-triggered', x: primary.x, y: primary.y, synergy: 'frostfire-calamity' });
      }
    }
  }

  private applyOrbitingBlades(deltaMs: number): void {
    if (
      this.state.player.orbitingBladeCount <= 0 ||
      this.state.player.orbitingBladeDamagePerSecond <= 0
    ) {
      return;
    }
    const damage = this.state.player.orbitingBladeDamagePerSecond * (deltaMs / 1000);
    for (const enemy of this.state.enemies) {
      if (distance(enemy, this.state.player) <= this.state.player.orbitingBladeRadius + enemy.radius) {
        this.dealDamage(enemy, damage, 'orbit');
      }
    }
    this.removeDeadEnemies();
  }

  private castMeteors(deltaMs: number): void {
    if (this.state.player.meteorCooldownMs <= 0 || this.state.enemies.length === 0) {
      return;
    }
    this.state.player.meteorTimerMs += deltaMs;
    if (this.state.player.meteorTimerMs < this.state.player.meteorCooldownMs) {
      return;
    }
    this.state.player.meteorTimerMs %= this.state.player.meteorCooldownMs;
    const targets = this.state.enemies
      .filter((enemy) => enemy.hp > 0)
      .slice()
      .sort((a, b) => distance(a, this.state.player) - distance(b, this.state.player))
      .slice(0, this.state.player.meteorCount);
    for (const target of targets) {
      this.dealDamage(target, this.state.player.meteorDamage, 'meteor');
      this.events.push({
        type: 'meteor-strike',
        x: target.x,
        y: target.y,
        damage: this.state.player.meteorDamage,
        awakened: isUpgradeAwakened(this.state.player, 'meteor-seal'),
      });
      if (hasSynergy(this.state.player, 'starfall-convergence')) {
        for (let index = 0; index < 8; index += 1) {
          const angle = index * Math.PI / 4;
          this.state.projectiles.push({
            id: this.takeId(),
            targetId: -1,
            x: target.x,
            y: target.y,
            vx: Math.cos(angle) * PROJECTILE_SPEED * 0.78,
            vy: Math.sin(angle) * PROJECTILE_SPEED * 0.78,
            radius: 6,
            damage: this.state.player.northStarDamage * 0.9,
            ttlMs: PROJECTILE_TTL_MS,
            pierceRemaining: this.state.player.northStarPierce,
            hitEnemyIds: [target.id],
            kind: 'star',
            source: 'north-star',
          });
        }
        this.events.push({ type: 'synergy-triggered', x: target.x, y: target.y, synergy: 'starfall-convergence' });
      }
    }
    this.removeDeadEnemies();
  }

  private beginAwakening(upgrade: UpgradeId): void {
    const label = UPGRADE_LABELS[upgrade];
    this.state.awakeningNotice = {
      upgrade,
      skillName: label.name,
      awakeningName: label.awakeningName,
      summary: label.awakeningSummary,
    };
    this.state.awakeningRemainingMs = 1500;
    this.state.pendingAwakeningSurge = upgrade;
    this.state.phase = 'awakening';
    this.events.push({
      type: 'skill-awakened',
      x: this.state.player.x,
      y: this.state.player.y,
      upgrade,
    });
  }

  private triggerAwakeningSurge(upgrade: UpgradeId): void {
    if (getUpgradeKind(upgrade) !== 'skill') return;
    const player = this.state.player;
    const targetsByDistance = () => this.state.enemies
      .filter((enemy) => enemy.hp > 0)
      .sort((a, b) => distance(a, player) - distance(b, player));
    const damageAroundPlayer = (radius: number, damage: number, source: DamageSource) => {
      for (const enemy of this.state.enemies) {
        if (enemy.hp > 0 && distance(enemy, player) <= radius) {
          this.dealDamage(enemy, damage, source);
        }
      }
    };
    const clearBullets = (radius: number, by: 'blade' | 'barrier') => {
      this.state.enemyProjectiles = this.state.enemyProjectiles.filter((bullet) => {
        if (distance(bullet, player) > radius) return true;
        this.state.runStats.bulletsBlocked += 1;
        this.events.push({ type: 'enemy-bullet-broken', x: bullet.x, y: bullet.y, by });
        return false;
      });
    };
    const freezeInRange = (radius: number, durationMs: number) => {
      for (const enemy of this.state.enemies) {
        if (enemy.hp <= 0 || distance(enemy, player) > radius) continue;
        if (enemy.kind === 'boss') {
          enemy.slowMultiplier = Math.min(enemy.slowMultiplier, 0.45);
          enemy.slowUntilMs = this.state.elapsedMs + durationMs;
        } else {
          enemy.freezeUntilMs = Math.max(enemy.freezeUntilMs, this.state.elapsedMs + durationMs);
        }
        this.events.push({ type: 'frost-hit', x: enemy.x, y: enemy.y, frozen: enemy.kind !== 'boss' });
      }
    };

    switch (upgrade) {
      case 'thunder-ring':
        damageAroundPlayer(player.thunderRadius + 100, player.thunderDamagePerSecond * 3, 'thunder');
        this.events.push({ type: 'bullet-reprisal', x: player.x, y: player.y, radius: player.thunderRadius + 100 });
        break;
      case 'chain-lightning': {
        const targets = targetsByDistance().slice(0, 6);
        for (let index = 0; index < targets.length; index += 1) {
          const previous = targets[index - 1] ?? player;
          const target = targets[index];
          this.dealDamage(target, player.chainLightningDamage * 1.5, 'chain');
          this.events.push({ type: 'chain-lightning', fromX: previous.x, fromY: previous.y, toX: target.x, toY: target.y });
        }
        break;
      }
      case 'fire-burst':
        damageAroundPlayer(player.fireBurstRadius + 90, player.fireBurstDamage * 2, 'fire');
        this.events.push({ type: 'fire-burst', x: player.x, y: player.y, radius: player.fireBurstRadius + 90 });
        break;
      case 'golden-shield':
        player.shield = player.maxShield;
        damageAroundPlayer(180, player.shieldBreakDamage || 80, 'reprisal');
        this.events.push({ type: 'shield-broken', x: player.x, y: player.y, radius: 180 });
        break;
      case 'frost-seal':
        freezeInRange(300, 2200);
        break;
      case 'orbiting-blades':
        clearBullets(player.orbitingBladeRadius + 120, 'blade');
        damageAroundPlayer(player.orbitingBladeRadius + 100, player.orbitingBladeDamagePerSecond * 2, 'orbit');
        this.events.push({ type: 'bullet-reprisal', x: player.x, y: player.y, radius: player.orbitingBladeRadius + 120 });
        break;
      case 'meteor-seal':
        for (const target of targetsByDistance().slice(0, 6)) {
          this.dealDamage(target, player.meteorDamage * 1.7, 'meteor');
          this.events.push({ type: 'meteor-strike', x: target.x, y: target.y, damage: player.meteorDamage * 1.7 });
        }
        break;
      case 'north-star':
        this.fireNorthStarVolley(player.northStarShotCount);
        break;
      case 'bullet-reprisal':
        clearBullets(player.bulletReprisalRadius + 100, 'barrier');
        damageAroundPlayer(player.bulletReprisalRadius + 100, player.bulletReprisalDamage * 2, 'reprisal');
        this.events.push({ type: 'bullet-reprisal', x: player.x, y: player.y, radius: player.bulletReprisalRadius + 100 });
        break;
      case 'soul-pin':
        freezeInRange(300, 1800);
        break;
      case 'solar-ray':
        for (const target of targetsByDistance().slice(0, 3)) {
          this.dealDamage(target, player.solarRayDamage * 1.5, 'solar-ray');
          this.events.push({ type: 'chain-lightning', fromX: player.x, fromY: player.y, toX: target.x, toY: target.y });
        }
        break;
      case 'void-bell':
        clearBullets(player.voidBellRadius + 100, 'barrier');
        damageAroundPlayer(player.voidBellRadius + 100, player.voidBellDamage * 2, 'void-bell');
        this.events.push({ type: 'bullet-reprisal', x: player.x, y: player.y, radius: player.voidBellRadius + 100 });
        break;
      case 'spirit-sword-rain': {
        const targets = targetsByDistance();
        for (let index = 0; index < player.swordRainCount * 2 && targets.length > 0; index += 1) {
          const target = targets[index % targets.length];
          this.dealDamage(target, player.swordRainDamage * 1.3, 'sword-rain');
          this.events.push({ type: 'meteor-strike', x: target.x, y: target.y, damage: player.swordRainDamage * 1.3 });
        }
        break;
      }
    }
    this.removeDeadEnemies();
  }

  private dealDamage(
    enemy: Enemy,
    damage: number,
    source: DamageSource = 'flying-sword',
  ): void {
    if (enemy.kind === 'boss' && (enemy.bossArenaVulnerableUntilMs ?? 0) > this.state.elapsedMs) {
      damage *= 1.25;
    }
    const dealt = dealPlayerDamage(this.state, enemy, damage, source);
    if (dealt >= 1) {
      this.events.push({ type: 'damage-dealt', x: enemy.x, y: enemy.y, amount: dealt, source });
    }
  }

  private nextRandom(): number {
    this.state.randomState =
      (Math.imul(this.state.randomState, 1664525) + 1013904223) >>> 0;
    return this.state.randomState / 0x100000000;
  }

  private checkEndStates(): void {
    if (!this.state.coopEnabled) {
      if (this.state.player.hp <= 0) {
        this.state.player.hp = 0;
        this.state.phase = 'lost';
      }
      return;
    }
    const partner = this.state.partner;
    if (!partner) return;
    if (this.state.player.hp <= 0 && !this.state.playerDowned) {
      this.state.player.hp = 0;
      this.state.playerDowned = true;
      this.state.playerDownedUntilMs = this.state.elapsedMs + 12_000;
      this.state.playerReviveProgressMs = 0;
    }
    if (partner.hp <= 0 && !partner.downed) {
      partner.hp = 0;
      partner.downed = true;
      partner.downedUntilMs = this.state.elapsedMs + 12_000;
      partner.reviveProgressMs = 0;
    }
    if (this.state.playerDowned && partner.downed) this.state.phase = 'lost';
  }

  private takeId(): number {
    const id = this.state.nextId;
    this.state.nextId += 1;
    return id;
  }
}

function normalize(vector: Vector): Vector {
  const length = Math.hypot(vector.x, vector.y);
  if (length === 0) {
    return { x: 0, y: 0 };
  }
  return {
    x: vector.x / length,
    y: vector.y / length,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function distance(a: Vector, b: Vector): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function segmentDistance(start: Vector, end: Vector, point: Vector): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) {
    return distance(start, point);
  }

  const t = clamp(((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared, 0, 1);
  return distance({ x: start.x + dx * t, y: start.y + dy * t }, point);
}
