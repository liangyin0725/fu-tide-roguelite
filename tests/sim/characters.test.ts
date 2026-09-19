import { describe, expect, it } from 'vitest';
import { GameSimulation } from '../../src/sim/GameSimulation';
import { createDefaultState } from '../../src/sim/state';
import { recalculatePlayerBuild } from '../../src/sim/loadout';

describe('character system', () => {
  it('routes a new run through character selection', () => {
    const state = createDefaultState();
    state.phase = 'menu';
    const sim = new GameSimulation(state);
    sim.start();
    expect(state.phase).toBe('character-choice');
    sim.chooseCharacter('lei-zhuan');
    expect(state.phase).toBe('active-choice');
    expect(state.player.characterId).toBe('lei-zhuan');
  });

  it('applies each character trait during build recalculation', () => {
    const sword = createDefaultState();
    sword.player.characterId = 'xuan-jian';
    recalculatePlayerBuild(sword.player);
    expect(sword.player.attackDamage).toBeCloseTo(18 * 1.1);

    const thunder = createDefaultState();
    thunder.player.characterId = 'lei-zhuan';
    recalculatePlayerBuild(thunder.player);
    expect(thunder.player.maxHp).toBe(90);

    const guardian = createDefaultState();
    guardian.player.characterId = 'shou-yi';
    recalculatePlayerBuild(guardian.player);
    expect(guardian.player.maxHp).toBe(125);
    expect(guardian.player.speed).toBeCloseTo(245 * 0.95);

    const mirror = createDefaultState();
    mirror.player.characterId = 'jing-po';
    mirror.player.equippedSkills = ['mirror-sigil', 'bullet-reprisal'];
    mirror.player.upgradeLevels['mirror-sigil'] = 2;
    mirror.player.upgradeLevels['bullet-reprisal'] = 2;
    recalculatePlayerBuild(mirror.player);
    expect(mirror.player.maxHp).toBe(90);
    expect(mirror.player.mirrorSigilCooldownMs).toBeLessThan(4_000);
    expect(mirror.player.mirrorSigilDamage).toBeGreaterThan(30);
    expect(mirror.player.bulletReprisalRadius).toBeGreaterThan(100);
    expect(mirror.player.mirrorSigilChains).toBe(1);
    expect(mirror.player.bulletReprisalChains).toBe(1);
  });

  it('applies only the selected character’s unlocked talents after base traits', () => {
    const player = createDefaultState().player;
    player.characterId = 'xuan-jian';
    player.metaTalentIds = ['xuan-jian:sword-intent', 'lei-zhuan:thunder-body'];

    recalculatePlayerBuild(player);

    expect(player.attackDamage).toBeCloseTo(18 * 1.1 * 1.08);
    expect(player.thunderDamagePerSecond).toBe(10);
  });

  it('gives guardian shield and regeneration talents to a fresh run', () => {
    const player = createDefaultState().player;
    player.characterId = 'shou-yi';
    player.metaTalentIds = ['shou-yi:root-guard', 'shou-yi:jade-armor', 'shou-yi:evergreen'];

    recalculatePlayerBuild(player);

    expect(player.maxHp).toBeCloseTo(125 * 1.1);
    expect(player.maxShield).toBe(20);
    expect(player.hpRegenPerSecond).toBeCloseTo(0.6);
  });

  it('applies shared path nodes and only the selected character relic', () => {
    const player = createDefaultState().player;
    player.characterId = 'lei-zhuan';
    player.metaPathNodeIds = ['path:life-root', 'path:war-sigil'];
    player.metaRelicIds = ['lei-zhuan:storm-crown', 'xuan-jian:star-forged-edge'];

    recalculatePlayerBuild(player);

    expect(player.maxHp).toBeCloseTo(90 * 1.08);
    expect(player.arcaneDamageMultiplier).toBeCloseTo(1.08 * 1.16);
    expect(player.projectilePierce).toBe(0);
  });

  it('turns equipped relic forge ranks into distinct combat build changes', () => {
    const sword = createDefaultState().player;
    sword.characterId = 'xuan-jian';
    sword.metaRelicIds = ['xuan-jian:star-forged-edge'];
    sword.metaRelicForgeRanks = { 'xuan-jian:star-forged-edge': 2 };
    recalculatePlayerBuild(sword);
    expect(sword.projectileCount).toBe(3);
    expect(sword.projectilePierce).toBe(3);

    const guardian = createDefaultState().player;
    guardian.characterId = 'shou-yi';
    guardian.metaRelicIds = ['shou-yi:jade-heart'];
    guardian.metaRelicForgeRanks = { 'shou-yi:jade-heart': 3 };
    recalculatePlayerBuild(guardian);
    expect(guardian.shieldBreakDamage).toBeGreaterThan(0);
  });
});
