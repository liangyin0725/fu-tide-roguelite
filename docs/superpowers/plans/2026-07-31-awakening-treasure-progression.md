# Awakening, Treasure, and Progression Implementation Plan

> **For Codex:** Use the `superpowers:executing-plans` workflow to implement this plan task by task, with test-driven development and verification before completion.

**Goal:** Speed up progression, expand the skill pool to 16, add unique level-4 awakenings, and reward boss kills with treasure chests and large experience bursts.

**Architecture:** Keep deterministic gameplay rules inside `GameSimulation` and pure upgrade/spawn helpers. Extend the existing event stream for presentation, then let `GameScene`, `EffectRenderer`, and `HudController` render the new mechanics without owning combat state.

**Tech Stack:** TypeScript, Phaser 3, Vitest, Vite.

---

### Task 1: Expand Progression and Upgrade Selection

**Files:**
- Modify: `src/sim/types.ts`
- Modify: `src/sim/state.ts`
- Modify: `src/sim/upgrades.ts`
- Test: `tests/sim/GameSimulation.test.ts`

**Steps:**
1. Add failing tests for the faster experience curve, 16 upgrade definitions, level-4 cap, deterministic normal choices, and treasure-choice priority.
2. Add the four new upgrade IDs and metadata for every skill's awakening.
3. Change the initial threshold to `8` and level growth to `floor(previous * 1.22 + 4)`.
4. Implement deterministic candidate selection that guarantees an owned non-max skill and a new skill when those categories exist.
5. Add treasure-choice generation prioritizing owned level 2-3, then owned level 1, then new skills.
6. Run the focused simulation tests.

### Task 2: Implement Upgrade Levels and Unique Awakenings

**Files:**
- Modify: `src/sim/types.ts`
- Modify: `src/sim/state.ts`
- Modify: `src/sim/upgrades.ts`
- Test: `tests/sim/GameSimulation.test.ts`

**Steps:**
1. Add failing tests for `UpgradeResult`, level clamping, awakening detection, and representative level-4 attributes.
2. Add player fields for thunder DPS, chain targets, burst radius, shield break, regeneration, XP multiplier, dodge, frost, orbiting blades, meteors, and boss damage.
3. Change `applyUpgrade` to return `{ previousLevel, level, awakened }`.
4. Implement levels 1-3 and the unique level-4 bonus for all 16 skills.
5. Run the focused simulation tests.

### Task 3: Add Awakening Flow and Combat Mechanics

**Files:**
- Modify: `src/sim/types.ts`
- Modify: `src/sim/state.ts`
- Modify: `src/sim/GameSimulation.ts`
- Test: `tests/sim/GameSimulation.test.ts`

**Steps:**
1. Add failing tests for the 1.5-second paused awakening phase.
2. Add failing deterministic tests for regeneration, dodge, frost/freeze, orbiting blades, meteors, and boss damage multiplication.
3. Add the `awakening` phase, notice state, countdown, and `skill-awakened` event.
4. Implement the new combat mechanics with seeded randomness and elapsed-time timers.
5. Ensure combat and elapsed time pause while the awakening notice is active.
6. Run the focused simulation tests.

### Task 4: Add Boss Treasure and Experience Burst

**Files:**
- Modify: `src/sim/types.ts`
- Modify: `src/sim/state.ts`
- Modify: `src/sim/GameSimulation.ts`
- Test: `tests/sim/GameSimulation.test.ts`

**Steps:**
1. Add failing tests for one chest, twelve shards, exact total XP, and no ordinary boss shard.
2. Add failing tests for chest pickup, treasure choices, awakening from treasure, and the all-skills-maxed fallback.
3. Add chest and treasure state plus `chest-dropped` and `boss-reward-burst` events.
4. Spawn the chest and experience ring when a boss dies.
5. Auto-open nearby chests and pause in the `treasure` phase until a reward is selected.
6. Implement the +25 max HP/full recovery fallback.
7. Run the focused simulation tests.

### Task 5: Render Awakening, Treasure, and New Effects

**Files:**
- Modify: `src/render/effectSpecs.ts`
- Modify: `src/render/EffectRenderer.ts`
- Modify: `src/render/ShapeFactory.ts`
- Modify: `src/scenes/GameScene.ts`
- Modify: `src/ui/HudController.ts`
- Modify: `src/styles.css`
- Test: `tests/render/effectSpecs.test.ts`

**Steps:**
1. Add failing effect-spec tests for awakening, chest reward, meteors, dodge, frost, and shield break.
2. Add distinct effect specifications and renderer dispatch for each event.
3. Render chests in the world with a clear boss-reward silhouette and pickup feedback.
4. Add treasure choices and a full-screen awakening presentation with attribute summary.
5. Keep desktop and mobile layouts within the viewport.
6. Run render tests and the full unit suite.

### Task 6: Verify the Complete Game

**Files:**
- Verify all modified files.

**Steps:**
1. Run `npm.cmd test`.
2. Run `npm.cmd run build`.
3. Start or reuse the Vite development server.
4. Exercise menu, gameplay, normal upgrade, treasure, and awakening states in the in-app browser at desktop and mobile sizes.
5. Check screenshots, canvas pixels, layout overlap, and console errors.
6. Report exact verification results and any remaining non-blocking warning.
