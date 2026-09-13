import { describe, expect, it } from 'vitest';
import { GameSimulation } from '../../src/sim/GameSimulation';
import { createDefaultState } from '../../src/sim/state';
import { ARENA_HEIGHT, ARENA_WIDTH } from '../../src/sim/constants';
import { createUpgradeChoices } from '../../src/sim/upgrades';

describe('local co-op state', () => {
  it('adds a second player and targets the nearest living player in co-op mode', () => {
    const state = createDefaultState();
    const sim = new GameSimulation(state);

    sim.enableLocalCoop();

    expect(state.coopEnabled).toBe(true);
    expect(state.partner).toMatchObject({ id: 'p2', downed: false });
    const target = sim.getNearestLivingPlayer({ x: state.partner!.x + 10, y: state.partner!.y });
    expect(target?.id).toBe('p2');
  });

  it('expands only the co-op battlefield', () => {
    const state = createDefaultState();
    const sim = new GameSimulation(state);

    sim.enableLocalCoop();

    expect(state.arena).toEqual({ width: 3600, height: 2250 });
    expect(ARENA_WIDTH).toBe(2400);
    expect(ARENA_HEIGHT).toBe(1500);
  });

  it('limits each co-op player to four skills and four enhancements with distinct choices', () => {
    const state = createDefaultState();
    const sim = new GameSimulation(state);
    sim.enableLocalCoop();
    const playerOneChoices = createUpgradeChoices(state, state.player);
    const playerTwoChoices = createUpgradeChoices(state, state.partner!, playerOneChoices);

    expect(state.player.skillSlotLimit).toBe(4);
    expect(state.player.enhancementSlotLimit).toBe(4);
    expect(state.partner).toMatchObject({ skillSlotLimit: 4, enhancementSlotLimit: 4 });
    expect(playerTwoChoices.some((choice) => playerOneChoices.includes(choice))).toBe(false);
  });

  it('moves and auto-attacks independently for player two', () => {
    const state = createDefaultState();
    const sim = new GameSimulation(state);
    sim.enableLocalCoop();
    const partner = state.partner!;
    partner.attackCooldownMs = 1;
    const target = sim.spawnEnemy({ x: partner.x + 100, y: partner.y, hp: 200, speed: 0 });
    const startX = partner.x;

    sim.update(20, {
      move: { x: 0, y: 0 }, aim: { x: 0, y: 0 }, activate: false,
      partner: { move: { x: 1, y: 0 }, aim: { x: 1, y: 0 }, activate: false },
    });

    expect(partner.x).toBeGreaterThan(startX);
    expect(state.projectiles.some((projectile) => projectile.targetId === target.id)).toBe(true);
  });

  it('makes enemies pursue the nearest living player', () => {
    const state = createDefaultState();
    const sim = new GameSimulation(state);
    sim.enableLocalCoop();
    state.nextBossAtMs = Number.MAX_SAFE_INTEGER;
    state.nextEliteSquadAtMs = Number.MAX_SAFE_INTEGER;
    state.spawnTimerMs = 999_999;
    state.partner!.x = 600;
    state.partner!.y = 700;
    const enemy = sim.spawnEnemy({ x: 600, y: 570, hp: 100, speed: 100 });

    sim.update(100, {
      move: { x: 0, y: 0 }, aim: { x: 0, y: 0 }, activate: false,
      partner: { move: { x: 0, y: 0 }, aim: { x: 0, y: 0 }, activate: false },
    });

    expect(enemy.y).toBeGreaterThan(570);
  });

  it('allows a nearby partner to revive a downed player', () => {
    const state = createDefaultState();
    const sim = new GameSimulation(state);
    sim.enableLocalCoop();
    state.nextBossAtMs = Number.MAX_SAFE_INTEGER;
    state.nextEliteSquadAtMs = Number.MAX_SAFE_INTEGER;
    state.spawnTimerMs = 999_999;
    state.partner!.x = state.player.x + 20;
    state.partner!.y = state.player.y;
    sim.spawnEnemy({ x: state.player.x, y: state.player.y, hp: 100, speed: 0, damage: 999 });

    sim.update(16, { move: { x: 0, y: 0 }, aim: { x: 0, y: 0 }, activate: false });
    state.enemies = [];
    sim.update(3_100, { move: { x: 0, y: 0 }, aim: { x: 0, y: 0 }, activate: false });

    expect(state.playerDowned).toBe(false);
    expect(state.player.hp).toBeGreaterThan(0);
    expect(state.player.invulnerableMs).toBeGreaterThan(0);
  });

  it('casts player two active skills independently', () => {
    const state = createDefaultState();
    const sim = new GameSimulation(state);
    sim.enableLocalCoop();
    const partner = state.partner!;
    partner.activeSkill = 'talisman-ruin';
    partner.activeSkillLevel = 1;
    sim.spawnEnemy({ x: partner.x + 100, y: partner.y, hp: 300, speed: 0 });

    sim.update(16, {
      move: { x: 0, y: 0 }, aim: { x: 0, y: 0 }, activate: false,
      partner: { move: { x: 0, y: 0 }, aim: { x: 1, y: 0 }, activate: true },
    });

    expect(partner.activeCooldownRemainingMs).toBeGreaterThan(0);
  });

  it('lets player two take contact damage again after their invulnerability window expires', () => {
    const state = createDefaultState();
    const sim = new GameSimulation(state);
    sim.enableLocalCoop();
    state.nextBossAtMs = Number.MAX_SAFE_INTEGER;
    state.nextEliteSquadAtMs = Number.MAX_SAFE_INTEGER;
    state.spawnTimerMs = 999_999;
    state.player.x = 200;
    state.player.y = 200;
    state.partner!.x = 700;
    state.partner!.y = 700;
    state.partner!.shield = 0;
    state.partner!.dodgeChance = 0;
    sim.spawnEnemy({ x: 700, y: 700, hp: 100, speed: 0, damage: 10 });

    sim.update(16, { move: { x: 0, y: 0 }, aim: { x: 0, y: 0 }, activate: false });
    const hpAfterFirstHit = state.partner!.hp;
    sim.update(1_001, { move: { x: 0, y: 0 }, aim: { x: 0, y: 0 }, activate: false });

    expect(state.partner!.hp).toBeLessThan(hpAfterFirstHit);
  });

  it('lets player two collect nearby experience shards independently', () => {
    const state = createDefaultState();
    const sim = new GameSimulation(state);
    sim.enableLocalCoop();
    state.nextBossAtMs = Number.MAX_SAFE_INTEGER;
    state.nextEliteSquadAtMs = Number.MAX_SAFE_INTEGER;
    state.spawnTimerMs = 999_999;
    state.player.x = 200;
    state.player.y = 200;
    state.partner!.x = 900;
    state.partner!.y = 700;
    state.shards.push({ id: 1, x: 900, y: 700, radius: 8, value: 12 });

    sim.update(1, { move: { x: 0, y: 0 }, aim: { x: 0, y: 0 }, activate: false });

    expect(state.shards).toHaveLength(0);
    expect(state.partner!.level).toBe(2);
    expect(state.partner!.experience).toBe(state.player.experience);
  });

  it('grants twenty-five percent more shared experience in co-op', () => {
    const state = createDefaultState();
    const sim = new GameSimulation(state);
    sim.enableLocalCoop();
    state.nextBossAtMs = Number.MAX_SAFE_INTEGER;
    state.nextEliteSquadAtMs = Number.MAX_SAFE_INTEGER;
    state.spawnTimerMs = 999_999;
    state.player.x = 200;
    state.player.y = 200;
    state.partner!.x = 900;
    state.partner!.y = 700;
    state.shards.push({ id: 1, x: 900, y: 700, radius: 8, value: 4 });

    sim.update(1, { move: { x: 0, y: 0 }, aim: { x: 0, y: 0 }, activate: false });

    expect(state.player.experience).toBe(5);
    expect(state.partner!.experience).toBe(5);
  });

  it('alternates every co-op upgrade between player one and player two', () => {
    const state = createDefaultState();
    const sim = new GameSimulation(state);
    sim.enableLocalCoop();
    state.nextBossAtMs = Number.MAX_SAFE_INTEGER;
    state.nextEliteSquadAtMs = Number.MAX_SAFE_INTEGER;
    state.spawnTimerMs = 999_999;

    state.player.experience = state.player.experienceToNext;
    sim.update(1, { move: { x: 0, y: 0 }, aim: { x: 0, y: 0 }, activate: false });

    expect(state.pendingUpgradePlayerId).toBe('p1');
    sim.chooseUpgrade(state.upgradeChoices[0]);
    expect(state.phase).toBe('playing');

    state.player.experience = state.player.experienceToNext;
    sim.update(1, { move: { x: 0, y: 0 }, aim: { x: 0, y: 0 }, activate: false });

    expect(state.pendingUpgradePlayerId).toBe('p2');
  });

  it('rejects a skill already owned by the other co-op player', () => {
    const state = createDefaultState();
    const sim = new GameSimulation(state);
    sim.enableLocalCoop();
    state.player.equippedSkills = ['thunder-ring'];
    state.player.upgradeLevels['thunder-ring'] = 1;
    state.phase = 'upgrade';
    state.pendingUpgradePlayerId = 'p2';
    state.upgradeChoices = ['thunder-ring'];

    sim.chooseUpgrade('thunder-ring');

    expect(state.partner!.upgradeLevels['thunder-ring']).toBe(0);
  });
});
