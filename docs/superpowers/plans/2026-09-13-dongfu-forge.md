# 洞府锻炉 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a persistent spirit-ore forge that upgrades equipped character relics through three behavior-changing ranks.

**Architecture:** Keep persistent currency and forge ranks in `MetaProgression`; `GameScene` turns simulation reward events into stored progression. The player receives a snapshot of forged ranks when a run begins, and `GameSimulation` emits all combat mechanics as ordinary events consumed by the existing renderer.

**Tech Stack:** TypeScript, Phaser 3, Vite, Vitest.

---

### Task 1: Persistent forge progression

**Files:**
- Modify: `src/sim/types.ts`
- Modify: `src/meta/metaProgression.ts`
- Modify: `tests/meta/metaProgression.test.ts`

- [ ] **Step 1: Write failing migration and forge-purchase tests**

```ts
expect(loadMetaProgression(storage)).toMatchObject({ version: 3, spiritOre: 0, relicForgeRanks: {} });
expect(tryForgeRelic({ ...progression, spiritOre: 2 }, 'xuan-jian:star-forged-edge')).toMatchObject({ forged: true });
```

- [ ] **Step 2: Run `npm.cmd test -- --run tests/meta/metaProgression.test.ts` and confirm the tests fail because version 3 fields and `tryForgeRelic` do not exist.**

- [ ] **Step 3: Implement `spiritOre`, `relicForgeRanks`, v1/v2 migration, `earnSpiritOre`, and `tryForgeRelic`; use rank costs `[2, 4, 7]` and require both unlock and equipment.**

- [ ] **Step 4: Re-run the focused meta test and confirm it passes.**

### Task 2: Earn and surface spirit ore

**Files:**
- Modify: `src/sim/types.ts`
- Modify: `src/sim/state.ts`
- Modify: `src/sim/GameSimulation.ts`
- Modify: `src/scenes/GameScene.ts`
- Modify: `src/ui/HudController.ts`
- Test: `tests/sim/GameSimulation.test.ts`

- [ ] **Step 1: Write failing simulation tests for a five-minute survival reward, a boss reward, and an objective reward.**

```ts
expect(sim.consumeEvents()).toContainEqual(expect.objectContaining({ type: 'spirit-ore-earned', source: 'survival', amount: 1 }));
```

- [ ] **Step 2: Run the focused simulation test and confirm the new event is absent.**

- [ ] **Step 3: Add the `spirit-ore-earned` event, per-run earned counter, 5-minute reward tracker, boss reward, and successful-objective reward. Have `GameScene` store the event through `earnSpiritOre`. Render the total on the loss summary.**

- [ ] **Step 4: Run focused simulation and HUD tests and confirm they pass.**

### Task 3: Forge controls in the dongfu

**Files:**
- Modify: `src/ui/HudController.ts`
- Modify: `src/scenes/GameScene.ts`
- Modify: `src/styles.css`
- Modify: `tests/ui/HudController.test.ts`

- [ ] **Step 1: Write a failing HUD test that expects equipped relics to show forge rank, next cost, and a `data-forge-relic` control.**

- [ ] **Step 2: Run the focused HUD test and confirm it fails.**

- [ ] **Step 3: Add the forge callback, route its action in `HudController`, persist successful `tryForgeRelic` results from `GameScene`, and add compact styling for forge status.**

- [ ] **Step 4: Re-run the focused HUD test and confirm it passes.**

### Task 4: Apply forged relic mechanics

**Files:**
- Modify: `src/sim/types.ts`
- Modify: `src/sim/state.ts`
- Modify: `src/scenes/GameScene.ts`
- Modify: `src/sim/GameSimulation.ts`
- Modify: `src/render/effectSpecs.ts`
- Modify: `src/render/EffectRenderer.ts`
- Test: `tests/sim/GameSimulation.test.ts`

- [ ] **Step 1: Write failing simulation tests for star-forged follow-up swords, storm-crown conductive zones, and jade-heart recovery fields.**

- [ ] **Step 2: Run the focused simulation test and confirm the forged mechanics are absent.**

- [ ] **Step 3: Pass forge ranks into the run player state and implement rank-gated follow-up attacks, conductive control fields, and shield-break recovery fields. Emit normal combat events for renderer feedback.**

- [ ] **Step 4: Render compact forge-specific feedback and re-run focused tests.**

### Task 5: Full verification

**Files:**
- Verify: `tests/meta/metaProgression.test.ts`
- Verify: `tests/sim/GameSimulation.test.ts`
- Verify: `tests/ui/HudController.test.ts`

- [ ] **Step 1: Run `npm.cmd test -- --run` and require every test to pass.**
- [ ] **Step 2: Run `npm.cmd run build` and require TypeScript and Vite to succeed.**
- [ ] **Step 3: Load `http://127.0.0.1:5173/`, open 洞府, and verify forge controls are visible for equipped relics.**
