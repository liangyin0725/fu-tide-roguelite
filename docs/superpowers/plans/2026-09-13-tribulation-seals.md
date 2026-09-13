# Tribulation Seals Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add permanent, mechanism-changing tribulation seals that are awarded from every tribulation choice.

**Architecture:** Store seal ranks and transient counters in `GameState`; `GameSimulation` grants and triggers each seal at existing choice, projectile, freeze, and enemy-death boundaries. The HUD renders rank badges and `EffectRenderer` consumes two new seal event types.

**Tech Stack:** TypeScript, Phaser, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-13-tribulation-seals-design.md`

## Global Constraints

- Preserve existing temporary tribulation-choice modifiers.
- Use deterministic simulation state and existing combat-event rendering.
- Test behavior before implementation; run the full suite and production build before completion.

---

### Task 1: Seal State And Selection

**Files:**
- Modify: `src/sim/types.ts`, `src/sim/state.ts`, `src/sim/GameSimulation.ts`
- Test: `tests/sim/tribulationSeals.test.ts`

- [ ] Write a failing test that selecting `thunder-conduit` grants Thunder Seal rank one while retaining `activeTribulationChoiceId`.
- [ ] Add `TribulationSealId`, persistent run-local ranks, and transient counters to game state.
- [ ] Grant a seal by tribulation type in `chooseTribulationChoice` and emit `tribulation-seal-gained`.
- [ ] Run `npm.cmd test -- --run tests/sim/tribulationSeals.test.ts`.

### Task 2: Combat Triggers

**Files:**
- Modify: `src/sim/GameSimulation.ts`, `src/sim/enemyProjectiles.ts`
- Test: `tests/sim/tribulationSeals.test.ts`

- [ ] Write failing tests for a Thunder chain after four swords, Blood Echo after three elite kills, and Frost Mirror bullet interception after a normal-enemy freeze.
- [ ] Trigger seals at existing sword-hit, elite-death, and freeze boundaries; cap one Frost Mirror and retain deterministic behavior.
- [ ] Run the focused simulation test.

### Task 3: HUD And Effects

**Files:**
- Modify: `src/ui/HudController.ts`, `src/render/EffectRenderer.ts`, `src/i18n/uiText.ts`
- Test: `tests/ui/HudController.test.ts`

- [ ] Write a failing HUD test for ranked seal badges in Chinese and English.
- [ ] Render seal badges below tribulation status and add distinct effect feedback for gain and trigger events.
- [ ] Run focused UI tests.

### Task 4: Regression Verification

**Files:**
- Test: `tests/sim/tribulationSeals.test.ts`, `tests/ui/HudController.test.ts`

- [ ] Run `npm.cmd test`.
- [ ] Run `npm.cmd run build`.
- [ ] Inspect `git diff --check` and report the result.
