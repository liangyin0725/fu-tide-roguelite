# 劫主战场目标 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为三位劫主的二阶段加入可摧毁的战场目标、成功易伤与失败强化。

**Architecture:** 在 `GameSimulation` 中维护独立于天劫目标的劫主目标状态，并将目标作为带 `ownerBossId` 的静止敌人纳入现有伤害与渲染循环。`bossArena.ts` 负责纯粹的类型映射、生命与强化参数；HUD 和特效层只消费模拟状态与事件。

**Tech Stack:** TypeScript、Phaser 4、Vitest、jsdom。

**Spec:** `docs/superpowers/specs/2026-09-06-boss-arena-objectives-design.md`

## Global Constraints

- 仅在劫主第一次进入二阶段生成一个归属目标，时限固定为 22 秒。
- 目标生命值必须是 `320 + bossWave * 130`，且不覆盖既有 `activeObjectiveId`。
- 成功提供 4 秒停滞、10 秒劫主易伤和经验；失败只强化归属劫主的后续技能。
- 不改变五分钟劫主周期、洞府、现有天劫目标、宝箱选择或角色构筑。
- 工作区不是 Git 仓库；每项完成后运行测试和构建，不执行提交命令。

---

## File Structure

- Create: `src/sim/bossArena.ts` — 劫主目标类型、三类配置、目标位置与强化参数。
- Modify: `src/sim/types.ts` — 劫主目标状态、敌人字段、战斗事件与目标类型。
- Modify: `src/sim/state.ts` — 劫主目标默认状态。
- Modify: `src/sim/GameSimulation.ts` — 生成、成功、超时、死亡清理、易伤与停滞结算。
- Modify: `src/sim/bossSkills.ts` — 按劫主失败强化调整后续危险区域。
- Modify: `src/ui/HudController.ts` — 劫主战场目标状态条。
- Modify: `src/render/effectSpecs.ts` — 目标生成与结算特效规格。
- Modify: `src/render/EffectRenderer.ts` — 三色生成、成功与失败反馈。
- Modify: `src/audio/GameAudio.ts` — 目标结算音色。
- Modify: `tests/sim/bossArena.test.ts` — 纯配置和位置规则。
- Modify: `tests/sim/GameSimulation.test.ts` — 生成、成功、超时和劫主死亡清理。
- Modify: `tests/ui/HudController.test.ts` — 劫主目标 HUD。
- Modify: `tests/render/effectSpecs.test.ts` — 特效事件映射。

### Task 1: 劫主战场目标配置与状态类型

**Files:**
- Create: `src/sim/bossArena.ts`
- Create: `tests/sim/bossArena.test.ts`
- Modify: `src/sim/types.ts`
- Modify: `src/sim/state.ts`

**Interfaces:**
- Produces `type BossObjectiveKind = 'crimson-anchor' | 'storm-pylon' | 'blood-well'`.
- Produces `getBossObjectiveKind(bossType)`, `getBossObjectiveHp(wave)`, `getBossObjectivePosition(boss, arena)`, and `getBossArenaModifiers(boss)`.
- `Enemy` gains `ownerBossId`, `bossObjectiveKind`, `bossArenaResolved`, `bossArenaEnraged`, `bossArenaVulnerableUntilMs`, and `bossArenaStunnedUntilMs`.
- `GameState` gains `activeBossObjectiveId` and `bossObjectiveExpiresAtMs`.

- [ ] **Step 1: Write failing configuration tests**

```ts
it('maps each boss to its arena objective and scales objective health by wave', () => {
  expect(getBossObjectiveKind('crimson')).toBe('crimson-anchor');
  expect(getBossObjectiveKind('thunder')).toBe('storm-pylon');
  expect(getBossObjectiveKind('blood-moon')).toBe('blood-well');
  expect(getBossObjectiveHp(3)).toBe(710);
});

it('keeps an arena target in bounds and away from its owner', () => {
  const position = getBossObjectivePosition({ x: 600, y: 420, radius: 42 } as Enemy, { width: 1280, height: 720 });
  expect(Math.hypot(position.x - 600, position.y - 420)).toBeGreaterThanOrEqual(210);
  expect(position.x).toBeGreaterThan(0);
  expect(position.y).toBeGreaterThan(0);
});
```

- [ ] **Step 2: Run the focused test to verify failure**

Run: `npm.cmd test -- --run tests/sim/bossArena.test.ts`

Expected: FAIL because `bossArena.ts` does not exist.

- [ ] **Step 3: Add the configuration module and default state**

```ts
export function getBossObjectiveHp(wave: number): number {
  return 320 + Math.max(1, wave) * 130;
}

export function getBossArenaModifiers(boss: Enemy): { hazardScale: number; extraThunderCircles: number; telegraphScale: number; bloodHealFraction: number } {
  return boss.bossArenaEnraged
    ? { hazardScale: 1.2, extraThunderCircles: boss.bossType === 'thunder' ? 2 : 0, telegraphScale: boss.bossType === 'thunder' ? 0.8 : 1, bloodHealFraction: boss.bossType === 'blood-moon' ? 0.07 : 0.04 }
    : { hazardScale: 1, extraThunderCircles: 0, telegraphScale: 1, bloodHealFraction: 0.04 };
}
```

Initialize `activeBossObjectiveId: null` and `bossObjectiveExpiresAtMs: 0` in `createDefaultState()`.

- [ ] **Step 4: Run focused configuration tests**

Run: `npm.cmd test -- --run tests/sim/bossArena.test.ts`

Expected: PASS.

### Task 2: 二阶段目标生成、成功与失败结算

**Files:**
- Modify: `src/sim/GameSimulation.ts`
- Modify: `src/sim/types.ts`
- Modify: `tests/sim/GameSimulation.test.ts`

**Interfaces:**
- `CombatEvent` gains `boss-objective-spawned` and `boss-objective-resolved` variants.
- `GameSimulation` produces a single stationary arena target when a boss transitions to phase two.
- A target success sets its owner `bossArenaStunnedUntilMs = elapsedMs + 4000` and `bossArenaVulnerableUntilMs = elapsedMs + 10000`; timeout sets `bossArenaEnraged = true`.

- [ ] **Step 1: Write failing lifecycle tests**

```ts
it('spawns one crimson arena target when its boss reaches phase two', () => {
  const state = createDefaultState();
  const sim = new GameSimulation(state);
  const boss = sim.spawnEnemy({ x: 700, y: 360, hp: 100, speed: 0, kind: 'boss', bossWave: 1, bossType: 'crimson' });
  boss.hp = 50;
  sim.update(16, { x: 0, y: 0 });
  const target = state.enemies.find((enemy) => enemy.id === state.activeBossObjectiveId);
  expect(target).toMatchObject({ bossObjectiveKind: 'crimson-anchor', ownerBossId: boss.id, speed: 0, hp: 450 });
  expect(state.bossObjectiveExpiresAtMs).toBe(state.elapsedMs + 22_000);
});

it('rewards resolving a boss target and enrages its owner on timeout', () => {
  const state = createDefaultState();
  state.nextBossAtMs = 9_999_999;
  state.nextEliteSquadAtMs = 9_999_999;
  state.spawnTimerMs = -100_000;
  const sim = new GameSimulation(state);
  const boss = sim.spawnEnemy({ x: 700, y: 360, hp: 100, speed: 0, kind: 'boss', bossWave: 1, bossType: 'thunder' });
  boss.hp = 50;
  sim.update(16, { x: 0, y: 0 });
  const target = state.enemies.find((enemy) => enemy.id === state.activeBossObjectiveId)!;
  target.hp = 0;
  sim.update(16, { x: 0, y: 0 });
  expect(boss.bossArenaVulnerableUntilMs).toBe(state.elapsedMs + 10_000);
  expect(state.activeBossObjectiveId).toBeNull();
});
```

- [ ] **Step 2: Run the focused simulation test to verify failure**

Run: `npm.cmd test -- --run tests/sim/GameSimulation.test.ts`

Expected: FAIL because arena targets and their state do not exist.

- [ ] **Step 3: Implement lifecycle logic**

Add `spawnBossArenaObjective(boss)` at the existing phase-two transition. Update elapsed target timers before normal enemy movement. When an arena target dies, resolve success before generic normal-enemy rewards: clear state, set the owner windows, add `experienceToNext * 0.5` plus six local shards, and emit a success event. On expiry remove the target, mark the owner enraged, clear state, and emit a failure event. When a boss dies, remove its unexpired owned target without emitting resolution.

Apply target windows in existing enemy movement and damage methods: a stunned boss does not move or cast; `dealDamage` multiplies damage against an owner with an active vulnerable window by `1.25` before normal boss modifiers.

- [ ] **Step 4: Run focused lifecycle tests**

Run: `npm.cmd test -- --run tests/sim/GameSimulation.test.ts`

Expected: PASS.

### Task 3: 三种失败强化接入既有劫主技能

**Files:**
- Modify: `src/sim/bossSkills.ts`
- Modify: `src/sim/GameSimulation.ts`
- Modify: `tests/sim/bossSkills.test.ts`

**Interfaces:**
- `createBossPrimaryHazards` and `createBossSecondaryHazards` use `getBossArenaModifiers(boss)`.
- Crimson applies `hazardScale` to line width, ring radii and ring band width.
- Thunder adds `extraThunderCircles` and applies `telegraphScale` to telegraph time.
- Blood moon uses `bloodHealFraction` for secondary hazard healing.

- [ ] **Step 1: Write failing enraged-boss skill tests**

```ts
it('adds thunder circles and shortens their warning after a failed arena target', () => {
  const state = createDefaultState();
  const boss = new GameSimulation(state).spawnEnemy({ x: 420, y: 360, hp: 100, speed: 0, kind: 'boss', bossWave: 1, bossType: 'thunder' });
  boss.bossArenaEnraged = true;
  let id = 10;
  const hazards = createBossPrimaryHazards(boss, { x: 640, y: 360 }, () => id++, () => 0.5);
  expect(hazards).toHaveLength(5);
  expect(hazards[0].telegraphRemainingMs).toBe(800);
});

it('raises blood-moon healing after a failed arena target', () => {
  const state = createDefaultState();
  const boss = new GameSimulation(state).spawnEnemy({ x: 420, y: 360, hp: 100, speed: 0, kind: 'boss', bossWave: 1, bossType: 'blood-moon' });
  boss.bossPhase = 2;
  boss.bossArenaEnraged = true;
  let id = 10;
  expect(createBossSecondaryHazards(boss, { x: 640, y: 360 }, () => id++)[0].healBossFraction).toBe(0.07);
});
```

- [ ] **Step 2: Run focused boss-skill tests to verify failure**

Run: `npm.cmd test -- --run tests/sim/bossSkills.test.ts`

Expected: FAIL because enraged fields do not affect hazard configuration.

- [ ] **Step 3: Apply the per-boss modifiers**

Keep all existing base values unchanged when `bossArenaEnraged` is false. Do not add normal enemy spawns or change boss base health.

- [ ] **Step 4: Run focused boss-skill tests**

Run: `npm.cmd test -- --run tests/sim/bossSkills.test.ts`

Expected: PASS.

### Task 4: HUD、特效与音频反馈

**Files:**
- Modify: `src/ui/HudController.ts`
- Modify: `src/render/effectSpecs.ts`
- Modify: `src/render/EffectRenderer.ts`
- Modify: `src/audio/GameAudio.ts`
- Modify: `tests/ui/HudController.test.ts`
- Modify: `tests/render/effectSpecs.test.ts`

**Interfaces:**
- HUD renders `.boss-objective-status` below the boss status only while `activeBossObjectiveId` resolves to an owned target.
- Effect specs map spawn and resolved events to a `boss-objective` effect kind.

- [ ] **Step 1: Write failing HUD and visual-spec tests**

```ts
it('shows the active boss arena target under its owner health bar', () => {
  const state = createDefaultState();
  state.activeBossObjectiveId = 9;
  state.bossObjectiveExpiresAtMs = 22_000;
  const target = new GameSimulation(state).spawnEnemy({ x: 600, y: 360, hp: 580, speed: 0 });
  target.id = 9;
  target.ownerBossId = 8;
  target.bossObjectiveKind = 'storm-pylon';
  hud.render(state, DEFAULT_GAME_SETTINGS, false);
  expect(root.querySelector('.boss-objective-status')?.textContent).toContain('引雷天柱');
  expect(root.querySelector('.boss-objective-status')?.textContent).toContain('0:22');
});

it('maps boss arena events to dedicated visual effects', () => {
  expect(createEffectSpecs([{ type: 'boss-objective-resolved', x: 1, y: 2, bossType: 'blood-moon', objective: 'blood-well', success: false }]).map((spec) => spec.kind)).toEqual(['boss-objective']);
});
```

- [ ] **Step 2: Run focused HUD and effect-spec tests to verify failure**

Run: `npm.cmd test -- --run tests/ui/HudController.test.ts tests/render/effectSpecs.test.ts`

Expected: FAIL because the state, event variants and renderer mappings are absent.

- [ ] **Step 3: Implement readable feedback**

Add the target bar with distinct labels and objective colors. Render a long three-ring spawn sigil, a gold-cyan success burst, and a color-matched failure burst; only shake or flash when `screenShake` is enabled. Add short target-spawn, success and failure tones that use the existing sound gain node.

- [ ] **Step 4: Run focused presentation tests**

Run: `npm.cmd test -- --run tests/ui/HudController.test.ts tests/render/effectSpecs.test.ts`

Expected: PASS.

### Task 5: Full verification and visual QA

**Files:**
- Modify only for a directly observed test, compilation, or layout defect.

- [ ] **Step 1: Run all tests**

Run: `npm.cmd test -- --run`

Expected: PASS with no failed test files.

- [ ] **Step 2: Build production assets**

Run: `npm.cmd run build`

Expected: TypeScript succeeds and Vite emits `dist` assets.

- [ ] **Step 3: Verify local server availability**

Run: `curl.exe --noproxy "*" -sS -I http://127.0.0.1:5173/`

Expected: `HTTP/1.1 200 OK`.

- [ ] **Step 4: Inspect the three boss previews**

Open `http://127.0.0.1:5173/?preview=boss-crimson`, `?preview=boss-thunder`, and `?preview=boss-blood-moon`. Confirm the target status, target art, objective telegraph and boss status do not overlap on desktop or a narrow mobile viewport.
