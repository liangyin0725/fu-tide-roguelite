import Phaser from 'phaser';
import { GameSimulation } from '../sim/GameSimulation';
import { createDefaultState } from '../sim/state';
import { applyUpgrade, UPGRADE_LABELS } from '../sim/upgrades';
import { createBossPrimaryHazards, createBossSecondaryHazards } from '../sim/bossSkills';
import type { ActiveSkillId, BossType, SimulationInput, TribulationType } from '../sim/types';
import { HudController } from '../ui/HudController';
import {
  createEntityGraphic,
  drawEnemyProjectile,
  drawEnemyHealth,
  drawChest,
  drawBossHazard,
  drawOrbitingBlades,
  drawPlayerStatus,
  drawProjectile,
  drawShard,
  drawThunderAura,
  drawAwakenedSkillGlyphs,
  drawActiveBarrier,
} from '../render/ShapeFactory';
import {
  createPixelSprite,
  registerPixelTextures,
  type PixelSpriteKey,
} from '../render/pixelArt';
import { EffectRenderer } from '../render/EffectRenderer';
import { drawArenaTheme } from '../render/arenaTheme';
import {
  loadGameSettings,
  saveGameSettings,
  scaleSimulationDelta,
  type GameSettings,
} from '../settings/gameSettings';
import { GameAudio } from '../audio/GameAudio';
import { isBetaModePassphrase } from '../testing/betaMode';
import { getBossWaveBeforeElapsed } from '../sim/spawnPacing';
import { getAwakenedSkills, isUpgradeAwakened } from '../sim/awakening';
import {
  earnDaoYun,
  earnSpiritOre,
  loadMetaProgression,
  saveMetaProgression,
  toggleRelic,
  tryForgeRelic,
  tryUnlockTalent,
  unlockCharacter,
} from '../meta/metaProgression';
import type { MetaProgression, MetaUnlockId, RelicId } from '../sim/types';

export class GameScene extends Phaser.Scene {
  private simulation!: GameSimulation;
  private hud!: HudController;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private readonly enemyGraphics = new Map<number, Phaser.GameObjects.Graphics>();
  private readonly enemySprites = new Map<number, Phaser.GameObjects.Sprite>();
  private readonly projectileGraphics = new Map<number, Phaser.GameObjects.Graphics>();
  private readonly enemyProjectileGraphics = new Map<number, Phaser.GameObjects.Graphics>();
  private readonly shardGraphics = new Map<number, Phaser.GameObjects.Graphics>();
  private readonly chestGraphics = new Map<number, Phaser.GameObjects.Graphics>();
  private readonly bossHazardGraphics = new Map<number, Phaser.GameObjects.Graphics>();
  private playerGraphic!: Phaser.GameObjects.Graphics;
  private playerSprite!: Phaser.GameObjects.Sprite;
  private partnerGraphic!: Phaser.GameObjects.Graphics;
  private partnerSprite!: Phaser.GameObjects.Sprite;
  private gridGraphic!: Phaser.GameObjects.Graphics;
  private arenaTribulation: TribulationType = 'calm';
  private thunderGraphic!: Phaser.GameObjects.Graphics;
  private orbitingBladeGraphic!: Phaser.GameObjects.Graphics;
  private awakeningGlyphGraphic!: Phaser.GameObjects.Graphics;
  private activeBarrierGraphic!: Phaser.GameObjects.Graphics;
  private effects!: EffectRenderer;
  private developmentPreviewPaused = false;
  private settings!: GameSettings;
  private settingsOpen = false;
  private mobileActivateQueued = false;
  private mobileAim: { x: number; y: number } | null = null;
  private mobileMove = { x: 0, y: 0 };
  private audio!: GameAudio;
  private metaProgression!: MetaProgression;

  public constructor() {
    super('game');
  }

  public create(): void {
    this.settings = loadGameSettings(window.localStorage);
    document.documentElement.lang = this.settings.language;
    this.metaProgression = loadMetaProgression(window.localStorage);
    this.audio = new GameAudio();
    this.audio.setVolumes(this.settings.musicVolume, this.settings.soundVolume);
    this.simulation = new GameSimulation(createDefaultState());
    this.injectMetaTalents();
    this.simulation.state.phase = 'menu';
    registerPixelTextures(this);
    this.gridGraphic = this.add.graphics();
    this.gridGraphic.setDepth(-10);
    this.playerGraphic = createEntityGraphic(this);
    this.playerSprite = createPixelSprite(this, 'player');
    this.partnerGraphic = createEntityGraphic(this);
    this.partnerSprite = createPixelSprite(this, 'player');
    this.partnerGraphic.setVisible(false);
    this.partnerSprite.setVisible(false);
    this.thunderGraphic = this.add.graphics().setDepth(4).setBlendMode(Phaser.BlendModes.ADD);
    this.orbitingBladeGraphic = this.add.graphics().setDepth(7).setBlendMode(Phaser.BlendModes.ADD);
    this.awakeningGlyphGraphic = this.add.graphics().setDepth(5.5).setBlendMode(Phaser.BlendModes.ADD);
    this.effects = new EffectRenderer(this, () => this.settings);
    this.activeBarrierGraphic = this.add.graphics().setDepth(6).setBlendMode(Phaser.BlendModes.ADD);
    this.keys = this.input.keyboard!.addKeys('W,A,S,D,E,UP,DOWN,LEFT,RIGHT,SPACE,ENTER') as Record<
      string,
      Phaser.Input.Keyboard.Key
    >;

    const hudRoot = document.querySelector<HTMLElement>('#hud-root');
    if (!hudRoot) {
      throw new Error('Missing #hud-root');
    }
    this.hud = new HudController(hudRoot, {
      onStart: () => {
        this.audio.startMusic();
        this.simulation.start();
      },
      onStartLocalCoop: () => {
        this.audio.startMusic();
        this.simulation.startLocalCoop();
        this.cameras.main.setBounds(0, 0, this.simulation.state.arena.width, this.simulation.state.arena.height);
        this.drawArena();
      },
      onOpenDongfu: () => { this.simulation.state.phase = 'dongfu'; },
      onCloseDongfu: () => { this.simulation.state.phase = 'menu'; },
      onUnlockTalent: (talentId) => this.unlockTalent(talentId),
      onToggleRelic: (relicId) => this.toggleRelic(relicId),
      onForgeRelic: (relicId) => this.forgeRelic(relicId),
      onChooseCharacter: (character) => {
        if (character === 'jing-po' && !this.metaProgression.unlockedCharacterIds.includes(character)) return;
        this.simulation.chooseCharacter(character);
      },
      onChooseTribulationChoice: (choice) => this.simulation.chooseTribulationChoice(choice),
      onChooseObjectiveRoute: (route) => this.simulation.chooseObjectiveRoute(route),
      onChooseActiveSkill: (skill) => this.simulation.chooseActiveSkill(skill),
      onRestart: () => this.restartRun(),
      onChooseUpgrade: (upgrade) => this.simulation.chooseUpgrade(upgrade),
      onChooseTreasure: (upgrade) => this.simulation.chooseTreasure(upgrade),
      onConfirmTreasureReplacement: (slotIndex) => this.simulation.confirmTreasureReplacement(slotIndex),
      onCancelTreasureReplacement: () => this.simulation.cancelTreasureReplacement(),
      onOpenSettings: () => {
        this.settingsOpen = true;
        this.mobileActivateQueued = false;
        this.mobileMove = { x: 0, y: 0 };
      },
      onCloseSettings: () => { this.settingsOpen = false; },
      onUnlockBetaMode: (passphrase) => {
        if (!isBetaModePassphrase(passphrase)) return;
        this.settings = { ...this.settings, betaModeUnlocked: true };
        saveGameSettings(window.localStorage, this.settings);
      },
      onStartBetaMode: () => this.startBetaMode(),
      onToggleBetaSkill: (skill) => this.toggleBetaSkill(skill),
      onSetBetaSkillLevel: (skill, level) => this.setBetaSkillLevel(skill, level),
      onSetBetaActiveSkill: (skill) => this.setBetaActiveSkill(skill),
      onSetBetaActiveSkillLevel: (level) => this.setBetaActiveSkillLevel(level),
      onSetBetaStartTime: (minutes) => this.setBetaStartTime(minutes),
      onLaunchBetaMode: () => this.launchBetaMode(),
      onCloseBetaLoadout: () => { this.simulation.state.phase = 'menu'; },
      onChangeSetting: (key, value) => {
        this.settings = { ...this.settings, [key]: value } as GameSettings;
        if (key === 'language') document.documentElement.lang = this.settings.language;
        saveGameSettings(window.localStorage, this.settings);
        this.audio.setVolumes(this.settings.musicVolume, this.settings.soundVolume);
      },
      onActivate: (aim) => {
        this.mobileAim = aim ?? null;
        this.mobileActivateQueued = true;
      },
      onMove: (move) => { this.mobileMove = move; },
    });
    this.applyDevelopmentPreview();

    this.cameras.main.setBounds(0, 0, this.simulation.state.arena.width, this.simulation.state.arena.height);
    this.drawArena();
  }

  public update(_time: number, delta: number): void {
    if (!this.developmentPreviewPaused && !this.settingsOpen) {
      this.simulation.update(
        scaleSimulationDelta(Math.min(delta, 50), this.settings.gameSpeed),
        this.readInput(),
      );
    }
    const events = this.simulation.consumeEvents();
    this.collectMetaProgression(events);
    this.effects.render(events);
    this.audio.playEvents(events);
    this.centerCoopCamera();
    this.renderWorld();
    this.effects.update(Math.min(delta, 50));
    this.hud.render(
      this.simulation.state,
      this.settings,
      this.settingsOpen,
      this.metaProgression,
      this.keys.E.isDown,
    );
  }

  private restartRun(): void {
    this.clearEntityMap(this.enemyGraphics);
    this.clearSpriteMap(this.enemySprites);
    this.clearEntityMap(this.projectileGraphics);
    this.clearEntityMap(this.enemyProjectileGraphics);
    this.clearEntityMap(this.shardGraphics);
    this.clearEntityMap(this.chestGraphics);
    this.clearEntityMap(this.bossHazardGraphics);
    this.effects.clear();
    this.simulation = new GameSimulation(createDefaultState());
    this.injectMetaTalents();
    this.simulation.state.phase = 'character-choice';
    this.cameras.main.setBounds(0, 0, this.simulation.state.arena.width, this.simulation.state.arena.height);
    this.drawArena();
  }

  private startBetaMode(): void {
    this.restartRun();
    const skills = ['thunder-ring', 'chain-lightning', 'fire-burst', 'meteor-seal', 'north-star'] as const;
    this.simulation.state.betaSkillSelections = [...skills];
    for (const skill of skills) this.simulation.state.betaSkillLevels[skill] = 5;
    this.simulation.state.phase = 'beta-loadout';
  }

  private toggleBetaSkill(skill: import('../sim/types').UpgradeId): void {
    const state = this.simulation.state;
    if (state.phase !== 'beta-loadout') return;
    if (state.betaSkillSelections.includes(skill)) {
      state.betaSkillSelections = state.betaSkillSelections.filter((selected) => selected !== skill);
      state.betaSkillLevels[skill] = 0;
    } else if (state.betaSkillSelections.length < 5) {
      state.betaSkillSelections.push(skill);
      state.betaSkillLevels[skill] = 5;
    }
  }

  private setBetaSkillLevel(skill: import('../sim/types').UpgradeId, level: number): void {
    const state = this.simulation.state;
    if (state.phase !== 'beta-loadout' || !state.betaSkillSelections.includes(skill)) return;
    state.betaSkillLevels[skill] = Math.max(1, Math.min(6, Math.round(level)));
  }

  private setBetaActiveSkill(skill: ActiveSkillId): void {
    const state = this.simulation.state;
    if (state.phase !== 'beta-loadout') return;
    state.betaActiveSkill = skill;
  }

  private setBetaActiveSkillLevel(level: number): void {
    const state = this.simulation.state;
    if (state.phase !== 'beta-loadout') return;
    state.betaActiveSkillLevel = Math.max(1, Math.min(4, Math.round(level)));
  }

  private setBetaStartTime(minutes: number): void {
    const state = this.simulation.state;
    if (state.phase !== 'beta-loadout') return;
    state.betaStartElapsedMs = Math.max(0, Math.min(30, Math.round(minutes / 5) * 5)) * 60_000;
  }

  private launchBetaMode(): void {
    const selected = [...this.simulation.state.betaSkillSelections];
    const levels = { ...this.simulation.state.betaSkillLevels };
    const activeSkill = this.simulation.state.betaActiveSkill;
    const activeSkillLevel = this.simulation.state.betaActiveSkillLevel;
    const startElapsedMs = this.simulation.state.betaStartElapsedMs;
    if (selected.length === 0) return;
    this.restartRun();
    this.audio.startMusic();
    this.simulation.chooseCharacter('lei-zhuan');
    for (const skill of selected) {
      const levelTarget = levels[skill];
      for (let level = 0; level < levelTarget; level += 1) {
        applyUpgrade(this.simulation.state, skill);
      }
    }
    this.simulation.chooseActiveSkill(activeSkill);
    this.simulation.state.player.activeSkillLevel = activeSkillLevel;
    this.simulation.state.player.level = 18;
    this.simulation.state.elapsedMs = startElapsedMs;
    if (startElapsedMs > 0) {
      this.simulation.state.bossWave = getBossWaveBeforeElapsed(startElapsedMs);
      this.simulation.state.nextBossAtMs = startElapsedMs;
      this.simulation.state.nextEliteSquadAtMs = startElapsedMs;
    }
  }

  private injectMetaTalents(): void {
    this.simulation.state.player.metaTalentIds = [...this.metaProgression.unlockedTalentIds];
    this.simulation.state.player.metaPathNodeIds = [...this.metaProgression.unlockedPathNodeIds];
    this.simulation.state.player.metaRelicIds = [...this.metaProgression.equippedRelicIds];
    this.simulation.state.player.metaRelicForgeRanks = { ...this.metaProgression.relicForgeRanks };
  }

  private collectMetaProgression(events: import('../sim/types').CombatEvent[]): void {
    for (const event of events) {
      if (event.type === 'dao-yun-earned') {
        this.metaProgression = earnDaoYun(this.metaProgression, event.amount);
        this.simulation.state.runDaoYunEarned += event.amount;
        saveMetaProgression(window.localStorage, this.metaProgression);
      } else if (event.type === 'hidden-character-unlocked') {
        const next = unlockCharacter(this.metaProgression, event.character);
        if (next === this.metaProgression) continue;
        this.metaProgression = next;
        saveMetaProgression(window.localStorage, this.metaProgression);
      } else if (event.type === 'spirit-ore-earned') {
        this.metaProgression = earnSpiritOre(this.metaProgression, event.amount);
        this.simulation.state.runSpiritOreEarned += event.amount;
        saveMetaProgression(window.localStorage, this.metaProgression);
      }
    }
  }

  private unlockTalent(talentId: MetaUnlockId): void {
    const result = tryUnlockTalent(this.metaProgression, talentId);
    if (!result.unlocked) return;
    this.metaProgression = result.progression;
    saveMetaProgression(window.localStorage, this.metaProgression);
  }

  private toggleRelic(relicId: RelicId): void {
    this.metaProgression = toggleRelic(this.metaProgression, relicId);
    saveMetaProgression(window.localStorage, this.metaProgression);
  }

  private forgeRelic(relicId: RelicId): void {
    const result = tryForgeRelic(this.metaProgression, relicId);
    if (!result.forged) return;
    this.metaProgression = result.progression;
    saveMetaProgression(window.localStorage, this.metaProgression);
  }

  private applyDevelopmentPreview(): void {
    if (!import.meta.env.DEV) {
      return;
    }
    const preview = new URLSearchParams(window.location.search).get('preview');
    if (preview === 'upgrade') {
      this.simulation.state.player.level = 4;
      this.simulation.state.player.upgradeLevels['faster-swords'] = 3;
      this.simulation.state.upgradeChoices = ['faster-swords', 'frost-seal', 'orbiting-blades'];
      this.simulation.state.phase = 'upgrade';
    } else if (preview === 'treasure') {
      this.simulation.state.player.upgradeLevels['meteor-seal'] = 3;
      this.simulation.state.player.upgradeLevels['golden-shield'] = 2;
      this.simulation.state.treasureChoices = ['meteor-seal', 'golden-shield', 'boss-slayer'];
      this.simulation.state.treasureWave = 2;
      this.simulation.state.phase = 'treasure';
    } else if (preview === 'awakening') {
      const label = UPGRADE_LABELS['meteor-seal'];
      this.simulation.state.awakeningNotice = {
        upgrade: 'meteor-seal',
        skillName: label.name,
        awakeningName: label.awakeningName,
        summary: label.awakeningSummary,
      };
      this.simulation.state.awakeningRemainingMs = 60_000;
      this.simulation.state.phase = 'awakening';
    } else if (preview === 'tribulation-choice') {
      const state = this.simulation.state;
      state.elapsedMs = 315_000;
      state.tribulation = 'thunder';
      state.tribulationChoices = ['thunder-conduit', 'thunder-seal'];
      state.nextTribulationChoiceAtMs = 615_000;
      state.phase = 'tribulation-choice';
      this.developmentPreviewPaused = true;
    } else if (preview === 'objective') {
      const state = this.simulation.state;
      state.phase = 'playing';
      state.elapsedMs = 330_000;
      state.tribulation = 'thunder';
      state.player.characterId = 'lei-zhuan';
      const objective = this.simulation.spawnEnemy({
        x: state.player.x + 220,
        y: state.player.y - 70,
        hp: 600,
        speed: 0,
        damage: 0,
        radius: 30,
        archetype: 'talisman',
        objectiveKind: 'thunder-pillar',
      });
      state.activeObjectiveId = objective.id;
      state.objectiveExpiresAtMs = state.elapsedMs + 45_000;
      state.objectiveChainStep = 1;
      state.objectiveChainTribulation = 'thunder';
      state.nextObjectiveAtMs = 1_290_000;
      state.nextBossAtMs = 9_999_999;
      state.nextEliteSquadAtMs = 9_999_999;
      this.developmentPreviewPaused = true;
    } else if (preview === 'summary') {
      const state = this.simulation.state;
      state.phase = 'lost';
      state.elapsedMs = 1_347_000;
      state.kills = 864;
      state.bossesDefeated = 4;
      state.player.level = 31;
      state.runStats.damageBySource['flying-sword'] = 184_250;
      state.runStats.damageBySource.thunder = 128_640;
      state.runStats.damageBySource.meteor = 92_400;
      state.runStats.damageBySource['solar-ray'] = 61_880;
      state.runStats.damageBySource.active = 34_260;
      state.runStats.elitesDefeated = 17;
      state.runStats.bulletsBlocked = 392;
      state.runStats.objectivesCompleted = 2;
      this.developmentPreviewPaused = true;
    } else if (preview?.startsWith('boss-')) {
      const bossType = preview.slice(5) as BossType;
      if (!['crimson', 'thunder', 'blood-moon'].includes(bossType)) {
        return;
      }
      this.simulation.state.phase = 'playing';
      const player = this.simulation.state.player;
      const previewBossOffset = Math.min(260, this.scale.width * 0.32);
      const boss = this.simulation.spawnEnemy({
        x: player.x + previewBossOffset,
        y: player.y,
        hp: 600,
        speed: 0,
        damage: 20,
        kind: 'boss',
        bossWave: bossType === 'crimson' ? 1 : bossType === 'thunder' ? 2 : 3,
        bossType,
      });
      boss.hp = 270;
      boss.bossPhase = 2;
      boss.bossCastCount = 2;
      const takeId = () => {
        const id = this.simulation.state.nextId;
        this.simulation.state.nextId += 1;
        return id;
      };
      this.simulation.state.bossHazards.push(...createBossPrimaryHazards(
        boss,
        player,
        takeId,
        () => 0.5,
      ));
      this.simulation.state.bossHazards.push(...createBossSecondaryHazards(
        boss,
        player,
        takeId,
      ));
      this.developmentPreviewPaused = true;
    }
  }

  private readInput(): SimulationInput {
    const pointer = this.input.activePointer;
    const world = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const activate = Phaser.Input.Keyboard.JustDown(this.keys.SPACE) || this.mobileActivateQueued;
    const mobileAim = this.mobileAim;
    this.mobileActivateQueued = false;
    this.mobileAim = null;
    return {
      move: {
        x: keyValue(this.keys.D) - keyValue(this.keys.A) + this.mobileMove.x,
        y: keyValue(this.keys.S) - keyValue(this.keys.W) + this.mobileMove.y,
      },
      aim: mobileAim ?? {
        x: world.x - this.simulation.state.player.x,
        y: world.y - this.simulation.state.player.y,
      },
      activate,
      aimMode: this.settings.aimMode,
      partner: {
        move: {
          x: keyValue(this.keys.RIGHT) - keyValue(this.keys.LEFT),
          y: keyValue(this.keys.DOWN) - keyValue(this.keys.UP),
        },
        aim: { x: 0, y: 0 },
        activate: Phaser.Input.Keyboard.JustDown(this.keys.ENTER),
        aimMode: 'auto',
      },
    };
  }

  private drawArena(): void {
    const { width, height } = this.simulation.state.arena;
    this.arenaTribulation = this.simulation.state.tribulation;
    drawArenaTheme(this.gridGraphic, width, height, this.arenaTribulation);
  }

  private renderWorld(): void {
    if (this.arenaTribulation !== this.simulation.state.tribulation) this.drawArena();
    const { player, partner } = this.simulation.state;
    drawThunderAura(
      this.thunderGraphic,
      player.x,
      player.y,
      player.thunderRadius,
      this.time.now,
      isUpgradeAwakened(player, 'thunder-ring'),
    );
    drawOrbitingBlades(
      this.orbitingBladeGraphic,
      player.x,
      player.y,
      player.orbitingBladeCount,
      player.orbitingBladeRadius,
      this.time.now,
    );
    drawAwakenedSkillGlyphs(
      this.awakeningGlyphGraphic,
      player.x,
      player.y,
      player.equippedSkills,
      player.upgradeLevels,
      this.time.now,
      getAwakenedSkills(player),
    );
    drawActiveBarrier(
      this.activeBarrierGraphic,
      player.x,
      player.y,
      player.activeBarrierRemainingMs > 0 ? player.activeBarrierRadius : 0,
      this.time.now,
    );
    this.playerSprite.setPosition(Math.round(player.x), Math.round(player.y));
    const playerTexture: PixelSpriteKey = player.characterId
      ? `player-${player.characterId}`
      : 'player';
    if (this.playerSprite.texture.key !== playerTexture) this.playerSprite.setTexture(playerTexture);
    this.playerSprite.setFrame(Math.floor(this.time.now / 180) % 2);
    if (player.lastMoveDirection.x !== 0) this.playerSprite.setFlipX(player.lastMoveDirection.x < 0);
    drawPlayerStatus(
      this.playerGraphic,
      player.x,
      player.y,
      player.hp / player.maxHp,
      player.maxShield > 0 ? player.shield / player.maxShield : 0,
      player.frostSlowPercent,
    );
    this.renderPartner(partner);

    this.syncMap(
      this.enemyGraphics,
      this.simulation.state.enemies,
      (graphics, enemy) => drawEnemyHealth(
        graphics,
        enemy.x,
        enemy.y,
        enemy.hp / enemy.maxHp,
        enemy.kind === 'boss',
      ),
    );
    this.syncEnemySprites();
    this.syncMap(this.projectileGraphics, this.simulation.state.projectiles, (graphics, projectile) =>
      drawProjectile(graphics, projectile.x, projectile.y, projectile.vx, projectile.vy, projectile.kind),
    );
    this.syncMap(
      this.enemyProjectileGraphics,
      this.simulation.state.enemyProjectiles,
      (graphics, projectile) => drawEnemyProjectile(graphics, projectile),
    );
    this.syncMap(this.shardGraphics, this.simulation.state.shards, (graphics, shard) =>
      drawShard(graphics, shard.x, shard.y, Math.sin(this.time.now * 0.008 + shard.id) * 2),
    );
    this.syncMap(this.chestGraphics, this.simulation.state.chests, (graphics, chest) =>
      drawChest(graphics, chest.x, chest.y, Math.sin(this.time.now * 0.006 + chest.id) * 3),
    );
    this.syncMap(this.bossHazardGraphics, this.simulation.state.bossHazards, (graphics, hazard) => {
      graphics.setDepth(hazard.telegraphRemainingMs > 0 ? 2 : 8);
      drawBossHazard(graphics, hazard, this.time.now);
    });
  }

  private syncMap<T extends { id: number }>(
    map: Map<number, Phaser.GameObjects.Graphics>,
    entities: T[],
    draw: (graphics: Phaser.GameObjects.Graphics, entity: T) => void,
  ): void {
    const liveIds = new Set(entities.map((entity) => entity.id));
    for (const [id, graphics] of map) {
      if (!liveIds.has(id)) {
        graphics.destroy();
        map.delete(id);
      }
    }

    for (const entity of entities) {
      let graphics = map.get(entity.id);
      if (!graphics) {
        graphics = createEntityGraphic(this);
        map.set(entity.id, graphics);
      }
      draw(graphics, entity);
    }
  }

  private clearEntityMap(map: Map<number, Phaser.GameObjects.Graphics>): void {
    for (const graphics of map.values()) {
      graphics.destroy();
    }
    map.clear();
  }

  private syncEnemySprites(): void {
    const enemies = this.simulation.state.enemies;
    const liveIds = new Set(enemies.map((enemy) => enemy.id));
    for (const [id, sprite] of this.enemySprites) {
      if (!liveIds.has(id)) {
        sprite.destroy();
        this.enemySprites.delete(id);
      }
    }
    for (const enemy of enemies) {
      const key: PixelSpriteKey = enemy.kind === 'boss'
        ? `boss-${enemy.bossType ?? 'crimson'}`
        : enemy.archetype;
      let sprite = this.enemySprites.get(enemy.id);
      if (!sprite) {
        sprite = createPixelSprite(this, key);
        this.enemySprites.set(enemy.id, sprite);
      } else if (sprite.texture.key !== key) {
        sprite.setTexture(key);
      }
      sprite.setPosition(Math.round(enemy.x), Math.round(enemy.y));
      sprite.setFrame(Math.floor((this.time.now + enemy.id * 41) / 210) % 2);
      sprite.setFlipX(enemy.x > this.simulation.state.player.x);
      const objectiveTint = enemy.objectiveKind === 'thunder-pillar'
        ? 0x61f5ff
        : enemy.objectiveKind === 'blood-well'
          ? 0xff4fa3
          : enemy.objectiveKind === 'frost-core' ? 0xc9f5ff : null;
      const eliteTint = enemy.eliteAffix === 'iron-wall'
        ? 0xb8c4d6
        : enemy.eliteAffix === 'haste'
          ? 0xffd166
          : enemy.eliteAffix === 'mender'
            ? 0x7dff9c
            : enemy.eliteAffix === 'suppressor' ? 0xc68cff : 0xffffff;
      sprite.setTint(enemy.freezeUntilMs > this.simulation.state.elapsedMs ? 0x9defff : objectiveTint ?? eliteTint);
      sprite.setScale(enemy.objectiveKind ? 2.8 : enemy.eliteAffix ? 2.3 : 2);
    }
  }

  private clearSpriteMap(map: Map<number, Phaser.GameObjects.Sprite>): void {
    for (const sprite of map.values()) sprite.destroy();
    map.clear();
  }

  private renderPartner(partner: import('../sim/types').CoopPlayer | null): void {
    if (!partner) {
      this.partnerGraphic.setVisible(false);
      this.partnerSprite.setVisible(false);
      return;
    }
    this.partnerGraphic.setVisible(true);
    this.partnerSprite.setVisible(true);
    this.partnerSprite.setPosition(Math.round(partner.x), Math.round(partner.y));
    const texture: PixelSpriteKey = partner.characterId ? `player-${partner.characterId}` : 'player';
    if (this.partnerSprite.texture.key !== texture) this.partnerSprite.setTexture(texture);
    this.partnerSprite.setFrame(Math.floor((this.time.now + 90) / 180) % 2);
    this.partnerSprite.setTint(partner.downed ? 0x707890 : 0x6deaff);
    if (partner.lastMoveDirection.x !== 0) this.partnerSprite.setFlipX(partner.lastMoveDirection.x < 0);
    drawPlayerStatus(
      this.partnerGraphic,
      partner.x,
      partner.y,
      partner.hp / partner.maxHp,
      partner.maxShield > 0 ? partner.shield / partner.maxShield : 0,
      partner.frostSlowPercent,
    );
  }

  private centerCoopCamera(): void {
    const { player, partner } = this.simulation.state;
    if (!partner) {
      this.cameras.main.centerOn(player.x, player.y);
      this.cameras.main.setZoom(1);
      return;
    }
    const camera = this.cameras.main;
    const horizontalSpan = Math.abs(player.x - partner.x) + 180;
    const verticalSpan = Math.abs(player.y - partner.y) + 180;
    const requiredZoom = Math.min(camera.width / horizontalSpan, camera.height / verticalSpan);
    camera.setZoom(Phaser.Math.Clamp(requiredZoom, 0.25, 1));
    this.cameras.main.centerOn((player.x + partner.x) / 2, (player.y + partner.y) / 2);
  }
}

function keyValue(primary: Phaser.Input.Keyboard.Key): number {
  return primary.isDown ? 1 : 0;
}
