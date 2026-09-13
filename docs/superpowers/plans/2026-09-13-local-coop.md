# Local Co-op Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement optional same-screen two-player local co-op with independent builds and revive play.

**Architecture:** Promote the current player state into an owner-addressable player collection while retaining `state.player` as player one during migration. Route input, projectiles, upgrades, and damage through player IDs; world systems target the nearest living player.

**Tech Stack:** TypeScript, Phaser, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-13-local-coop-design.md`

## Global Constraints

- Keep existing single-player behavior and browser saves compatible.
- Co-op is keyboard-only and local-only.
- Add a failing test before each behavior change; validate with `npm.cmd test` and `npm.cmd run build`.

---

### Task 1: Co-op State And Targeting

**Files:** `src/sim/types.ts`, `src/sim/state.ts`, `src/sim/GameSimulation.ts`, `tests/sim/coOp.test.ts`

- [ ] Add player IDs, co-op mode, partner state, downed state, and nearest-living-player selection.
- [ ] Test two players spawn independently and enemies target the nearest living player.

### Task 2: Input, Combat Ownership, And Shared Experience

**Files:** `src/sim/types.ts`, `src/sim/GameSimulation.ts`, `src/sim/activeSkills.ts`, `tests/sim/coOp.test.ts`

- [ ] Add per-player movement/aim/activation input and projectile ownership.
- [ ] Test separate attacks/build state and shared experience delivery.

### Task 3: Upgrade Queue And Revive

**Files:** `src/sim/GameSimulation.ts`, `src/sim/upgrades.ts`, `tests/sim/coOp.test.ts`

- [ ] Queue independent upgrade choices and resolve them one player at a time.
- [ ] Test downed timeout, revive progress, revive health, and all-downed defeat.

### Task 4: Scene, Camera, And HUD

**Files:** `src/scenes/GameScene.ts`, `src/ui/HudController.ts`, `src/styles.css`, `src/render/pixelArt.ts`, `tests/ui/HudController.test.ts`

- [ ] Add the local-co-op menu action, player-two keyboard input, second sprite, shared camera framing, and dual HUD.
- [ ] Test co-op menu action and player-two HUD state.

### Task 5: Regression Verification

**Files:** `tests/sim/coOp.test.ts`, `tests/ui/HudController.test.ts`

- [ ] Run focused co-op tests, then `npm.cmd test`, `npm.cmd run build`, and `git diff --check`.
