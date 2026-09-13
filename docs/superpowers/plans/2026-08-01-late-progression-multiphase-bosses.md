# Late Progression and Multiphase Bosses Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Accelerate upgrades after five minutes and add a deterministic three-boss rotation with readable two-phase skills.

**Architecture:** Keep progression and boss selection as pure functions. Add a focused `bossSkills.ts` module for hazard creation and geometry, while `GameSimulation` owns timers, damage, phase transitions, and cleanup; Phaser consumes state and events for presentation only.

**Tech Stack:** TypeScript, Phaser 3, Vitest, Vite.

## Global Constraints

- Normal enemies retain 3 experience before 5:00 and gain a `1.2 ** floor(elapsedMs / 300000)` multiplier afterward.
- Level requirements use `floor(previous * 1.22 + 4)` through level 11 and `floor(previous * 1.14 + 4)` from level 12 onward.
- Bosses appear every five minutes in `crimson`, `thunder`, `blood-moon` order.
- Every boss enters phase 2 once at 50% health; unresolved owned hazards are cleared.
- All skill attacks are telegraphed and use shared shield, dodge, invulnerability, damage, and death behavior.
- Existing chest and boss experience rewards remain unchanged.
- The workspace is not a Git repository, so commit steps are omitted.

---

### Task 1: Late-Game Progression Functions

**Files:**
- Modify: `src/sim/spawnPacing.ts`
- Modify: `src/sim/GameSimulation.ts`
- Test: `tests/sim/spawnPacing.test.ts`
- Test: `tests/sim/GameSimulation.test.ts`

**Interfaces:**
- Produces: `getNormalEnemyExperience(elapsedMs: number): number`
- Produces: `getNextExperienceRequirement(previous: number, reachedLevel: number): number`

- [ ] **Step 1: Write failing boundary tests**

```ts
expect(getNormalEnemyExperience(299_999)).toBe(3);
expect(getNormalEnemyExperience(300_000)).toBeCloseTo(3.6);
expect(getNormalEnemyExperience(600_000)).toBeCloseTo(4.32);
expect(getNextExperienceRequirement(100, 11)).toBe(126);
expect(getNextExperienceRequirement(100, 12)).toBe(118);
```

- [ ] **Step 2: Run the focused tests and verify failure**

Run: `npm.cmd test -- --run tests/sim/spawnPacing.test.ts tests/sim/GameSimulation.test.ts`

- [ ] **Step 3: Implement the pure functions and use them at spawn/level-up time**

```ts
export function getNormalEnemyExperience(elapsedMs: number): number {
  return 3 * 1.2 ** Math.floor(Math.max(0, elapsedMs) / 300_000);
}

export function getNextExperienceRequirement(previous: number, reachedLevel: number): number {
  const growth = reachedLevel >= 12 ? 1.14 : 1.22;
  return Math.floor(previous * growth + 4);
}
```

- [ ] **Step 4: Run focused tests and verify pass**

Run: `npm.cmd test -- --run tests/sim/spawnPacing.test.ts tests/sim/GameSimulation.test.ts`

### Task 2: Boss Types, Rotation, and Phase State

**Files:**
- Create: `src/sim/bossSkills.ts`
- Modify: `src/sim/types.ts`
- Modify: `src/sim/GameSimulation.ts`
- Modify: `src/sim/spawnPacing.ts`
- Test: `tests/sim/bossSkills.test.ts`
- Test: `tests/sim/GameSimulation.test.ts`

**Interfaces:**
- Produces: `type BossType = 'crimson' | 'thunder' | 'blood-moon'`
- Produces: `getBossTypeForWave(wave: number): BossType`
- Produces: `getBossDisplayName(type: BossType): string`
- Adds boss fields: `bossType`, `bossPhase`, `bossSkillTimerMs`, `bossSecondaryTimerMs`, `bossCastCount`

- [ ] **Step 1: Write failing rotation and phase-transition tests**

```ts
expect(Array.from({length: 6}, (_, i) => getBossTypeForWave(i + 1))).toEqual([
  'crimson', 'thunder', 'blood-moon', 'crimson', 'thunder', 'blood-moon',
]);
// Damage a boss below 50%, update once, then assert phase 2 and one event.
```

- [ ] **Step 2: Run focused tests and verify failure**

Run: `npm.cmd test -- --run tests/sim/bossSkills.test.ts tests/sim/GameSimulation.test.ts`

- [ ] **Step 3: Add boss types, deterministic selection, initialized timers, and one-time phase transition**

```ts
export function getBossTypeForWave(wave: number): BossType {
  return BOSS_TYPES[(Math.max(1, wave) - 1) % BOSS_TYPES.length];
}
```

- [ ] **Step 4: Run focused tests and verify pass**

Run: `npm.cmd test -- --run tests/sim/bossSkills.test.ts tests/sim/GameSimulation.test.ts`

### Task 3: Hazard Model and Shared Skill Damage

**Files:**
- Modify: `src/sim/types.ts`
- Modify: `src/sim/state.ts`
- Modify: `src/sim/bossSkills.ts`
- Modify: `src/sim/GameSimulation.ts`
- Test: `tests/sim/bossSkills.test.ts`
- Test: `tests/sim/GameSimulation.test.ts`

**Interfaces:**
- Produces: `BossHazard` discriminated union for charge, circle, line, and ring geometry
- Produces: `isPointInsideBossHazard(hazard: BossHazard, point: Vector): boolean`
- Adds `GameState.bossHazards: BossHazard[]`

- [ ] **Step 1: Write failing geometry and shared-damage tests**

```ts
expect(isPointInsideBossHazard(chargeHazard, {x: 300, y: 200})).toBe(true);
expect(isPointInsideBossHazard(ringHazard, {x: 200, y: 100})).toBe(true);
// Assert shield absorbs a hazard, dodge prevents it, and invulnerability blocks repeats.
```

- [ ] **Step 2: Run focused tests and verify failure**

Run: `npm.cmd test -- --run tests/sim/bossSkills.test.ts tests/sim/GameSimulation.test.ts`

- [ ] **Step 3: Implement hazard timing, collision, one-hit tracking, and shared player damage helper**

```ts
interface BossHazardBase {
  id: number;
  ownerBossId: number;
  telegraphRemainingMs: number;
  activeRemainingMs: number;
  damageMultiplier: number;
  hasDamagedPlayer: boolean;
}
```

- [ ] **Step 4: Run focused tests and verify pass**

Run: `npm.cmd test -- --run tests/sim/bossSkills.test.ts tests/sim/GameSimulation.test.ts`

### Task 4: Three Two-Phase Boss Skill Sets

**Files:**
- Modify: `src/sim/bossSkills.ts`
- Modify: `src/sim/GameSimulation.ts`
- Test: `tests/sim/bossSkills.test.ts`
- Test: `tests/sim/GameSimulation.test.ts`

**Interfaces:**
- Consumes: `BossType`, `BossHazard`, seeded random values, boss/player positions
- Produces: `createBossPrimaryHazards(...)`, `createBossSecondaryHazards(...)`

- [ ] **Step 1: Write failing timing and quantity tests for all six phase behaviors**

```ts
// Crimson: 900ms charge warning; phase 2 creates a ring after charge.
// Thunder: 3 circles in phase 1, 5 in phase 2, cross every second phase-2 cast.
// Blood moon: expanding ring; phase 2 creates 3 seals and heals 4% on a successful hit.
```

- [ ] **Step 2: Run focused tests and verify failure**

Run: `npm.cmd test -- --run tests/sim/bossSkills.test.ts tests/sim/GameSimulation.test.ts`

- [ ] **Step 3: Implement the exact cooldowns, telegraphs, geometry, damage multipliers, charge movement, and healing from the approved spec**

```ts
const PRIMARY_COOLDOWNS = {
  crimson: [7000, 5200],
  thunder: [6500, 4800],
  'blood-moon': [7000, 5200],
} as const;
```

- [ ] **Step 4: Add death and phase-transition cleanup plus independent multi-boss timers**

- [ ] **Step 5: Run focused tests and verify pass**

Run: `npm.cmd test -- --run tests/sim/bossSkills.test.ts tests/sim/GameSimulation.test.ts`

### Task 5: Boss Rendering, Telegraphs, and HUD

**Files:**
- Modify: `src/render/ShapeFactory.ts`
- Modify: `src/render/effectSpecs.ts`
- Modify: `src/render/EffectRenderer.ts`
- Modify: `src/scenes/GameScene.ts`
- Modify: `src/ui/HudController.ts`
- Modify: `src/styles.css`
- Test: `tests/render/effectSpecs.test.ts`

**Interfaces:**
- Consumes: `GameState.bossHazards`, boss type/phase, boss combat events
- Produces: distinct silhouettes, ground telegraphs, active effects, phase HUD notice

- [ ] **Step 1: Write failing effect-spec mappings for cast, activation, phase change, and healing**

```ts
expect(specs.map((spec) => spec.kind)).toContain('boss-cast');
expect(specs.map((spec) => spec.kind)).toContain('boss-phase');
```

- [ ] **Step 2: Run render tests and verify failure**

Run: `npm.cmd test -- --run tests/render/effectSpecs.test.ts`

- [ ] **Step 3: Draw boss-specific silhouettes and hazard telegraph/active states**

- [ ] **Step 4: Add HUD boss name, phase, and second-stage skill notice without changing the existing compact HUD structure**

- [ ] **Step 5: Run render tests and full unit suite**

Run: `npm.cmd test`

### Task 6: Complete Verification

**Files:**
- Verify all modified files.

**Interfaces:**
- Consumes: complete implementation
- Produces: test, build, and browser evidence

- [ ] **Step 1: Run the full tests**

Run: `npm.cmd test`
Expected: all test files pass with zero failures.

- [ ] **Step 2: Run the production build**

Run: `npm.cmd run build`
Expected: TypeScript and Vite exit successfully; the known Phaser chunk-size warning may remain.

- [ ] **Step 3: Verify desktop browser previews for each boss and phase**

Check canvas rendering, telegraph visibility, phase notice, HUD labels, and console errors.

- [ ] **Step 4: Verify a 390 by 844 mobile viewport**

Check that the top HUD, boss bar, phase notice, player, and telegraphs do not overlap incoherently or overflow.
