import { describe, expect, it } from 'vitest';
import { createDefaultState } from '../../src/sim/state';
import { applyUpgrade } from '../../src/sim/upgrades';
import { createUpgradePreview } from '../../src/sim/upgradePreview';

describe('upgrade preview', () => {
  it('shows exact current, next, and delta values for a normal skill level', () => {
    const state = createDefaultState();
    for (let level = 0; level < 4; level += 1) applyUpgrade(state, 'thunder-ring');

    const preview = createUpgradePreview(state.player, 'thunder-ring');

    expect(preview).toMatchObject({ currentLevel: 4, nextLevel: 5, maxLevel: 6, awakens: false });
    expect(preview.lines).toContain('雷环范围 152 → 190（+38）');
  });

  it('shows sixth-level awakening changes for multi-stat skills', () => {
    const state = createDefaultState();
    applyUpgrade(state, 'boss-slayer');
    for (let level = 0; level < 5; level += 1) applyUpgrade(state, 'meteor-seal');

    const preview = createUpgradePreview(state.player, 'meteor-seal');

    expect(preview.awakens).toBe(true);
    expect(preview.lines).toEqual(expect.arrayContaining([
      '天火间隔 4.2秒 → 3.6秒（-0.6秒）',
      '天火数量 1 → 3（+2）',
      '单枚伤害 85 → 105（+20）',
    ]));
  });

  it('uses level four as the awakening cap for enhancements', () => {
    const state = createDefaultState();
    for (let level = 0; level < 3; level += 1) applyUpgrade(state, 'heavier-swords');

    const preview = createUpgradePreview(state.player, 'heavier-swords');

    expect(preview).toMatchObject({ currentLevel: 3, nextLevel: 4, maxLevel: 4, awakens: true });
    expect(preview.lines).toContain('飞剑伤害 42 → 78（+36）');
  });
});
