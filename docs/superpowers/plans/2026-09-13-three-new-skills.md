# Three New Skills Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Frost Domain, Rift Return, and Star Pull as six-level skills with awakened mechanical changes and readable effects.

**Architecture:** Extend the existing `UpgradeId` and `Player` stat model, configure derived values in `loadout.ts`, and drive all periodic behavior from `GameSimulation`. Reuse `CombatEvent`/`EffectRenderer` for feedback and the existing projectile/enemy state for collision, pull, and bullet interaction.

**Tech Stack:** TypeScript, Phaser 3, Vite, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-13-three-new-skills-design.md`

## Global Constraints

- No new dependencies.
- Skill upgrades have six ranks and support local co-op player independence.
- Existing slot limits and combat systems remain compatible.
- Run `npm.cmd test` and `npm.cmd run build` before delivery.

---

### Task 1: Register skills and derived player values

**Files:**
- Modify: `src/sim/types.ts`, `src/sim/upgradeCatalog.ts`, `src/sim/state.ts`, `src/sim/loadout.ts`, `src/sim/upgrades.ts`
- Test: `tests/sim/newSkills.test.ts`, `tests/sim/skillProgression.test.ts`

**Interfaces:**
- Produces three `UpgradeId` values and corresponding `Player` cooldown, radius, duration, damage, and timer fields.

- [ ] Write failing catalog and rank-six derived-stat tests.
- [ ] Register the skill IDs, labels, awakening summaries, base player fields, reset logic, and per-rank effects.
- [ ] Run `npm.cmd test -- --run tests/sim/newSkills.test.ts tests/sim/skillProgression.test.ts`.

### Task 2: Implement periodic mechanics

**Files:**
- Modify: `src/sim/GameSimulation.ts`, `src/sim/enemyProjectiles.ts`
- Test: `tests/sim/newSkills.test.ts`

**Interfaces:**
- Consumes the derived `Player` fields from Task 1.
- Produces periodic frost fields, return-blade passes, and star-pull force/bullet behavior.

- [ ] Write failing simulation tests for domain freezing, two-pass return hits, and pull-field projectile destruction at awakening.
- [ ] Add the minimal update-loop implementations and include both co-op player instances.
- [ ] Run `npm.cmd test -- --run tests/sim/newSkills.test.ts`.

### Task 3: Add player-facing feedback

**Files:**
- Modify: `src/render/effectSpecs.ts`, `src/render/EffectRenderer.ts`, `src/sim/types.ts`, `src/i18n/uiText.ts`
- Test: `tests/sim/newSkills.test.ts`

**Interfaces:**
- Consumes new combat events emitted by Task 2.
- Produces distinct frost-field, return-blade, and star-pull visual effect recipes.

- [ ] Write failing event assertions for each activation and awakening branch.
- [ ] Add effect events and renderer recipes with distinct colors and geometry.
- [ ] Run focused simulation tests.

### Task 4: Verify regression safety

**Files:**
- Test: all Vitest suites

- [ ] Run `npm.cmd test`.
- [ ] Run `npm.cmd run build`.
- [ ] Inspect `git diff --stat` and report the uncommitted scope without committing or pushing.
