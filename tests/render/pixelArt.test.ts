import { describe, expect, it } from 'vitest';
import { PIXEL_SPRITES } from '../../src/render/pixelArt';

describe('pixel art definitions', () => {
  it('uses distinct 32px silhouettes for the player and normal enemies', () => {
    expect(PIXEL_SPRITES.player.width).toBe(32);
    expect(PIXEL_SPRITES.melee.width).toBe(32);
    expect(PIXEL_SPRITES.crossbow.frames).not.toEqual(PIXEL_SPRITES.talisman.frames);
    expect(PIXEL_SPRITES.talisman.frames).not.toEqual(PIXEL_SPRITES['soul-lamp'].frames);
  });

  it('uses larger silhouettes for every boss family', () => {
    expect(PIXEL_SPRITES['boss-crimson'].width).toBeGreaterThanOrEqual(48);
    expect(PIXEL_SPRITES['boss-thunder'].width).toBeGreaterThanOrEqual(48);
    expect(PIXEL_SPRITES['boss-blood-moon'].width).toBeGreaterThanOrEqual(48);
  });

  it('keeps every colored part inside its source texture', () => {
    for (const sprite of Object.values(PIXEL_SPRITES)) {
      for (const frame of sprite.frames) {
        expect(frame.every((part) => part.x >= 0 && part.y >= 0
          && part.x + part.w <= sprite.width
          && part.y + part.h <= sprite.height)).toBe(true);
      }
    }
  });

  it('uses layered pixel highlights without changing the established sprite scale', () => {
    for (const key of ['player-xuan-jian', 'player-lei-zhuan', 'player-shou-yi', 'player-jing-po'] as const) {
      expect(PIXEL_SPRITES[key].width).toBe(32);
      expect(PIXEL_SPRITES[key].frames.every((frame) => frame.length >= 14)).toBe(true);
    }
    for (const key of ['boss-crimson', 'boss-thunder', 'boss-blood-moon'] as const) {
      expect(PIXEL_SPRITES[key].frames.every((frame) => frame.length >= 16)).toBe(true);
    }
  });
});
