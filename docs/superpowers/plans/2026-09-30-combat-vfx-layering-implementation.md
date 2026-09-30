# Combat VFX Layering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep enemy danger and objectives readable during late-game effect saturation while preserving the current bright generated-pixel spectacle at high density.

**Architecture:** A pure effect-policy module assigns every `EffectKind` a priority and per-frame budget. `EffectRenderer` consumes that policy, pools or merges bounded objects, and centralizes depth/shake decisions; `GameScene` renders persistent world threats and edge indicators using shared depth constants.

**Tech Stack:** TypeScript 6, Vitest 4, Phaser 4, Vite 8, Playwright 1.60.

**Spec:** `docs/superpowers/specs/2026-09-30-skill-paths-vfx-layering-design.md`

## Global Constraints

- Keep `critical` effects visible at low, medium/standard, and high density.
- Reuse stored `effectLevel: 'low' | 'medium' | 'high'`; change only the displayed label from intensity to density.
- Low/standard/high per-frame creation limits are combat 20/36/64, ambient 8/16/28, and active damage-number caps 20/36/52.
- Do not lower global scene brightness or hide enemy projectiles, Boss telegraphs, break targets, player hit feedback, or stage objectives.
- Screen shake uses its own existing setting and keeps an 80ms ordinary cooldown.

## Review Focus

- A frame containing more critical effects than the normal budget must still render every distinct danger object; Task 1 tests critical bypass and de-duplication.
- Turning damage numbers off must not retain hidden merge entries or text objects; Task 3 tests cleanup.
- Re-entering the viewport must remove an edge indicator immediately rather than waiting for a timeout; Task 4 tests view-boundary transitions.
- Repeated persistent-area events must update one object instead of allocating every tick; Task 2 tests stable object count.
- A weak late event in the same frame must not replace a stronger pending shake; Task 2 tests strongest-per-frame selection and cooldown.

---

### Task 1: Effect Priorities, Budgets, And Shared Depths

**Files:**
- Create: `src/render/combatDepths.ts`
- Create: `src/render/effectPolicy.ts`
- Modify: `src/render/effectSpecs.ts`
- Test: `tests/render/effectPolicy.test.ts`
- Test: `tests/render/effectSpecs.test.ts`

**Interfaces:**
- Produces: `EffectPriority`, `EFFECT_FRAME_BUDGETS`, `getEffectPriority(kind)`, `selectEffectsForFrame(specs, level)`, and `COMBAT_DEPTHS`.
- Consumes: existing `EffectKind`, `EffectSpec`, and `EffectLevel`.

- [ ] **Step 1: Write failing pure-policy tests**

Create mixed arrays that exceed each budget. Assert all critical specs survive, combat specs retain boss/elite/route triggers before repeated hits, ambient specs stop at their cap, and duplicate critical specs sharing `identityKey` collapse to one.

- [ ] **Step 2: Run and verify RED**

Run: `npm.cmd test -- tests/render/effectPolicy.test.ts tests/render/effectSpecs.test.ts`

Expected: FAIL because policy/depth modules and priority metadata are missing.

- [ ] **Step 3: Implement the pure policy and depths**

```ts
export const EFFECT_FRAME_BUDGETS = {
  low: { combat: 20, ambient: 8, damageNumbers: 20 },
  medium: { combat: 36, ambient: 16, damageNumbers: 36 },
  high: { combat: 64, ambient: 28, damageNumbers: 52 },
} as const;

export const COMBAT_DEPTHS = {
  ground: 0,
  playerField: 7,
  playerProjectile: 12,
  enemy: 18,
  enemyProjectile: 24,
  bossTelegraph: 28,
  player: 30,
  worldIndicator: 36,
  hud: 100,
} as const;
```

- [ ] **Step 4: Run focused tests and commit**

Run: `npm.cmd test -- tests/render/effectPolicy.test.ts tests/render/effectSpecs.test.ts`

Expected: PASS.

```powershell
git add src/render/combatDepths.ts src/render/effectPolicy.ts src/render/effectSpecs.ts tests/render/effectPolicy.test.ts tests/render/effectSpecs.test.ts
git commit -m "feat: define combat effect priorities"
```

### Task 2: Budgeted Effect Renderer, Persistent Reuse, And Shake Arbitration

**Files:**
- Modify: `src/render/EffectRenderer.ts`
- Modify: `src/render/generatedPixelArt.ts`
- Modify: `src/scenes/GameScene.ts`
- Test: `tests/render/gameRenderer.test.ts`
- Test: `tests/render/generatedCombatLayers.test.ts`

**Interfaces:**
- Consumes: `selectEffectsForFrame`, `COMBAT_DEPTHS`, and existing generated texture resolvers.
- Produces: bounded renderer allocations, persistent effect identity reuse, and strongest-per-frame screen shake.

- [ ] **Step 1: Write failing renderer policy tests**

Assert that 100 repeated ambient events create only the configured count, a critical boss cast survives saturation, repeated persistent fields retain one active record, and multiple shake-worthy events call the camera once with the strongest amplitude.

- [ ] **Step 2: Run and verify RED**

Run: `npm.cmd test -- tests/render/gameRenderer.test.ts tests/render/generatedCombatLayers.test.ts`

Expected: FAIL because renderer still uses a total active-object budget and shakes per event.

- [ ] **Step 3: Refactor render admission and persistent identities**

Filter each incoming frame through `selectEffectsForFrame`. Assign shared depths instead of literal `12`. Maintain a `Map<string, ActiveEffect>` only for effects with an explicit identity; update age/spec/decal position on reuse and delete the map entry on destruction.

- [ ] **Step 4: Add shake arbitration**

Map effect kinds to severity, choose the strongest event in the frame, enforce 80ms between ordinary shakes, and let awakening, boss phase, and player critical-health events bypass the ordinary cooldown.

- [ ] **Step 5: Run focused, full tests, and build**

Run: `npm.cmd test -- tests/render/gameRenderer.test.ts tests/render/generatedCombatLayers.test.ts`

Run: `npm.cmd test`

Run: `npm.cmd run build`

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add src/render/EffectRenderer.ts src/render/generatedPixelArt.ts src/scenes/GameScene.ts tests/render/gameRenderer.test.ts tests/render/generatedCombatLayers.test.ts
git commit -m "feat: budget combat effects by priority"
```

### Task 3: Damage Number Identity And 120ms Merging

**Files:**
- Modify: `src/sim/types.ts`
- Modify: `src/sim/GameSimulation.ts`
- Modify: `src/render/EffectRenderer.ts`
- Test: `tests/sim/combatStats.test.ts`
- Test: `tests/render/gameRenderer.test.ts`

**Interfaces:**
- Consumes: enemy IDs and `DamageSource` at the central damage application point.
- Produces: `damage-dealt.targetId`, source/target merge keys, 120ms merging, and density-specific active-number caps.

- [ ] **Step 1: Write failing event and merge tests**

Assert `dealDamage` emits a stable enemy `targetId`; two same-target/same-source hits within 120ms update one label total; a different source or target creates another label; an event after 120ms creates a new label; disabling numbers clears merge state.

- [ ] **Step 2: Run and verify RED**

Run: `npm.cmd test -- tests/sim/combatStats.test.ts tests/render/gameRenderer.test.ts`

Expected: FAIL because damage events lack target identity and the renderer always allocates new labels.

- [ ] **Step 3: Add target identity and bounded merge records**

Use `${targetId}:${source}` as the ordinary merge key. Exclude player damage, boss-break damage, and explicitly marked burst/critical events. On merge, update accumulated value, reset age to zero, and apply a short scale pulse. Evict the oldest ordinary number when the active cap is reached.

- [ ] **Step 4: Run focused, full tests, and build**

Run: `npm.cmd test -- tests/sim/combatStats.test.ts tests/render/gameRenderer.test.ts`

Run: `npm.cmd test`

Run: `npm.cmd run build`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/sim/types.ts src/sim/GameSimulation.ts src/render/EffectRenderer.ts tests/sim/combatStats.test.ts tests/render/gameRenderer.test.ts
git commit -m "feat: merge repeated damage numbers"
```

### Task 4: Offscreen Boss, Objective, And Large-Hazard Indicators

**Files:**
- Create: `src/render/threatIndicators.ts`
- Modify: `src/scenes/GameScene.ts`
- Modify: `src/render/combatDepths.ts`
- Test: `tests/render/threatIndicators.test.ts`
- Test: `tests/scenes/GameScene.camera.test.ts`

**Interfaces:**
- Produces: `getThreatIndicators(state, cameraWorldView, safeMargin)`, stable threat IDs, clamped edge coordinates, angle, icon kind, and distance.
- Consumes: live bosses, active objectives, and active large boss hazards from `GameState`.

- [ ] **Step 1: Write failing geometry and lifecycle tests**

Assert only eligible offscreen threats are returned, coordinates remain inside safe margins, angles point toward world positions, entering the viewport removes the indicator, and expired/inactive hazards never appear.

- [ ] **Step 2: Run and verify RED**

Run: `npm.cmd test -- tests/render/threatIndicators.test.ts tests/scenes/GameScene.camera.test.ts`

Expected: FAIL because indicator geometry/rendering does not exist.

- [ ] **Step 3: Implement pure indicator geometry and pooled scene objects**

Create a stable ID for boss, objective, and hazard threats. In `GameScene`, reuse one container per ID at `COMBAT_DEPTHS.worldIndicator`, rotate an arrow toward the threat, display the relevant icon and rounded distance, and destroy containers absent from the latest result.

- [ ] **Step 4: Run focused, full tests, and build**

Run: `npm.cmd test -- tests/render/threatIndicators.test.ts tests/scenes/GameScene.camera.test.ts`

Run: `npm.cmd test`

Run: `npm.cmd run build`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/render/threatIndicators.ts src/render/combatDepths.ts src/scenes/GameScene.ts tests/render/threatIndicators.test.ts tests/scenes/GameScene.camera.test.ts
git commit -m "feat: indicate offscreen combat threats"
```

### Task 5: Settings Copy, Stress Verification, And Browser QA

**Files:**
- Modify: `src/ui/HudController.ts`
- Modify: `src/i18n/uiText.ts`
- Modify: `tests/settings/gameSettings.test.ts`
- Modify: `tests/ui/HudController.test.ts`
- Create: `tests/render/effectStress.test.ts`

**Interfaces:**
- Consumes: unchanged stored `effectLevel` schema and completed effect policy.
- Produces: “特效密度 / Effect Density” UI copy and a deterministic 20-minute-equivalent stress test.

- [ ] **Step 1: Write failing settings-copy and stress tests**

Assert old stored low/medium/high settings load unchanged, the UI label is density in both languages, and a synthetic 20-minute event stream keeps active effects, identity maps, labels, and indicators within their declared bounds.

- [ ] **Step 2: Run and verify RED**

Run: `npm.cmd test -- tests/settings/gameSettings.test.ts tests/ui/HudController.test.ts tests/render/effectStress.test.ts`

Expected: FAIL because copy and stress harness are missing.

- [ ] **Step 3: Update copy and expose read-only debug counts for tests**

Change only the setting label; preserve `effectLevel` storage values. Provide a test-only-friendly `getActiveCounts()` public method returning numbers without exposing mutable renderer collections.

- [ ] **Step 4: Run full automated verification**

Run: `npm.cmd test`

Run: `npm.cmd run build`

Expected: all tests pass and the production build completes.

- [ ] **Step 5: Run real browser comparison**

At `1280x720` and `691x704`, inspect low, medium, and high density during a boss wave and dense ordinary combat. Capture screenshots and confirm player fields remain bright, enemy bullets/telegraphs remain unobscured, edge indicators disappear on entry, and no UI overlaps.

- [ ] **Step 6: Commit**

```powershell
git add src/ui/HudController.ts src/i18n/uiText.ts tests/settings/gameSettings.test.ts tests/ui/HudController.test.ts tests/render/effectStress.test.ts
git commit -m "feat: finish combat effect density controls"
```

