import { describe, expect, it } from 'vitest';
import {
  GENERATED_ARENA_CELLS,
  GENERATED_EFFECT_CELLS,
  GENERATED_PIXEL_ASSETS,
  GENERATED_SPRITE_CELLS,
  getGeneratedEffectOrigin,
  getGeneratedEffectTexture,
  getGeneratedProjectileTexture,
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
