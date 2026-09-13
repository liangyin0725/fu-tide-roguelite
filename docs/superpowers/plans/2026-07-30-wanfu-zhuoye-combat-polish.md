# 万符灼夜战斗表现 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 提高玩家角色清晰度，加入由真实战斗事件驱动的华丽特效，并把三选一升级池扩充为 12 种可叠加技能。

**Architecture:** 保持 `GameSimulation` 为纯 TypeScript 规则源，在状态中保存技能等级和运行种子，并通过一次性 `CombatEvent` 队列向 Phaser 场景发布视觉事件。`GameScene` 继续负责实体同步，同时把短生命周期特效交给独立的 `EffectRenderer`；DOM HUD 只读取升级元数据和等级。

**Tech Stack:** Phaser 3、TypeScript、Vite、Vitest、Playwright

## Global Constraints

- 保留自动攻击、移动走位、三选一升级和五分钟生存目标。
- 技能池固定为 12 种，达到安全上限的技能不再进入选择池。
- 特效必须由模拟层事件驱动，渲染后消费一次。
- 手机视口只降低粒子数量和辉光半径，不改变技能数值。
- 不增加音效、外部美术包、武器合成、存档、多角色或新地图。
- 当前目录不是 Git 仓库；每个任务的提交步骤记录为跳过，不执行伪提交。

---

### Task 1: 技能状态与确定性选择池

**Files:**
- Modify: `src/sim/types.ts`
- Modify: `src/sim/state.ts`
- Modify: `src/sim/upgrades.ts`
- Modify: `tests/sim/GameSimulation.test.ts`

**Interfaces:**
- Produces: `UPGRADE_IDS: readonly UpgradeId[]`
- Produces: `createUpgradeChoices(state: GameState): UpgradeId[]`
- Produces: `applyUpgrade(state: GameState, upgrade: UpgradeId): void`
- Produces: `upgradeLevels: Record<UpgradeId, number>` on `Player`

- [ ] **Step 1: Write failing selection-pool tests**

```ts
it('offers three distinct upgrades from the twelve-skill pool', () => {
  const state = createDefaultState();
  state.player.level = 6;
  const choices = createUpgradeChoices(state);
  expect(UPGRADE_IDS).toHaveLength(12);
  expect(new Set(choices).size).toBe(3);
  expect(choices.every((choice) => UPGRADE_IDS.includes(choice))).toBe(true);
});

it('increments the selected upgrade level', () => {
  const state = createDefaultState();
  applyUpgrade(state, 'multi-swords');
  expect(state.player.upgradeLevels['multi-swords']).toBe(1);
  expect(state.player.projectileCount).toBe(2);
});
```

- [ ] **Step 2: Run tests and verify RED**

Run: `npm.cmd test -- tests/sim/GameSimulation.test.ts`

Expected: FAIL because `UPGRADE_IDS`, `multi-swords`, `upgradeLevels`, and `projectileCount` do not exist.

- [ ] **Step 3: Add the twelve upgrade IDs and player fields**

```ts
export type UpgradeId =
  | 'faster-swords' | 'heavier-swords' | 'multi-swords' | 'piercing-swords'
  | 'thunder-ring' | 'chain-lightning' | 'fire-burst' | 'golden-shield'
  | 'life-drain' | 'soul-banner' | 'swift-steps' | 'vital-breath';

export type UpgradeLevels = Record<UpgradeId, number>;
```

Add `runSeed`, `projectileCount`, `projectilePierce`, `shield`, `maxShield`, `lifeOnKill`, `pickupRadius`, and `upgradeLevels` defaults in `createDefaultState`.

- [ ] **Step 4: Implement deterministic choices and upgrade caps**

Use a small seeded linear-congruential step based on `state.runSeed + state.player.level`, filter capped skills, then choose three distinct IDs. Apply each upgrade and increment its level only when selected.

- [ ] **Step 5: Run tests and verify GREEN**

Run: `npm.cmd test -- tests/sim/GameSimulation.test.ts`

Expected: all tests pass.

- [ ] **Step 6: Commit**

Skipped: `D:\codex\game` is not a Git repository.

### Task 2: 多重飞剑、穿透、护盾与吸血

**Files:**
- Modify: `src/sim/types.ts`
- Modify: `src/sim/GameSimulation.ts`
- Modify: `tests/sim/GameSimulation.test.ts`

**Interfaces:**
- Consumes: `player.projectileCount`, `player.projectilePierce`, `player.shield`, `player.lifeOnKill`
- Produces: `Projectile.pierceRemaining`

- [ ] **Step 1: Write failing combat-rule tests**

```ts
it('fires the configured number of swords', () => {
  const state = createDefaultState();
  state.player.projectileCount = 3;
  const sim = new GameSimulation(state);
  sim.spawnEnemy({ x: 520, y: 360, hp: 100, speed: 0 });
  sim.update(700, { x: 0, y: 0 });
  expect(sim.state.projectiles).toHaveLength(3);
});

it('uses shield before health and heals on kill without overhealing', () => {
  const state = createDefaultState();
  state.player.shield = 20;
  state.player.lifeOnKill = 8;
  state.player.hp = 99;
  state.player.attackDamage = 99;
  const sim = new GameSimulation(state);
  sim.spawnEnemy({ x: state.player.x, y: state.player.y, hp: 5, speed: 0 });
  sim.update(700, { x: 0, y: 0 });
  expect(sim.state.player.shield).toBeLessThan(20);
  expect(sim.state.player.hp).toBeLessThanOrEqual(sim.state.player.maxHp);
});
```

- [ ] **Step 2: Run tests and verify RED**

Run: `npm.cmd test -- tests/sim/GameSimulation.test.ts`

Expected: FAIL because firing still creates one projectile and contact damage ignores shield.

- [ ] **Step 3: Implement fan firing, penetration tracking, shield absorption, and kill healing**

Generate a centered angular fan around the target direction. Track `hitEnemyIds` and `pierceRemaining` per projectile so one projectile cannot damage the same enemy twice. Subtract contact damage from shield before HP. On enemy death, heal `lifeOnKill` with `Math.min(maxHp, hp + lifeOnKill)`.

- [ ] **Step 4: Run tests and verify GREEN**

Run: `npm.cmd test -- tests/sim/GameSimulation.test.ts`

Expected: all tests pass.

- [ ] **Step 5: Commit**

Skipped: `D:\codex\game` is not a Git repository.

### Task 3: 连锁雷、爆炎符与战斗事件

**Files:**
- Modify: `src/sim/types.ts`
- Modify: `src/sim/GameSimulation.ts`
- Modify: `tests/sim/GameSimulation.test.ts`

**Interfaces:**
- Produces: `CombatEvent` discriminated union
- Produces: `GameSimulation.consumeEvents(): CombatEvent[]`
- Produces: `Player.chainLightningDamage`, `Player.fireBurstDamage`, `Player.fireBurstChance`

- [ ] **Step 1: Write failing event and area-damage tests**

```ts
it('publishes combat events once', () => {
  const sim = new GameSimulation(createDefaultState());
  sim.spawnEnemy({ x: 520, y: 360, hp: 100, speed: 0 });
  sim.update(700, { x: 0, y: 0 });
  expect(sim.consumeEvents().some((event) => event.type === 'projectile-fired')).toBe(true);
  expect(sim.consumeEvents()).toEqual([]);
});

it('chain lightning damages a nearby enemy but not a distant enemy', () => {
  const state = createDefaultState();
  state.player.chainLightningDamage = 12;
  const sim = new GameSimulation(state);
  sim.spawnEnemy({ x: 520, y: 360, hp: 100, speed: 0 });
  sim.spawnEnemy({ x: 560, y: 360, hp: 100, speed: 0 });
  sim.spawnEnemy({ x: 900, y: 360, hp: 100, speed: 0 });
  sim.update(700, { x: 0, y: 0 });
  sim.update(200, { x: 0, y: 0 });
  expect(sim.state.enemies[1].hp).toBeLessThan(100);
  expect(sim.state.enemies[2].hp).toBe(100);
});
```

- [ ] **Step 2: Run tests and verify RED**

Run: `npm.cmd test -- tests/sim/GameSimulation.test.ts`

Expected: FAIL because `consumeEvents` and chain-lightning fields do not exist.

- [ ] **Step 3: Implement event queue and secondary damage**

Create events for projectile fire/hit, kill, player damage, level up, shield block, chain lightning, and fire burst. Chain to the nearest valid enemy within 150 units. Use the seeded run RNG for fire-burst chance and apply damage within a 90-unit radius.

- [ ] **Step 4: Run tests and verify GREEN**

Run: `npm.cmd test -- tests/sim/GameSimulation.test.ts`

Expected: all tests pass.

- [ ] **Step 5: Commit**

Skipped: `D:\codex\game` is not a Git repository.

### Task 4: 角色绘制与事件特效

**Files:**
- Create: `src/render/EffectRenderer.ts`
- Modify: `src/render/ShapeFactory.ts`
- Modify: `src/scenes/GameScene.ts`

**Interfaces:**
- Consumes: `CombatEvent[]` from `simulation.consumeEvents()`
- Produces: `EffectRenderer.render(events: CombatEvent[]): void`
- Produces: `EffectRenderer.update(deltaMs: number): void`
- Produces: `EffectRenderer.clear(): void`

- [ ] **Step 1: Extend player and entity drawing**

Replace the circular player marker with head, robe, sleeves, chest sigil, two aura rings, HP bar, and damage-flash input. Draw enemies with a dark outer edge. Draw projectiles as a bright core plus cyan and gold trail layers.

- [ ] **Step 2: Implement short-lived effect objects**

`EffectRenderer` creates pooled Phaser Graphics for impact sparks, kill shards, shield ripples, chain arcs, fire circles, and level-up sigils. Each effect stores `ageMs` and `durationMs`; `update` redraws with normalized lifetime and destroys expired objects.

- [ ] **Step 3: Wire events into the scene**

After simulation update, call `effectRenderer.render(simulation.consumeEvents())`, then update entity graphics and call `effectRenderer.update(delta)`. Clear all effects during restart. Apply camera shake only for player damage, fire burst, and level up.

- [ ] **Step 4: Build to verify TypeScript and Phaser APIs**

Run: `npm.cmd run build`

Expected: TypeScript exits 0 and Vite produces `dist`.

- [ ] **Step 5: Commit**

Skipped: `D:\codex\game` is not a Git repository.

### Task 5: 十二技能升级界面

**Files:**
- Modify: `src/sim/upgrades.ts`
- Modify: `src/ui/HudController.ts`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: `UPGRADE_LABELS`, `state.player.upgradeLevels`
- Produces: category metadata `offense | arcane | defense | utility`

- [ ] **Step 1: Add complete skill metadata**

Each entry includes `name`, `description`, `symbol`, and `category`. Use one-character symbols such as `剑`, `雷`, `炎`, `盾`, `生`, and `行`; do not add external icon assets.

- [ ] **Step 2: Render category and current level**

Each upgrade button receives `data-category`, a symbol element, and `Lv.N → Lv.N+1`. Preserve the existing click delegation through `data-upgrade`.

- [ ] **Step 3: Polish responsive layout**

Use three equal-height columns above 720 px and one column below it. Give offense, arcane, defense, and utility distinct restrained accent colors. Ensure long descriptions wrap and buttons do not change size on hover.

- [ ] **Step 4: Run the full automated suite**

Run: `npm.cmd test`

Expected: all Vitest files and tests pass with zero failures.

- [ ] **Step 5: Build production output**

Run: `npm.cmd run build`

Expected: TypeScript and Vite exit 0; the known Phaser chunk-size warning is acceptable.

- [ ] **Step 6: Commit**

Skipped: `D:\codex\game` is not a Git repository.

### Task 6: Browser visual and interaction verification

**Files:**
- Verify: `http://127.0.0.1:5173`

**Interfaces:**
- Consumes: completed Vite application
- Produces: desktop/mobile screenshots and console-error check

- [ ] **Step 1: Start or reuse the local development server**

Run: `npm.cmd run dev -- --port 5173`

Expected: Vite serves the game at `http://127.0.0.1:5173`.

- [ ] **Step 2: Verify desktop play**

At 1280×720, start a run, move with WASD, wait for firing and hits, and inspect that the player remains legible beneath effects. Confirm nonblank canvas, visible projectile trails, hit effects, HUD, and no console errors.

- [ ] **Step 3: Verify upgrade overlay**

Drive the simulation to an upgrade or temporarily use browser-side state only if the public UI exposes no deterministic shortcut. Confirm three distinct cards, symbols, categories, levels, and no overflow.

- [ ] **Step 4: Verify mobile layout**

At 390×844, confirm the HUD wraps without overlap, upgrade cards stack vertically, and the canvas remains playable.

- [ ] **Step 5: Final verification**

Run: `npm.cmd test`

Run: `npm.cmd run build`

Expected: both commands exit 0 immediately before completion is reported.
