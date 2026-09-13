import { describe, expect, it } from 'vitest';
import { getGlyphFormation, getGlyphFormationPosition } from '../../src/sim/glyphFormations';

describe('glyph formations', () => {
  it('resolves distinct formations from awakened glyph combinations', () => {
    expect(getGlyphFormation(['thunder-ring', 'fire-burst'])).toBe('stormfire');
    expect(getGlyphFormation(['frost-seal', 'soul-pin'])).toBe('frostbind');
    expect(getGlyphFormation(['void-bell', 'mirror-sigil'])).toBe('mirror-ward');
    expect(getGlyphFormation(['north-star', 'meteor-seal'])).toBe('orbit');
  });

  it('places stormfire glyphs in a more aggressive spiral than the default orbit', () => {
    const orbit = getGlyphFormationPosition('orbit', 1, 3, 1000);
    const stormfire = getGlyphFormationPosition('stormfire', 1, 3, 1000);

    expect(stormfire.radius).toBeGreaterThan(orbit.radius);
    expect(stormfire.angle).not.toBe(orbit.angle);
  });
});
