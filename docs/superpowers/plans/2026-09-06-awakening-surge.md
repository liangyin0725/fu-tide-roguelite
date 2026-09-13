# Awakening Surge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every six-level skill awakening create a visible, skill-specific combat surge and an upgraded visual presentation.

**Architecture:** Keep surge resolution inside `GameSimulation`, where it can reuse existing damage, projectile, projectile-clearing, control, and combat-event paths. Keep visual differentiation in `EffectRenderer`, keyed by the existing `skill-awakened` event's `upgrade` field; extend the existing HUD notice rather than adding another game phase.

**Tech Stack:** TypeScript, Phaser, Vitest, Vite.

**Spec:** `docs/superpowers/specs/2026-09-06-awakening-surge-design.md`

## Global Constraints

- Do not add dependencies.
- Apply surges only to six-level `SKILL_IDS`; four-level enhancements retain their existing awakening behavior.
- Reuse `CombatEvent` types and existing damage sources whenever possible.
- Keep renderer selection unchanged.

---

### Task 1: Specify and test gameplay surges

**Files:**
- Modify: `tests/sim/GameSimulation.test.ts`
- Modify: `src/sim/GameSimulation.ts`

**Interfaces:**
- Consumes: `GameSimulation.chooseUpgrade(upgrade)` and the skill build values from `recalculatePlayerBuild`.
- Produces: `triggerAwakeningSurge(upgrade: UpgradeId): void`, called from `beginAwakening` after player build values are current.

- [x] **Step 1: Write failing tests**

```ts
it('turns a frost-seal awakening into an immediate battlefield freeze', () => {
  // Put frost-seal at level five, choose it, then assert nearby normal enemies are frozen.
});

it('turns a void-bell awakening into an immediate bullet clear', () => {
  // Put void-bell at level five, choose it, then assert nearby enemy bullets are removed.
});

it('turns a north-star awakening into an immediate double volley', () => {
  // Put north-star at level five, choose it, then assert sixteen star projectiles exist.
});
```

- [x] **Step 2: Run the focused test file and confirm the assertions fail**

Run: `npm.cmd test -- --run tests/sim/GameSimulation.test.ts`

- [x] **Step 3: Implement the smallest surge resolver**

```ts
private triggerAwakeningSurge(upgrade: UpgradeId): void {
  if (getUpgradeKind(upgrade) !== 'skill') return;
  // Route every skill id to existing damage, control, projectile and event helpers.
  this.removeDeadEnemies();
}
```

- [x] **Step 4: Re-run the focused test file and confirm it passes**

Run: `npm.cmd test -- --run tests/sim/GameSimulation.test.ts`

### Task 2: Upgrade presentation and player-facing copy

**Files:**
- Modify: `tests/render/effectSpecs.test.ts`
- Modify: `src/render/effectSpecs.ts`
- Modify: `src/render/EffectRenderer.ts`
- Modify: `src/ui/HudController.ts`
- Modify: `src/sim/upgrades.ts`

**Interfaces:**
- Consumes: the existing `{ type: 'skill-awakened'; upgrade: UpgradeId }` event.
- Produces: a 2300ms awakening effect and `getAwakeningSurgeSummary(upgrade: UpgradeId): string` for the notice.

- [x] **Step 1: Write a failing duration assertion**

```ts
expect(createEffectSpecs([
  { type: 'skill-awakened', x: 400, y: 300, upgrade: 'meteor-seal' },
])[0].durationMs).toBe(2300);
```

- [x] **Step 2: Run the focused renderer test and confirm it fails**

Run: `npm.cmd test -- --run tests/render/effectSpecs.test.ts`

- [x] **Step 3: Implement visual variants and copy**

```ts
function drawAwakening(graphics, x, y, upgrade, progress, fade) {
  // Select elemental, blade, celestial, or void geometry from upgrade.
}
```

- [x] **Step 4: Re-run focused tests**

Run: `npm.cmd test -- --run tests/render/effectSpecs.test.ts`

### Task 3: Full verification

**Files:**
- Verify: `tests/**/*.test.ts`
- Verify: production build

- [x] **Step 1: Run the full suite**

Run: `npm.cmd test -- --run`

- [x] **Step 2: Build production assets**

Run: `npm.cmd run build`

- [x] **Step 3: Launch the local game and inspect the running combat view**

Run: `npm.cmd run dev -- --port 5174`
