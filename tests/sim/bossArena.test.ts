import { describe, expect, it } from 'vitest';
import {
  getBossObjectiveHp,
  getBossObjectiveKind,
  getBossObjectivePosition,
} from '../../src/sim/bossArena';
import type { Enemy } from '../../src/sim/types';

describe('boss arena objectives', () => {
  it('maps each boss to its arena objective and scales objective health by wave', () => {
    expect(getBossObjectiveKind('crimson')).toBe('crimson-anchor');
    expect(getBossObjectiveKind('thunder')).toBe('storm-pylon');
    expect(getBossObjectiveKind('blood-moon')).toBe('blood-well');
    expect(getBossObjectiveHp(3)).toBe(710);
  });

  it('keeps an arena target in bounds and away from its owner', () => {
    const position = getBossObjectivePosition(
      { x: 600, y: 420, radius: 42 } as Enemy,
      { width: 1280, height: 720 },
    );

    expect(Math.hypot(position.x - 600, position.y - 420)).toBeGreaterThanOrEqual(210);
    expect(position.x).toBeGreaterThan(0);
    expect(position.y).toBeGreaterThan(0);
  });
});
