// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { HudController } from '../../src/ui/HudController';
import { createDefaultState } from '../../src/sim/state';
import { DEFAULT_GAME_SETTINGS } from '../../src/settings/gameSettings';
import { SKILL_IDS } from '../../src/sim/upgradeCatalog';

describe('skill route choice', () => {
  it.each(SKILL_IDS)('renders both %s routes in English without untranslated copy', (skill) => {
    const root = document.createElement('div');
    const state = createDefaultState();
    state.phase = 'skill-path-choice';
    state.pendingSkillPath = { skill, playerId: 'p2', resumePhase: 'playing' };
    const hud = new HudController(root, {} as ConstructorParameters<typeof HudController>[1]);
    hud.render(state, { ...DEFAULT_GAME_SETTINGS, language: 'en' });
    expect(root.querySelectorAll('[data-skill-path]')).toHaveLength(2);
    expect(root.textContent).not.toMatch(/[\u4e00-\u9fff]/);
  });
  it('shows route tooltip without falsely marking a gated level-six skill awakened', () => {
    const root = document.createElement('div');
    const state = createDefaultState();
    state.player.equippedSkills = ['meteor-seal'];
    state.player.upgradeLevels['meteor-seal'] = 6;
    state.player.skillPaths['meteor-seal'] = 'b';
    const hud = new HudController(root, {} as ConstructorParameters<typeof HudController>[1]);
    hud.render(state, { ...DEFAULT_GAME_SETTINGS, language: 'en' });
    const slot = root.querySelector('.skill-slot:not(.empty)')!;
    expect(slot.getAttribute('title')).toContain('Molten Crater');
    expect(slot.classList.contains('awakened')).toBe(false);
    expect(slot.textContent).toContain('Lv.6');
  });
  it('renders both English routes and dispatches the chosen route', () => {
    const root = document.createElement('div');
    const onChooseSkillPath = vi.fn();
    const state = createDefaultState();
    state.phase = 'skill-path-choice';
    state.player.upgradeLevels['thunder-ring'] = 3;
    state.pendingSkillPath = { skill: 'thunder-ring', playerId: 'p1', resumePhase: 'playing' };
    const hud = new HudController(root, { onChooseSkillPath } as unknown as ConstructorParameters<typeof HudController>[1]);
    hud.render(state, { ...DEFAULT_GAME_SETTINGS, language: 'en' });
    expect(root.querySelectorAll('[data-skill-path]')).toHaveLength(2);
    expect(root.querySelector('.skill-path-panel')?.textContent).toContain('Wandering Thunder Field');
    expect(root.querySelector('.skill-path-panel')?.textContent).not.toMatch(/[\u4e00-\u9fff]/);
    root.querySelector<HTMLButtonElement>('[data-skill-path="b"]')!.click();
    expect(onChooseSkillPath).toHaveBeenCalledWith('b');
  });
});
