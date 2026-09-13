# Main Menu Language Toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a persistent Chinese/English selector to the main menu and render UI labels from a centralized translation layer.

**Architecture:** Settings owns the selected locale. `HudController` uses translation helpers for UI-facing labels while the simulation continues to carry stable ids and Chinese gameplay data.

**Tech Stack:** TypeScript, Phaser 3, Vite, Vitest.

---

### Task 1: Persist the language setting

**Files:**
- Modify: `src/settings/gameSettings.ts`
- Modify: `tests/settings/gameSettings.test.ts`

- [ ] Write a failing test that loads an older settings record as `zh-CN` and saves/loads `en`.
- [ ] Run `npm.cmd test -- --run tests/settings/gameSettings.test.ts` and verify failure.
- [ ] Add `Language`, the default locale, migration and validation.
- [ ] Re-run the focused test and verify it passes.

### Task 2: Add translation helpers and the main-menu selector

**Files:**
- Create: `src/i18n/uiText.ts`
- Modify: `src/ui/HudController.ts`
- Modify: `tests/ui/HudController.test.ts`

- [ ] Write a failing HUD test for the `data-setting="language"` action and English menu copy.
- [ ] Run the focused HUD test and verify failure.
- [ ] Implement language dictionaries, translated name helpers and the menu segmented selector.
- [ ] Re-run the focused test and verify it passes.

### Task 3: Wire and verify

**Files:**
- Modify: `src/scenes/GameScene.ts`
- Modify: `src/styles.css`
- Verify: `tests/**/*.test.ts`

- [ ] Ensure the existing setting callback persists `language` and HUD re-renders after selection.
- [ ] Style the main-menu language selector as a compact segmented control.
- [ ] Run `npm.cmd test -- --run` and `npm.cmd run build`.
