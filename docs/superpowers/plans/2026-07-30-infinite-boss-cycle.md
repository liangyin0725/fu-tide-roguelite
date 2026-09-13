# 无限怪潮与 Boss 周期 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将五分钟胜利局改为无限生存，并每五分钟生成一只成长型 Boss，同时降低后期普通怪刷新速度。

**Architecture:** 把刷新间隔与 Boss 数值放入纯函数模块 `spawnPacing.ts`，由 `GameSimulation` 负责时间边界、敌人生成和死亡统计。Boss 继续复用 `Enemy` 数据流，但通过 `kind`、`bossWave`、专属事件和绘制分支获得独立行为与表现。

**Tech Stack:** Phaser 3、TypeScript、Vite、Vitest

## Global Constraints

- 游戏只在玩家生命归零时结束，不再存在五分钟胜利。
- 每 `300000` 毫秒生成一只 Boss，跨越多个周期时不得漏刷或重复。
- Boss 登场后 30 秒内普通怪刷新间隔乘以 `1.5`。
- 普通怪刷新间隔最低 `380` 毫秒，场上普通怪上限 `140`。
- Boss 不计入普通怪上限。
- 当前目录不是 Git 仓库；提交步骤记录为跳过。

---

### Task 1: 纯刷新节奏与 Boss 数值

**Files:**
- Create: `src/sim/spawnPacing.ts`
- Create: `tests/sim/spawnPacing.test.ts`

**Interfaces:**
- Produces: `getNormalSpawnInterval(elapsedMs: number, slowdownUntilMs: number): number`
- Produces: `getBossStats(wave: number): BossStats`

- [ ] **Step 1: Write failing pacing tests**

```ts
expect(getNormalSpawnInterval(3_600_000, 0)).toBe(380);
expect(getNormalSpawnInterval(300_000, 330_000)).toBe(570);
expect(getBossStats(1)).toEqual({ hp: 600, damage: 20, speed: 52, experience: 60 });
expect(getBossStats(3)).toEqual({ hp: 1300, damage: 26, speed: 56, experience: 100 });
```

- [ ] **Step 2: Run tests and verify RED**

Run: `npm.cmd test -- tests/sim/spawnPacing.test.ts`

Expected: FAIL because `spawnPacing.ts` does not exist.

- [ ] **Step 3: Implement the formulas**

```ts
export function getNormalSpawnInterval(elapsedMs: number, slowdownUntilMs: number): number {
  const interval = Math.max(380, 1200 / (1 + elapsedMs / 120000));
  return elapsedMs < slowdownUntilMs ? interval * 1.5 : interval;
}
```

Implement the exact linear Boss formulas from the approved spec.

- [ ] **Step 4: Run tests and verify GREEN**

Run: `npm.cmd test -- tests/sim/spawnPacing.test.ts`

Expected: all pacing tests pass.

### Task 2: 无限计时和五分钟 Boss 生成

**Files:**
- Modify: `src/sim/types.ts`
- Modify: `src/sim/state.ts`
- Modify: `src/sim/GameSimulation.ts`
- Modify: `tests/sim/GameSimulation.test.ts`

**Interfaces:**
- Consumes: `getBossStats`, `getNormalSpawnInterval`
- Produces: `Enemy.kind`, `Enemy.bossWave`
- Produces: `GameState.nextBossAtMs`, `bossWave`, `bossesDefeated`, `bossSlowdownUntilMs`

- [ ] **Step 1: Write failing infinite-mode tests**

```ts
it('keeps playing and spawns bosses at five-minute boundaries', () => {
  const sim = new GameSimulation(createDefaultState());
  sim.update(300_000, { x: 0, y: 0 });
  expect(sim.state.phase).toBe('playing');
  expect(sim.state.enemies.filter((enemy) => enemy.kind === 'boss')).toHaveLength(1);
  sim.update(300_000, { x: 0, y: 0 });
  expect(sim.state.enemies.filter((enemy) => enemy.kind === 'boss')).toHaveLength(2);
});
```

```ts
it('counts a defeated boss', () => {
  const state = createDefaultState();
  state.elapsedMs = 299_999;
  const sim = new GameSimulation(state);
  sim.update(1, { x: 0, y: 0 });
  const boss = sim.state.enemies.find((enemy) => enemy.kind === 'boss')!;
  boss.hp = 0;
  sim.update(16, { x: 0, y: 0 });
  expect(sim.state.bossesDefeated).toBe(1);
});
```

- [ ] **Step 2: Run tests and verify RED**

Run: `npm.cmd test -- tests/sim/GameSimulation.test.ts`

Expected: FAIL because the state has no Boss cycle fields and still enters `won`.

- [ ] **Step 3: Implement state, Boss spawning, normal cap, and death counting**

Add `spawnDueBosses()` before `spawnWave()`. Use a `while` loop against `nextBossAtMs`. Limit normal catch-up spawning to 4 per update and skip generation when 140 normal enemies are alive. Remove the elapsed-time victory branch.

- [ ] **Step 4: Run tests and verify GREEN**

Run: `npm.cmd test -- tests/sim/GameSimulation.test.ts`

Expected: all simulation tests pass.

### Task 3: Boss event, rendering, and HUD

**Files:**
- Modify: `src/sim/types.ts`
- Modify: `src/render/effectSpecs.ts`
- Modify: `src/render/EffectRenderer.ts`
- Modify: `src/render/ShapeFactory.ts`
- Modify: `src/scenes/GameScene.ts`
- Modify: `src/ui/HudController.ts`
- Modify: `src/styles.css`
- Modify: `tests/render/effectSpecs.test.ts`

**Interfaces:**
- Produces: `CombatEvent` variant `{ type: 'boss-spawned'; x; y; wave }`
- Consumes: latest alive Boss from `GameState.enemies`

- [ ] **Step 1: Write failing Boss-effect mapping test**

```ts
const events: CombatEvent[] = [
  { type: 'boss-spawned', x: 400, y: 300, wave: 1 },
];
expect(createEffectSpecs(events).map((spec) => spec.kind)).toEqual(['boss']);
```

- [ ] **Step 2: Run test and verify RED**

Run: `npm.cmd test -- tests/render/effectSpecs.test.ts`

Expected: FAIL because the event and effect kind are not mapped.

- [ ] **Step 3: Implement Boss visuals and HUD**

Draw Boss with radius 42, gold edge, rotating rune pins, and a wide health bar. Render a large gold-red summon sigil for `boss-spawned`. HUD shows elapsed time, next Boss countdown, and the highest-wave living Boss health bar.

- [ ] **Step 4: Run tests and build**

Run: `npm.cmd test`

Run: `npm.cmd run build`

Expected: tests pass and TypeScript/Vite exit 0.

### Task 4: Browser verification

**Files:**
- Verify: `http://127.0.0.1:5173`

- [ ] **Step 1: Verify normal play and HUD**

Start a run and confirm time counts upward, next Boss counts downward, and no victory overlay appears.

- [ ] **Step 2: Verify Boss presentation**

Use a controlled simulation test for the exact five-minute boundary, then verify browser rendering and console state after the updated application loads. Confirm Boss drawing code compiles and the HUD has no overlap at desktop and mobile widths.

- [ ] **Step 3: Run final verification**

Run: `npm.cmd test`

Run: `npm.cmd run build`

Expected: both commands exit 0 immediately before completion is reported.
