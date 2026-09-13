// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HudController } from '../../src/ui/HudController';
import { createDefaultState } from '../../src/sim/state';
import { DEFAULT_GAME_SETTINGS } from '../../src/settings/gameSettings';
import { GameSimulation } from '../../src/sim/GameSimulation';
import type { MetaProgression } from '../../src/sim/types';

describe('HudController', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="hud"></div>';
  });

  it('renders five skill slots, six enhancement slots, and one independent active slot', () => {
    const root = document.querySelector<HTMLElement>('#hud')!;
    const hud = new HudController(root, callbacks());
    const state = createDefaultState();
    state.player.equippedSkills = ['thunder-ring'];
    state.player.equippedEnhancements = ['faster-swords'];
    state.player.upgradeLevels['faster-swords'] = 2;
    state.player.activeSkill = 'dimension-step';

    hud.render(state, DEFAULT_GAME_SETTINGS, false);

    expect(root.querySelectorAll('.skill-slot')).toHaveLength(5);
    expect(root.querySelectorAll('.enhancement-slot')).toHaveLength(6);
    expect(root.querySelectorAll('.active-slot')).toHaveLength(1);
    expect(root.textContent).toContain('乾坤挪移');
    expect(root.textContent).toContain('Lv.1');
  });

  it('shows the active tribulation and elite squad countdown', () => {
    const root = document.querySelector<HTMLElement>('#hud')!;
    const hud = new HudController(root, callbacks());
    const state = createDefaultState();
    state.elapsedMs = 300_000;
    state.tribulation = 'thunder';
    state.nextEliteSquadAtMs = 330_000;

    hud.render(state, DEFAULT_GAME_SETTINGS, false);

    expect(root.textContent).toContain('九霄雷劫');
    expect(root.textContent).toContain('精英 0:30');
  });

  it('shows a persistent warning while the player is surrounded', () => {
    const root = document.querySelector<HTMLElement>('#hud')!;
    const hud = new HudController(root, callbacks());
    const state = createDefaultState();
    state.siegeActive = true;
    state.siegeEnemyCount = 7;

    hud.render(state, DEFAULT_GAME_SETTINGS, false);

    expect(root.textContent).toContain('围困 7');
    expect(root.querySelector('.siege-warning')).not.toBeNull();
  });

  it('renders exact upgrade deltas and the correct sixth-level awakening threshold', () => {
    const root = document.querySelector<HTMLElement>('#hud')!;
    const hud = new HudController(root, callbacks());
    const state = createDefaultState();
    state.phase = 'upgrade';
    state.player.equippedSkills = ['thunder-ring'];
    state.player.upgradeLevels['thunder-ring'] = 4;
    state.upgradeChoices = ['thunder-ring'];

    hud.render(state, DEFAULT_GAME_SETTINGS, false);

    expect(root.textContent).toContain('Lv.4 → Lv.5');
    expect(root.textContent).toContain('雷环范围 152 → 190（+38）');
  });

  it('explains the immediate battlefield surge in a skill awakening notice', () => {
    const root = document.querySelector<HTMLElement>('#hud')!;
    const hud = new HudController(root, callbacks());
    const state = createDefaultState();
    state.phase = 'awakening';
    state.awakeningNotice = {
      upgrade: 'void-bell',
      skillName: '太虚钟',
      awakeningName: '万法皆寂',
      summary: ['震波范围与伤害大幅提高'],
    };

    hud.render(state, DEFAULT_GAME_SETTINGS, false);

    expect(root.textContent).toContain('觉醒降临 · 钟鸣扩张并清除近处弹幕');
  });

  it('shows active synergies and previews a synergy completed by an upgrade', () => {
    const root = document.querySelector<HTMLElement>('#hud')!;
    const hud = new HudController(root, callbacks());
    const state = createDefaultState();
    state.player.equippedSkills = ['thunder-ring', 'chain-lightning'];
    state.player.upgradeLevels['thunder-ring'] = 1;
    state.player.upgradeLevels['chain-lightning'] = 1;

    hud.render(state, DEFAULT_GAME_SETTINGS, false);
    expect(root.querySelector('.synergy-strip')?.textContent).toContain('雷狱共鸣');

    state.phase = 'upgrade';
    state.player.equippedSkills = ['fire-burst'];
    state.player.upgradeLevels['fire-burst'] = 1;
    state.upgradeChoices = ['frost-seal'];
    hud.render(state, DEFAULT_GAME_SETTINGS, false);
    expect(root.querySelector('.synergy-preview')?.textContent).toContain('冰火劫');
  });

  it('renders every confirmed setting and sends speed changes', () => {
    const root = document.querySelector<HTMLElement>('#hud')!;
    const handlers = callbacks();
    const hud = new HudController(root, handlers);

    hud.render(createDefaultState(), DEFAULT_GAME_SETTINGS, true);

    expect(root.textContent).toContain('游戏速度');
    expect(root.textContent).toContain('特效强度');
    expect(root.textContent).toContain('摇杆透明度');
    const speed = root.querySelector<HTMLButtonElement>('[data-setting="gameSpeed"][data-value="1.25"]')!;
    speed.click();
    expect(handlers.onChangeSetting).toHaveBeenCalledWith('gameSpeed', 1.25);
  });

  it('forwards the beta passphrase and exposes the unlocked beta entry from the menu', () => {
    const root = document.querySelector<HTMLElement>('#hud')!;
    const handlers = callbacks();
    const hud = new HudController(root, handlers);

    hud.render(createDefaultState(), DEFAULT_GAME_SETTINGS, true);
    const passphrase = root.querySelector<HTMLInputElement>('[data-beta-passphrase]')!;
    expect(passphrase.type).toBe('text');
    expect(passphrase.inputMode).toBe('text');
    passphrase.value = '作者真厉害';
    root.querySelector<HTMLButtonElement>('[data-action="unlock-beta-mode"]')!.click();
    expect(handlers.onUnlockBetaMode).toHaveBeenCalledWith('作者真厉害');

    const menuState = createDefaultState();
    menuState.phase = 'menu';
    hud.render(menuState, { ...DEFAULT_GAME_SETTINGS, betaModeUnlocked: true }, false);
    root.querySelector<HTMLButtonElement>('[data-action="start-beta-mode"]')!.click();
    expect(handlers.onStartBetaMode).toHaveBeenCalled();
  });

  it('puts the language selector on the main menu and renders English copy immediately', () => {
    const root = document.querySelector<HTMLElement>('#hud')!;
    const handlers = callbacks();
    const hud = new HudController(root, handlers);
    const state = createDefaultState();
    state.phase = 'menu';

    hud.render(state, DEFAULT_GAME_SETTINGS, false);
    root.querySelector<HTMLButtonElement>('[data-setting="language"][data-value="en"]')!.click();
    expect(handlers.onChangeSetting).toHaveBeenCalledWith('language', 'en');

    hud.render(state, { ...DEFAULT_GAME_SETTINGS, language: 'en' }, false);
    expect(root.textContent).toContain('Begin Tribulation');
  });

  it('does not leave Chinese labels in the English run summary', () => {
    const root = document.querySelector<HTMLElement>('#hud')!;
    const hud = new HudController(root, callbacks());
    const state = createDefaultState();
    state.phase = 'lost';
    state.player.level = 8;
    state.kills = 42;
    state.bossesDefeated = 1;

    hud.render(state, { ...DEFAULT_GAME_SETTINGS, language: 'en' }, false);

    expect(root.textContent).not.toMatch(/[\u4e00-\u9fff]/);
  });

  it('translates upgrade-card descriptions in English', () => {
    const root = document.querySelector<HTMLElement>('#hud')!;
    const hud = new HudController(root, callbacks());
    const state = createDefaultState();
    state.phase = 'upgrade';
    state.upgradeChoices = ['frost-seal'];

    hud.render(state, { ...DEFAULT_GAME_SETTINGS, language: 'en' }, false);

    const card = root.querySelector<HTMLElement>('[data-upgrade="frost-seal"]')!;
    expect(card.textContent).toContain('Frost Seal');
    expect(card.querySelector('.upgrade-description')?.textContent).toBe('Slow Strength 0% → 12%（+12%）');
  });

  it('translates dynamic progression and tribulation data in English', () => {
    const root = document.querySelector<HTMLElement>('#hud')!;
    const hud = new HudController(root, callbacks());
    const state = createDefaultState();
    const english = { ...DEFAULT_GAME_SETTINGS, language: 'en' } as const;

    state.phase = 'dongfu';
    hud.render(state, english, false);
    expect(root.querySelector('[data-talent="xuan-jian:sword-intent"]')?.textContent).toContain('Sword Intent');

    state.phase = 'tribulation-choice';
    state.tribulation = 'thunder';
    state.tribulationChoices = ['thunder-conduit'];
    hud.render(state, english, false);
    const choice = root.querySelector<HTMLElement>('[data-tribulation-choice="thunder-conduit"]')!;
    expect(choice.textContent).toContain('Thunder Conduit');
    expect(choice.textContent).toContain('All damage +30%.');
  });

  it('translates awakening names and summaries in English', () => {
    const root = document.querySelector<HTMLElement>('#hud')!;
    const hud = new HudController(root, callbacks());
    const state = createDefaultState();
    state.phase = 'awakening';
    state.awakeningNotice = {
      upgrade: 'faster-swords',
      skillName: '疾风飞剑',
      awakeningName: '无间剑域',
      summary: ['攻击间隔额外缩短 40%', '最低攻击间隔降至 120ms'],
    };

    hud.render(state, { ...DEFAULT_GAME_SETTINGS, language: 'en' }, false);

    expect(root.textContent).toContain('Infinite Sword Domain');
    expect(root.textContent).toContain('Attack interval reduced by an additional 40%.');
  });

  it('lets beta players select skills and configure their levels before launch', () => {
    const root = document.querySelector<HTMLElement>('#hud')!;
    const handlers = callbacks();
    const hud = new HudController(root, handlers);
    const state = createDefaultState();
    state.phase = 'beta-loadout';
    state.betaSkillSelections = ['thunder-ring'];
    state.betaSkillLevels['thunder-ring'] = 5;

    hud.render(state, DEFAULT_GAME_SETTINGS, false);
    expect(root.querySelectorAll('[data-beta-skill]')).toHaveLength(15);
    root.querySelector<HTMLButtonElement>('[data-beta-skill="chain-lightning"]')!.click();
    expect(handlers.onToggleBetaSkill).toHaveBeenCalledWith('chain-lightning');
    const level = root.querySelector<HTMLInputElement>('[data-beta-level="thunder-ring"]')!;
    level.value = '6';
    level.dispatchEvent(new Event('input', { bubbles: true }));
    expect(handlers.onSetBetaSkillLevel).toHaveBeenCalledWith('thunder-ring', 6);
    root.querySelector<HTMLButtonElement>('[data-action="launch-beta-mode"]')!.click();
    expect(handlers.onLaunchBetaMode).toHaveBeenCalled();
  });

  it('lets beta players configure an active skill and its level before launch', () => {
    const root = document.querySelector<HTMLElement>('#hud')!;
    const handlers = callbacks();
    const hud = new HudController(root, handlers);
    const state = createDefaultState();
    state.phase = 'beta-loadout';

    hud.render(state, DEFAULT_GAME_SETTINGS, false);

    expect(root.querySelectorAll('[data-beta-active-skill]')).toHaveLength(3);
    root.querySelector<HTMLButtonElement>('[data-beta-active-skill="dimension-step"]')!.click();
    expect(handlers.onSetBetaActiveSkill).toHaveBeenCalledWith('dimension-step');
    const level = root.querySelector<HTMLInputElement>('[data-beta-active-level]')!;
    level.value = '4';
    level.dispatchEvent(new Event('input', { bubbles: true }));
    expect(handlers.onSetBetaActiveSkillLevel).toHaveBeenCalledWith(4);
  });

  it('lets beta players configure the starting timeline before launch', () => {
    const root = document.querySelector<HTMLElement>('#hud')!;
    const handlers = callbacks();
    const hud = new HudController(root, handlers);
    const state = createDefaultState();
    state.phase = 'beta-loadout';

    hud.render(state, DEFAULT_GAME_SETTINGS, false);

    const timeline = root.querySelector<HTMLInputElement>('[data-beta-start-time]')!;
    expect(timeline.max).toBe('30');
    timeline.value = '15';
    timeline.dispatchEvent(new Event('input', { bubbles: true }));
    expect(handlers.onSetBetaStartTime).toHaveBeenCalledWith(15);
  });

  it('keeps beta launch actions in a dedicated footer', () => {
    const root = document.querySelector<HTMLElement>('#hud')!;
    const hud = new HudController(root, callbacks());
    const state = createDefaultState();
    state.phase = 'beta-loadout';

    hud.render(state, DEFAULT_GAME_SETTINGS, false);

    const actions = root.querySelector('.beta-actions');
    expect(actions).not.toBeNull();
    expect(actions!.querySelector('[data-action="launch-beta-mode"]')).not.toBeNull();
    expect(actions!.querySelector('[data-action="close-beta-loadout"]')).not.toBeNull();
  });

  it('renders character choices and sends the selected character', () => {
    const root = document.querySelector<HTMLElement>('#hud')!;
    const handlers = callbacks();
    const hud = new HudController(root, handlers);
    const state = createDefaultState();
    state.phase = 'character-choice';

    hud.render(state, DEFAULT_GAME_SETTINGS, false);
    root.querySelector<HTMLButtonElement>('[data-character="lei-zhuan"]')!.click();

    expect(root.textContent).toContain('玄剑');
    expect(root.textContent).toContain('雷篆');
    expect(root.textContent).toContain('守一');
    expect(handlers.onChooseCharacter).toHaveBeenCalledWith('lei-zhuan');
  });

  it('seals the hidden mirror character until its permanent unlock is stored', () => {
    const root = document.querySelector<HTMLElement>('#hud')!;
    const handlers = callbacks();
    const hud = new HudController(root, handlers);
    const state = createDefaultState();
    state.phase = 'character-choice';

    hud.render(state, DEFAULT_GAME_SETTINGS, false);

    const sealed = root.querySelector<HTMLButtonElement>('[data-character="jing-po"]')!;
    expect(sealed.disabled).toBe(true);
    expect(sealed.textContent).toContain('镜魄');
    expect(sealed.textContent).toContain('破除血祭魔井');
    expect(root.querySelector('.skill-dock')).toBeNull();
    sealed.click();
    expect(handlers.onChooseCharacter).not.toHaveBeenCalled();

    const progression = {
      version: 3,
      daoYun: 0,
      spiritOre: 0,
      relicForgeRanks: {},
      unlockedTalentIds: [],
      unlockedPathNodeIds: [],
      unlockedRelicIds: [],
      equippedRelicIds: [],
      unlockedCharacterIds: ['jing-po'],
    } as MetaProgression;
    hud.render(state, DEFAULT_GAME_SETTINGS, false, progression);

    const unlocked = root.querySelector<HTMLButtonElement>('[data-character="jing-po"]')!;
    expect(unlocked.disabled).toBe(false);
    unlocked.click();
    expect(handlers.onChooseCharacter).toHaveBeenCalledWith('jing-po');
  });

  it('renders two tribulation choices and forwards the selected id', () => {
    const root = document.querySelector<HTMLElement>('#hud')!;
    const handlers = callbacks();
    const hud = new HudController(root, handlers);
    const state = createDefaultState();
    state.phase = 'tribulation-choice';
    state.tribulation = 'frost';
    state.tribulationChoices = ['frost-edge', 'frost-ward'];

    hud.render(state, DEFAULT_GAME_SETTINGS, false);
    root.querySelector<HTMLButtonElement>('[data-tribulation-choice="frost-edge"]')!.click();

    expect(root.textContent).toContain('碎霜剑意');
    expect(root.textContent).toContain('玩家移动速度 -12%');
    expect(root.querySelector('.skill-dock')).toBeNull();
    expect(handlers.onChooseTribulationChoice).toHaveBeenCalledWith('frost-edge');
  });

  it('renders objective route choices and forwards the selected route', () => {
    const root = document.querySelector<HTMLElement>('#hud')!;
    const handlers = callbacks();
    const hud = new HudController(root, handlers);
    const state = createDefaultState();
    state.phase = 'objective-route';
    state.objectiveRoutePendingStep = 2;
    state.objectiveChainRiskLevel = 1;

    hud.render(state, DEFAULT_GAME_SETTINGS, false);
    root.querySelector<HTMLButtonElement>('[data-objective-route="risk"]')!.click();

    expect(root.textContent).toContain('加注劫火');
    expect(root.textContent).toContain('额外获得 2 个宝箱');
    expect(root.querySelector('.skill-dock')).toBeNull();
    expect(handlers.onChooseObjectiveRoute).toHaveBeenCalledWith('risk');
  });

  it('shows objective status and a ranked damage summary', () => {
    const root = document.querySelector<HTMLElement>('#hud')!;
    const hud = new HudController(root, callbacks());
    const state = createDefaultState();
    const objective = new GameSimulation(state).spawnEnemy({
      x: 300,
      y: 300,
      hp: 500,
      speed: 0,
      objectiveKind: 'blood-well',
    });
    state.activeObjectiveId = objective.id;
    state.objectiveExpiresAtMs = 45_000;
    state.runStats.damageBySource.meteor = 1200;
    state.runStats.damageBySource['flying-sword'] = 800;
    state.runStats.bulletsBlocked = 9;

    hud.render(state, DEFAULT_GAME_SETTINGS, false);

    expect(root.textContent).toContain('封印血月魔井');
    state.phase = 'lost';
    hud.render(state, DEFAULT_GAME_SETTINGS, false);
    expect(root.textContent).toContain('伤害排行');
    expect(root.textContent).toContain('天火陨印');
    expect(root.textContent).toContain('弹幕阻挡 9');
  });

  it('shows the active boss arena target below combat status', () => {
    const root = document.querySelector<HTMLElement>('#hud')!;
    const hud = new HudController(root, callbacks());
    const state = createDefaultState();
    const target = new GameSimulation(state).spawnEnemy({ x: 600, y: 360, hp: 580, speed: 0 });
    target.ownerBossId = 8;
    target.bossObjectiveKind = 'storm-pylon';
    state.activeBossObjectiveId = target.id;
    state.bossObjectiveExpiresAtMs = 22_000;

    hud.render(state, DEFAULT_GAME_SETTINGS, false);

    expect(root.querySelector('.boss-objective-status')?.textContent).toContain('引雷天柱');
    expect(root.querySelector('.boss-objective-status')?.textContent).toContain('0:22');
  });

  it('renders the dao-yun balance and unlocks the first available talent', () => {
    const root = document.querySelector<HTMLElement>('#hud')!;
    const handlers = callbacks();
    const hud = new HudController(root, handlers);
    const state = createDefaultState();
    state.phase = 'dongfu';
    state.runDaoYunEarned = 2;
    const progression: MetaProgression = {
      version: 3,
      daoYun: 1,
      spiritOre: 0,
      relicForgeRanks: {},
      unlockedTalentIds: [],
      unlockedPathNodeIds: [],
      unlockedRelicIds: [],
      equippedRelicIds: [],
      unlockedCharacterIds: [],
    };

    hud.render(state, DEFAULT_GAME_SETTINGS, false, progression);

    expect(root.textContent).toContain('道蕴 1');
    expect(root.querySelector('.skill-dock')).toBeNull();
    root.querySelector<HTMLButtonElement>('[data-talent="xuan-jian:sword-intent"]')!.click();
    expect(handlers.onUnlockTalent).toHaveBeenCalledWith('xuan-jian:sword-intent');

    state.phase = 'lost';
    hud.render(state, DEFAULT_GAME_SETTINGS, false, progression);
    expect(root.textContent).toContain('本局道蕴 +2');
  });

  it('shows a completed character relic and lets the player equip it from the dongfu', () => {
    const root = document.querySelector<HTMLElement>('#hud')!;
    const handlers = callbacks();
    const hud = new HudController(root, handlers);
    const state = createDefaultState();
    state.phase = 'dongfu';
    const progression: MetaProgression = {
      version: 3,
      daoYun: 0,
      spiritOre: 0,
      relicForgeRanks: {},
      unlockedTalentIds: ['lei-zhuan:thunder-body', 'lei-zhuan:thunder-field', 'lei-zhuan:spirit-echo'],
      unlockedPathNodeIds: [],
      unlockedRelicIds: ['lei-zhuan:storm-crown'],
      equippedRelicIds: [],
      unlockedCharacterIds: [],
    };

    hud.render(state, DEFAULT_GAME_SETTINGS, false, progression);

    const relic = root.querySelector<HTMLButtonElement>('[data-relic="lei-zhuan:storm-crown"]')!;
    expect(relic.textContent).toContain('引劫雷冠');
    relic.click();
    expect(handlers.onToggleRelic).toHaveBeenCalledWith('lei-zhuan:storm-crown');
  });

  it('shows an equipped relic forge control with its next spirit-ore cost', () => {
    const root = document.querySelector<HTMLElement>('#hud')!;
    const handlers = callbacks();
    const hud = new HudController(root, handlers);
    const state = createDefaultState();
    state.phase = 'dongfu';
    const progression = {
      version: 3 as const,
      daoYun: 0,
      spiritOre: 2,
      relicForgeRanks: {},
      unlockedTalentIds: [],
      unlockedPathNodeIds: [],
      unlockedRelicIds: ['xuan-jian:star-forged-edge'],
      equippedRelicIds: ['xuan-jian:star-forged-edge'],
      unlockedCharacterIds: [],
    } satisfies MetaProgression;

    hud.render(state, DEFAULT_GAME_SETTINGS, false, progression);

    const forge = root.querySelector<HTMLButtonElement>('[data-forge-relic="xuan-jian:star-forged-edge"]')!;
    expect(root.textContent).toContain('灵材 2');
    expect(forge.textContent).toContain('锻造 2');
    forge.click();
    expect(handlers.onForgeRelic).toHaveBeenCalledWith('xuan-jian:star-forged-edge');
  });
});

function callbacks() {
  return {
    onStart: vi.fn(),
    onOpenDongfu: vi.fn(),
    onCloseDongfu: vi.fn(),
    onUnlockTalent: vi.fn(),
    onToggleRelic: vi.fn(),
    onForgeRelic: vi.fn(),
    onChooseCharacter: vi.fn(),
    onChooseTribulationChoice: vi.fn(),
    onChooseObjectiveRoute: vi.fn(),
    onRestart: vi.fn(),
    onChooseActiveSkill: vi.fn(),
    onChooseUpgrade: vi.fn(),
    onChooseTreasure: vi.fn(),
    onConfirmTreasureReplacement: vi.fn(),
    onCancelTreasureReplacement: vi.fn(),
    onOpenSettings: vi.fn(),
    onCloseSettings: vi.fn(),
    onUnlockBetaMode: vi.fn(),
    onStartBetaMode: vi.fn(),
    onToggleBetaSkill: vi.fn(),
    onSetBetaSkillLevel: vi.fn(),
    onSetBetaActiveSkill: vi.fn(),
    onSetBetaActiveSkillLevel: vi.fn(),
    onSetBetaStartTime: vi.fn(),
    onLaunchBetaMode: vi.fn(),
    onCloseBetaLoadout: vi.fn(),
    onChangeSetting: vi.fn(),
    onActivate: vi.fn(),
    onMove: vi.fn(),
  };
}
