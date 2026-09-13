# 洞府局外成长 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为《符潮残夜》增加本地保存的道蕴货币、角色专属洞府天赋与劫主奖励。

**Architecture:** `metaProgression.ts` 负责纯粹的存档、解锁和天赋定义；战斗模拟只在劫主死亡时发出 `dao-yun-earned` 事件。`GameScene` 消费该事件并保存进度，`HudController` 按传入的进度渲染菜单洞府和局末奖励。角色的已解锁天赋保留在本局 `Player` 上，使每次 `recalculatePlayerBuild` 都能稳定重建属性。

**Tech Stack:** TypeScript、Phaser 4、Vitest、jsdom、浏览器 `localStorage`。

**Spec:** `docs/superpowers/specs/2026-09-06-dongfu-meta-progression-design.md`

## Global Constraints

- 存档键必须为 `fu-tide-dongfu-v1`，版本必须为 `1`。
- 每个劫主只奖励 `1` 道蕴，且奖励不依赖宝箱拾取。
- 天赋仅在所属角色被选定后生效，不占用局内五个技能格或六个强化格。
- 不实现云同步、清档、局外装备、随机词条或付费货币。
- 此工作区不是 Git 仓库；每个任务完成后运行对应测试与构建，不执行提交命令。

---

## File Structure

- Create: `src/meta/metaProgression.ts` — 存档结构、九项天赋、解锁与属性应用。
- Create: `tests/meta/metaProgression.test.ts` — 存档与解锁行为测试。
- Modify: `src/sim/types.ts` — `TalentId`、`MetaProgression`、玩家已解锁天赋与道蕴事件。
- Modify: `src/sim/state.ts` — 默认玩家携带空的局外天赋数组。
- Modify: `src/sim/loadout.ts` — 在角色固有特性后叠加局外天赋。
- Modify: `src/sim/GameSimulation.ts` — 劫主死亡时发出道蕴奖励事件。
- Modify: `src/scenes/GameScene.ts` — 加载、保存与注入洞府进度。
- Modify: `src/ui/HudController.ts` — 洞府入口、天赋面板、局末奖励与交互回调。
- Modify: `src/styles.css` — 洞府面板、天赋状态与小屏布局。
- Modify: `tests/sim/characters.test.ts` — 角色天赋应用测试。
- Modify: `tests/sim/GameSimulation.test.ts` — 劫主奖励事件测试。
- Modify: `tests/ui/HudController.test.ts` — 洞府面板与解锁交互测试。

### Task 1: 洞府存档与天赋目录

**Files:**
- Create: `src/meta/metaProgression.ts`
- Create: `tests/meta/metaProgression.test.ts`
- Modify: `src/sim/types.ts`

**Interfaces:**
- Produces `type TalentId`, `type MetaProgression`, `TALENTS`, `createDefaultMetaProgression()`, `loadMetaProgression(storage)`, `saveMetaProgression(storage, progression)`, `tryUnlockTalent(progression, talentId)`, and `earnDaoYun(progression, amount)`.
- `tryUnlockTalent` returns `{ progression: MetaProgression; unlocked: boolean }` without mutating its input.

- [ ] **Step 1: Write the failing storage and unlock tests**

```ts
it('falls back to a zero-balance progression for invalid storage', () => {
  storage.setItem('fu-tide-dongfu-v1', '{broken');
  expect(loadMetaProgression(storage)).toEqual({ version: 1, daoYun: 0, unlockedTalentIds: [] });
});

it('requires the previous talent and pays its fixed cost once', () => {
  const first = tryUnlockTalent({ version: 1, daoYun: 3, unlockedTalentIds: [] }, 'xuan-jian:sword-intent');
  expect(first).toEqual({
    unlocked: true,
    progression: { version: 1, daoYun: 2, unlockedTalentIds: ['xuan-jian:sword-intent'] },
  });
  const second = tryUnlockTalent(first.progression, 'xuan-jian:swift-sword');
  expect(second.unlocked).toBe(true);
  expect(tryUnlockTalent(second.progression, 'xuan-jian:sword-intent').progression.daoYun).toBe(0);
});
```

- [ ] **Step 2: Run the focused test to verify it fails because the module does not exist**

Run: `npm.cmd test -- --run tests/meta/metaProgression.test.ts`

Expected: FAIL with a module-not-found error for `src/meta/metaProgression`.

- [ ] **Step 3: Add types and minimal progression implementation**

```ts
export const META_STORAGE_KEY = 'fu-tide-dongfu-v1';
export function createDefaultMetaProgression(): MetaProgression {
  return { version: 1, daoYun: 0, unlockedTalentIds: [] };
}

export function earnDaoYun(progression: MetaProgression, amount: number): MetaProgression {
  return { ...progression, daoYun: Math.max(0, progression.daoYun + Math.max(0, amount)) };
}
```

Define all nine `TalentDefinition` entries with the identifiers, costs, prerequisites, names and effects from the spec. Validate version, finite non-negative integer balance, known unique talent ids, prerequisite, current balance, and duplicate unlocks.

- [ ] **Step 4: Run focused progression tests**

Run: `npm.cmd test -- --run tests/meta/metaProgression.test.ts`

Expected: PASS.

### Task 2: 将洞府天赋稳定叠加到角色构筑

**Files:**
- Modify: `src/sim/types.ts`
- Modify: `src/sim/state.ts`
- Modify: `src/sim/loadout.ts`
- Modify: `tests/sim/characters.test.ts`

**Interfaces:**
- `Player` gains `metaTalentIds: TalentId[]`.
- `applyMetaTalents(player: Player): void` is exported from `src/meta/metaProgression.ts` and assumes the player already has `characterId`.
- `recalculatePlayerBuild(player)` calls `applyMetaTalents` after the existing character trait branch.

- [ ] **Step 1: Write failing character-specific talent tests**

```ts
it('applies only the selected character’s unlocked talents after base traits', () => {
  const player = createDefaultState().player;
  player.characterId = 'xuan-jian';
  player.metaTalentIds = ['xuan-jian:sword-intent', 'lei-zhuan:thunder-body'];
  recalculatePlayerBuild(player);
  expect(player.attackDamage).toBeCloseTo(18 * 1.15 * 1.08);
  expect(player.thunderDamagePerSecond).toBe(10);
});

it('gives guardian shield and regeneration talents to a fresh run', () => {
  const player = createDefaultState().player;
  player.characterId = 'shou-yi';
  player.metaTalentIds = ['shou-yi:root-guard', 'shou-yi:evergreen'];
  recalculatePlayerBuild(player);
  expect(player.maxShield).toBe(20);
  expect(player.hpRegenPerSecond).toBeCloseTo(0.6);
});
```

- [ ] **Step 2: Run focused character tests to verify failure**

Run: `npm.cmd test -- --run tests/sim/characters.test.ts`

Expected: FAIL because `metaTalentIds` and the talent application path are absent.

- [ ] **Step 3: Add default talent state and apply effects**

Implement the exact effects from the specification. For 雷篆, multiply all listed arcane damage values by `1.08`; multiply only `thunderRadius` and `voidBellRadius` by `1.12`; multiply experience by `1.10`. For 守一, apply its existing `1.25` role multiplier first, then multiply maximum health by `1.10` and add shield and regeneration. For 玄剑, apply damage multiplier, cooldown multiplier, then pierce increment.

- [ ] **Step 4: Run focused character tests**

Run: `npm.cmd test -- --run tests/sim/characters.test.ts`

Expected: PASS.

### Task 3: 劫主道蕴奖励事件与场景保存

**Files:**
- Modify: `src/sim/types.ts`
- Modify: `src/sim/GameSimulation.ts`
- Modify: `src/scenes/GameScene.ts`
- Modify: `tests/sim/GameSimulation.test.ts`
- Modify: `tests/meta/metaProgression.test.ts`

**Interfaces:**
- `CombatEvent` gains `{ type: 'dao-yun-earned'; amount: 1; wave: number; x: number; y: number }`.
- `GameScene` stores `private metaProgression: MetaProgression` and updates it through `earnDaoYun` when consuming a reward event.
- `injectMetaTalents()` copies `metaProgression.unlockedTalentIds` to the fresh simulation player before character selection.

- [ ] **Step 1: Write the failing single-reward test**

```ts
it('emits exactly one dao-yun reward when a boss dies', () => {
  const state = createDefaultState();
  const sim = new GameSimulation(state);
  const boss = sim.spawnEnemy({ x: 400, y: 300, hp: 1, speed: 0, kind: 'boss', bossWave: 1 });
  boss.hp = 0;
  sim.update(16, { x: 0, y: 0 });
  expect(sim.consumeEvents().filter((event) => event.type === 'dao-yun-earned')).toEqual([
    expect.objectContaining({ amount: 1, wave: 1 }),
  ]);
});
```

- [ ] **Step 2: Run the focused simulation test to verify failure**

Run: `npm.cmd test -- --run tests/sim/GameSimulation.test.ts`

Expected: FAIL because the simulation does not emit `dao-yun-earned`.

- [ ] **Step 3: Emit and persist the reward**

Push the reward event beside `chest-dropped` in `dropBossRewards`. In `GameScene.update`, consume reward events before rendering and audio, call `earnDaoYun`, then `saveMetaProgression(window.localStorage, this.metaProgression)`. Load once in `create()` and inject talent ids after creating each fresh simulation in both `create()` and `restartRun()`.

- [ ] **Step 4: Run focused reward and progression tests**

Run: `npm.cmd test -- --run tests/sim/GameSimulation.test.ts tests/meta/metaProgression.test.ts`

Expected: PASS.

### Task 4: 洞府界面与局末奖励展示

**Files:**
- Modify: `src/sim/types.ts`
- Modify: `src/ui/HudController.ts`
- Modify: `src/scenes/GameScene.ts`
- Modify: `src/styles.css`
- Modify: `tests/ui/HudController.test.ts`

**Interfaces:**
- `GamePhase` gains `'dongfu'`.
- `HudController.render(state, settings, settingsOpen, progression)` receives `MetaProgression`.
- New callbacks: `onOpenDongfu()`, `onCloseDongfu()`, `onUnlockTalent(talentId: TalentId)`.
- `GameScene` changes phase between `'menu'` and `'dongfu'`, and calls `tryUnlockTalent` before saving successful unlocks.

- [ ] **Step 1: Write failing menu and unlock interaction tests**

```ts
it('renders the dao-yun balance and unlocks the first available talent', () => {
  const progression = { version: 1, daoYun: 1, unlockedTalentIds: [] } as const;
  state.phase = 'dongfu';
  hud.render(state, DEFAULT_GAME_SETTINGS, false, progression);
  expect(root.textContent).toContain('道蕴 1');
  root.querySelector<HTMLButtonElement>('[data-talent="xuan-jian:sword-intent"]')!.click();
  expect(handlers.onUnlockTalent).toHaveBeenCalledWith('xuan-jian:sword-intent');
});
```

- [ ] **Step 2: Run the focused HUD test to verify failure**

Run: `npm.cmd test -- --run tests/ui/HudController.test.ts`

Expected: FAIL because the dongfu phase, render parameter and callback do not exist.

- [ ] **Step 3: Implement the menu, panel and summary copy**

Add a sibling “洞府” button beside “开始渡劫”. Render three character columns from `TALENTS`, using the existing `upgrade` visual language. Use disabled buttons for insufficient balance or missing prerequisites. Under the lost-summary counters, render `本局道蕴 +${state.runDaoYunEarned}`; add `runDaoYunEarned: number` to `GameState` and increment it while GameScene consumes a reward event.

Add responsive CSS so the three columns become a scrollable single column under 720px, without overlapping the bottom skill dock or panel actions.

- [ ] **Step 4: Run focused HUD tests**

Run: `npm.cmd test -- --run tests/ui/HudController.test.ts`

Expected: PASS.

### Task 5: Full verification and visual QA

**Files:**
- Modify only if a verified test, layout or compile failure requires a targeted correction.

**Interfaces:**
- All preceding public interfaces remain unchanged.

- [ ] **Step 1: Run all automated tests**

Run: `npm.cmd test -- --run`

Expected: PASS with no failed test files.

- [ ] **Step 2: Build the production bundle**

Run: `npm.cmd run build`

Expected: TypeScript completes and Vite emits `dist` assets.

- [ ] **Step 3: Start or verify the local development server**

Run: `curl.exe --noproxy "*" -sS -I http://127.0.0.1:5173/`

Expected: `HTTP/1.1 200 OK`.

- [ ] **Step 4: Inspect desktop and mobile UI states**

Open `http://127.0.0.1:5173/`, then inspect the menu,洞府 balance, locked and unlocked talent states, and the loss summary. Repeat at a narrow mobile viewport. Confirm no text overlap, no clipped panel actions and no console errors.
