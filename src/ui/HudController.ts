import type { ActiveSkillId, CharacterId, GameState, MetaProgression, MetaUnlockId, ObjectiveKind, ObjectiveRouteId, RelicId, TribulationChoiceId, UpgradeChoice, UpgradeId, Vector } from '../sim/types';
import {
  AWAKENING_SURGE_SUMMARIES,
  INSIGHT_LABELS,
  isInsightChoice,
  UPGRADE_LABELS,
} from '../sim/upgrades';
import { getActiveSkillLevelSummary, getActiveSkillName } from '../sim/activeSkills';
import {
  DEFAULT_GAME_SETTINGS,
  type GameSettings,
} from '../settings/gameSettings';
import { getBossDisplayName, getBossPhaseSkillName } from '../sim/bossSkills';
import { getUpgradeKind, getUpgradeMaxLevel, SKILL_IDS } from '../sim/upgradeCatalog';
import { createUpgradePreview } from '../sim/upgradePreview';
import {
  getActiveSynergies,
  getSynergiesActivatedByUpgrade,
  SYNERGIES,
} from '../sim/synergies';
import { getTribulationEndMs, TRIBULATION_NAMES } from '../sim/tribulations';
import { TRIBULATION_CHOICES } from '../sim/tribulationChoices';
import { CHARACTERS, CHARACTER_IDS, STARTING_CHARACTER_IDS } from '../sim/characters';
import { DAMAGE_SOURCE_NAMES } from '../sim/combatStats';
import { createDefaultMetaProgression, PATH_NODES, RELIC_FORGE_COSTS, RELICS, TALENTS } from '../meta/metaProgression';
import { localizeMarkup } from '../i18n/uiText';

const OBJECTIVE_NAMES: Record<ObjectiveKind, string> = {
  'thunder-pillar': '破坏引雷天柱',
  'blood-well': '封印血月魔井',
  'frost-core': '击碎玄霜劫核',
};

const OBJECTIVE_FIELD_NAMES: Record<ObjectiveKind, string> = {
  'thunder-pillar': '雷脉共鸣',
  'blood-well': '血潮回生',
  'frost-core': '霜域护持',
};

const BOSS_OBJECTIVE_NAMES = {
  'crimson-anchor': '赤煞阵眼',
  'storm-pylon': '引雷天柱',
  'blood-well': '血祭魔井',
} as const;

const BOSS_HAZARD_NAMES = {
  charge: '冲锋斩击', circle: '坠星法阵', line: '贯穿雷光', ring: '血月震环',
} as const;

interface HudCallbacks {
  onStart: () => void;
  onStartLocalCoop?: () => void;
  onOpenDongfu: () => void;
  onCloseDongfu: () => void;
  onUnlockTalent: (talentId: MetaUnlockId) => void;
  onToggleRelic: (relicId: RelicId) => void;
  onForgeRelic: (relicId: RelicId) => void;
  onChooseCharacter: (character: CharacterId) => void;
  onChooseTribulationChoice: (choice: TribulationChoiceId) => void;
  onChooseObjectiveRoute: (route: ObjectiveRouteId) => void;
  onChooseActiveSkill: (skill: ActiveSkillId) => void;
  onRestart: () => void;
  onChooseUpgrade: (upgrade: UpgradeChoice) => void;
  onChooseTreasure: (upgrade: UpgradeId) => void;
  onConfirmTreasureReplacement: (slotIndex: number) => void;
  onCancelTreasureReplacement: () => void;
  onOpenSettings: () => void;
  onCloseSettings: () => void;
  onUnlockBetaMode: (passphrase: string) => void;
  onStartBetaMode: () => void;
  onToggleBetaSkill: (skill: UpgradeId) => void;
  onSetBetaSkillLevel: (skill: UpgradeId, level: number) => void;
  onSetBetaActiveSkill: (skill: ActiveSkillId) => void;
  onSetBetaActiveSkillLevel: (level: number) => void;
  onSetBetaStartTime: (minutes: number) => void;
  onLaunchBetaMode: () => void;
  onCloseBetaLoadout: () => void;
  onChangeSetting: (key: keyof GameSettings, value: GameSettings[keyof GameSettings]) => void;
  onActivate: (aim?: Vector) => void;
  onMove: (move: Vector) => void;
}

export class HudController {
  private readonly root: HTMLElement;
  private readonly callbacks: HudCallbacks;
  private lastMarkup = '';
  private settings: GameSettings = DEFAULT_GAME_SETTINGS;
  private touchControl: 'joystick' | 'active' | null = null;
  private touchOrigin = { x: 0, y: 0 };
  private touchVector = { x: 0, y: 0 };
  private suppressActivateClick = false;

  public constructor(root: HTMLElement, callbacks: HudCallbacks) {
    this.root = root;
    this.callbacks = callbacks;
    this.root.addEventListener('click', (event) => this.handleClick(event));
    this.root.addEventListener('input', (event) => this.handleInput(event));
    this.root.addEventListener('pointerdown', (event) => this.handlePointerDown(event));
    this.root.addEventListener('pointermove', (event) => this.handlePointerMove(event));
    this.root.addEventListener('pointerup', (event) => this.handlePointerUp(event));
    this.root.addEventListener('pointercancel', (event) => this.handlePointerUp(event));
  }

  public render(
    state: GameState,
    settings: GameSettings = DEFAULT_GAME_SETTINGS,
    settingsOpen = false,
    progression: MetaProgression = createDefaultMetaProgression(),
    showCoopBuilds = false,
  ): void {
    this.settings = settings;
    const showCombatHud = !['menu', 'dongfu', 'beta-loadout', 'lost'].includes(state.phase);
    const showLoadout = showCombatHud && !['character-choice', 'tribulation-choice', 'objective-route'].includes(state.phase);
    const markup = localizeMarkup([
      showCombatHud ? this.renderTopBar(state) : '',
      showLoadout ? this.renderLoadout(state, settings, showCoopBuilds) : '',
      settingsOpen ? this.renderSettings(settings) : this.renderOverlay(state, progression),
    ].join(''), settings.language);

    if (markup !== this.lastMarkup && this.touchControl === null) {
      this.root.innerHTML = markup;
      this.lastMarkup = markup;
    }
  }

  private renderLoadout(state: GameState, settings: GameSettings, showCoopBuilds: boolean): string {
    const skillSlots = this.renderSlotRow(state, state.player.equippedSkills, state.player.skillSlotLimit, 'skill-slot');
    const enhancementSlots = this.renderSlotRow(
      state,
      state.player.equippedEnhancements,
      state.player.enhancementSlotLimit,
      'enhancement-slot',
    );
    const activeSynergies = getActiveSynergies(state.player);
    const synergyStrip = activeSynergies.length > 0
      ? `<div class="synergy-strip">${activeSynergies.map((synergy) => {
        const definition = SYNERGIES[synergy];
        return `<span title="${definition.description}"><i>${definition.symbol}</i>${definition.name}</span>`;
      }).join('')}</div>`
      : '';
    const active = state.player.activeSkill;
    const activeName = active ? getActiveSkillName(active) : '未选择';
    const cooldown = Math.max(0, state.player.activeCooldownRemainingMs);
    const showBuilds = !state.coopEnabled || showCoopBuilds;
    const partnerDock = state.partner && showBuilds ? this.renderPartnerDock(state) : '';
    return `<div class="mobile-joystick opacity-${settings.joystickOpacity}" data-control="joystick"><i></i></div>
    <div class="skill-dock${state.coopEnabled && showBuilds ? ' coop-builds' : ''}">
      ${showBuilds ? `<div class="loadout-stack">
        ${synergyStrip}
        <div class="loadout-rows">
          <div class="loadout-row"><b>技能</b><div class="passive-slots skill-slots">${skillSlots}</div></div>
          <div class="loadout-row"><b>强化</b><div class="passive-slots enhancement-slots">${enhancementSlots}</div></div>
        </div>
      </div>` : ''}
      <button class="active-slot" data-action="activate" aria-label="释放主动技能" title="${activeName} · 空格">
        <i>${active ? activeName.slice(0, 1) : '主'}</i>
        <span>${active ? `${activeName}<small>Lv.${state.player.activeSkillLevel} · ${cooldown > 0 ? `${(cooldown / 1000).toFixed(1)}s` : getActiveSkillLevelSummary(active, state.player.activeSkillLevel)}</small>` : activeName}</span>
      </button>
      <button class="settings-button" data-action="open-settings" aria-label="设置" title="设置">⚙</button>
    </div>${partnerDock}`;
  }

  private renderPartnerDock(state: GameState): string {
    const partner = state.partner!;
    const skills = this.renderSlotRow(state, partner.equippedSkills, partner.skillSlotLimit, 'skill-slot', partner);
    const enhancements = this.renderSlotRow(state, partner.equippedEnhancements, partner.enhancementSlotLimit, 'enhancement-slot', partner);
    const active = partner.activeSkill;
    return `<div class="partner-dock${partner.downed ? ' downed' : ''}">
      <b>P2 · ${partner.downed ? '待救援' : `Lv.${partner.level}`}</b>
      <div class="loadout-row"><span>技能</span><div class="passive-slots skill-slots">${skills}</div></div>
      <div class="loadout-row"><span>强化</span><div class="passive-slots enhancement-slots">${enhancements}</div></div>
      <small>${active ? `${getActiveSkillName(active)} · Enter` : '未选择主动技能'}</small>
    </div>`;
  }

  private renderSlotRow(
    state: GameState,
    equipped: UpgradeId[],
    count: number,
    className: string,
    player = state.player,
  ): string {
    return Array.from({ length: count }, (_, index) => {
      const upgrade = equipped[index];
      if (!upgrade) return `<div class="passive-slot ${className} empty"><i>空</i></div>`;
      const label = UPGRADE_LABELS[upgrade];
      const level = player.upgradeLevels[upgrade];
      const awakened = level === getUpgradeMaxLevel(upgrade);
      return `<div class="passive-slot ${className}${awakened ? ' awakened' : ''}" title="${label.name}">
        <i>${label.symbol}</i><span>${awakened ? '觉' : `Lv.${level}`}</span>
      </div>`;
    }).join('');
  }

  private renderSettings(settings: GameSettings): string {
    return `<div class="settings-backdrop"><section class="settings-panel">
      <header><p class="eyebrow">PAUSED</p><h2>设置</h2><button data-action="close-settings" aria-label="关闭设置">×</button></header>
      ${segmentedSetting('主动瞄准', 'aimMode', [['auto', '自动'], ['manual', '手动']], settings.aimMode)}
      ${segmentedSetting('游戏速度', 'gameSpeed', [['0.75', '0.75×'], ['1', '1.0×'], ['1.25', '1.25×']], String(settings.gameSpeed))}
      <label class="settings-row slider-row"><span>音乐音量 <b>${Math.round(settings.musicVolume * 100)}%</b></span><input type="range" min="0" max="1" step="0.05" value="${settings.musicVolume}" data-setting-input="musicVolume"></label>
      <label class="settings-row slider-row"><span>音效音量 <b>${Math.round(settings.soundVolume * 100)}%</b></span><input type="range" min="0" max="1" step="0.05" value="${settings.soundVolume}" data-setting-input="soundVolume"></label>
      ${segmentedSetting('屏幕震动', 'screenShake', [['true', '开启'], ['false', '关闭']], String(settings.screenShake))}
      ${segmentedSetting('伤害数字', 'damageNumbers', [['true', '开启'], ['false', '关闭']], String(settings.damageNumbers))}
      ${segmentedSetting('特效强度', 'effectLevel', [['low', '低'], ['medium', '中'], ['high', '高']], settings.effectLevel)}
      ${segmentedSetting('摇杆透明度', 'joystickOpacity', [['low', '低'], ['medium', '中'], ['high', '高']], settings.joystickOpacity)}
      ${settings.betaModeUnlocked
        ? '<div class="settings-row beta-unlocked"><span>内测模式</span><b>已解锁</b></div>'
        : '<label class="settings-row beta-passphrase"><span>内测口令</span><input type="text" inputmode="text" autocomplete="off" spellcheck="false" data-beta-passphrase></label><button class="secondary-action beta-unlock" data-action="unlock-beta-mode">解锁内测模式</button>'}
    </section></div>`;
  }

  private renderTopBar(state: GameState): string {
    const hpRatio = Math.max(0, state.player.hp / state.player.maxHp);
    const expRatio = state.player.experience / state.player.experienceToNext;
    const shield = state.player.maxShield > 0
      ? `<div class="pill shield">护盾 ${Math.ceil(state.player.shield)}/${state.player.maxShield}</div>`
      : '';
    const activeBoss = state.enemies
      .filter((enemy) => enemy.kind === 'boss')
      .sort((a, b) => (b.bossWave ?? 0) - (a.bossWave ?? 0))[0];
    const bossStatus = activeBoss
      ? `
        <div class="boss-status">
          <span>第 ${activeBoss.bossWave} 劫 · ${getBossDisplayName(activeBoss.bossType ?? 'crimson')}</span>
          ${(activeBoss.bossPhase ?? 1) >= 2
            ? `<em>${activeBoss.bossPhase === 3 ? '三阶段 · 绝境' : '二阶段'} · ${getBossPhaseSkillName(activeBoss.bossType ?? 'crimson', activeBoss.bossPhase ?? 1)}</em>`
            : ''}
          ${(activeBoss.bossArenaVulnerableUntilMs ?? 0) > state.elapsedMs
            ? `<em class="boss-vulnerable">破阵易伤 ${formatTime((activeBoss.bossArenaVulnerableUntilMs ?? 0) - state.elapsedMs)}</em>`
            : ''}
          <b>${Math.ceil(activeBoss.hp)} / ${activeBoss.maxHp}</b>
          <i style="--value:${Math.max(0, activeBoss.hp / activeBoss.maxHp)}"></i>
        </div>
      `
      : '';
    const telegraph = state.bossHazards
      .filter((hazard) => hazard.telegraphRemainingMs > 0)
      .sort((a, b) => a.telegraphRemainingMs - b.telegraphRemainingMs)[0];
    const bossTelegraph = telegraph
      ? `<div class="boss-telegraph"><span>劫主读招 · ${BOSS_HAZARD_NAMES[telegraph.kind]}</span><b>${formatTime(telegraph.telegraphRemainingMs)}</b></div>`
      : '';
    const breakTarget = activeBoss && state.enemies.find((enemy) => enemy.bossBreakOwnerId === activeBoss.id);
    const bossBreak = breakTarget
      ? `<div class="boss-telegraph boss-break"><span>破势命门 · 打破以中断招式</span><b>${formatTime((breakTarget.bossBreakExpiresAtMs ?? state.elapsedMs) - state.elapsedMs)}</b></div>`
      : '';
    const tribulation = state.tribulation === 'calm'
      ? `<div class="pill tribulation">天劫 ${formatTime(getTribulationEndMs(state.elapsedMs) - state.elapsedMs)}</div>`
      : `<div class="pill tribulation active" data-tribulation="${state.tribulation}">${TRIBULATION_NAMES[state.tribulation]} · ${formatTime(nextTribulationAt(state.elapsedMs) - state.elapsedMs)}</div>`;
    const activeChoice = state.activeTribulationChoiceId
      ? TRIBULATION_CHOICES[state.activeTribulationChoiceId]
      : undefined;
    const choiceStatus = activeChoice
      ? `<div class="pill tribulation-choice-status" data-tribulation="${activeChoice.tribulation}" title="${activeChoice.benefit}；${activeChoice.pressure}">${activeChoice.symbol} ${activeChoice.name} · ${formatTime(getTribulationEndMs(state.elapsedMs) - state.elapsedMs)}</div>`
      : '';
    const sealStatus = Object.entries(state.tribulationSealRanks)
      .filter(([, rank]) => rank > 0)
      .map(([seal, rank]) => {
        const name = seal === 'thunder' ? '雷印' : seal === 'blood' ? '血印' : '霜印';
        return `<span data-seal="${seal}">${name} ${toRoman(rank)}</span>`;
      })
      .join('');
    const eliteCountdown = state.elapsedMs < state.nextEliteSquadAtMs
      ? `<div class="pill elite-countdown">精英 ${formatTime(state.nextEliteSquadAtMs - state.elapsedMs)}</div>`
      : '';
    const siegeWarning = state.siegeActive
      ? `<div class="pill siege-warning">围困 ${state.siegeEnemyCount}</div>`
      : '';
    const objective = state.activeObjectiveId === null
      ? undefined
      : state.enemies.find((enemy) => enemy.id === state.activeObjectiveId);
    const objectiveStatus = objective?.objectiveKind
      ? `<div class="objective-status" data-objective="${objective.objectiveKind}">
          <span>天劫链 ${state.objectiveChainStep}/3 · ${OBJECTIVE_NAMES[objective.objectiveKind]}</span>
          <b>${formatTime(state.objectiveExpiresAtMs - state.elapsedMs)} · ${Math.ceil(objective.hp)}/${objective.maxHp}</b>
          <i style="--value:${Math.max(0, objective.hp / objective.maxHp)}"></i>
        </div>`
      : '';
    const objectiveFields = (Object.entries(state.objectiveFieldExpiresAtMs) as Array<[ObjectiveKind, number]>)
      .filter(([, expiresAtMs]) => expiresAtMs > state.elapsedMs)
      .map(([objectiveKind, expiresAtMs]) => `<div class="pill objective-field" data-objective="${objectiveKind}">${OBJECTIVE_FIELD_NAMES[objectiveKind]} ${formatTime(expiresAtMs - state.elapsedMs)}</div>`)
      .join('');
    const bossObjective = state.activeBossObjectiveId === null
      ? undefined
      : state.enemies.find((enemy) => enemy.id === state.activeBossObjectiveId);
    const bossObjectiveStatus = bossObjective?.bossObjectiveKind
      ? `<div class="boss-objective-status" data-objective="${bossObjective.bossObjectiveKind}">
          <span>${BOSS_OBJECTIVE_NAMES[bossObjective.bossObjectiveKind]}</span>
          <b>${formatTime(state.bossObjectiveExpiresAtMs - state.elapsedMs)} · ${Math.ceil(bossObjective.hp)}/${bossObjective.maxHp}</b>
          <i style="--value:${Math.max(0, bossObjective.hp / bossObjective.maxHp)}"></i>
        </div>`
      : '';
    return `
      <div class="hud-top">
        <div class="brand">符潮残夜</div>
        <div class="stat"><span>生命</span><b>${Math.ceil(state.player.hp)}/${state.player.maxHp}</b><i style="--value:${hpRatio}"></i></div>
        <div class="stat"><span>等级</span><b>Lv.${state.player.level}</b><i style="--value:${expRatio}"></i></div>
        ${shield}
        <div class="pill">击杀 ${state.kills}</div>
        <div class="pill">生存 ${formatTime(state.elapsedMs)}</div>
        <div class="pill boss-countdown">劫主 ${formatTime(state.nextBossAtMs - state.elapsedMs)}</div>
        ${eliteCountdown}
        ${siegeWarning}
        ${tribulation}
        ${choiceStatus}
        ${sealStatus ? `<div class="tribulation-seals">${sealStatus}</div>` : ''}
      </div>
      ${bossStatus}
      ${bossTelegraph}
      ${bossBreak}
      ${bossObjectiveStatus}
      ${objectiveStatus}
      ${objectiveFields}
    `;
  }

  private renderOverlay(state: GameState, progression: MetaProgression): string {
    if (state.phase === 'menu') {
      return `
        <div class="center-panel">
          <p class="eyebrow">CYBER DAOIST ROGUELITE</p>
          <h1>符潮残夜</h1>
          <p>用 WASD 或方向键移动，在无尽怪潮中修行。每五分钟会有一位劫主降临。</p>
          <button data-action="start">开始渡劫</button>
          <button class="secondary-action" data-action="start-local-coop">本地双人</button>
          <button class="secondary-action" data-action="open-dongfu">洞府</button>
          ${this.settings.betaModeUnlocked ? '<button class="secondary-action" data-action="start-beta-mode">进入内测模式</button>' : ''}
          <button class="secondary-action" data-action="open-settings">设置</button>
          ${segmentedSetting('语言', 'language', [['zh-CN', '中文'], ['en', 'EN']], this.settings.language)}
        </div>
      `;
    }

    if (state.phase === 'dongfu') {
      return this.renderDongfu(progression);
    }

    if (state.phase === 'character-choice' || state.phase === 'coop-character-choice') {
      const playerLabel = state.phase === 'coop-character-choice' ? 'P2' : 'P1';
      return `
        <div class="center-panel compact upgrade-panel character-panel">
          <p class="eyebrow">CHOOSE CULTIVATOR · ${playerLabel}</p>
          <h2>选择${playerLabel}本局角色</h2>
          <div class="upgrade-grid">
            ${CHARACTER_IDS.map((character) => {
              const definition = CHARACTERS[character];
              const unlocked = !definition.hidden || progression.unlockedCharacterIds.includes(character);
              return `<button class="upgrade character-choice ${unlocked ? '' : 'sealed'}" data-character="${character}" ${unlocked ? '' : 'disabled'}>
                <span class="upgrade-head"><i class="upgrade-symbol">${definition.symbol}</i><em>${unlocked ? '角色' : '封印中'}</em></span>
                <strong>${definition.name}</strong>
                <span class="upgrade-description">${unlocked ? definition.trait : definition.unlockHint}</span>
              </button>`;
            }).join('')}
          </div>
        </div>
      `;
    }

    if (state.phase === 'upgrade') {
      const upgradePlayer = state.pendingUpgradePlayerId === 'p2' ? state.partner : state.player;
      return this.renderChoicePanel(
        state,
        state.upgradeChoices,
        `${state.pendingUpgradePlayerId.toUpperCase()} · LEVEL ${upgradePlayer?.level ?? 1}`,
        `为 ${state.pendingUpgradePlayerId.toUpperCase()} 选择一道符法`,
        'upgrade',
      );
    }

    if (state.phase === 'tribulation-choice') {
      return `<div class="center-panel compact upgrade-panel tribulation-choice-panel" data-tribulation="${state.tribulation}">
        <p class="eyebrow">TRIBULATION VOW</p>
        <h2>${TRIBULATION_NAMES[state.tribulation]} · 定一张劫契</h2>
        <div class="upgrade-grid">${state.tribulationChoices.map((choice) => {
          const definition = TRIBULATION_CHOICES[choice];
          return `<button class="upgrade tribulation-choice" data-tribulation-choice="${choice}">
            <span class="upgrade-head"><i class="upgrade-symbol">${definition.symbol}</i><em>本轮有效</em></span>
            <strong>${definition.name}</strong>
            <span class="tribulation-benefit">收益 · ${definition.benefit}</span>
            <span class="tribulation-pressure">压力 · ${definition.pressure}</span>
          </button>`;
        }).join('')}</div>
      </div>`;
    }

    if (state.phase === 'objective-route') {
      const nextStep = state.objectiveRoutePendingStep;
      const riskReward = state.objectiveChainRiskLevel + 1;
      return `<div class="center-panel compact upgrade-panel objective-route-panel">
        <p class="eyebrow">TRIBULATION CROSSROADS</p>
        <h2>天劫链 · 第 ${nextStep} 环</h2>
        <div class="upgrade-grid">
          <button class="upgrade" data-objective-route="secure">
            <span class="upgrade-head"><i class="upgrade-symbol">守</i><em>稳妥</em></span>
            <strong>收束灵息</strong>
            <span class="upgrade-description">恢复生命与护盾，下一环额外延长 12 秒</span>
          </button>
          <button class="upgrade" data-objective-route="risk">
            <span class="upgrade-head"><i class="upgrade-symbol">赌</i><em>冒险</em></span>
            <strong>加注劫火</strong>
            <span class="upgrade-description">下一环出现三名精英守卫，终环额外获得 ${riskReward} 个宝箱</span>
          </button>
        </div>
      </div>`;
    }

    if (state.phase === 'active-choice' || state.phase === 'coop-active-choice') {
      const playerLabel = state.phase === 'coop-active-choice' ? 'P2' : 'P1';
      const skills: ActiveSkillId[] = ['talisman-ruin', 'dimension-step', 'tai-chi-ward'];
      const descriptions: Record<ActiveSkillId, string> = {
        'talisman-ruin': '朝目标方向释放密集符剑，造成高额爆发伤害',
        'dimension-step': '向目标方向冲刺，短暂无敌并击碎路径弹幕',
        'tai-chi-ward': '展开护身玄阵，阻挡弹幕并减速附近敌人',
      };
      return `
        <div class="center-panel compact upgrade-panel active-choice-panel">
          <p class="eyebrow">ACTIVE ART · ${playerLabel}</p>
          <h2>选择${playerLabel}主动技能</h2>
          <div class="upgrade-grid">
            ${skills.map((skill, index) => `<button class="upgrade active-choice" data-active-skill="${skill}">
              <span class="upgrade-head"><i class="upgrade-symbol">${['符', '移', '阵'][index]}</i><em>主动</em></span>
              <strong>${getActiveSkillName(skill)}</strong>
              <span class="upgrade-description">${descriptions[skill]}</span>
            </button>`).join('')}
          </div>
        </div>
      `;
    }

    if (state.phase === 'beta-loadout') {
      const selected = state.betaSkillSelections;
      const activeSkills: ActiveSkillId[] = ['talisman-ruin', 'dimension-step', 'tai-chi-ward'];
      return `<div class="center-panel compact upgrade-panel beta-loadout-panel">
        <p class="eyebrow">BETA LOADOUT</p>
        <h2>内测技能配置</h2>
        <p class="beta-loadout-count">已选 ${selected.length}/5 项技能</p>
        <section class="beta-active-config">
          <header><b>主动战技</b><span>Lv.${state.betaActiveSkillLevel}/4</span></header>
          <div class="beta-active-grid">${activeSkills.map((skill) => `<button class="secondary-action ${state.betaActiveSkill === skill ? 'selected' : ''}" data-beta-active-skill="${skill}">
            ${getActiveSkillName(skill)}<small>${getActiveSkillLevelSummary(skill, state.betaActiveSkill === skill ? state.betaActiveSkillLevel : 1)}</small>
          </button>`).join('')}</div>
          <label class="beta-level"><span>战技等级 Lv.${state.betaActiveSkillLevel}</span><input type="range" min="1" max="4" step="1" value="${state.betaActiveSkillLevel}" data-beta-active-level></label>
        </section>
        <section class="beta-timeline-config">
          <header><b>开局时间</b><span>${formatTime(state.betaStartElapsedMs)}</span></header>
          <p>从对应阶段开始，后期成长与劫主时间线会立即生效</p>
          <input type="range" min="0" max="30" step="5" value="${state.betaStartElapsedMs / 60_000}" data-beta-start-time aria-label="开局时间">
        </section>
        <div class="beta-skill-grid">${SKILL_IDS.map((skill) => {
          const label = UPGRADE_LABELS[skill];
          const isSelected = selected.includes(skill);
          const disabled = !isSelected && selected.length >= 5;
          const level = state.betaSkillLevels[skill];
          return `<section class="beta-skill-card ${isSelected ? 'selected' : ''}">
            <button class="upgrade" data-beta-skill="${skill}" ${disabled ? 'disabled' : ''}>
              <span class="upgrade-head"><i class="upgrade-symbol">${label.symbol}</i><em>${isSelected ? `Lv.${level}` : '未选择'}</em></span>
              <strong>${label.name}</strong>
              <span class="upgrade-description">${label.description}</span>
            </button>
            ${isSelected ? `<label class="beta-level"><span>等级 Lv.${level}</span><input type="range" min="1" max="6" step="1" value="${level}" data-beta-level="${skill}"></label>` : ''}
          </section>`;
        }).join('')}</div>
        <footer class="beta-actions">
          <button data-action="launch-beta-mode" ${selected.length === 0 ? 'disabled' : ''}>开始内测</button>
          <button class="secondary-action" data-action="close-beta-loadout">返回</button>
        </footer>
      </div>`;
    }

    if (state.phase === 'treasure') {
      return this.renderChoicePanel(
        state,
        state.treasureChoices,
        `第 ${state.treasureWave ?? 1} 劫战利品`,
        '开启劫主宝藏',
        'treasure',
      );
    }

    if (state.phase === 'treasure-replace' && state.pendingTreasureUpgrade) {
      const pending = UPGRADE_LABELS[state.pendingTreasureUpgrade];
      const pendingKind = getUpgradeKind(state.pendingTreasureUpgrade);
      const equipped = pendingKind === 'skill'
        ? state.player.equippedSkills
        : state.player.equippedEnhancements;
      return `
        <div class="center-panel compact upgrade-panel treasure-panel replace-panel">
          <p class="eyebrow">替换为 ${pending.name}</p>
          <h2>选择要舍弃的${pendingKind === 'skill' ? '技能' : '强化'}</h2>
          <div class="upgrade-grid">
            ${equipped.map((upgrade, index) => {
              const label = UPGRADE_LABELS[upgrade];
              const level = state.player.upgradeLevels[upgrade];
              return `<button class="upgrade" data-replace-slot="${index}">
                <span class="upgrade-head"><i class="upgrade-symbol">${label.symbol}</i><em>Lv.${level}</em></span>
                <strong>${label.name}</strong>
                <span class="upgrade-description">替换后新能力从 Lv.1 开始</span>
              </button>`;
            }).join('')}
          </div>
          <button class="secondary-action" data-action="cancel-replacement">返回宝箱</button>
        </div>
      `;
    }

    if (state.phase === 'awakening' && state.awakeningNotice) {
      const notice = state.awakeningNotice;
      const label = UPGRADE_LABELS[notice.upgrade];
      return `
        <div class="awakening-screen" data-category="${label.category}">
          <div class="awakening-rays"></div>
          <p class="eyebrow">SKILL AWAKENED</p>
          <div class="awakening-symbol">${label.symbol}</div>
          <span>${notice.skillName} · ${getUpgradeMaxLevel(notice.upgrade) === 6 ? '六重' : '四重'}</span>
          <h2>${notice.awakeningName}</h2>
          <div class="awakening-stats">
            ${notice.summary.map((summary) => `<strong>${summary}</strong>`).join('')}
            ${AWAKENING_SURGE_SUMMARIES[notice.upgrade]
              ? `<strong class="awakening-surge">觉醒降临 · ${AWAKENING_SURGE_SUMMARIES[notice.upgrade]}</strong>`
              : ''}
          </div>
        </div>
      `;
    }

    if (state.phase === 'lost') {
      const damageRows = Object.entries(state.runStats.damageBySource)
        .filter(([, damage]) => damage > 0)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([source, damage]) => `<div><span>${DAMAGE_SOURCE_NAMES[source as keyof typeof DAMAGE_SOURCE_NAMES]}</span><b>${Math.round(damage).toLocaleString()}</b></div>`)
        .join('');
      return `
        <div class="center-panel compact run-summary">
          <p class="eyebrow">NIGHT CLAIMED</p>
          <h2>道心破碎</h2>
          <p>等级 ${state.player.level} · 击杀 ${state.kills} · 击败劫主 ${state.bossesDefeated} · 坚持 ${formatTime(state.elapsedMs)}</p>
          <section class="summary-stats">
            <span>精英击败 <b>${state.runStats.elitesDefeated}</b></span>
            <span>弹幕阻挡 <b>${state.runStats.bulletsBlocked}</b></span>
            <span>场景目标 <b>${state.runStats.objectivesCompleted}</b></span>
          </section>
          <p class="dao-yun-summary">本局道蕴 +${state.runDaoYunEarned}</p>
          <p class="dao-yun-summary">本局灵材 +${state.runSpiritOreEarned}</p>
          <section class="damage-ranking"><h3>伤害排行</h3>${damageRows || '<p>本局尚未造成伤害</p>'}</section>
          <button data-action="restart">再来一局</button>
        </div>
      `;
    }

    return '';
  }

  private renderDongfu(progression: MetaProgression): string {
    const nodeButton = (
      node: { id: MetaUnlockId; name: string; effect: string; cost: number; prerequisite?: string },
      unlocked: boolean,
      prerequisiteUnlocked: boolean,
    ) => {
      const ready = !unlocked && progression.daoYun >= node.cost && prerequisiteUnlocked;
      const status = unlocked ? '已解锁' : ready ? `消耗 ${node.cost}` : node.prerequisite ? '前置未完成' : '道蕴不足';
      return `<button class="dongfu-talent ${unlocked ? 'unlocked' : ''}" data-talent="${node.id}" ${ready ? '' : 'disabled'}>
        <span><strong>${node.name}</strong><small>${node.effect}</small></span><em>${status}</em>
      </button>`;
    };
    return `<div class="center-panel compact upgrade-panel dongfu-panel">
      <p class="eyebrow">CULTIVATION SANCTUM</p>
      <h2>洞府</h2>
      <p class="dao-yun-balance">道蕴 ${progression.daoYun}</p>
      <p class="dao-yun-balance">灵材 ${progression.spiritOre ?? 0}</p>
      <section class="path-tree">
        <header><span>道</span><strong>道途成长树</strong></header>
        <div class="path-node-list">${PATH_NODES.map((node) => nodeButton(
          node,
          progression.unlockedPathNodeIds.includes(node.id),
          !node.prerequisite || progression.unlockedPathNodeIds.includes(node.prerequisite),
        )).join('')}</div>
      </section>
      <div class="dongfu-routes">
        ${STARTING_CHARACTER_IDS.map((character) => {
          const definition = CHARACTERS[character];
          const relic = RELICS.find((item) => item.characterId === character)!;
          const relicUnlocked = progression.unlockedRelicIds.includes(relic.id);
          const relicEquipped = progression.equippedRelicIds.includes(relic.id);
          const forgeRank = progression.relicForgeRanks?.[relic.id] ?? 0;
          const forgeCost = RELIC_FORGE_COSTS[forgeRank];
          return `<section class="dongfu-route" data-character="${character}">
            <header><i>${definition.symbol}</i><strong>${definition.name}</strong></header>
            ${TALENTS.filter((talent) => talent.characterId === character).map((talent) => nodeButton(
              talent,
              progression.unlockedTalentIds.includes(talent.id),
              !talent.prerequisite || progression.unlockedTalentIds.includes(talent.prerequisite),
            )).join('')}
            ${nodeButton(relic, relicUnlocked, progression.unlockedTalentIds.includes(relic.prerequisite))}
            ${relicUnlocked ? `<button class="relic-toggle ${relicEquipped ? 'equipped' : ''}" data-relic="${relic.id}">
              <span>遗物 · ${relic.name}</span><em>${relicEquipped ? '已装备' : '装备'}</em>
            </button>${relicEquipped ? `<button class="relic-forge" data-forge-relic="${relic.id}" ${forgeCost === undefined || (progression.spiritOre ?? 0) < forgeCost ? 'disabled' : ''}>
              <span>锻炉 ${forgeRank}/3</span><em>${forgeCost === undefined ? '已圆满' : `锻造 ${forgeCost}`}</em>
            </button>` : ''}` : ''}
          </section>`;
        }).join('')}
      </div>
      <button class="secondary-action" data-action="close-dongfu">返回</button>
    </div>`;
  }

  private renderChoicePanel(
    state: GameState,
    choices: UpgradeChoice[],
    eyebrow: string,
    title: string,
    source: 'upgrade' | 'treasure',
  ): string {
    const choiceMarkup = choices
      .map((choice) => {
        if (isInsightChoice(choice)) {
          const insight = INSIGHT_LABELS[choice];
          return `
            <button class="upgrade insight-choice" data-upgrade="${choice}">
              <span class="upgrade-head"><i class="upgrade-symbol">${insight.symbol}</i><em>可重复</em></span>
              <strong>${insight.name}</strong>
              <span class="upgrade-description">${insight.description}</span>
            </button>
          `;
        }
        const label = UPGRADE_LABELS[choice];
        const preview = createUpgradePreview(state.player, choice);
        const awakens = preview.awakens;
        const needsResonance = preview.awakeningRequirement !== null
          && preview.nextLevel === preview.maxLevel
          && !awakens;
        const newSynergies = getSynergiesActivatedByUpgrade(state.player, choice);
        return `
          <button
            class="upgrade${awakens ? ' awakening-choice' : ''}"
            data-category="${label.category}"
            data-${source}="${choice}"
          >
            <span class="upgrade-head">
              <i class="upgrade-symbol">${label.symbol}</i>
              <em>${awakens ? `Lv.${preview.currentLevel} → 觉醒` : `Lv.${preview.currentLevel} → Lv.${preview.nextLevel}`}</em>
            </span>
            <strong>${awakens ? label.awakeningName : label.name}</strong>
            <span class="upgrade-kind">${preview.kind === 'skill' ? '技能' : '强化'} · 上限 Lv.${preview.maxLevel}</span>
            <span class="upgrade-description">${preview.lines.join('<br>')}</span>
            ${newSynergies.length > 0 ? `<span class="synergy-preview">激活组合技 · ${newSynergies.map((synergy) => SYNERGIES[synergy].name).join(' / ')}</span>` : ''}
            ${needsResonance ? `<span class="awakening-summary">共鸣觉醒需 · ${UPGRADE_LABELS[preview.awakeningRequirement!].name}</span>` : ''}
            ${awakens ? `<span class="awakening-summary">${label.awakeningSummary.join(' · ')}</span>` : ''}
          </button>
        `;
      })
      .join('');
    return `
      <div class="center-panel compact upgrade-panel${source === 'treasure' ? ' treasure-panel' : ''}">
        <p class="eyebrow">${eyebrow}</p>
        <h2>${title}</h2>
        <div class="upgrade-grid">${choiceMarkup}</div>
      </div>
    `;
  }

  private handleClick(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    const button = target.closest('button');
    if (!(button instanceof HTMLButtonElement)) {
      return;
    }

    const action = button.dataset.action;
    const upgrade = button.dataset.upgrade as UpgradeChoice | undefined;
    const treasure = button.dataset.treasure as UpgradeId | undefined;
    const replaceSlot = button.dataset.replaceSlot;
    const activeSkill = button.dataset.activeSkill as ActiveSkillId | undefined;
    const character = button.dataset.character as CharacterId | undefined;
    const talent = button.dataset.talent as MetaUnlockId | undefined;
    const relic = button.dataset.relic as RelicId | undefined;
    const forgeRelic = button.dataset.forgeRelic as RelicId | undefined;
    const tribulationChoice = button.dataset.tribulationChoice as TribulationChoiceId | undefined;
    const objectiveRoute = button.dataset.objectiveRoute as ObjectiveRouteId | undefined;
    if (action === 'start') {
      this.callbacks.onStart();
    } else if (action === 'start-local-coop') {
      this.callbacks.onStartLocalCoop?.();
    } else if (action === 'restart') {
      this.callbacks.onRestart();
    } else if (action === 'open-dongfu') {
      this.callbacks.onOpenDongfu();
    } else if (action === 'close-dongfu') {
      this.callbacks.onCloseDongfu();
    } else if (action === 'cancel-replacement') {
      this.callbacks.onCancelTreasureReplacement();
    } else if (action === 'open-settings') {
      this.callbacks.onOpenSettings();
    } else if (action === 'close-settings') {
      this.callbacks.onCloseSettings();
    } else if (action === 'unlock-beta-mode') {
      const input = this.root.querySelector<HTMLInputElement>('[data-beta-passphrase]');
      this.callbacks.onUnlockBetaMode(input?.value ?? '');
    } else if (action === 'start-beta-mode') {
      this.callbacks.onStartBetaMode();
    } else if (action === 'launch-beta-mode') {
      this.callbacks.onLaunchBetaMode();
    } else if (action === 'close-beta-loadout') {
      this.callbacks.onCloseBetaLoadout();
    } else if (action === 'activate') {
      if (this.suppressActivateClick) {
        this.suppressActivateClick = false;
      } else {
        this.callbacks.onActivate();
      }
    } else if (character) {
      this.callbacks.onChooseCharacter(character);
    } else if (tribulationChoice) {
      this.callbacks.onChooseTribulationChoice(tribulationChoice);
    } else if (objectiveRoute) {
      this.callbacks.onChooseObjectiveRoute(objectiveRoute);
    } else if (talent) {
      this.callbacks.onUnlockTalent(talent);
    } else if (relic) {
      this.callbacks.onToggleRelic(relic);
    } else if (forgeRelic) {
      this.callbacks.onForgeRelic(forgeRelic);
    } else if (activeSkill) {
      this.callbacks.onChooseActiveSkill(activeSkill);
    } else if (replaceSlot !== undefined) {
      this.callbacks.onConfirmTreasureReplacement(Number(replaceSlot));
    } else if (upgrade) {
      this.callbacks.onChooseUpgrade(upgrade);
    } else if (treasure) {
      this.callbacks.onChooseTreasure(treasure);
    } else if (button.dataset.betaSkill) {
      this.callbacks.onToggleBetaSkill(button.dataset.betaSkill as UpgradeId);
    } else if (button.dataset.betaActiveSkill) {
      this.callbacks.onSetBetaActiveSkill(button.dataset.betaActiveSkill as ActiveSkillId);
    } else if (button.dataset.setting) {
      this.callbacks.onChangeSetting(
        button.dataset.setting as keyof GameSettings,
        parseSettingValue(button.dataset.setting, button.dataset.value ?? ''),
      );
    }
  }

  private handleInput(event: Event): void {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) return;
    if (input.dataset.betaLevel) {
      this.callbacks.onSetBetaSkillLevel(input.dataset.betaLevel as UpgradeId, Number(input.value));
      return;
    }
    if (input.dataset.betaActiveLevel !== undefined) {
      this.callbacks.onSetBetaActiveSkillLevel(Number(input.value));
      return;
    }
    if (input.dataset.betaStartTime !== undefined) {
      this.callbacks.onSetBetaStartTime(Number(input.value));
      return;
    }
    if (!input.dataset.settingInput) return;
    this.callbacks.onChangeSetting(
      input.dataset.settingInput as keyof GameSettings,
      Number(input.value),
    );
  }

  private handlePointerDown(event: PointerEvent): void {
    if (event.pointerType === 'mouse') return;
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const control = target.closest<HTMLElement>('[data-control="joystick"], .active-slot');
    if (!control) return;
    this.touchControl = control.matches('.active-slot') ? 'active' : 'joystick';
    this.touchOrigin = { x: event.clientX, y: event.clientY };
    this.touchVector = { x: 0, y: 0 };
    control.setPointerCapture(event.pointerId);
    event.preventDefault();
  }

  private handlePointerMove(event: PointerEvent): void {
    if (!this.touchControl) return;
    const dx = event.clientX - this.touchOrigin.x;
    const dy = event.clientY - this.touchOrigin.y;
    const length = Math.hypot(dx, dy);
    const scale = length > 44 ? 44 / length : 1;
    this.touchVector = { x: dx * scale / 44, y: dy * scale / 44 };
    if (this.touchControl === 'joystick') {
      this.callbacks.onMove(this.touchVector);
      const knob = this.root.querySelector<HTMLElement>('.mobile-joystick i');
      if (knob) knob.style.transform = `translate(${dx * scale}px, ${dy * scale}px)`;
    }
    event.preventDefault();
  }

  private handlePointerUp(event: PointerEvent): void {
    if (!this.touchControl) return;
    if (this.touchControl === 'joystick') {
      this.callbacks.onMove({ x: 0, y: 0 });
      const knob = this.root.querySelector<HTMLElement>('.mobile-joystick i');
      if (knob) knob.style.transform = '';
    } else if (this.settings.aimMode === 'manual') {
      this.suppressActivateClick = true;
      if (Math.hypot(this.touchVector.x, this.touchVector.y) >= 0.2) {
        this.callbacks.onActivate(this.touchVector);
      }
    } else {
      this.suppressActivateClick = true;
      this.callbacks.onActivate();
    }
    this.touchControl = null;
    event.preventDefault();
  }
}

function segmentedSetting(
  label: string,
  key: keyof GameSettings,
  options: [string, string][],
  current: string,
): string {
  return `<div class="settings-row"><span>${label}</span><div class="segmented">
    ${options.map(([value, text]) => `<button class="${value === current ? 'selected' : ''}" data-setting="${key}" data-value="${value}">${text}</button>`).join('')}
  </div></div>`;
}

function parseSettingValue(key: string, value: string): GameSettings[keyof GameSettings] {
  if (key === 'gameSpeed' || key === 'musicVolume' || key === 'soundVolume') return Number(value);
  if (key === 'screenShake' || key === 'damageNumbers') return value === 'true';
  return value as GameSettings[keyof GameSettings];
}

function formatTime(ms: number): string {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${remainder.toString().padStart(2, '0')}`;
}

function nextTribulationAt(elapsedMs: number): number { return getTribulationEndMs(elapsedMs); }

function toRoman(value: number): string {
  return ['I', 'II', 'III', 'IV', 'V'][Math.max(0, Math.min(4, value - 1))];
}
