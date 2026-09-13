# Skill And Enhancement Slots Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the shared passive loadout with five six-level skill slots and six four-level enhancement slots, including exact upgrade previews and same-category treasure replacement.

**Architecture:** Keep `UpgradeId` stable and add one authoritative category/max-level registry in `upgrades.ts`. Store equipped skills and enhancements separately, rebuild derived attributes from both arrays, and generate structured preview rows from the same progression functions used by the simulation. HUD and treasure flows consume these APIs without duplicating gameplay math.

**Tech Stack:** TypeScript 6, Phaser 4, Vite 8, Vitest 4, jsdom

**Spec:** `docs/superpowers/specs/2026-08-28-skill-enhancement-slots-design.md`

## Global Constraints

- Exactly five skill slots and six enhancement slots.
- Skills awaken at level six; enhancements awaken at level four.
- Ten existing IDs are skills and ten are enhancements as listed in the spec.
- Every skill level changes a tested value or mechanic.
- Treasure replacement is same-category only.
- Upgrade cards use structured previews derived from simulation progression.
- Active skills remain independent.
- This directory is not a Git repository, so commit steps are omitted.

---

### Task 1: Category Registry And Split Loadout

**Files:**
- Modify: `src/sim/types.ts`
- Modify: `src/sim/state.ts`
- Modify: `src/sim/upgrades.ts`
- Modify: `src/sim/loadout.ts`
- Modify: `tests/sim/loadout.test.ts`
- Modify: `tests/sim/GameSimulation.test.ts`

**Interfaces:**
- Produce `UpgradeKind`, `UPGRADE_KIND`, `getUpgradeKind(id)`, `getUpgradeMaxLevel(id)`, `MAX_SKILL_SLOTS = 5`, `MAX_ENHANCEMENT_SLOTS = 6`.
- Replace `Player.equippedUpgrades` with `equippedSkills` and `equippedEnhancements`.
- Produce `getEquippedForKind(player, kind)` and `canEquipUpgrade(player, id)`.

- [ ] Write failing tests asserting ten IDs per category, max levels six/four, five/six slot limits, and cross-category independence.
- [ ] Run `npm.cmd test -- tests/sim/loadout.test.ts` and confirm failures reference missing category APIs.
- [ ] Add the category registry and split player state.

```ts
export type UpgradeKind = 'skill' | 'enhancement';
export const MAX_SKILL_SLOTS = 5;
export const MAX_ENHANCEMENT_SLOTS = 6;
export function getUpgradeMaxLevel(id: UpgradeId): number {
  return getUpgradeKind(id) === 'skill' ? 6 : 4;
}
```

- [ ] Update loadout lookup, candidate filtering and derived-stat replay to consume both arrays.
- [ ] Remove every production reference to `equippedUpgrades`; migrate test fixtures and development previews.
- [ ] Run focused tests, then `npm.cmd run build`.

---

### Task 2: Six-Level Skill Progression

**Files:**
- Modify: `src/sim/loadout.ts`
- Modify: `src/sim/upgrades.ts`
- Modify: `src/sim/GameSimulation.ts`
- Modify: `tests/sim/GameSimulation.test.ts`

**Interfaces:**
- `applyUpgrade` uses `getUpgradeMaxLevel` and reports awakening only when `level === maxLevel`.
- Skill progression values exactly match the table in the spec.

- [ ] Write a parameterized failing test that captures a meaningful derived value at every level one through six for all ten skills and asserts each level differs from the previous level.
- [ ] Add explicit assertions that level five does not awaken, level six does, and a seventh application is capped.
- [ ] Run the focused test and confirm current level-four behavior fails.
- [ ] Extend `applyUpgradeLevelEffects` for skill levels four, five and six using the exact table values.
- [ ] Move every skill awakening summary and behavior trigger from level four to level six; keep enhancement awakening at level four.
- [ ] Run `npm.cmd test -- tests/sim/GameSimulation.test.ts tests/sim/loadout.test.ts`.

---

### Task 3: Exact Upgrade Preview And Mixed Candidate Generation

**Files:**
- Create: `src/sim/upgradePreview.ts`
- Create: `tests/sim/upgradePreview.test.ts`
- Modify: `src/sim/upgrades.ts`
- Modify: `src/ui/HudController.ts`
- Modify: `src/styles.css`

**Interfaces:**
- Produce `UpgradePreview = { kind, currentLevel, nextLevel, maxLevel, awakens, title, lines }`.
- Produce `UpgradePreviewLine = { label, current, next, delta, mechanic?: boolean }`.
- Produce `getUpgradePreview(player, id): UpgradePreview` using the same progression calculator as `recalculatePlayerBuild`.

- [ ] Write failing tests for numeric previews of attack damage, meteor cooldown, blade count, shield capacity and level-six awakening mechanics.
- [ ] Verify each preview by cloning a player, applying the upgrade, recalculating, and comparing preview `next` values to resulting fields.
- [ ] Implement preview generation by evaluating the current and next derived snapshots; keep human-readable labels in one field mapping.
- [ ] Update candidate generation to prioritize one owned upgrade, one legal new item, and one seeded legal item across both categories.
- [ ] Render category tags, current-to-next values, signed deltas and awakening mechanic lines in normal and treasure cards.
- [ ] Run `npm.cmd test -- tests/sim/upgradePreview.test.ts tests/ui/HudController.test.ts` and build.

---

### Task 4: Same-Category Treasure Replacement

**Files:**
- Modify: `src/sim/types.ts`
- Modify: `src/sim/GameSimulation.ts`
- Modify: `src/ui/HudController.ts`
- Modify: `tests/sim/GameSimulation.test.ts`

**Interfaces:**
- `pendingTreasureUpgrade` determines replacement kind through `getUpgradeKind`.
- `confirmTreasureReplacement(slotIndex)` indexes only the matching category array.

- [ ] Write failing tests for skill-to-skill replacement, enhancement-to-enhancement replacement, invalid cross-category index rejection and cancel behavior.
- [ ] Change treasure selection so only the pending item's category can enter replacement mode.
- [ ] On confirmation, zero the removed level, insert the new ID at level one, recalculate, and reset removed skill timers.
- [ ] Render only matching-category slots and show old current preview beside new level-one preview.
- [ ] Run `npm.cmd test -- tests/sim/GameSimulation.test.ts` and full tests.

---

### Task 5: Two-Row HUD And Final Verification

**Files:**
- Modify: `src/ui/HudController.ts`
- Modify: `src/styles.css`
- Modify: `tests/ui/HudController.test.ts`

**Interfaces:**
- HUD renders `.skill-slots` with five `.skill-slot` children and `.enhancement-slots` with six `.enhancement-slot` children.
- Skill slots render six level pips; enhancement slots render four.

- [ ] Write failing DOM tests for five skill slots, six enhancement slots, one active slot and six/four level markers.
- [ ] Replace the shared passive row with labeled skill and enhancement rows while keeping stable dimensions.
- [ ] Style desktop as a compact two-row dock and mobile as a non-overlapping grid above the controls.
- [ ] Run `npm.cmd test` and confirm zero failures.
- [ ] Run `npm.cmd run build` and confirm TypeScript and Vite succeed.
- [ ] Confirm `curl.exe --noproxy '*' http://127.0.0.1:5173/` returns HTTP 200 and keep the server running.
