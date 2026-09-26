import Phaser from 'phaser';
import { GameSimulation } from '../sim/GameSimulation';
import { createDefaultState } from '../sim/state';
import { applyUpgrade, UPGRADE_LABELS } from '../sim/upgrades';
import { createBossPrimaryHazards, createBossSecondaryHazards } from '../sim/bossSkills';
import type { ActiveSkillId, BossType, SimulationInput, TribulationType } from '../sim/types';
import { HudController } from '../ui/HudController';
import {
  createEntityGraphic,
  drawEnemyHealth,
  drawChest,
  drawBossBreakTarget,
  drawPlayerStatus,
  drawShard,
} from '../render/ShapeFactory';
import {
  createPixelSprite,
  preloadGeneratedPixelAssets,
  registerPixelTextures,
  type PixelSpriteKey,
} from '../render/pixelArt';
import {
  generatedArenaTextureKey,
  getGeneratedBossHazardVisual,
  getGeneratedEnemyProjectileScale,
  getGeneratedEnemyProjectileTexture,
  getGeneratedProjectileTexture,
  getPersistentEffectVisuals,
  type PersistentEffectKey,
} from '../render/generatedPixelArt';
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
import { getAwakenedSkills } from '../sim/awakening';
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
  private readonly projectileSprites = new Map<number, Phaser.GameObjects.Image>();
  private readonly enemyProjectileSprites = new Map<number, Phaser.GameObjects.Image>();
  private readonly shardGraphics = new Map<number, Phaser.GameObjects.Graphics>();
  private readonly chestGraphics = new Map<number, Phaser.GameObjects.Graphics>();
  private readonly bossHazardSprites = new Map<number, Phaser.GameObjects.Image>();
  private playerGraphic!: Phaser.GameObjects.Graphics;
  private playerSprite!: Phaser.GameObjects.Sprite;
  private partnerGraphic!: Phaser.GameObjects.Graphics;
  private partnerSprite!: Phaser.GameObjects.Sprite;
  private arenaTexture!: Phaser.GameObjects.TileSprite;
  private gridGraphic!: Phaser.GameObjects.Graphics;
  private arenaTribulation: TribulationType = 'calm';
  private readonly persistentEffectSprites = new Map<PersistentEffectKey, Phaser.GameObjects.Image>();
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

  public preload(): void {
    preloadGeneratedPixelAssets(this);
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
    this.arenaTexture = this.add.tileSprite(
      0,
      0,
      this.simulation.state.arena.width,
      this.simulation.state.arena.height,
      generatedArenaTextureKey('calm'),
    ).setOrigin(0).setDepth(-11).setAlpha(0.9);
    this.gridGraphic = this.add.graphics();
    this.gridGraphic.setDepth(-10);
    this.playerGraphic = createEntityGraphic(this);
    this.playerSprite = createPixelSprite(this, 'player');
    this.partnerGraphic = createEntityGraphic(this);
    this.partnerSprite = createPixelSprite(this, 'player');
    this.partnerGraphic.setVisible(false);
    this.partnerSprite.setVisible(false);
    for (const [key, depth] of [
      ['thunder-ring', 3.7],
      ['orbiting-blades', 6.7],
      ['golden-shield', 6.2],
      ['awakening-formation', 5.2],
    ] as const) {
      this.persistentEffectSprites.set(
        key,
        this.add.image(0, 0, `generated-persistent-${key}`)
          .setDepth(depth)
          .setBlendMode(Phaser.BlendModes.ADD)
          .setVisible(false),
      );
    }
    this.effects = new EffectRenderer(this, () => this.settings);
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
    this.clearImageMap(this.projectileSprites);
    this.clearImageMap(this.enemyProjectileSprites);
    this.clearEntityMap(this.shardGraphics);
    this.clearEntityMap(this.chestGraphics);
    this.clearImageMap(this.bossHazardSprites);
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
    this.arenaTexture
      .setTexture(generatedArenaTextureKey(this.arenaTribulation))
      .setSize(width, height)
      .setDisplaySize(width, height);
    drawArenaTheme(this.gridGraphic, width, height, this.arenaTribulation);
  }

  private renderWorld(): void {
    if (this.arenaTribulation !== this.simulation.state.tribulation) this.drawArena();
    const { player, partner } = this.simulation.state;
    this.renderGeneratedPersistentEffects(player);
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
      (graphics, enemy) => enemy.bossBreakOwnerId
        ? drawBossBreakTarget(graphics, enemy.x, enemy.y, enemy.hp / enemy.maxHp, this.time.now)
        : drawEnemyHealth(graphics, enemy.x, enemy.y, enemy.hp / enemy.maxHp, enemy.kind === 'boss'),
    );
    this.syncEnemySprites();
    this.syncProjectileSprites();
    this.syncEnemyProjectileSprites();
    this.syncMap(this.shardGraphics, this.simulation.state.shards, (graphics, shard) =>
      drawShard(graphics, shard.x, shard.y, Math.sin(this.time.now * 0.008 + shard.id) * 2),
    );
    this.syncMap(this.chestGraphics, this.simulation.state.chests, (graphics, chest) =>
      drawChest(graphics, chest.x, chest.y, Math.sin(this.time.now * 0.006 + chest.id) * 3),
    );
    this.syncBossHazardSprites();
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
      if (enemy.bossBreakOwnerId) {
        this.enemySprites.get(enemy.id)?.setVisible(false);
        continue;
      }
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
      sprite.setVisible(true);
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
      sprite.setScale(enemy.kind === 'boss' ? 1.42 : enemy.objectiveKind ? 1.38 : enemy.eliteAffix ? 1.18 : 1);
    }
  }

  private clearSpriteMap(map: Map<number, Phaser.GameObjects.Sprite>): void {
    for (const sprite of map.values()) sprite.destroy();
    map.clear();
  }

  private clearImageMap(map: Map<number, Phaser.GameObjects.Image>): void {
    for (const image of map.values()) image.destroy();
    map.clear();
  }

  private syncProjectileSprites(): void {
    const projectiles = this.simulation.state.projectiles;
    const liveIds = new Set(projectiles.map((projectile) => projectile.id));
    for (const [id, image] of this.projectileSprites) {
      if (!liveIds.has(id)) {
        image.destroy();
        this.projectileSprites.delete(id);
      }
    }
    for (const projectile of projectiles) {
      const texture = getGeneratedProjectileTexture(projectile.kind);
      let image = this.projectileSprites.get(projectile.id);
      if (!image) {
        image = this.add.image(projectile.x, projectile.y, texture)
          .setDepth(8.5)
          .setBlendMode(Phaser.BlendModes.ADD);
        this.projectileSprites.set(projectile.id, image);
      } else if (image.texture.key !== texture) {
        image.setTexture(texture);
      }
      const pulse = Math.sin(this.time.now * 0.018 + projectile.id) * 0.025;
      image
        .setPosition(Math.round(projectile.x), Math.round(projectile.y))
        .setRotation(Math.atan2(projectile.vy, projectile.vx) + Math.PI / 2)
        .setScale((projectile.kind === 'glyph' ? 0.2 : 0.17) + pulse)
        .setAlpha(0.88);
    }
  }

  private syncEnemyProjectileSprites(): void {
    const projectiles = this.simulation.state.enemyProjectiles;
    const liveIds = new Set(projectiles.map((projectile) => projectile.id));
    for (const [id, image] of this.enemyProjectileSprites) {
      if (!liveIds.has(id)) {
        image.destroy();
        this.enemyProjectileSprites.delete(id);
      }
    }
    for (const projectile of projectiles) {
      const texture = getGeneratedEnemyProjectileTexture(projectile.kind);
      let image = this.enemyProjectileSprites.get(projectile.id);
      if (!image) {
        image = this.add.image(projectile.x, projectile.y, texture)
          .setDepth(9.5)
          .setBlendMode(Phaser.BlendModes.ADD);
        this.enemyProjectileSprites.set(projectile.id, image);
      } else if (image.texture.key !== texture) {
        image.setTexture(texture);
      }
      const pulse = Math.sin(this.time.now * 0.016 + projectile.id) * 0.018;
      const rotation = projectile.kind === 'soul-orb'
        ? this.time.now * 0.0012
        : Math.atan2(projectile.vy, projectile.vx) + Math.PI / 4;
      image
        .setPosition(Math.round(projectile.x), Math.round(projectile.y))
        .setRotation(rotation)
        .setScale(getGeneratedEnemyProjectileScale(projectile.kind) + pulse)
        .setAlpha(0.95);
    }
  }

  private syncBossHazardSprites(): void {
    const hazards = this.simulation.state.bossHazards;
    const liveIds = new Set(hazards.map((hazard) => hazard.id));
    for (const [id, image] of this.bossHazardSprites) {
      if (!liveIds.has(id)) {
        image.destroy();
        this.bossHazardSprites.delete(id);
      }
    }
    for (const hazard of hazards) {
      const visual = getGeneratedBossHazardVisual(hazard, this.time.now);
      let image = this.bossHazardSprites.get(hazard.id);
      if (!image) {
        image = this.add.image(visual.x, visual.y, visual.textureKey)
          .setBlendMode(Phaser.BlendModes.ADD);
        this.bossHazardSprites.set(hazard.id, image);
      } else if (image.texture.key !== visual.textureKey) {
        image.setTexture(visual.textureKey);
      }
      image
        .setDepth(hazard.telegraphRemainingMs > 0 ? 2 : 8)
        .setPosition(visual.x, visual.y)
        .setDisplaySize(visual.width, visual.height)
        .setRotation(visual.rotation)
        .setAlpha(visual.alpha);
    }
  }

  private renderGeneratedPersistentEffects(player: import('../sim/types').Player): void {
    const visuals = getPersistentEffectVisuals({
      thunderRadius: player.thunderRadius,
      orbitingBladeCount: player.orbitingBladeCount,
      orbitingBladeRadius: player.orbitingBladeRadius,
      shield: player.shield,
      activeBarrierRemainingMs: player.activeBarrierRemainingMs,
      activeBarrierRadius: player.activeBarrierRadius,
      awakenedSkillCount: getAwakenedSkills(player).length,
      timeMs: this.time.now,
    });
    for (const [key, visual] of Object.entries(visuals) as [PersistentEffectKey, (typeof visuals)[PersistentEffectKey]][]) {
      const image = this.persistentEffectSprites.get(key);
      if (!image) continue;
      image
        .setVisible(visual.visible)
        .setPosition(Math.round(player.x), Math.round(player.y))
        .setOrigin(visual.originX, visual.originY)
        .setDisplaySize(visual.diameter, visual.diameter)
        .setAlpha(visual.alpha)
        .setRotation(visual.rotation);
    }
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
