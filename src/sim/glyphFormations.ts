import type { UpgradeId } from './types';

export type GlyphFormation = 'orbit' | 'stormfire' | 'frostbind' | 'mirror-ward';

export interface GlyphFormationPosition {
  angle: number;
  radius: number;
}

export function getGlyphFormation(glyphs: UpgradeId[]): GlyphFormation {
  if (glyphs.includes('thunder-ring') && glyphs.includes('fire-burst')) return 'stormfire';
  if (glyphs.includes('frost-seal') && glyphs.includes('soul-pin')) return 'frostbind';
  if (glyphs.includes('void-bell') && glyphs.includes('mirror-sigil')) return 'mirror-ward';
  return 'orbit';
}

export function getGlyphFormationPosition(
  formation: GlyphFormation,
  index: number,
  count: number,
  timeMs: number,
): GlyphFormationPosition {
  const orbitAngle = timeMs * 0.0014 + index * (Math.PI * 2 / count);
  const orbitRadius = 72 + (index % 2) * 12;

  if (formation === 'stormfire') {
    return { angle: orbitAngle + index * 0.22, radius: orbitRadius + 14 + index * 4 };
  }
  if (formation === 'frostbind') {
    return { angle: orbitAngle + (index - (count - 1) / 2) * 0.26, radius: 76 + index * 8 };
  }
  if (formation === 'mirror-ward') {
    return { angle: orbitAngle, radius: 94 };
  }
  return { angle: orbitAngle, radius: orbitRadius };
}
