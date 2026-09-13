import { describe, expect, it } from 'vitest';
import { getAwakenedSkillGlyphs } from '../../src/render/awakeningVisuals';
import { createEmptyUpgradeLevels } from '../../src/sim/upgrades';

describe('getAwakenedSkillGlyphs', () => {
  it('returns one persistent, skill-coloured glyph for each equipped six-level skill', () => {
    const levels = createEmptyUpgradeLevels();
    levels['thunder-ring'] = 6;
    levels['void-bell'] = 6;
    levels['faster-swords'] = 4;

    expect(getAwakenedSkillGlyphs(['thunder-ring', 'void-bell'], levels)).toEqual([
      expect.objectContaining({ upgrade: 'thunder-ring', color: 0x61f5ff }),
      expect.objectContaining({ upgrade: 'void-bell', color: 0x8d7cff }),
    ]);
  });
});
