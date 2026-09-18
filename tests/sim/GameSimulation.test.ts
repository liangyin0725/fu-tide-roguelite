import { describe, expect, it } from 'vitest';
import { GameSimulation } from '../../src/sim/GameSimulation';
import { createDefaultState } from '../../src/sim/state';
import type { BossHazard } from '../../src/sim/types';
import {
  applyUpgrade,
  createTreasureChoices,
  createUpgradeChoices,
  isInsightChoice,
  UPGRADE_IDS,
} from '../../src/sim/upgrades';
import {
  ENHANCEMENT_IDS,
  getUpgradeMaxLevel,
  SKILL_IDS,
} from '../../src/sim/upgradeCatalog';
import { ARENA_HEIGHT, ARENA_WIDTH, PLAYER_START_X, PLAYER_START_Y } from '../../src/sim/constants';
import { getBossWaveBeforeElapsed } from '../../src/sim/spawnPacing';
import { getAwakeningRequirement } from '../../src/sim/awakening';

describe('GameSimulation', () => {
  it('awards one spirit ore for each ten-minute survival milestone', () => {
    const state = createDefaultState();
    state.elapsedMs = 599_999;
    const sim = new GameSimulation(state);

    sim.update(1, { x: 0, y: 0 });

    const rewards = sim.consumeEvents().filter((event) => event.type === 'spirit-ore-earned');
    expect(rewards).toEqual([expect.objectContaining({
      type: 'spirit-ore-earned',
      source: 'survival',
      amount: 1,
    })]);
  });

  it('uses the expanded arena while preserving the established opening spawn point', () => {
    const state = createDefaultState();

    expect(state.arena).toEqual({ width: 2400, height: 1500 });
    expect(ARENA_WIDTH).toBe(2400);
    expect(ARENA_HEIGHT).toBe(1500);
    expect(state.player).toMatchObject({ x: 480, y: 360 });
    expect(PLAYER_START_X).toBe(480);
    expect(PLAYER_START_Y).toBe(360);
  });

  it('moves the player with normalized input and keeps them inside the arena', () => {
    const sim = new GameSimulation(createDefaultState());

    sim.update(1000, { x: 10, y: 0 });
    sim.update(10000, { x: -1, y: -1 });

    expect(sim.state.player.x).toBeGreaterThanOrEqual(0);
    expect(sim.state.player.y).toBeGreaterThanOrEqual(0);
    expect(sim.state.player.x).toBeLessThanOrEqual(sim.state.arena.width);
    expect(sim.state.player.y).toBeLessThanOrEqual(sim.state.arena.height);
  });

  it('auto-fires at the nearest enemy after the attack cooldown', () => {
    const sim = new GameSimulation(createDefaultState());
    sim.spawnEnemy({ x: 520, y: 360, hp: 12, speed: 0 });
    sim.spawnEnemy({ x: 760, y: 360, hp: 12, speed: 0 });

    sim.update(700, { x: 0, y: 0 });

    expect(sim.state.projectiles).toHaveLength(1);
    expect(sim.state.projectiles[0].targetId).toBe(sim.state.enemies[0].id);
  });

  it('damages the player when an enemy overlaps them', () => {
    const sim = new GameSimulation(createDefaultState());
    sim.spawnEnemy({ x: sim.state.player.x, y: sim.state.player.y, hp: 12, speed: 0 });

    sim.update(250, { x: 0, y: 0 });

    expect(sim.state.player.hp).toBeLessThan(sim.state.player.maxHp);
  });

  it('drops experience when projectiles kill enemies and levels from collected shards', () => {
    const state = createDefaultState();
    state.player.attackDamage = 99;
    const sim = new GameSimulation(state);
    sim.spawnEnemy({ x: 520, y: 360, hp: 5, speed: 0, experience: 10 });

    sim.update(700, { x: 0, y: 0 });
    sim.update(250, { x: 0, y: 0 });
    const shard = sim.state.shards[0];
    sim.state.player.x = shard.x;
    sim.state.player.y = shard.y;
    sim.update(16, { x: 0, y: 0 });

    expect(sim.state.enemies).toHaveLength(0);
    expect(sim.state.player.level).toBe(2);
    expect(sim.state.phase).toBe('upgrade');
    expect(sim.state.upgradeChoices).toHaveLength(3);
  });

  it('applies an upgrade choice and resumes combat', () => {
    const state = createDefaultState();
    state.phase = 'upgrade';
    state.upgradeChoices = ['faster-swords', 'thunder-ring', 'vital-breath'];
    const sim = new GameSimulation(state);

    sim.chooseUpgrade('faster-swords');

    expect(sim.state.phase).toBe('playing');
    expect(sim.state.player.attackCooldownMs).toBe(650);
    expect(sim.state.player.skillCooldownReduction).toBeCloseTo(0.08);
    expect(sim.state.upgradeChoices).toHaveLength(0);
  });

  it('applies a selected tribulation choice to direct damage and clears it at the next stage', () => {
    const state = createDefaultState();
    state.phase = 'tribulation-choice';
    state.elapsedMs = 315_000;
    state.tribulation = 'thunder';
    state.tribulationChoices = ['thunder-conduit', 'thunder-seal'];
    state.nextBossAtMs = 9_999_999;
    state.nextEliteSquadAtMs = 9_999_999;
    state.spawnTimerMs = -100_000;
    state.player.attackDamage = 10;
    const sim = new GameSimulation(state);
    const enemy = sim.spawnEnemy({ x: 520, y: 360, hp: 100, speed: 0 });

    sim.chooseTribulationChoice('thunder-conduit');
    sim.chooseTribulationChoice('blood-pact');
    sim.update(700, { x: 0, y: 0 });
    sim.update(160, { x: 0, y: 0 });

    expect(state.activeTribulationChoiceId).toBe('thunder-conduit');
    expect(state.phase).toBe('playing');
    expect(enemy.hp).toBe(87);

    state.elapsedMs = 599_999;
    sim.update(1, { x: 0, y: 0 });
    expect(state.tribulation).toBe('blood-moon');
    expect(state.activeTribulationChoiceId).toBeNull();
  });

  it('starts with a faster experience curve', () => {
    const state = createDefaultState();
    expect(state.player.experienceToNext).toBe(8);

    state.player.experience = 8;
    const sim = new GameSimulation(state);
    sim.update(16, { x: 0, y: 0 });

    expect(sim.state.player.level).toBe(2);
    expect(sim.state.player.experienceToNext).toBe(13);
  });

  it('switches to the late-game requirement curve when reaching level twelve', () => {
    const state = createDefaultState();
    state.player.level = 11;
    state.player.experienceToNext = 100;
    state.player.experience = 100;
    const sim = new GameSimulation(state);

    sim.update(16, { x: 0, y: 0 });

    expect(sim.state.player.level).toBe(12);
    expect(sim.state.player.experienceToNext).toBe(118);
  });

  it('offers three distinct upgrades from the full ability pool', () => {
    const state = createDefaultState();
    state.player.level = 6;

    const choices = createUpgradeChoices(state);

    expect(UPGRADE_IDS).toHaveLength(28);
    expect(new Set(choices).size).toBe(3);
    expect(choices.every((choice) => !isInsightChoice(choice) && UPGRADE_IDS.includes(choice))).toBe(true);
  });

  it('includes an owned skill and a new skill in normal choices when possible', () => {
    const state = createDefaultState();
    state.player.level = 7;
    state.player.upgradeLevels['faster-swords'] = 2;
    state.player.upgradeLevels['heavier-swords'] = 4;

    const choices = createUpgradeChoices(state);

    expect(choices).toContain('faster-swords');
    expect(choices.some((choice) => !isInsightChoice(choice) && state.player.upgradeLevels[choice] === 0)).toBe(true);
    expect(choices).not.toContain('heavier-swords');
  });

  it('prioritizes level two and three skills in treasure choices', () => {
    const state = createDefaultState();
    state.player.upgradeLevels['faster-swords'] = 3;
    state.player.upgradeLevels['heavier-swords'] = 2;
    state.player.upgradeLevels['multi-swords'] = 1;

    const choices = createTreasureChoices(state);

    expect(choices).toContain('faster-swords');
    expect(choices).toContain('heavier-swords');
    expect(choices).toHaveLength(3);
  });

  it('increments the selected upgrade level', () => {
    const state = createDefaultState();

    applyUpgrade(state, 'multi-swords');

    expect(state.player.upgradeLevels['multi-swords']).toBe(1);
    expect(state.player.projectileCount).toBe(2);
  });

  it('caps enhancements at level four', () => {
    const state = createDefaultState();

    for (let level = 0; level < 6; level += 1) {
      applyUpgrade(state, 'heavier-swords');
    }

    expect(state.player.upgradeLevels['heavier-swords']).toBe(4);
  });

  it('reports an awakening exactly when an upgrade reaches level four', () => {
    const state = createDefaultState();

    const results = Array.from({ length: 5 }, () => applyUpgrade(state, 'faster-swords'));

    expect(results[2]).toEqual({ previousLevel: 2, level: 3, awakened: false });
    expect(results[3]).toEqual({ previousLevel: 3, level: 4, awakened: true });
    expect(results[4]).toEqual({ previousLevel: 4, level: 4, awakened: false });
    expect(state.player.attackCooldownMs).toBe(650);
    expect(state.player.skillCooldownReduction).toBeCloseTo(0.32);
  });

  it('reduces every skill cooldown by eight percent per level without speeding up basic swords', () => {
    const state = createDefaultState();

    applyUpgrade(state, 'meteor-seal');
    for (let level = 0; level < 4; level += 1) {
      applyUpgrade(state, 'faster-swords');
    }

    expect(state.player.attackCooldownMs).toBe(650);
    expect(state.player.meteorCooldownMs).toBeCloseTo(7000 * 0.68);
    expect(state.player.activeCooldownMultiplier).toBeCloseTo(0.68);
  });

  it('applies distinct awakening attributes at each category cap', () => {
    const awaken = (upgrade: (typeof UPGRADE_IDS)[number]) => {
      const state = createDefaultState();
      const requirement = getAwakeningRequirement(upgrade);
      if (requirement) applyUpgrade(state, requirement);
      for (let level = 0; level < getUpgradeMaxLevel(upgrade); level += 1) {
        applyUpgrade(state, upgrade);
      }
      return state.player;
    };

    expect(awaken('chain-lightning').chainLightningTargets).toBe(4);
    expect(awaken('fire-burst')).toMatchObject({ fireBurstChance: 1, fireBurstRadius: 140 });
    expect(awaken('golden-shield').shieldBreakDamage).toBe(80);
    expect(awaken('soul-banner').experienceMultiplier).toBe(1.35);
    expect(awaken('frost-seal').frostFreezeMs).toBe(1000);
    expect(awaken('orbiting-blades')).toMatchObject({
      orbitingBladeCount: 8,
      orbitingBladeDamagePerSecond: 60,
    });
    expect(awaken('meteor-seal')).toMatchObject({ meteorCount: 3, meteorDamage: 105 });
    expect(awaken('boss-slayer').bossDamageMultiplier).toBe(2);
  });

  it('awakens every ability at its category level cap', () => {
    for (const upgrade of UPGRADE_IDS) {
      const state = createDefaultState();
      const requirement = getAwakeningRequirement(upgrade);
      if (requirement) applyUpgrade(state, requirement);
      let result;
      const maxLevel = getUpgradeMaxLevel(upgrade);
      for (let level = 0; level < maxLevel; level += 1) {
        result = applyUpgrade(state, upgrade);
      }
      expect(result?.awakened, upgrade).toBe(true);
      expect(state.player.upgradeLevels[upgrade], upgrade).toBe(maxLevel);
    }
  });

  it('fires a radial north-star volley on its configured timer', () => {
    const state = createDefaultState();
    applyUpgrade(state, 'north-star');
    state.player.attackCooldownMs = 99_999;
    const sim = new GameSimulation(state);

    sim.update(6000, { x: 0, y: 0 });

    expect(sim.state.projectiles).toHaveLength(8);
    expect(sim.consumeEvents()).toContainEqual(expect.objectContaining({ type: 'star-volley' }));
  });

  it('keeps north-star in its awakened double-volley form on every later cast', () => {
    const state = createDefaultState();
    for (let level = 0; level < 6; level += 1) applyUpgrade(state, 'north-star');
    state.player.attackCooldownMs = 99_999;
    const sim = new GameSimulation(state);

    sim.update(3800, { x: 0, y: 0 });

    expect(sim.state.projectiles.filter((projectile) => projectile.kind === 'star')).toHaveLength(16);
    expect(sim.consumeEvents()).toContainEqual(expect.objectContaining({
      type: 'star-volley', count: 16, awakened: true,
    }));
  });

  it('pauses combat and elapsed time for the awakening notice', () => {
    const state = createDefaultState();
    state.phase = 'upgrade';
    state.upgradeChoices = ['faster-swords'];
    state.player.upgradeLevels['faster-swords'] = 3;
    const sim = new GameSimulation(state);

    sim.chooseUpgrade('faster-swords');

    expect(sim.state.phase).toBe('awakening');
    expect(sim.state.awakeningRemainingMs).toBe(1500);
    expect(sim.state.awakeningNotice?.upgrade).toBe('faster-swords');
    expect(sim.consumeEvents()).toContainEqual(expect.objectContaining({
      type: 'skill-awakened',
      upgrade: 'faster-swords',
    }));

    sim.update(1000, { x: 1, y: 0 });
    expect(sim.state.elapsedMs).toBe(0);
    expect(sim.state.awakeningRemainingMs).toBe(500);

    sim.update(500, { x: 1, y: 0 });
    expect(sim.state.phase).toBe('playing');
    expect(sim.state.elapsedMs).toBe(0);
  });

  it('regenerates health during active combat', () => {
    const state = createDefaultState();
    state.player.hp = 50;
    state.player.hpRegenPerSecond = 2.5;
    const sim = new GameSimulation(state);

    sim.update(2000, { x: 0, y: 0 });

    expect(sim.state.player.hp).toBe(55);
  });

  it('uses deterministic dodge chance against contact damage', () => {
    const state = createDefaultState();
    state.player.dodgeChance = 1;
    const sim = new GameSimulation(state);
    sim.spawnEnemy({ x: state.player.x, y: state.player.y, speed: 0 });

    sim.update(16, { x: 0, y: 0 });

    expect(sim.state.player.hp).toBe(state.player.maxHp);
    expect(sim.consumeEvents().some((event) => event.type === 'dodge')).toBe(true);
  });

  it('freezes a normal enemy after an awakened frost projectile hit', () => {
    const state = createDefaultState();
    state.player.frostSlowPercent = 0.3;
    state.player.frostFreezeMs = 1000;
    const sim = new GameSimulation(state);
    const enemy = sim.spawnEnemy({ x: 520, y: 360, hp: 100, speed: 0 });

    sim.update(700, { x: 0, y: 0 });
    sim.update(160, { x: 0, y: 0 });
    enemy.speed = 100;
    const frozenX = enemy.x;
    sim.update(500, { x: 0, y: 0 });

    expect(enemy.freezeUntilMs).toBeGreaterThan(860);
    expect(enemy.x).toBe(frozenX);
  });

  it('damages nearby enemies with awakened orbiting blades', () => {
    const state = createDefaultState();
    state.player.attackCooldownMs = 99_999;
    state.player.orbitingBladeCount = 6;
    state.player.orbitingBladeRadius = 82;
    state.player.orbitingBladeDamagePerSecond = 48;
    const sim = new GameSimulation(state);
    const enemy = sim.spawnEnemy({ x: state.player.x + 70, y: state.player.y, hp: 100, speed: 0 });

    sim.update(1000, { x: 0, y: 0 });

    expect(enemy.hp).toBe(52);
  });

  it('lets each awakened glyph fire a reinforced bolt every 0.9 seconds', () => {
    const state = createDefaultState();
    state.player.attackCooldownMs = 99_999;
    state.player.equippedSkills = ['thunder-ring', 'fire-burst'];
    state.player.upgradeLevels['thunder-ring'] = 6;
    state.player.upgradeLevels['fire-burst'] = 6;
    const sim = new GameSimulation(state);
    sim.spawnEnemy({ x: state.player.x + 240, y: state.player.y, hp: 300, speed: 0 });

    sim.update(900, { x: 0, y: 0 });

    const glyphProjectiles = sim.state.projectiles.filter((projectile) => projectile.source === 'glyph');
    expect(glyphProjectiles).toHaveLength(2);
    expect(glyphProjectiles).toEqual(expect.arrayContaining([
      expect.objectContaining({ damage: 18 * 0.95, pierceRemaining: 2, radius: 5 }),
    ]));
    expect(sim.consumeEvents()).toContainEqual(expect.objectContaining({
      type: 'glyph-volley',
      count: 2,
      ritual: 'bolt',
      formation: 'stormfire',
    }));
  });

  it('does not create glyph attacks until a skill is awakened', () => {
    const state = createDefaultState();
    state.player.attackCooldownMs = 99_999;
    state.player.equippedSkills = ['thunder-ring'];
    state.player.upgradeLevels['thunder-ring'] = 5;
    const sim = new GameSimulation(state);
    sim.spawnEnemy({ x: state.player.x + 240, y: state.player.y, hp: 300, speed: 0 });

    sim.update(2800, { x: 0, y: 0 });

    expect(sim.state.projectiles.filter((projectile) => projectile.source === 'glyph')).toHaveLength(0);
  });

  it('turns every second awakened glyph volley into a control ritual', () => {
    const state = createDefaultState();
    state.player.attackCooldownMs = 99_999;
    state.player.equippedSkills = ['frost-seal'];
    state.player.upgradeLevels['frost-seal'] = 6;
    const sim = new GameSimulation(state);
    sim.spawnEnemy({ x: state.player.x + 180, y: state.player.y, hp: 300, speed: 0 });

    sim.update(1800, { x: 0, y: 0 });

    expect(sim.consumeEvents()).toContainEqual(expect.objectContaining({
      type: 'glyph-volley',
      count: 1,
      ritual: 'control',
    }));
  });

  it('uses the frostbind formation to bind nearby enemies on a glyph ritual', () => {
    const state = createDefaultState();
    state.player.attackCooldownMs = 99_999;
    state.player.equippedSkills = ['frost-seal', 'soul-pin'];
    state.player.upgradeLevels['frost-seal'] = 6;
    state.player.upgradeLevels['soul-pin'] = 6;
    const sim = new GameSimulation(state);
    sim.spawnEnemy({ x: state.player.x + 160, y: state.player.y, hp: 300, speed: 0 });
    sim.spawnEnemy({ x: state.player.x + 220, y: state.player.y + 12, hp: 300, speed: 0 });

    sim.update(4200, { x: 0, y: 0 });

    expect(sim.consumeEvents()).toContainEqual(expect.objectContaining({
      type: 'glyph-volley',
      formation: 'frostbind',
      ritual: 'control',
    }));
    expect(state.enemies.filter((enemy) => enemy.freezeUntilMs > state.elapsedMs).length).toBeGreaterThanOrEqual(2);
  });

  it('strikes three distinct targets with awakened meteors', () => {
    const state = createDefaultState();
    state.player.attackCooldownMs = 99_999;
    state.player.meteorCooldownMs = 100;
    state.player.meteorCount = 3;
    state.player.meteorDamage = 90;
    const sim = new GameSimulation(state);
    for (let index = 0; index < 4; index += 1) {
      sim.spawnEnemy({ x: 600 + index * 30, y: 360, hp: 100, speed: 0 });
    }

    sim.update(100, { x: 0, y: 0 });

    expect(sim.state.enemies.filter((enemy) => enemy.hp === 10)).toHaveLength(3);
    expect(sim.consumeEvents().filter((event) => event.type === 'meteor-strike')).toHaveLength(3);
  });

  it('multiplies all direct sword damage against bosses', () => {
    const state = createDefaultState();
    state.player.attackDamage = 10;
    state.player.bossDamageMultiplier = 2;
    const sim = new GameSimulation(state);
    const boss = sim.spawnEnemy({
      x: 520,
      y: 360,
      hp: 100,
      speed: 0,
      kind: 'boss',
      bossWave: 1,
    });

    sim.update(700, { x: 0, y: 0 });
    sim.update(160, { x: 0, y: 0 });

    expect(boss.hp).toBe(80);
  });

  it('fires the configured number of swords', () => {
    const state = createDefaultState();
    state.player.projectileCount = 3;
    const sim = new GameSimulation(state);
    sim.spawnEnemy({ x: 520, y: 360, hp: 100, speed: 0 });

    sim.update(700, { x: 0, y: 0 });

    expect(sim.state.projectiles).toHaveLength(3);
  });

  it('lets a piercing sword damage enemies along its path', () => {
    const state = createDefaultState();
    state.player.projectilePierce = 1;
    const sim = new GameSimulation(state);
    sim.spawnEnemy({ x: 520, y: 360, hp: 100, speed: 0 });
    sim.spawnEnemy({ x: 560, y: 360, hp: 100, speed: 0 });

    sim.update(700, { x: 0, y: 0 });
    sim.update(160, { x: 0, y: 0 });

    expect(sim.state.enemies[0].hp).toBeLessThan(100);
    expect(sim.state.enemies[1].hp).toBeLessThan(100);
  });

  it('uses shield before health when contact damage lands', () => {
    const state = createDefaultState();
    state.player.shield = 20;
    state.player.maxShield = 20;
    const sim = new GameSimulation(state);
    sim.spawnEnemy({ x: state.player.x, y: state.player.y, hp: 100, speed: 0 });

    sim.update(16, { x: 0, y: 0 });

    expect(sim.state.player.shield).toBe(11);
    expect(sim.state.player.hp).toBe(state.player.maxHp);
  });

  it('does not heal on kill when life-drain fails its chance roll', () => {
    const state = createDefaultState();
    state.player.lifeOnKill = 3;
    state.player.lifeOnKillChance = 0;
    state.player.hp = 90;
    state.player.attackDamage = 99;
    const sim = new GameSimulation(state);
    sim.spawnEnemy({ x: 520, y: 360, hp: 5, speed: 0 });

    sim.update(700, { x: 0, y: 0 });
    sim.update(100, { x: 0, y: 0 });

    expect(sim.state.enemies).toHaveLength(0);
    expect(sim.state.player.hp).toBe(90);
    expect(sim.consumeEvents().some((event) => event.type === 'player-healed')).toBe(false);
  });

  it('occasionally restores only a small amount of health through life-drain', () => {
    const state = createDefaultState();
    state.player.lifeOnKill = 3;
    state.player.lifeOnKillChance = 1;
    state.player.hp = 90;
    state.player.attackDamage = 99;
    const sim = new GameSimulation(state);
    sim.spawnEnemy({ x: 520, y: 360, hp: 5, speed: 0 });

    sim.update(700, { x: 0, y: 0 });
    sim.update(100, { x: 0, y: 0 });

    expect(sim.state.player.hp).toBe(93);
    expect(sim.consumeEvents()).toContainEqual({
      type: 'player-healed',
      x: state.player.x,
      y: state.player.y,
      amount: 3,
      source: 'life-drain',
    });
  });

  it('enters and leaves siege pressure as nearby enemy density changes', () => {
    const state = createDefaultState();
    const sim = new GameSimulation(state);
    for (let index = 0; index < 6; index += 1) {
      const angle = index * Math.PI / 3;
      sim.spawnEnemy({
        x: state.player.x + Math.cos(angle) * 120,
        y: state.player.y + Math.sin(angle) * 120,
        hp: 100,
        speed: 0,
        damage: 0,
      });
    }

    sim.update(16, { x: 0, y: 0 });

    expect(state.siegeActive).toBe(true);
    expect(state.siegeEnemyCount).toBe(6);
    expect(sim.consumeEvents()).toContainEqual({
      type: 'siege-pressure',
      x: state.player.x,
      y: state.player.y,
      enemyCount: 6,
    });

    state.enemies.splice(0, 3);
    sim.update(16, { x: 0, y: 0 });

    expect(state.siegeActive).toBe(false);
    expect(state.siegeEnemyCount).toBe(3);
  });

  it('publishes combat events once', () => {
    const sim = new GameSimulation(createDefaultState());
    sim.spawnEnemy({ x: 520, y: 360, hp: 100, speed: 0 });

    sim.update(700, { x: 0, y: 0 });

    expect(sim.consumeEvents().some((event) => event.type === 'projectile-fired')).toBe(true);
    expect(sim.consumeEvents()).toEqual([]);
  });

  it('chain lightning damages a nearby enemy but not a distant enemy', () => {
    const state = createDefaultState();
    state.player.chainLightningDamage = 12;
    const sim = new GameSimulation(state);
    sim.spawnEnemy({ x: 520, y: 360, hp: 100, speed: 0 });
    sim.spawnEnemy({ x: 560, y: 360, hp: 100, speed: 0 });
    sim.spawnEnemy({ x: 900, y: 360, hp: 100, speed: 0 });

    sim.update(700, { x: 0, y: 0 });
    sim.update(160, { x: 0, y: 0 });

    expect(sim.state.enemies[1].hp).toBeLessThan(100);
    expect(sim.state.enemies[2].hp).toBe(100);
  });

  it('fire burst damages enemies inside the blast radius', () => {
    const state = createDefaultState();
    state.player.fireBurstDamage = 20;
    state.player.fireBurstChance = 1;
    const sim = new GameSimulation(state);
    sim.spawnEnemy({ x: 520, y: 360, hp: 100, speed: 0 });
    sim.spawnEnemy({ x: 570, y: 360, hp: 100, speed: 0 });
    sim.spawnEnemy({ x: 900, y: 360, hp: 100, speed: 0 });

    sim.update(700, { x: 0, y: 0 });
    sim.update(160, { x: 0, y: 0 });

    expect(sim.state.enemies[1].hp).toBeLessThan(100);
    expect(sim.state.enemies[2].hp).toBe(100);
  });

  it('keeps playing and spawns bosses at five-minute boundaries', () => {
    const sim = new GameSimulation(createDefaultState());

    sim.update(300_000, { x: 0, y: 0 });

    expect(sim.state.phase).toBe('playing');
    expect(sim.state.enemies.filter((enemy) => enemy.kind === 'boss')).toHaveLength(1);
    expect(sim.consumeEvents().some((event) => event.type === 'boss-spawned')).toBe(true);

    sim.update(1, { x: 0, y: 0 });
    expect(sim.state.enemies.filter((enemy) => enemy.kind === 'boss')).toHaveLength(1);

    sim.update(299_999, { x: 0, y: 0 });
    expect(sim.state.enemies.filter((enemy) => enemy.kind === 'boss')).toHaveLength(2);
  });

  it('allows a slightly larger normal enemy crowd', () => {
    const state = createDefaultState();
    const sim = new GameSimulation(state);
    for (let index = 0; index < 150; index += 1) {
      sim.spawnEnemy({ x: 20, y: 20, hp: 9999, speed: 0, damage: 0 });
    }
    state.spawnTimerMs = 10_000;

    sim.update(16, { x: 0, y: 0 });

    expect(state.enemies.filter((enemy) => enemy.kind === 'normal').length).toBe(154);
  });

  it('emits exactly one dao-yun reward when a boss dies', () => {
    const state = createDefaultState();
    const sim = new GameSimulation(state);
    const boss = sim.spawnEnemy({
      x: 400,
      y: 300,
      hp: 1,
      speed: 0,
      kind: 'boss',
      bossWave: 1,
    });
    boss.hp = 0;

    sim.update(16, { x: 0, y: 0 });

    expect(sim.consumeEvents().filter((event) => event.type === 'dao-yun-earned')).toEqual([
      expect.objectContaining({ amount: 1, wave: 1 }),
    ]);
  });

  it('catches up every missed boss cycle', () => {
    const sim = new GameSimulation(createDefaultState());

    sim.update(900_000, { x: 0, y: 0 });

    expect(sim.state.enemies.filter((enemy) => enemy.kind === 'boss')).toHaveLength(3);
    expect(sim.state.bossWave).toBe(3);
    expect(sim.state.nextBossAtMs).toBe(1_200_000);
  });

  it('spawns bosses in the fixed three-type rotation', () => {
    const sim = new GameSimulation(createDefaultState());

    sim.update(900_000, { x: 0, y: 0 });

    expect(sim.state.enemies
      .filter((enemy) => enemy.kind === 'boss')
      .map((enemy) => enemy.bossType)).toEqual(['crimson', 'thunder', 'blood-moon']);
  });

  it('derives the preceding boss wave for a test-run timeline jump', () => {
    expect(getBossWaveBeforeElapsed(0)).toBe(0);
    expect(getBossWaveBeforeElapsed(300_000)).toBe(0);
    expect(getBossWaveBeforeElapsed(600_000)).toBe(1);
    expect(getBossWaveBeforeElapsed(900_000)).toBe(2);
  });

  it('enters boss phase two at 65% and a final phase at 30% health', () => {
    const sim = new GameSimulation(createDefaultState());
    const boss = sim.spawnEnemy({
      x: 900,
      y: 600,
      hp: 100,
      speed: 0,
      kind: 'boss',
      bossWave: 1,
    });
    boss.hp = 65;

    sim.update(16, { x: 0, y: 0 });
    sim.update(16, { x: 0, y: 0 });

    expect(boss.bossPhase).toBe(2);
    expect(sim.consumeEvents().filter((event) => event.type === 'boss-phase-changed')).toHaveLength(1);

    boss.hp = 30;
    sim.update(16, { x: 0, y: 0 });

    expect(boss.bossPhase).toBe(3);
    expect(sim.consumeEvents().filter((event) => event.type === 'boss-phase-changed')).toHaveLength(1);
  });

  it('spawns one arena target when a boss reaches phase two', () => {
    const state = createDefaultState();
    state.nextBossAtMs = 9_999_999;
    const sim = new GameSimulation(state);
    const boss = sim.spawnEnemy({
      x: 700, y: 360, hp: 100, speed: 0, kind: 'boss', bossWave: 1, bossType: 'crimson',
    });
    boss.hp = 50;

    sim.update(16, { x: 0, y: 0 });

    const target = state.enemies.find((enemy) => enemy.id === state.activeBossObjectiveId);
    expect(target).toMatchObject({ bossObjectiveKind: 'crimson-anchor', ownerBossId: boss.id, speed: 0, hp: 450 });
    expect(state.bossObjectiveExpiresAtMs).toBe(state.elapsedMs + 22_000);
    sim.update(6_000, { x: 0, y: 0 });
    expect(state.enemyProjectiles).toHaveLength(0);
  });

  it('stuns and exposes the boss when its arena target is destroyed', () => {
    const state = createDefaultState();
    state.nextBossAtMs = 9_999_999;
    const sim = new GameSimulation(state);
    const boss = sim.spawnEnemy({
      x: 700, y: 360, hp: 100, speed: 0, kind: 'boss', bossWave: 1, bossType: 'thunder',
    });
    boss.hp = 50;
    sim.update(16, { x: 0, y: 0 });
    state.enemies.find((enemy) => enemy.id === state.activeBossObjectiveId)!.hp = 0;

    sim.update(16, { x: 0, y: 0 });

    expect(boss.bossArenaStunnedUntilMs).toBe(state.elapsedMs + 4000);
    expect(boss.bossArenaVulnerableUntilMs).toBe(state.elapsedMs + 10_000);
    expect(state.activeBossObjectiveId).toBeNull();
  });

  it('interrupts a boss cast when its break target is destroyed during the telegraph', () => {
    const state = createDefaultState();
    state.nextBossAtMs = 9_999_999;
    state.player.attackDamage = 0;
    const sim = new GameSimulation(state);
    const boss = sim.spawnEnemy({
      x: 700, y: 360, hp: 500, speed: 0, kind: 'boss', bossWave: 1, bossType: 'crimson',
    });

    sim.update(7_000, { x: 0, y: 0 });
    const target = state.enemies.find((enemy) => enemy.bossBreakOwnerId === boss.id);
    expect(target).toMatchObject({ speed: 0, hp: 130, radius: 24 });
    expect(state.bossHazards.length).toBeGreaterThan(0);

    target!.hp = 0;
    sim.update(16, { x: 0, y: 0 });

    expect(boss.bossArenaStunnedUntilMs).toBe(state.elapsedMs + 3_000);
    expect(boss.bossArenaVulnerableUntilMs).toBe(state.elapsedMs + 8_000);
    expect(state.bossHazards).toHaveLength(0);
    expect(sim.consumeEvents()).toContainEqual(expect.objectContaining({ type: 'boss-break-resolved', success: true }));
  });

  it('unlocks the hidden character only after resolving a blood moon boss well and defeating its owner', () => {
    const state = createDefaultState();
    state.nextBossAtMs = 9_999_999;
    const sim = new GameSimulation(state);
    const boss = sim.spawnEnemy({
      x: 700, y: 360, hp: 100, speed: 0, kind: 'boss', bossWave: 3, bossType: 'blood-moon',
    });
    boss.hp = 50;
    sim.update(16, { x: 0, y: 0 });
    state.enemies.find((enemy) => enemy.id === state.activeBossObjectiveId)!.hp = 0;
    sim.update(16, { x: 0, y: 0 });
    boss.hp = 0;
    sim.update(16, { x: 0, y: 0 });

    expect(sim.consumeEvents()).toContainEqual(expect.objectContaining({
      type: 'hidden-character-unlocked',
      character: 'jing-po',
    }));
  });

  it('applies active boss hazards through shield and invulnerability', () => {
    const state = createDefaultState();
    state.player.shield = 6;
    state.player.maxShield = 6;
    state.bossHazards.push({
      id: 100,
      ownerBossId: 50,
      bossType: 'thunder',
      kind: 'circle',
      x: state.player.x,
      y: state.player.y,
      endX: state.player.x,
      endY: state.player.y,
      radius: 54,
      startRadius: 0,
      endRadius: 54,
      bandWidth: 0,
      lineWidth: 0,
      telegraphRemainingMs: 0,
      activeRemainingMs: 100,
      activeDurationMs: 100,
      damageMultiplier: 1,
      hasDamagedPlayer: false,
    });
    const sim = new GameSimulation(state);
    sim.spawnEnemy({
      x: 900,
      y: 600,
      hp: 100,
      speed: 0,
      damage: 10,
      kind: 'boss',
      bossWave: 2,
      bossType: 'thunder',
    }).id = 50;

    sim.update(16, { x: 0, y: 0 });
    sim.update(16, { x: 0, y: 0 });

    expect(sim.state.player.shield).toBe(0);
    expect(sim.state.player.hp).toBe(96);
    expect(sim.state.bossHazards[0].hasDamagedPlayer).toBe(true);
  });

  it('lets deterministic dodge avoid an active boss hazard', () => {
    const state = createDefaultState();
    state.player.dodgeChance = 1;
    state.bossHazards.push({
      id: 100,
      ownerBossId: 50,
      bossType: 'thunder',
      kind: 'circle',
      x: state.player.x,
      y: state.player.y,
      endX: state.player.x,
      endY: state.player.y,
      radius: 54,
      startRadius: 0,
      endRadius: 54,
      bandWidth: 0,
      lineWidth: 0,
      telegraphRemainingMs: 0,
      activeRemainingMs: 100,
      activeDurationMs: 100,
      damageMultiplier: 1,
      hasDamagedPlayer: false,
    });
    const sim = new GameSimulation(state);
    sim.spawnEnemy({
      x: 900,
      y: 600,
      hp: 100,
      speed: 0,
      damage: 10,
      kind: 'boss',
      bossWave: 2,
      bossType: 'thunder',
    }).id = 50;

    sim.update(16, { x: 0, y: 0 });

    expect(sim.state.player.hp).toBe(100);
    expect(sim.consumeEvents().some((event) => event.type === 'dodge')).toBe(true);
  });

  it('clears unresolved hazards when a boss changes phase', () => {
    const state = createDefaultState();
    const sim = new GameSimulation(state);
    const boss = sim.spawnEnemy({
      x: 900,
      y: 600,
      hp: 100,
      speed: 0,
      kind: 'boss',
      bossWave: 1,
    });
    state.bossHazards.push(makeTestHazard(boss.id, 'crimson', state.player.x, state.player.y));
    boss.hp = 50;

    sim.update(16, { x: 0, y: 0 });

    expect(state.bossHazards).toHaveLength(0);
  });

  it('heals the blood-moon boss after a seal successfully hits', () => {
    const state = createDefaultState();
    const sim = new GameSimulation(state);
    const boss = sim.spawnEnemy({
      x: 900,
      y: 600,
      hp: 100,
      speed: 0,
      damage: 10,
      kind: 'boss',
      bossWave: 3,
      bossType: 'blood-moon',
    });
    boss.hp = 60;
    boss.bossPhase = 2;
    const hazard = makeTestHazard(boss.id, 'blood-moon', state.player.x, state.player.y);
    hazard.healBossFraction = 0.04;
    state.bossHazards.push(hazard);

    sim.update(16, { x: 0, y: 0 });

    expect(boss.hp).toBe(64);
    expect(sim.consumeEvents().some((event) => event.type === 'boss-healed')).toBe(true);
  });

  it('counts a defeated boss', () => {
    const state = createDefaultState();
    state.elapsedMs = 299_999;
    const sim = new GameSimulation(state);
    sim.update(1, { x: 0, y: 0 });
    const boss = sim.state.enemies.find((enemy) => enemy.kind === 'boss');
    expect(boss).toBeDefined();

    boss!.hp = 0;
    sim.update(16, { x: 0, y: 0 });

    expect(sim.state.bossesDefeated).toBe(1);
  });

  it('drops one chest and twelve shards with the exact boss reward total', () => {
    const state = createDefaultState();
    const sim = new GameSimulation(state);
    const boss = sim.spawnEnemy({
      x: 900,
      y: 600,
      hp: 1,
      speed: 0,
      kind: 'boss',
      bossWave: 2,
      experience: 999,
    });
    boss.hp = 0;

    sim.update(16, { x: 0, y: 0 });

    expect(sim.state.chests).toHaveLength(1);
    expect(sim.state.chests[0].wave).toBe(2);
    expect(sim.state.shards).toHaveLength(12);
    expect(sim.state.shards.reduce((total, shard) => total + shard.value, 0)).toBe(160);
    expect(sim.consumeEvents()).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'chest-dropped', wave: 2 }),
      expect.objectContaining({ type: 'spirit-ore-earned', source: 'boss', amount: 1 }),
      expect.objectContaining({ type: 'boss-reward-burst', wave: 2, experience: 160 }),
    ]));
  });

  it('opens a nearby chest and offers treasure choices', () => {
    const state = createDefaultState();
    const sim = new GameSimulation(state);
    const boss = sim.spawnEnemy({
      x: 900,
      y: 600,
      hp: 0,
      speed: 0,
      kind: 'boss',
      bossWave: 1,
    });

    sim.update(16, { x: 0, y: 0 });
    state.player.x = boss.x;
    state.player.y = boss.y;
    sim.update(16, { x: 0, y: 0 });

    expect(sim.state.phase).toBe('treasure');
    expect(sim.state.chests).toHaveLength(0);
    expect(sim.state.treasureChoices).toHaveLength(3);
    expect(sim.state.treasureWave).toBe(1);

    const choice = sim.state.treasureChoices[0];
    sim.chooseTreasure(choice);
    expect(sim.state.player.upgradeLevels[choice]).toBe(1);
    expect(sim.state.phase).toBe('playing');
  });

  it('can awaken a level-five skill from a boss treasure', () => {
    const state = createDefaultState();
    applyUpgrade(state, 'boss-slayer');
    state.player.experienceToNext = 1_000_000;
    for (const upgrade of UPGRADE_IDS) state.player.upgradeLevels[upgrade] = getUpgradeMaxLevel(upgrade);
    state.player.upgradeLevels['meteor-seal'] = 5;
    state.player.equippedSkills = ['meteor-seal'];
    const sim = new GameSimulation(state);
    sim.spawnEnemy({
      x: state.player.x,
      y: state.player.y,
      hp: 0,
      speed: 0,
      damage: 0,
      kind: 'boss',
      bossWave: 1,
    });

    sim.update(16, { x: 0, y: 0 });
    expect(sim.state.phase).toBe('treasure');
    expect(sim.state.treasureChoices).toEqual(['meteor-seal']);

    sim.chooseTreasure('meteor-seal');
    expect(sim.state.phase).toBe('awakening');
    expect(sim.state.awakeningNotice?.upgrade).toBe('meteor-seal');
  });

  it('waits for an explicit slot before replacing a full skill loadout', () => {
    const state = createDefaultState();
    state.player.equippedSkills = SKILL_IDS.slice(0, 5);
    for (const id of state.player.equippedSkills) state.player.upgradeLevels[id] = 1;
    const replacement = SKILL_IDS[5];
    const removed = state.player.equippedSkills[1];
    state.phase = 'treasure';
    state.treasureChoices = [replacement];
    const sim = new GameSimulation(state);

    sim.chooseTreasure(replacement);
    expect(state.phase).toBe('treasure-replace');
    expect(state.player.equippedSkills).not.toContain(replacement);

    sim.confirmTreasureReplacement(1);
    expect(state.player.equippedSkills[1]).toBe(replacement);
    expect(state.player.upgradeLevels[replacement]).toBe(1);
    expect(state.player.upgradeLevels[removed]).toBe(0);
    expect(state.phase).toBe('playing');
  });

  it('can cancel a pending treasure replacement', () => {
    const state = createDefaultState();
    state.player.equippedSkills = SKILL_IDS.slice(0, 5);
    for (const id of state.player.equippedSkills) state.player.upgradeLevels[id] = 1;
    state.phase = 'treasure';
    state.treasureChoices = [SKILL_IDS[5]];
    const sim = new GameSimulation(state);

    sim.chooseTreasure(SKILL_IDS[5]);
    sim.cancelTreasureReplacement();

    expect(state.phase).toBe('treasure');
    expect(state.pendingTreasureUpgrade).toBeNull();
  });

  it('converts treasure to vitality when all skills are maxed', () => {
    const state = createDefaultState();
    state.player.experienceToNext = 1_000_000;
    for (const upgrade of UPGRADE_IDS) state.player.upgradeLevels[upgrade] = getUpgradeMaxLevel(upgrade);
    state.player.equippedSkills = [...SKILL_IDS.slice(0, 5)];
    state.player.equippedEnhancements = [...ENHANCEMENT_IDS.slice(0, 6)];
    state.player.hp = 10;
    state.player.maxShield = 50;
    state.player.shield = 0;
    const previousMaxHp = state.player.maxHp;
    const sim = new GameSimulation(state);
    sim.spawnEnemy({
      x: state.player.x,
      y: state.player.y,
      hp: 0,
      speed: 0,
      damage: 0,
      kind: 'boss',
      bossWave: 1,
    });

    sim.update(16, { x: 0, y: 0 });

    expect(sim.state.phase).toBe('playing');
    expect(sim.state.player.maxHp).toBe(previousMaxHp + 25);
    expect(sim.state.player.hp).toBe(sim.state.player.maxHp);
    expect(sim.state.player.shield).toBe(sim.state.player.maxShield);
  });

  it('does not spawn more normal enemies above the population cap', () => {
    const sim = new GameSimulation(createDefaultState());
    for (let index = 0; index < 160; index += 1) {
      sim.spawnEnemy({ x: 1000 + index, y: 900, hp: 100, speed: 0 });
    }

    sim.update(10_000, { x: 0, y: 0 });

    expect(sim.state.enemies.filter((enemy) => enemy.kind === 'normal')).toHaveLength(160);
  });
});

function makeTestHazard(
  ownerBossId: number,
  bossType: 'crimson' | 'thunder' | 'blood-moon',
  x: number,
  y: number,
): BossHazard {
  return {
    id: 10_000,
    ownerBossId,
    bossType,
    kind: 'circle' as const,
    x,
    y,
    endX: x,
    endY: y,
    radius: 54,
    startRadius: 0,
    endRadius: 54,
    bandWidth: 0,
    lineWidth: 0,
    telegraphRemainingMs: 0,
    activeRemainingMs: 100,
    activeDurationMs: 100,
    damageMultiplier: 1,
    hasDamagedPlayer: false,
  };
}
