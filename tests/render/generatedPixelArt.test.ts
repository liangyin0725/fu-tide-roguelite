import { describe, expect, it } from 'vitest';
import {
  GENERATED_ARENA_CELLS,
  GENERATED_EFFECT_CELLS,
  GENERATED_PIXEL_ASSETS,
  GENERATED_SPRITE_CELLS,
  getGeneratedEffectTexture,
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
});
