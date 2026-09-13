# Objective Fields Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make completed tribulation-chain objectives grant visible, temporary battlefield fields.

**Architecture:** Store field expiry times in `GameState`; objective completion activates the matching field and emits a typed event. Existing combat systems consume the field state at their closest behavior boundary, while the HUD and renderer surface the active state.

**Tech Stack:** TypeScript, Phaser, Vitest, Vite.

**Spec:** `docs/superpowers/specs/2026-09-13-objective-fields-design.md`

## Global Constraints

- Preserve current objective timing, route choice, rewards, and failure behavior.
- Use a failing Vitest assertion before each production behavior change.
- Keep objective fields temporary and clearly visible in the HUD.

---

### Task 1: Objective Field State

**Files:**
- Modify: `src/sim/types.ts`, `src/sim/state.ts`, `src/sim/GameSimulation.ts`
- Test: `tests/sim/stageObjectives.test.ts`

**Interfaces:**
- Produces: `objectiveFieldExpiresAtMs: Record<ObjectiveKind, number>` and `objective-field-activated` combat events.

- [ ] Write a failing objective-completion test that expects the matching field expiry.
- [ ] Run `npm.cmd test -- --run tests/sim/stageObjectives.test.ts` and observe failure.
- [ ] Activate the matching 18-second field when an objective dies and emit its event.
- [ ] Re-run the focused test.

### Task 2: Field Mechanics

**Files:**
- Modify: `src/sim/GameSimulation.ts`, `src/sim/enemyProjectiles.ts`
- Test: `tests/sim/stageObjectives.test.ts`, `tests/sim/enemyProjectiles.test.ts`

**Interfaces:**
- Consumes: `objectiveFieldExpiresAtMs`.
- Produces: extra thunder targeting, blood-well healing, and frost projectile denial while their fields remain active.

- [ ] Add failing tests for each active field behavior.
- [ ] Run each focused test and observe failure.
- [ ] Implement the smallest field checks at the existing combat boundaries.
- [ ] Re-run focused tests.

### Task 3: Field Feedback

**Files:**
- Modify: `src/sim/types.ts`, `src/render/effectSpecs.ts`, `src/render/EffectRenderer.ts`, `src/ui/HudController.ts`
- Test: `tests/render/effectSpecs.test.ts`, `tests/ui/HudController.test.ts`

**Interfaces:**
- Consumes: objective field events and expiry state.
- Produces: dedicated rendering effect and remaining-duration HUD labels.

- [ ] Add failing renderer and HUD tests.
- [ ] Run focused tests and observe failure.
- [ ] Add field event mapping, distinctive effect geometry, and HUD field chips.
- [ ] Run the full test suite and production build.
