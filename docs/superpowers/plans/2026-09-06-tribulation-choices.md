# 天劫抉择事件 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为每轮非平静天劫加入一次持续到阶段结束的二选一劫契抉择。

**Architecture:** 新建纯配置模块描述六张劫契与其倍率，`GameSimulation` 根据统一的天劫结束时间安排和结算选择。状态层只保存当前候选、已选劫契及下一次触发时间；HUD、音效和特效消费状态或事件，不直接修改战斗规则。

**Tech Stack:** TypeScript、Phaser 4、Vitest、jsdom。

**Spec:** `docs/superpowers/specs/2026-09-06-tribulation-choices-design.md`

## Global Constraints

- 首次在 `10:15` 触发，之后固定每 5 分钟触发一次，选择暂停全部模拟时间。
- 每种天劫只能显示自己的两张劫契，效果仅持续到该轮天劫结束。
- 所有玩家伤害、经验和敌方倍率必须通过现有集中结算路径叠加。
- 不改变五分钟劫主、天劫场景目标、劫主战场目标、技能栏、强化栏或洞府规则。
- 工作区不是 Git 仓库；每项完成后运行测试和构建，不执行提交命令。

---

### Task 1: 配置与状态契约

**Files:**
- Create: `src/sim/tribulationChoices.ts`
- Modify: `src/sim/types.ts`
- Modify: `src/sim/state.ts`
- Modify: `src/sim/tribulations.ts`
- Test: `tests/sim/tribulationChoices.test.ts`

**Interfaces:**
- Produces `TRIBULATION_CHOICE_IDS`, `TRIBULATION_CHOICES`, `getTribulationChoices(tribulation)` and `getTribulationChoiceModifiers(id)`.
- Produces `getTribulationEndMs(elapsedMs)` and a `GameState` that represents a pending or selected choice without storing modifiers directly.

- [ ] **Step 1: Write failing configuration tests**

```ts
it('maps every non-calm tribulation to two choices and exposes their multipliers', () => {
  expect(getTribulationChoices('thunder')).toEqual(['thunder-conduit', 'thunder-seal']);
  expect(getTribulationChoices('calm')).toEqual([]);
  expect(getTribulationChoiceModifiers('blood-pact')).toMatchObject({ experience: 1.35, enemyDamage: 1.25 });
  expect(getTribulationEndMs(615_000)).toBe(1_200_000);
});
```

- [ ] **Step 2: Run the focused test and verify the expected missing-module failure**

Run: `npm.cmd test -- --run tests/sim/tribulationChoices.test.ts`

- [ ] **Step 3: Add the types, default state, end-time helper and pure choice catalog**

Implement the exact six IDs and multipliers from the spec. The neutral modifier result must have every multiplier at `1`.

- [ ] **Step 4: Run the focused test**

Run: `npm.cmd test -- --run tests/sim/tribulationChoices.test.ts`

### Task 2: 模拟触发、选择与倍率结算

**Files:**
- Modify: `src/sim/GameSimulation.ts`
- Modify: `src/sim/enemyProjectiles.ts`
- Test: `tests/sim/tribulations.test.ts`
- Test: `tests/sim/GameSimulation.test.ts`

**Interfaces:**
- Consumes `getTribulationChoices`, `getTribulationChoiceModifiers` and `getTribulationEndMs`.
- Produces `GameSimulation.chooseTribulationChoice(choice: TribulationChoiceId): void`.
- Emits `tribulation-choice-offered` and `tribulation-choice-selected` events.

- [ ] **Step 1: Write failing simulation tests**

```ts
it('pauses for exactly one choice fifteen seconds into a tribulation', () => {
  state.elapsedMs = 614_999;
  state.tribulation = 'thunder';
  sim.update(1, { x: 0, y: 0 });
  expect(state.phase).toBe('tribulation-choice');
  expect(state.tribulationChoices).toEqual(['thunder-conduit', 'thunder-seal']);
  sim.update(1000, { x: 0, y: 0 });
  expect(state.elapsedMs).toBe(615_000);
});

it('applies a selected choice to direct damage and clears it at the next stage', () => {
  state.phase = 'tribulation-choice';
  state.tribulationChoices = ['thunder-conduit', 'thunder-seal'];
  sim.chooseTribulationChoice('thunder-conduit');
  expect(state.activeTribulationChoiceId).toBe('thunder-conduit');
});
```

- [ ] **Step 2: Run the focused tests and verify they fail because the phase and method do not exist**

Run: `npm.cmd test -- --run tests/sim/tribulations.test.ts tests/sim/GameSimulation.test.ts`

- [ ] **Step 3: Implement scheduling and choice validation**

After `updateTribulation`, detect `elapsedMs >= nextTribulationChoiceAtMs` only while playing and in a non-calm stage. Set the phase and candidates, increment the schedule by 600000, and do not advance the rest of the frame. On choice, require an offered choice and set the active ID before returning to playing. On a stage change, clear the active ID and candidates.

- [ ] **Step 4: Integrate all multipliers at existing centralized boundaries**

Multiply direct player damage in `dealDamage`, shard pickup experience in `collectExperience`, player and enemy movement in their existing movement methods, player damage in `applyPlayerDamage`, and ranged projectile speed in `createShot`. Preserve each base tribulation multiplier and multiply the choice result on top.

- [ ] **Step 5: Run focused simulation tests**

Run: `npm.cmd test -- --run tests/sim/tribulationChoices.test.ts tests/sim/tribulations.test.ts tests/sim/GameSimulation.test.ts`

### Task 3: HUD、特效、音效与预览

**Files:**
- Modify: `src/ui/HudController.ts`
- Modify: `src/scenes/GameScene.ts`
- Modify: `src/render/effectSpecs.ts`
- Modify: `src/render/EffectRenderer.ts`
- Modify: `src/audio/GameAudio.ts`
- Modify: `src/styles.css`
- Test: `tests/ui/HudController.test.ts`
- Test: `tests/render/effectSpecs.test.ts`

**Interfaces:**
- `HudCallbacks` gains `onChooseTribulationChoice(choice: TribulationChoiceId)`.
- HUD recognizes `data-tribulation-choice` and renders `.tribulation-choice-status` while an active choice exists.
- Effects map the two new events to a dedicated `tribulation-choice` visual kind.

- [ ] **Step 1: Write failing presentation tests**

```ts
it('renders two tribulation choices and forwards the selected id', () => {
  state.phase = 'tribulation-choice';
  state.tribulationChoices = ['frost-edge', 'frost-ward'];
  hud.render(state, DEFAULT_GAME_SETTINGS, false);
  root.querySelector<HTMLButtonElement>('[data-tribulation-choice="frost-edge"]')!.click();
  expect(handlers.onChooseTribulationChoice).toHaveBeenCalledWith('frost-edge');
});

it('maps tribulation choice events to their dedicated visual effect', () => {
  expect(createEffectSpecs([{ type: 'tribulation-choice-selected', x: 1, y: 2, choice: 'blood-pact' }])[0].kind).toBe('tribulation-choice');
});
```

- [ ] **Step 2: Run the focused presentation tests and verify they fail for the missing callback/event**

Run: `npm.cmd test -- --run tests/ui/HudController.test.ts tests/render/effectSpecs.test.ts`

- [ ] **Step 3: Implement readable choice feedback and development preview**

Render two cards with distinct benefit and pressure rows. Add a compact active-choice status below the tribulation pill. Use a color-matched inward ring for the offer and an outward confirmation ring for the chosen event; honor `screenShake`. Add low-volume offered and chosen tones. Add `?preview=tribulation-choice` that pauses on the thunder choice panel.

- [ ] **Step 4: Run focused presentation tests**

Run: `npm.cmd test -- --run tests/ui/HudController.test.ts tests/render/effectSpecs.test.ts`

### Task 4: 全量验证与视觉检查

**Files:**
- Modify: none unless verification exposes a defect.

- [ ] **Step 1: Run the complete test suite**

Run: `npm.cmd test -- --run`

- [ ] **Step 2: Build production assets**

Run: `npm.cmd run build`

- [ ] **Step 3: Inspect development preview at desktop and narrow viewport**

Open `http://127.0.0.1:5173/?preview=tribulation-choice`. Confirm both cards, benefit/pressure text and the top status fit without colliding with the boss or objective status bars.
