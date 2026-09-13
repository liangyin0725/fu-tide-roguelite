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
});
