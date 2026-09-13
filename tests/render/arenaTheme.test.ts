import { describe, expect, it } from 'vitest';
import { getArenaTheme } from '../../src/render/arenaTheme';

describe('arena themes', () => {
  it('gives every tribulation a distinct battlefield palette and motif', () => {
    const calm = getArenaTheme('calm');
    const thunder = getArenaTheme('thunder');
    const bloodMoon = getArenaTheme('blood-moon');
    const frost = getArenaTheme('frost');

    expect(calm.name).toBe('常夜道场');
    expect(thunder.name).toBe('九霄雷域');
    expect(bloodMoon.name).toBe('血月祭场');
    expect(frost.name).toBe('玄霜冰原');
    expect(new Set([calm.background, thunder.background, bloodMoon.background, frost.background])).toHaveLength(4);
    expect(new Set([calm.motif, thunder.motif, bloodMoon.motif, frost.motif])).toHaveLength(4);
  });

  it('keeps the active tribulation colors readable against the dark arena', () => {
    for (const tribulation of ['thunder', 'blood-moon', 'frost'] as const) {
      const theme = getArenaTheme(tribulation);
      expect(theme.accent).not.toBe(theme.background);
      expect(theme.grid).not.toBe(theme.background);
    }
  });
});
