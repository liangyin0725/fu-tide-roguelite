# Fu Tide Roguelite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a playable Phaser 2D cyber-daoist roguelite prototype with auto-combat, enemy waves, upgrades, and HUD.

**Architecture:** Keep game rules in `src/sim/*` as pure TypeScript so they are testable without Phaser. Use one Phaser scene to render simulation state and forward input. Use DOM elements for HUD, menu, upgrade, win, and loss overlays.

**Tech Stack:** Phaser, TypeScript, Vite, Vitest.

---

### Task 1: Project Shell

**Files:**
- Modify: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `index.html`
- Create: `src/main.ts`
- Create: `src/styles.css`

- [x] Add Vite, TypeScript, Vitest, and Phaser scripts and configuration.
- [ ] Create the game bootstrap and CSS layout.
- [ ] Verify with `npm.cmd run build`.

### Task 2: Simulation Rules

**Files:**
- Create: `tests/sim/GameSimulation.test.ts`
- Create: `src/sim/types.ts`
- Create: `src/sim/constants.ts`
- Create: `src/sim/GameSimulation.ts`
- Create: `src/sim/upgrades.ts`

- [x] Write failing tests for movement bounds, auto attacks, enemy contact damage, experience pickup, and upgrade selection.
- [ ] Implement minimal simulation code until `npm.cmd test` passes.

### Task 3: Phaser Runtime

**Files:**
- Create: `src/scenes/GameScene.ts`
- Create: `src/render/ShapeFactory.ts`
- Create: `src/ui/HudController.ts`
- Modify: `src/main.ts`

- [ ] Render player, enemies, projectiles, experience shards, and arena grid.
- [ ] Feed keyboard input into simulation.
- [ ] Keep scene objects disposable and synced by entity id.

### Task 4: HUD And Flow

**Files:**
- Create: `src/ui/HudController.ts`
- Modify: `src/styles.css`

- [ ] Add start, pause-like upgrade, defeat, and victory states.
- [ ] Show health, level, timer, kills, and selected upgrade choices.

### Task 5: Verification

**Files:**
- No new files expected.

- [ ] Run `npm.cmd test`.
- [ ] Run `npm.cmd run build`.
- [ ] Start `npm.cmd run dev` and inspect the game in a browser.
