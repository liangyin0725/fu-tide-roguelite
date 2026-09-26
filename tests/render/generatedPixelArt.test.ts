import { describe, expect, it } from 'vitest';
import {
  GENERATED_ARENA_CELLS,
  GENERATED_BOSS_EFFECT_CELLS,
  GENERATED_EFFECT_CELLS,
  GENERATED_PIXEL_ASSETS,
  GENERATED_PERSISTENT_EFFECT_CELLS,
  GENERATED_SPRITE_CELLS,
  getGeneratedEnemyProjectileTexture,
  getGeneratedBossEventTexture,
  getGeneratedBossHazardTexture,
  getGeneratedBossHazardVisual,
  getGeneratedEffectOrigin,
  getGeneratedEffectTexture,
  getGeneratedEnemyProjectileScale,
  getGeneratedProjectileTexture,
  getPersistentEffectVisuals,
} from '../../src/render/generatedPixelArt';

describe('generated pixel-art asset manifest', () => {
  it('maps every playable character, enemy family, and boss to a generated atlas cell', () => {
    expect(Object.keys(GENERATED_SPRITE_CELLS)).toEqual(expect.arrayContaining([
      'player',
      'player-xuan-jian',
      'player-lei-zhuan',
      'player-shou-yi',
      'player-jing-po',
      'melee',
      'crossbow',
      'talisman',
      'soul-lamp',
      'boss-crimson',
      'boss-thunder',
      'boss-blood-moon',
    ]));
  });

  it('loads project-owned atlases for actors, bosses, environments, and effects', () => {
    expect(GENERATED_PIXEL_ASSETS.actors.url).toBe('/assets/generated/actors-atlas.png');
    expect(GENERATED_PIXEL_ASSETS.bosses.url).toBe('/assets/generated/bosses-atlas.png');
    expect(GENERATED_PIXEL_ASSETS.worldVfx.url).toBe('/assets/generated/world-vfx-atlas.png');
    expect(GENERATED_PIXEL_ASSETS.combat.url).toBe('/assets/generated/combat-atlas.png');
  });

  it('gives every enemy projectile family its own generated texture', () => {
    expect(getGeneratedEnemyProjectileTexture('bolt')).toBe('generated-enemy-bolt');
    expect(getGeneratedEnemyProjectileTexture('fan-seal')).toBe('generated-enemy-fan-seal');
    expect(getGeneratedEnemyProjectileTexture('soul-orb')).toBe('generated-enemy-soul-orb');
  });

  it('provides generated textures for persistent combat fields', () => {
    expect(Object.keys(GENERATED_PERSISTENT_EFFECT_CELLS)).toEqual([
      'thunder-ring',
      'orbiting-blades',
      'golden-shield',
      'awakening-formation',
    ]);
  });

  it('gives every boss and hazard shape a dedicated generated effect', () => {
    expect(Object.keys(GENERATED_BOSS_EFFECT_CELLS)).toHaveLength(12);
    expect(getGeneratedBossHazardTexture('crimson', 'charge')).toBe('generated-boss-crimson-charge');
    expect(getGeneratedBossHazardTexture('thunder', 'line')).toBe('generated-boss-thunder-line');
    expect(getGeneratedBossHazardTexture('blood-moon', 'ring')).toBe('generated-boss-blood-moon-ring');
  });

  it('maps boss combat events to their own generated family', () => {
    expect(getGeneratedBossEventTexture({
      type: 'boss-spawned',
      x: 100,
      y: 120,
      wave: 2,
      bossType: 'crimson',
    })).toBe('generated-boss-crimson-ring');
    expect(getGeneratedBossEventTexture({
      type: 'boss-cast-started',
      x: 100,
      y: 120,
      bossType: 'thunder',
      kind: 'primary',
    })).toBe('generated-boss-thunder-charge');
    expect(getGeneratedBossEventTexture({
      type: 'boss-phase-changed',
      x: 100,
      y: 120,
      bossId: 7,
      bossType: 'blood-moon',
      phase: 2,
    })).toBe('generated-boss-blood-moon-ring');
  });

  it('sizes generated boss hazards from their real hit geometry', () => {
    const baseHazard = {
      id: 1,
      ownerBossId: 2,
      bossType: 'crimson' as const,
      kind: 'line' as const,
      x: 100,
      y: 100,
      endX: 300,
      endY: 100,
      radius: 0,
      startRadius: 0,
      endRadius: 0,
      bandWidth: 0,
      lineWidth: 24,
      telegraphRemainingMs: 400,
      activeRemainingMs: 500,
      activeDurationMs: 500,
      damageMultiplier: 1,
      hasDamagedPlayer: false,
    };
    const line = getGeneratedBossHazardVisual(baseHazard, 1000);
    expect(line).toMatchObject({ x: 200, y: 100, width: 248, height: 58 });
    expect(line.alpha).toBeLessThan(0.7);

    const ring = getGeneratedBossHazardVisual({
      ...baseHazard,
      kind: 'ring',
      x: 200,
      y: 180,
      endX: 200,
      endY: 180,
      startRadius: 60,
      endRadius: 140,
      bandWidth: 28,
      telegraphRemainingMs: 0,
      activeRemainingMs: 250,
      activeDurationMs: 500,
    }, 1000);
    expect(ring).toMatchObject({ x: 200, y: 180, width: 228, height: 228 });
    expect(ring.alpha).toBeGreaterThan(0.75);
  });

  it('keeps enemy projectile silhouettes distinct at combat scale', () => {
    expect(getGeneratedEnemyProjectileScale('bolt')).toBe(0.22);
    expect(getGeneratedEnemyProjectileScale('fan-seal')).toBe(0.28);
    expect(getGeneratedEnemyProjectileScale('soul-orb')).toBe(0.34);
    expect(getGeneratedEnemyProjectileScale('bolt')).toBeLessThan(
      getGeneratedEnemyProjectileScale('fan-seal'),
    );
    expect(getGeneratedEnemyProjectileScale('fan-seal')).toBeLessThan(
      getGeneratedEnemyProjectileScale('soul-orb'),
    );
  });

  it('keeps persistent skill textures visible while their mechanics are active', () => {
    const visuals = getPersistentEffectVisuals({
      thunderRadius: 150,
      orbitingBladeCount: 6,
      orbitingBladeRadius: 90,
      shield: 20,
      activeBarrierRemainingMs: 0,
      activeBarrierRadius: 0,
      awakenedSkillCount: 3,
      timeMs: 1000,
    });

    expect(visuals['thunder-ring']).toMatchObject({ visible: true, diameter: 338, alpha: 0.58 });
    expect(visuals['orbiting-blades']).toMatchObject({ visible: true, diameter: 252 });
    expect(visuals['golden-shield']).toMatchObject({ visible: true, diameter: 120 });
    expect(visuals['awakening-formation']).toMatchObject({ visible: true, diameter: 304 });
    expect(Math.max(...Object.values(visuals).map((visual) => visual.alpha))).toBeGreaterThan(0.6);
  });

  it('provides four arena themes and four readable skill decals', () => {
    expect(Object.keys(GENERATED_ARENA_CELLS)).toHaveLength(4);
    expect(Object.keys(GENERATED_EFFECT_CELLS)).toEqual(['sword', 'fire', 'lightning', 'frost']);
    expect(getGeneratedEffectTexture('projectile-fired')).toBe('generated-vfx-sword');
    expect(getGeneratedEffectTexture('meteor-strike')).toBe('generated-vfx-fire');
    expect(getGeneratedEffectTexture('chain-lightning')).toBe('generated-vfx-lightning');
    expect(getGeneratedEffectTexture('frost-domain')).toBe('generated-vfx-frost');
    expect(getGeneratedEffectTexture('level-up')).toBeNull();
  });

  it('keeps generated textures visible on every persistent player projectile', () => {
    expect(getGeneratedProjectileTexture(undefined)).toBe('generated-vfx-sword');
    expect(getGeneratedProjectileTexture('sword')).toBe('generated-vfx-sword');
    expect(getGeneratedProjectileTexture('star')).toBe('generated-vfx-lightning');
    expect(getGeneratedProjectileTexture('glyph')).toBe('generated-vfx-frost');
  });

  it('places line-based generated effects at their impact end instead of dropping them', () => {
    expect(getGeneratedEffectOrigin({
      type: 'chain-lightning',
      fromX: 10,
      fromY: 20,
      toX: 90,
      toY: 120,
    })).toEqual({ x: 90, y: 120 });
    expect(getGeneratedEffectOrigin({
      type: 'rift-return',
      fromX: 10,
      fromY: 20,
      toX: 210,
      toY: 220,
      awakened: true,
    })).toEqual({ x: 210, y: 220 });
  });
});
