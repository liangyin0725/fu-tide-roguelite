# Skill Paths Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two mechanically distinct Lv.3 routes to all 18 skills, carry the selected route through Lv.6 awakening, and keep single-player, local co-op, treasure replacement, beta loadouts, and bilingual HUD flows working.

**Architecture:** Route definitions and validation live in a pure `src/sim/skillPaths.ts` catalog. Player ownership is stored on `Player.skillPaths`; `GameSimulation` owns route-choice flow and runtime mechanics, while `HudController` only renders and dispatches choices. Existing upgrade stats remain in `loadout.ts`, with route-derived values applied after base rebuild, and every route-only runtime action emits a `CombatEvent` consumed by existing render boundaries.

**Tech Stack:** TypeScript 6, Vitest 4, Phaser 4, Vite 8, jsdom.

**Spec:** `docs/superpowers/specs/2026-09-30-skill-paths-vfx-layering-design.md`

## Global Constraints

- Keep work on `codex/high-detail-generated-pixel-art`; do not modify `main`.
- Preserve five skill slots and six enhancement slots in single-player and four plus four in local co-op.
- Preserve enhancement max level four and the existing alternating P1 odd/P2 even upgrade order.
- Lv.6 awakening requires both a selected route and any configured `AWAKENING_REQUIREMENTS` enhancement.
- Do not change the XP curve, boss HP, spawn pacing, base weapon damage, or UI navigation structure.
- Every new Chinese string requires an English mapping; English mode must not retain route names or descriptions in Chinese.
- Route effects must be simulation behavior represented by `CombatEvent`, never renderer-only behavior.

## Review Focus

- A Lv.3 upgrade during a queued co-op level-up must resume the remaining queue after route selection; Task 2 tests P1 and P2 queue continuation.
- A treasure replacement must delete the removed skill route before the new skill reaches Lv.3; Task 4 tests stale-route removal.
- A configured awakening requirement obtained after Lv.6 must awaken the already-selected route; Task 2 tests delayed awakening.
- Beta mode must reject launch when any selected Lv.3+ skill lacks a valid route; Task 4 tests validation and route rebuilding.
- Runtime mechanics must operate on the casting player rather than always P1; Tasks 6 and 7 exercise route events from both player entities.

---

### Task 1: Route Catalog And Player State

**Files:**
- Create: `src/sim/skillPaths.ts`
- Modify: `src/sim/types.ts`
- Modify: `src/sim/state.ts`
- Modify: `src/sim/GameSimulation.ts`
- Test: `tests/sim/skillPaths.test.ts`

**Interfaces:**
- Consumes: `SKILL_IDS`, `SkillId`/`UpgradeId`, and `Player` from the current simulation model.
- Produces: `SkillPathKey`, `SkillPathDefinition`, `SKILL_PATHS`, `getSkillPathDefinition(skill, key)`, `hasSkillPath(player, skill, key?)`, `needsSkillPath(player, skill)`, and `clearSkillPath(player, skill)`.

- [ ] **Step 1: Write the failing catalog and default-state tests**

```ts
it('defines exactly two routes for every skill', () => {
  expect(Object.keys(SKILL_PATHS)).toEqual(SKILL_IDS);
  for (const skill of SKILL_IDS) {
    expect(Object.keys(SKILL_PATHS[skill])).toEqual(['a', 'b']);
    expect(SKILL_PATHS[skill].a.nameZh).not.toBe(SKILL_PATHS[skill].b.nameZh);
  }
});

it('creates independent empty route maps for both players', () => {
  const state = createDefaultState();
  expect(state.player.skillPaths).toEqual({});
  new GameSimulation(state).enableLocalCoop();
  expect(state.partner?.skillPaths).toEqual({});
  expect(state.partner?.skillPaths).not.toBe(state.player.skillPaths);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm.cmd test -- tests/sim/skillPaths.test.ts`

Expected: FAIL because `skillPaths.ts` and `Player.skillPaths` do not exist.

- [ ] **Step 3: Add route types, all 36 catalog records, and independent state maps**

```ts
export type SkillPathKey = 'a' | 'b';
export interface SkillPathDefinition {
  skill: SkillId;
  key: SkillPathKey;
  nameZh: string;
  nameEn: string;
  coreZh: string;
  coreEn: string;
  level4Zh: string;
  level4En: string;
  level5Zh: string;
  level5En: string;
  awakeningNameZh: string;
  awakeningNameEn: string;
}
export type SkillPathMap = Partial<Record<SkillId, SkillPathKey>>;
```

Populate each route exactly as specified in the design table. Add `skillPaths: {}` to the default player and clone it as `{ ...player.skillPaths }` when creating P2.

- [ ] **Step 4: Run focused and state/co-op regressions**

Run: `npm.cmd test -- tests/sim/skillPaths.test.ts tests/sim/coOp.test.ts tests/sim/GameSimulation.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/sim/skillPaths.ts src/sim/types.ts src/sim/state.ts src/sim/GameSimulation.ts tests/sim/skillPaths.test.ts
git commit -m "feat: add skill route catalog"
```

### Task 2: Lv.3 Route Choice State Machine And Awakening Gate

**Files:**
- Modify: `src/sim/types.ts`
- Modify: `src/sim/state.ts`
- Modify: `src/sim/GameSimulation.ts`
- Modify: `src/sim/awakening.ts`
- Test: `tests/sim/skillPathProgression.test.ts`
- Test: `tests/sim/awakeningRequirements.test.ts`
- Test: `tests/sim/coOp.test.ts`

**Interfaces:**
- Consumes: `needsSkillPath`, `SkillPathKey`, `GameSimulation.showNextCoopUpgradeOrResume`, `getAwakenedSkills`.
- Produces: `GamePhase` value `skill-path-choice`, `GameState.pendingSkillPath`, `GameSimulation.chooseSkillPath(key)`, and route-aware `isUpgradeAwakened`.

- [ ] **Step 1: Write failing transition tests**

```ts
it('pauses exactly once for a route when a skill reaches level three', () => {
  const state = createDefaultState();
  const sim = new GameSimulation(state);
  applyUpgrade(state, 'thunder-ring');
  applyUpgrade(state, 'thunder-ring');
  state.phase = 'upgrade';
  state.upgradeChoices = ['thunder-ring'];
  sim.chooseUpgrade('thunder-ring');
  expect(state.phase).toBe('skill-path-choice');
  expect(state.pendingSkillPath).toMatchObject({ playerId: 'p1', skill: 'thunder-ring' });
  sim.chooseSkillPath('b');
  expect(state.player.skillPaths['thunder-ring']).toBe('b');
  expect(state.phase).toBe('playing');
});

it('requires a route and matching enhancement before awakening', () => {
  const state = createDefaultState();
  for (let i = 0; i < 6; i += 1) applyUpgrade(state, 'meteor-seal');
  applyUpgrade(state, 'boss-slayer');
  expect(isUpgradeAwakened(state.player, 'meteor-seal')).toBe(false);
  state.player.skillPaths['meteor-seal'] = 'a';
  expect(isUpgradeAwakened(state.player, 'meteor-seal')).toBe(true);
});
```

Add a co-op test that routes P1, resumes the queue, routes P2, and confirms `pendingUpgradePlayerId` advances without losing a queued level.

- [ ] **Step 2: Run progression tests and verify RED**

Run: `npm.cmd test -- tests/sim/skillPathProgression.test.ts tests/sim/awakeningRequirements.test.ts tests/sim/coOp.test.ts`

Expected: FAIL because the phase, pending state, chooser, and awakening route gate are missing.

- [ ] **Step 3: Implement pending-route state and resume behavior**

```ts
export interface PendingSkillPath {
  playerId: 'p1' | 'p2';
  skill: SkillId;
  resumePhase: 'playing' | 'upgrade';
}

public chooseSkillPath(key: SkillPathKey): void {
  const pending = this.state.pendingSkillPath;
  if (this.state.phase !== 'skill-path-choice' || !pending) return;
  const player = pending.playerId === 'p2' ? this.state.partner : this.state.player;
  if (!player || player.upgradeLevels[pending.skill] < 3 || player.skillPaths[pending.skill]) return;
  player.skillPaths[pending.skill] = key;
  this.state.pendingSkillPath = null;
  this.resumeAfterSkillPathChoice(pending.resumePhase);
}
```

In `chooseUpgrade`, after a successful Lv.3 skill upgrade, clear choices, save the player/skill/resume state, and enter `skill-path-choice` before any awakening/resume action. Make `isUpgradeAwakened` return false for skills without a selected route, while still requiring configured enhancements.

- [ ] **Step 4: Add delayed-awakening and invalid-choice assertions**

Test that an invalid route key/state mutation is ignored, and that selecting a route at Lv.6 then adding `boss-slayer` produces `meteor-seal` in `getAwakenedSkills`.

- [ ] **Step 5: Run progression, awakening, co-op, and full tests**

Run: `npm.cmd test -- tests/sim/skillPathProgression.test.ts tests/sim/awakeningRequirements.test.ts tests/sim/coOp.test.ts`

Run: `npm.cmd test`

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add src/sim/types.ts src/sim/state.ts src/sim/GameSimulation.ts src/sim/awakening.ts tests/sim/skillPathProgression.test.ts tests/sim/awakeningRequirements.test.ts tests/sim/coOp.test.ts
git commit -m "feat: add skill route progression"
```

### Task 3: Route Choice HUD And Bilingual Copy

**Files:**
- Modify: `src/ui/HudController.ts`
- Modify: `src/scenes/GameScene.ts`
- Modify: `src/i18n/uiText.ts`
- Modify: `src/styles.css`
- Test: `tests/ui/HudController.test.ts`
- Test: `tests/ui/responsiveSkillPathChoice.test.ts`

**Interfaces:**
- Consumes: `state.pendingSkillPath`, `getSkillPathDefinition`, and `GameSimulation.chooseSkillPath`.
- Produces: callback `onChooseSkillPath(key)`, `[data-skill-path]` route cards, and `.skill-path-panel` responsive styles.

- [ ] **Step 1: Write failing HUD interaction and localization tests**

```ts
it('renders two route cards and dispatches the selected key', () => {
  state.phase = 'skill-path-choice';
  state.player.upgradeLevels['thunder-ring'] = 3;
  state.pendingSkillPath = { playerId: 'p1', skill: 'thunder-ring', resumePhase: 'playing' };
  hud.render(state, settings);
  expect(root.querySelectorAll('[data-skill-path]')).toHaveLength(2);
  click(root.querySelector('[data-skill-path="b"]'));
  expect(callbacks.onChooseSkillPath).toHaveBeenCalledWith('b');
});
```

Add a source/style test asserting the panel has a viewport max-height, overflow scrolling, and a vertical narrow-screen route grid. Add English-mode assertions for title, both route names, descriptions, and Lv.4/Lv.5/Lv.6 labels.

- [ ] **Step 2: Run HUD tests and verify RED**

Run: `npm.cmd test -- tests/ui/HudController.test.ts tests/ui/responsiveSkillPathChoice.test.ts`

Expected: FAIL because the callback, phase rendering, and styles are missing.

- [ ] **Step 3: Add route UI and callback wiring**

Render two buttons for the pending skill. Each card includes route name, core mechanic, Lv.4, Lv.5, and awakening name. Use the existing language setting to select catalog `Zh` or `En` fields. Wire `GameScene` to `simulation.chooseSkillPath`.

```ts
onChooseSkillPath: (path: SkillPathKey) => void;
```

- [ ] **Step 4: Add responsive CSS without nesting cards**

Use a full-screen overlay with an unframed constrained panel, two columns at desktop, one column under 760px, `max-height: calc(100vh - 16px)`, and `overflow-y: auto`. Keep buttons at stable heights and do not reduce text size by viewport width.

- [ ] **Step 5: Run focused tests and build**

Run: `npm.cmd test -- tests/ui/HudController.test.ts tests/ui/responsiveSkillPathChoice.test.ts`

Run: `npm.cmd run build`

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add src/ui/HudController.ts src/scenes/GameScene.ts src/i18n/uiText.ts src/styles.css tests/ui/HudController.test.ts tests/ui/responsiveSkillPathChoice.test.ts
git commit -m "feat: add skill route choice UI"
```

### Task 4: Beta Loadout, Treasure Replacement, And Preview Compatibility

**Files:**
- Modify: `src/sim/types.ts`
- Modify: `src/sim/state.ts`
- Modify: `src/sim/GameSimulation.ts`
- Modify: `src/scenes/GameScene.ts`
- Modify: `src/ui/HudController.ts`
- Test: `tests/testing/betaMode.test.ts`
- Test: `tests/sim/treasureReplacement.test.ts`
- Test: `tests/ui/responsiveBetaLoadout.test.ts`

**Interfaces:**
- Consumes: `SkillPathMap`, `clearSkillPath`, `getSkillPathDefinition`.
- Produces: `GameState.betaSkillPaths`, `onSetBetaSkillPath(skill, key)`, route-aware `launchBetaMode`, and stale-route cleanup during replacement.

- [ ] **Step 1: Write failing beta and replacement tests**

```ts
it('clears the route of a replaced skill', () => {
  state.player.skillPaths['thunder-ring'] = 'b';
  state.pendingTreasureUpgrade = 'fire-burst';
  state.phase = 'treasure-replace';
  sim.confirmTreasureReplacement(state.player.equippedSkills.indexOf('thunder-ring'));
  expect(state.player.skillPaths['thunder-ring']).toBeUndefined();
});

it('requires beta routes for selected level-three skills', () => {
  state.betaSkillSelections = ['thunder-ring'];
  state.betaSkillLevels['thunder-ring'] = 6;
  state.betaSkillPaths = {};
  expect(canLaunchBetaLoadout(state)).toBe(false);
});
```

- [ ] **Step 2: Run focused tests and verify RED**

Run: `npm.cmd test -- tests/testing/betaMode.test.ts tests/sim/treasureReplacement.test.ts tests/ui/responsiveBetaLoadout.test.ts`

Expected: FAIL because route configuration and cleanup are missing.

- [ ] **Step 3: Implement beta route controls and launch validation**

Add A/B segmented controls only for selected Lv.3+ skills. Set route A when a selected skill is raised across Lv.3 unless the tester already chose B. Clear beta route state when deselecting or lowering below Lv.3. Disable launch and list missing routes when validation fails. During launch, apply levels, assign configured routes, then recalculate once so awakening gates use the correct route.

- [ ] **Step 4: Clear route ownership on every skill replacement path**

Call `clearSkillPath` before resetting the replaced skill level. Add assertions for both direct treasure replacement and cancel/reopen flows.

- [ ] **Step 5: Run focused tests, full tests, and build**

Run: `npm.cmd test -- tests/testing/betaMode.test.ts tests/sim/treasureReplacement.test.ts tests/ui/responsiveBetaLoadout.test.ts`

Run: `npm.cmd test`

Run: `npm.cmd run build`

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add src/sim/types.ts src/sim/state.ts src/sim/GameSimulation.ts src/scenes/GameScene.ts src/ui/HudController.ts tests/testing/betaMode.test.ts tests/sim/treasureReplacement.test.ts tests/ui/responsiveBetaLoadout.test.ts
git commit -m "feat: configure routes in beta and treasure flows"
```

### Task 5: Route-Derived Stats And Upgrade Preview

**Files:**
- Create: `src/sim/skillPathEffects.ts`
- Modify: `src/sim/loadout.ts`
- Modify: `src/sim/upgradePreview.ts`
- Modify: `src/sim/upgrades.ts`
- Test: `tests/sim/skillPathEffects.test.ts`
- Test: `tests/sim/upgradePreview.test.ts`

**Interfaces:**
- Consumes: route catalog and `Player` base values rebuilt by `recalculatePlayerBuild`.
- Produces: `applySkillPathLevelEffects(player)`, `getSkillPathMechanics(player, skill)`, and route-aware preview rows.

- [ ] **Step 1: Write failing derived-stat and preview tests**

Cover at least one route in every mechanic family: projectile count, cooldown, radius, duration, targeting, bullet interaction, and delayed field. Assert that rebuilding twice produces identical values rather than stacking bonuses.

```ts
it('applies route values idempotently after base rebuild', () => {
  player.upgradeLevels['meteor-seal'] = 5;
  player.skillPaths['meteor-seal'] = 'a';
  recalculatePlayerBuild(player);
  const first = [player.meteorCount, player.meteorCooldownMs];
  recalculatePlayerBuild(player);
  expect([player.meteorCount, player.meteorCooldownMs]).toEqual(first);
});
```

- [ ] **Step 2: Run focused tests and verify RED**

Run: `npm.cmd test -- tests/sim/skillPathEffects.test.ts tests/sim/upgradePreview.test.ts`

Expected: FAIL because route-derived effects and preview rows do not exist.

- [ ] **Step 3: Implement pure route mechanics lookup and post-base application**

Keep booleans/counters that describe runtime behavior in a returned `SkillPathMechanics` object rather than expanding `Player` with dozens of route-only fields. Apply only true derived stats such as radius/count/cooldown after all base levels and meta bonuses are rebuilt.

```ts
export interface SkillPathMechanics {
  secondaryBurst: boolean;
  lingeringField: boolean;
  blocksProjectiles: boolean;
  seeksElites: boolean;
  returningPulse: boolean;
  // Include every route flag used by Tasks 6 and 7 as explicit booleans or small numeric values.
}
```

- [ ] **Step 4: Make upgrade previews show the selected route and next mechanism**

At Lv.3 preview both route-choice requirement and the base level increase. At Lv.4/Lv.5 select route-specific catalog copy. At Lv.6 show route awakening name and matching-enhancement requirement when unmet.

- [ ] **Step 5: Run focused and full tests**

Run: `npm.cmd test -- tests/sim/skillPathEffects.test.ts tests/sim/upgradePreview.test.ts tests/sim/skillProgression.test.ts`

Run: `npm.cmd test`

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add src/sim/skillPathEffects.ts src/sim/loadout.ts src/sim/upgradePreview.ts src/sim/upgrades.ts tests/sim/skillPathEffects.test.ts tests/sim/upgradePreview.test.ts
git commit -m "feat: apply skill route progression effects"
```

### Task 6: Runtime Mechanics For Core Ten Skills

**Files:**
- Modify: `src/sim/types.ts`
- Modify: `src/sim/GameSimulation.ts`
- Modify: `src/render/effectSpecs.ts`
- Modify: `src/render/EffectRenderer.ts`
- Test: `tests/sim/skillPathCombatCore.test.ts`
- Test: `tests/render/effectSpecs.test.ts`

**Interfaces:**
- Consumes: `getSkillPathMechanics`, route-aware `isUpgradeAwakened`, enemy projectile state, and `dealDamage`.
- Produces: mechanics and route-styled events for thunder ring, chain lightning, fire burst, golden shield, frost seal, orbiting blades, meteor seal, north star, bullet reprisal, and soul pin.

- [ ] **Step 1: Write one failing behavior test per route**

Use deterministic states and direct simulation updates. Assert observable state/event changes for all 20 routes: knockback versus outward pulse, unique-target branching versus return arc, secondary burst versus lingering field, projectile reflection versus stored retaliation, freeze stacks versus death spread, projectile guard versus elite pursuit, satellite meteors versus lava field, orbit-before-fire versus elite homing, reflected blade versus qi accumulation, and area slow versus linked damage.

For co-op, add one P2 route assertion using a route whose cast method accepts `player`, proving its event origin matches P2 coordinates.

- [ ] **Step 2: Run combat tests and verify RED**

Run: `npm.cmd test -- tests/sim/skillPathCombatCore.test.ts`

Expected: FAIL because route mechanics/events are not implemented.

- [ ] **Step 3: Implement mechanics in existing skill update/collision paths**

Add only the minimum transient state needed to `Enemy`, `Player`, or `GameState`: frost stacks, link owner/expiry, shield retaliation charge, and lingering area arrays. Route actions emit existing events with a new optional `path?: SkillPathKey`, or a narrowly scoped new event when no existing geometry can represent the mechanic.

- [ ] **Step 4: Extend exhaustive effect mappings for every new event or path style**

Update the `CombatEvent` union first, then `effectSpecs.ts`, then `EffectRenderer.ts`. Route visuals must use distinct geometry/silhouette and existing generated textures; no new image assets are required.

- [ ] **Step 5: Run focused tests, full tests, and build**

Run: `npm.cmd test -- tests/sim/skillPathCombatCore.test.ts tests/render/effectSpecs.test.ts`

Run: `npm.cmd test`

Run: `npm.cmd run build`

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add src/sim/types.ts src/sim/GameSimulation.ts src/render/effectSpecs.ts src/render/EffectRenderer.ts tests/sim/skillPathCombatCore.test.ts tests/render/effectSpecs.test.ts
git commit -m "feat: add core skill route mechanics"
```

### Task 7: Runtime Mechanics For Advanced Eight Skills

**Files:**
- Modify: `src/sim/types.ts`
- Modify: `src/sim/GameSimulation.ts`
- Modify: `src/render/effectSpecs.ts`
- Modify: `src/render/EffectRenderer.ts`
- Test: `tests/sim/skillPathCombatAdvanced.test.ts`
- Test: `tests/render/effectSpecs.test.ts`

**Interfaces:**
- Consumes: the same route mechanics/event conventions established by Task 6.
- Produces: mechanics and route-styled events for solar ray, void bell, spirit sword rain, storm net, mirror sigil, frost domain, rift return, and star pull.

- [ ] **Step 1: Write one failing behavior test per route**

Assert observable behavior for all 16 routes: sweeping beam versus refraction, outward purge versus inward collapse, boss focus versus moving sword wall, fixed root zone versus moving storm cloud, directional reflection versus copied sword volley, center freeze versus frozen projectile conversion, parallel return track versus portal replay, and enemy-count burst versus orbiting stars.

Include an awakened assertion per skill that proves the chosen route changes behavior beyond a numeric multiplier.

- [ ] **Step 2: Run combat tests and verify RED**

Run: `npm.cmd test -- tests/sim/skillPathCombatAdvanced.test.ts`

Expected: FAIL because advanced route mechanics/events are absent.

- [ ] **Step 3: Implement advanced route mechanics**

Reuse existing projectile, enemy projectile, timer, and area systems. Add bounded arrays with explicit expiry for moving fields, portal points, and orbiting stars; remove expired objects in the same update that owns them. Never create renderer-only damage.

- [ ] **Step 4: Map route events and verify visual distinctions**

Extend exhaustive event mappings and use route-specific color/geometry while preserving enemy bullet visibility. Every new persistent render object must have a simulation lifetime and deterministic cleanup.

- [ ] **Step 5: Run focused tests, full tests, and build**

Run: `npm.cmd test -- tests/sim/skillPathCombatAdvanced.test.ts tests/render/effectSpecs.test.ts`

Run: `npm.cmd test`

Run: `npm.cmd run build`

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add src/sim/types.ts src/sim/GameSimulation.ts src/render/effectSpecs.ts src/render/EffectRenderer.ts tests/sim/skillPathCombatAdvanced.test.ts tests/render/effectSpecs.test.ts
git commit -m "feat: add advanced skill route mechanics"
```

### Task 8: Route-Aware Awakening Presentation And End-To-End Verification

**Files:**
- Modify: `src/sim/upgrades.ts`
- Modify: `src/ui/HudController.ts`
- Modify: `src/i18n/uiText.ts`
- Modify: `src/render/awakeningVisuals.ts`
- Modify: `src/scenes/GameScene.ts`
- Test: `tests/render/awakeningVisuals.test.ts`
- Test: `tests/ui/HudController.test.ts`
- Test: `tests/sim/skillPathProgression.test.ts`

**Interfaces:**
- Consumes: selected route definition and route-styled runtime events.
- Produces: route-specific `AwakeningNotice`, route labels in skill HUD/beta loadout, and browser-verifiable route previews.

- [ ] **Step 1: Write failing route-awakening presentation tests**

Assert that A/B routes of one skill produce different awakening names, summaries, visual symbols, and accent colors; assert English mode displays the English route and awakening names.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `npm.cmd test -- tests/render/awakeningVisuals.test.ts tests/ui/HudController.test.ts tests/sim/skillPathProgression.test.ts`

Expected: FAIL because notices and HUD labels still use the base awakening copy.

- [ ] **Step 3: Build route-specific notices and HUD labels**

Read the player's selected route whenever creating `AwakeningNotice`. Show a compact route badge on equipped skills, upgrade cards, and beta cards. Preserve existing awakening animation and add route-specific symbol/color selection without changing its duration.

- [ ] **Step 4: Add development previews for both route choice and awakened routes**

Support `?preview=skill-path` and `?preview=skill-path-awakening-b` so browser QA can inspect both states without grinding levels.

- [ ] **Step 5: Run complete automated verification**

Run: `npm.cmd test`

Run: `npm.cmd run build`

Expected: all tests and TypeScript/Vite build pass with no warnings from application code.

- [ ] **Step 6: Run browser verification**

Open desktop `1280x720` and narrow `691x704` previews. Select both route cards, launch beta mode with explicit routes, verify P1/P2 route ownership, replace one routed skill, and inspect a delayed Lv.6 awakening. Confirm no overlaps and no untranslated route text in English mode.

- [ ] **Step 7: Commit**

```powershell
git add src/sim/upgrades.ts src/ui/HudController.ts src/i18n/uiText.ts src/render/awakeningVisuals.ts src/scenes/GameScene.ts tests/render/awakeningVisuals.test.ts tests/ui/HudController.test.ts tests/sim/skillPathProgression.test.ts
git commit -m "feat: present route-specific awakenings"
```

