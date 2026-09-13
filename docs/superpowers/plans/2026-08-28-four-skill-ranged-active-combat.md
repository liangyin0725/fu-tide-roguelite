# Four-Skill Ranged Active Combat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a four-passive loadout, replaceable Boss rewards, four new passives, three ranged enemies with blockable bullets, three start-selected active skills, richer pixel art and VFX, and a persistent paused settings panel.

**Architecture:** Keep deterministic combat rules in focused `src/sim` modules and let `GameSimulation` orchestrate them. Keep Phaser responsible for input and world presentation, the DOM HUD responsible for choices and settings, and versioned local storage responsible for preferences. Render authored pixel matrices into Phaser textures with nearest-neighbor sampling so the game gains real pixel sprites without introducing an external asset pipeline.

**Tech Stack:** TypeScript 6, Phaser 4, Vite 8, Vitest 4, jsdom, Playwright

**Spec:** `docs/superpowers/specs/2026-08-28-four-skill-ranged-active-combat-design.md`

## Global Constraints

- A run equips at most four passive skills; each passive has four levels and awakens at level four.
- Normal level-ups cannot add a fifth passive; Boss treasure may replace one equipped passive.
- The active slot is independent and is chosen from three skills before combat begins.
- Enemy bullets are separate from player projectiles and `BossHazard`.
- Bullet resolution order is orbiting blades, Tai Chi barrier, golden shield, then player HP.
- Game speed options are exactly 0.75x, 1.0x, and 1.25x and scale all simulation time uniformly.
- Menus and HUD animation use unscaled time; choice, awakening, treasure, settings, and defeat phases do not advance combat.
- Pixel art uses nearest-neighbor sampling and pixel-aligned placement.
- This directory is not a Git repository, so commit steps are intentionally omitted.

---

### Task 1: Versioned Settings And Scaled Simulation Time

**Files:**
- Create: `src/settings/gameSettings.ts`
- Create: `tests/settings/gameSettings.test.ts`
- Modify: `src/scenes/GameScene.ts`
- Modify: `tests/sim/GameSimulation.test.ts`

**Interfaces:**
- Produces: `GameSettings`, `DEFAULT_GAME_SETTINGS`, `loadGameSettings(storage)`, `saveGameSettings(storage, settings)`, `scaleSimulationDelta(deltaMs, speed)`.
- Consumes: browser `Storage`; tests use a small in-memory `Storage` implementation.

- [ ] **Step 1: Write failing settings tests**

```ts
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_GAME_SETTINGS,
  loadGameSettings,
  saveGameSettings,
  scaleSimulationDelta,
} from '../../src/settings/gameSettings';

it('round-trips validated settings and falls back from corrupt data', () => {
  const storage = new MemoryStorage();
  saveGameSettings(storage, { ...DEFAULT_GAME_SETTINGS, gameSpeed: 1.25, aimMode: 'manual' });
  expect(loadGameSettings(storage).gameSpeed).toBe(1.25);
  storage.setItem('fu-tide-settings-v1', '{broken');
  expect(loadGameSettings(storage)).toEqual(DEFAULT_GAME_SETTINGS);
});

it('scales only the simulation delta', () => {
  expect(scaleSimulationDelta(40, 0.75)).toBe(30);
  expect(scaleSimulationDelta(40, 1.25)).toBe(50);
});
```

- [ ] **Step 2: Run the focused test and confirm failure**

Run: `npm.cmd test -- tests/settings/gameSettings.test.ts`

Expected: FAIL because `src/settings/gameSettings.ts` does not exist.

- [ ] **Step 3: Implement the settings contract and strict validation**

```ts
export type AimMode = 'auto' | 'manual';
export type GameSpeed = 0.75 | 1 | 1.25;
export type EffectLevel = 'low' | 'medium' | 'high';

export interface GameSettings {
  version: 1;
  aimMode: AimMode;
  gameSpeed: GameSpeed;
  musicVolume: number;
  soundVolume: number;
  screenShake: boolean;
  damageNumbers: boolean;
  effectLevel: EffectLevel;
  joystickOpacity: EffectLevel;
}

export const DEFAULT_GAME_SETTINGS: GameSettings = {
  version: 1,
  aimMode: 'auto',
  gameSpeed: 1,
  musicVolume: 0.7,
  soundVolume: 0.8,
  screenShake: true,
  damageNumbers: true,
  effectLevel: 'high',
  joystickOpacity: 'medium',
};

export function scaleSimulationDelta(deltaMs: number, speed: GameSpeed): number {
  return deltaMs * speed;
}
```

Use key `fu-tide-settings-v1`; accept only enumerated values and clamp volume values to `[0, 1]`. Any parse or shape failure returns a fresh copy of the defaults.

- [ ] **Step 4: Feed scaled time only to the simulation**

In `GameScene.update`, pass `scaleSimulationDelta(Math.min(delta, 50), settings.gameSpeed)` to `simulation.update`, while passing raw `Math.min(delta, 50)` to `effects.update`.

- [ ] **Step 5: Run focused and full tests**

Add an integration assertion that `240_000ms` of real time at `1.25x` advances the simulation to `300_000ms` and triggers the first Boss boundary, while the same real delta at `0.75x` advances only `180_000ms`.

Run: `npm.cmd test -- tests/settings/gameSettings.test.ts`

Run: `npm.cmd test`

Expected: all tests PASS.

---

### Task 2: Four-Slot Loadout And Derived-Stat Recalculation

**Files:**
- Create: `src/sim/loadout.ts`
- Create: `tests/sim/loadout.test.ts`
- Modify: `src/sim/types.ts`
- Modify: `src/sim/state.ts`
- Modify: `src/sim/upgrades.ts`
- Modify: `src/sim/GameSimulation.ts`
- Modify: `tests/sim/GameSimulation.test.ts`

**Interfaces:**
- Produces: `MAX_PASSIVE_SLOTS`, `getEquippedUpgrades(player)`, `canEquipUpgrade(player, id)`, `recalculatePlayerBuild(player)`, `createInsightChoices(state)`, `applyInsight(state, id)`.
- Adds to `Player`: `equippedUpgrades: UpgradeId[]`, `insightLevels: Record<InsightId, number>`.
- Adds `InsightId = 'damage' | 'vitality' | 'speed' | 'pickup'` and an upgrade-choice discriminant so normal passives and repeatable insights cannot be confused.

- [ ] **Step 1: Write failing loadout tests**

```ts
it('never equips a fifth passive through a normal level choice', () => {
  const state = createDefaultState();
  state.player.equippedUpgrades = UPGRADE_IDS.slice(0, 4);
  for (const id of state.player.equippedUpgrades) state.player.upgradeLevels[id] = 1;
  expect(createUpgradeChoices(state).every((id) => state.player.equippedUpgrades.includes(id))).toBe(true);
});

it('removes derived bonuses when a passive leaves the loadout', () => {
  const state = createDefaultState();
  state.player.equippedUpgrades = ['swift-steps'];
  state.player.upgradeLevels['swift-steps'] = 4;
  recalculatePlayerBuild(state.player);
  const boosted = state.player.speed;
  state.player.equippedUpgrades = [];
  state.player.upgradeLevels['swift-steps'] = 0;
  recalculatePlayerBuild(state.player);
  expect(state.player.speed).toBeLessThan(boosted);
  expect(state.player.speed).toBe(245);
});
```

- [ ] **Step 2: Run tests and confirm the missing loadout API failure**

Run: `npm.cmd test -- tests/sim/loadout.test.ts tests/sim/GameSimulation.test.ts`

- [ ] **Step 3: Add explicit base-stat reset and passive replay**

```ts
export const MAX_PASSIVE_SLOTS = 4;

export function recalculatePlayerBuild(player: Player): void {
  const hp = player.hp;
  resetDerivedStats(player);
  for (const id of player.equippedUpgrades) {
    applyUpgradeLevels(player, id, player.upgradeLevels[id]);
  }
  applyInsightLevels(player);
  player.hp = Math.min(hp, player.maxHp);
}
```

`resetDerivedStats` must assign every upgrade-derived field to the same defaults used by `createDefaultState`. `applyUpgradeLevels` computes the final contribution from a level without replaying one-time healing. Keep transient combat values such as position, attack timer, invulnerability, current HP, experience, and level intact; clamp shield and HP to recalculated maxima.

- [ ] **Step 4: Update normal upgrade selection**

When fewer than four skills are equipped, candidates may come from unowned skills and equipped skills below level four. When four are equipped, candidates only come from equipped skills below level four. When all four are level four, return three seeded `InsightId` choices instead of passive IDs.

- [ ] **Step 5: Preserve one-time effects around recalculation**

`chooseUpgrade` records the old level, inserts a first-time skill into `equippedUpgrades`, increments the level, recalculates, then applies one-time effects such as `vital-breath` healing and level-four awakening notification exactly once.

- [ ] **Step 6: Run loadout and regression tests**

Run: `npm.cmd test -- tests/sim/loadout.test.ts tests/sim/GameSimulation.test.ts`

Expected: slot-cap, stat-reset, awakening, and existing upgrade tests PASS.

---

### Task 3: Four New Passive Skills

**Files:**
- Modify: `src/sim/types.ts`
- Modify: `src/sim/state.ts`
- Modify: `src/sim/upgrades.ts`
- Modify: `src/sim/GameSimulation.ts`
- Modify: `tests/sim/GameSimulation.test.ts`

**Interfaces:**
- Extends `UpgradeId` with `north-star`, `bullet-reprisal`, `spirit-jade`, `soul-pin`.
- Adds derived fields for star timing/damage/pierce, bullet-reprisal damage/radius/chains, active cooldown multiplier/recovery, and soul-pin chance/knockback/root timing.
- Produces combat events `star-volley`, `bullet-reprisal`, `soul-pinned` for rendering.

- [ ] **Step 1: Add failing registry and behavior tests**

```ts
it('registers twenty passives and awakens each new passive at level four', () => {
  expect(UPGRADE_IDS).toHaveLength(20);
  for (const id of ['north-star', 'bullet-reprisal', 'spirit-jade', 'soul-pin'] as const) {
    const state = createDefaultState();
    state.player.equippedUpgrades = [id];
    state.player.upgradeLevels[id] = 3;
    const result = applyUpgrade(state, id);
    expect(result.awakened).toBe(true);
  }
});

it('fires eight north-star shots on its timer', () => {
  const sim = createStartedSimulation();
  equipAtLevel(sim.state.player, 'north-star', 1);
  sim.update(6_000, { x: 0, y: 0 });
  expect(sim.consumeEvents().filter((event) => event.type === 'star-volley')).toHaveLength(1);
});
```

- [ ] **Step 2: Run the focused test and confirm failure**

Run: `npm.cmd test -- tests/sim/GameSimulation.test.ts`

- [ ] **Step 3: Add labels, levels, derived values, and awakenings**

Use these fixed mechanical identities while keeping numeric tuning in exported configuration objects:

```ts
export const NEW_PASSIVE_CONFIG = {
  'north-star': { cooldownMs: [6000, 5400, 4800, 4200], damage: [12, 18, 24, 34], shots: [8, 8, 8, 16] },
  'bullet-reprisal': { damage: [12, 18, 26, 42], radius: [58, 66, 74, 92], chains: [0, 0, 0, 2] },
  'spirit-jade': { cooldownMultiplier: [0.92, 0.84, 0.76, 0.65], healOnCast: [0, 0, 0, 5], shieldOnCast: [0, 0, 0, 12] },
  'soul-pin': { chance: [0.06, 0.1, 0.14, 0.2], rootMs: [180, 240, 320, 520], pulseMs: [0, 0, 0, 6000] },
} as const;
```

- [ ] **Step 4: Implement periodic and hit-triggered behavior**

North Star emits eight radial projectiles, or two offset rings at awakening. Soul Pin applies knockback and seeded root chance on player projectile hits; its awakened pulse roots normal enemies and applies slow to Bosses. Spirit Jade modifies active cooldown and only heals on a successful active cast. Bullet Reprisal is invoked by the bullet interception API introduced in Task 5; until then its callable handler returns no event when no bullet is supplied.

- [ ] **Step 5: Run all simulation tests**

Run: `npm.cmd test -- tests/sim/GameSimulation.test.ts tests/sim/loadout.test.ts`

Expected: all passive tests PASS and existing 16 skills retain their behavior.

---

### Task 4: Transactional Boss-Treasure Replacement

**Files:**
- Modify: `src/sim/types.ts`
- Modify: `src/sim/upgrades.ts`
- Modify: `src/sim/GameSimulation.ts`
- Modify: `src/ui/HudController.ts`
- Modify: `src/styles.css`
- Modify: `tests/sim/GameSimulation.test.ts`

**Interfaces:**
- Adds phase `treasure-replace` and `pendingTreasureUpgrade: UpgradeId | null` to `GameState`.
- Produces methods `beginTreasureChoice(id)`, `confirmTreasureReplacement(slotIndex)`, `cancelTreasureReplacement()`.

- [ ] **Step 1: Write failing replacement transaction tests**

```ts
it('does not replace a full loadout until a slot is confirmed', () => {
  const sim = createStartedSimulation();
  sim.state.player.equippedUpgrades = UPGRADE_IDS.slice(0, 4);
  sim.state.phase = 'treasure';
  sim.beginTreasureChoice(UPGRADE_IDS[4]);
  expect(sim.state.phase).toBe('treasure-replace');
  expect(sim.state.player.equippedUpgrades).not.toContain(UPGRADE_IDS[4]);
  sim.confirmTreasureReplacement(1);
  expect(sim.state.player.equippedUpgrades[1]).toBe(UPGRADE_IDS[4]);
  expect(sim.state.player.upgradeLevels[UPGRADE_IDS[4]]).toBe(1);
});
```

- [ ] **Step 2: Run the focused simulation test and confirm failure**

Run: `npm.cmd test -- tests/sim/GameSimulation.test.ts`

- [ ] **Step 3: Implement begin, cancel, and confirm as one transaction**

Existing equipped treasure choices upgrade immediately. A new skill with a free slot equips immediately. A new skill with four occupied slots enters `treasure-replace`; confirm zeroes the removed level, clears its skill-specific timers/state, inserts the new ID at the same index, sets it to level one, recalculates derived stats, clears treasure state, and resumes play. Invalid slot indices leave state unchanged.

- [ ] **Step 4: Add replacement UI**

Render four existing slots as explicit buttons with skill name, level, and awakening badge. Add a back button wired to `cancelTreasureReplacement`; do not make the entire overlay clickable. Keep the panel within mobile viewport height with scrolling only inside the choices area.

- [ ] **Step 5: Run tests and production type checking**

Run: `npm.cmd test`

Run: `npm.cmd build`

Expected: both commands succeed.

---

### Task 5: Ranged Enemies, Enemy Bullets, And Interception

**Files:**
- Create: `src/sim/enemyProjectiles.ts`
- Create: `tests/sim/enemyProjectiles.test.ts`
- Modify: `src/sim/types.ts`
- Modify: `src/sim/state.ts`
- Modify: `src/sim/GameSimulation.ts`
- Modify: `src/sim/spawnPacing.ts`
- Modify: `tests/sim/spawnPacing.test.ts`

**Interfaces:**
- Adds `EnemyArchetype = 'melee' | 'crossbow' | 'talisman' | 'soul-lamp'` to normal enemies.
- Adds `EnemyProjectileKind = 'bolt' | 'fan-seal' | 'soul-orb'` and `EnemyProjectile` with `id`, `ownerId`, `kind`, `x`, `y`, `vx`, `vy`, `radius`, `damage`, `ttlMs`, `homingMs`, `turnRate`.
- Produces `updateEnemyProjectiles(state, deltaMs): CombatEvent[]`, `tryFireRangedEnemy(state, enemy): EnemyProjectile[]`, `getRangedSpawnRatio(elapsedMs): number`.

- [ ] **Step 1: Write failing firing, homing, cap, and interception tests**

```ts
it('caps ranged spawns at thirty-five percent', () => {
  expect(getRangedSpawnRatio(0)).toBe(0);
  expect(getRangedSpawnRatio(3_600_000)).toBeLessThanOrEqual(0.35);
});

it('resolves a bullet through blades before barrier, shield, and hp', () => {
  const state = createDefaultState();
  state.player.orbitingBladeCount = 6;
  state.enemyProjectiles.push(makeBulletAt(state.player.x + state.player.orbitingBladeRadius, state.player.y));
  const hp = state.player.hp;
  const events = updateEnemyProjectiles(state, 16);
  expect(state.player.hp).toBe(hp);
  expect(events.some((event) => event.type === 'enemy-bullet-broken' && event.by === 'blade')).toBe(true);
});
```

- [ ] **Step 2: Run focused tests and confirm missing APIs**

Run: `npm.cmd test -- tests/sim/enemyProjectiles.test.ts tests/sim/spawnPacing.test.ts`

- [ ] **Step 3: Implement ranged behavior and projectile integration**

Use exported configuration:

```ts
export const ENEMY_PROJECTILE_CAP = 180;
export const RANGED_ATTACKS = {
  crossbow: { cooldownMs: 2400, telegraphMs: 520, projectileSpeed: 520 },
  talisman: { cooldownMs: 3600, telegraphMs: 700, projectileSpeed: 245, count: 5, spreadRadians: 0.7 },
  'soul-lamp': { cooldownMs: 4500, telegraphMs: 800, projectileSpeed: 185, homingMs: 2800, turnRate: 1.8 },
} as const;
```

Ranged enemies seek their preferred distance band instead of touching the player. At the cap they retain their ready state and retry later. Enemy death does not remove bullets.

- [ ] **Step 4: Implement the fixed collision pipeline**

Move and steer first, then test orbiting blade geometry, active barrier geometry, shield, and player body in that order. Emit `enemy-bullet-broken` with `by: 'blade' | 'barrier' | 'dash'`, `shield-blocked`, or `player-damaged`. Call Bullet Reprisal only for the three broken causes. Remove expired and out-of-arena bullets last.

- [ ] **Step 5: Integrate ranged spawn selection**

Ramp ranged ratio from zero after the opening minute to 0.35 by 15 minutes. Choose among the three ranged archetypes with the seeded simulation RNG and preserve the existing total spawn interval and late-game slowdown.

- [ ] **Step 6: Run focused and full tests**

Run: `npm.cmd test -- tests/sim/enemyProjectiles.test.ts tests/sim/spawnPacing.test.ts tests/sim/GameSimulation.test.ts`

Run: `npm.cmd test`

Expected: all tests PASS with deterministic projectile outcomes.

---

### Task 6: Active-Skill Selection, Aiming, And Casting

**Files:**
- Create: `src/sim/activeSkills.ts`
- Create: `tests/sim/activeSkills.test.ts`
- Modify: `src/sim/types.ts`
- Modify: `src/sim/state.ts`
- Modify: `src/sim/GameSimulation.ts`
- Modify: `src/scenes/GameScene.ts`
- Modify: `src/ui/HudController.ts`

**Interfaces:**
- Adds `ActiveSkillId = 'talisman-ruin' | 'dimension-step' | 'tai-chi-ward'`.
- Adds `SimulationInput = { move: Vector; aim: Vector; activate: boolean }`. Provide overloads for both `Vector` and `SimulationInput` during this update so existing deterministic tests remain valid while scene input uses the richer shape.
- Produces `chooseActiveSkill(id)`, `resolveAim(state, input, mode)`, `tryActivateSkill(state, input): CombatEvent[]`.

- [ ] **Step 1: Write failing responsibility and fallback tests**

```ts
it('talisman ruin damages enemies but never removes enemy bullets', () => {
  const state = stateWithActive('talisman-ruin');
  state.enemyProjectiles.push(makeEnemyBullet());
  const before = state.enemyProjectiles.length;
  activateSkill(state, { x: 1, y: 0 });
  expect(state.enemyProjectiles).toHaveLength(before);
});

it('dimension step clamps its destination and breaks only path bullets', () => {
  const state = stateWithActive('dimension-step');
  state.player.x = state.arena.width - 5;
  activateSkill(state, { x: 1, y: 0 });
  expect(state.player.x).toBeLessThanOrEqual(state.arena.width - state.player.radius);
  expect(state.player.invulnerableMs).toBeGreaterThan(0);
});

it('uses last movement and then upward as deterministic aim fallbacks', () => {
  expect(resolveManualAim({ x: 0, y: 0 }, { x: -1, y: 0 })).toEqual({ x: -1, y: 0 });
  expect(resolveManualAim({ x: 0, y: 0 }, { x: 0, y: 0 })).toEqual({ x: 0, y: -1 });
});
```

- [ ] **Step 2: Run focused tests and confirm failure**

Run: `npm.cmd test -- tests/sim/activeSkills.test.ts`

- [ ] **Step 3: Add start selection and active state**

Starting from the menu enters `active-choice`; `chooseActiveSkill` sets the ID, initializes cooldown to ready, and enters `playing`. Store cooldown remaining, last move direction, dash state, and barrier remaining/radius on `Player`.

- [ ] **Step 4: Implement the three skills**

```ts
export const ACTIVE_SKILLS = {
  'talisman-ruin': { cooldownMs: 18_000, damage: 140, range: 420, halfAngle: 0.48 },
  'dimension-step': { cooldownMs: 12_000, distance: 230, invulnerableMs: 420 },
  'tai-chi-ward': { cooldownMs: 20_000, durationMs: 4_500, radius: 120, slowMultiplier: 0.55 },
} as const;
```

Apply the Spirit Jade cooldown multiplier when a cast starts. A cast at zero cooldown emits `active-skill-cast`; Spirit Jade awakening restoration occurs once. Talisman Ruin affects enemies in its cone but leaves bullets unchanged. Dimension Step sweeps from start to end and breaks path bullets. Tai Chi Ward follows the player while active, blocks entering bullets, slows enemies, and deals only low periodic damage.

- [ ] **Step 5: Add keyboard, pointer, and mobile drag input**

Register `SPACE`. Desktop manual aim uses pointer world position minus player position. Mobile presses on the active button begin a drag; pointer movement updates a direction preview; release casts; returning within the cancel radius cancels. Auto mode ignores manual direction and selects the nearest valid enemy, then falls back to last movement.

Normalize legacy movement-only calls as `{ move: input, aim: { x: 0, y: 0 }, activate: false }` inside `GameSimulation.update`. New production call sites must pass `SimulationInput`; old test call sites can be migrated incrementally without changing their behavior.

- [ ] **Step 6: Run active and regression tests**

Run: `npm.cmd test -- tests/sim/activeSkills.test.ts tests/sim/GameSimulation.test.ts`

Run: `npm.cmd build`

Expected: tests and type checking PASS.

---

### Task 7: Authored Pixel Textures And World Rendering

**Files:**
- Create: `src/render/pixelArt.ts`
- Create: `tests/render/pixelArt.test.ts`
- Modify: `src/scenes/GameScene.ts`
- Modify: `src/render/ShapeFactory.ts`
- Modify: `src/main.ts`

**Interfaces:**
- Produces `PIXEL_SPRITES`, `registerPixelTextures(scene)`, `createPixelSprite(scene, key)`, and frame metadata for player, melee, three ranged enemies, and three Boss silhouettes.
- `ShapeFactory` remains responsible for hazards, aura, orbiting blades, shards, and chests; entity bodies move to sprites.

- [ ] **Step 1: Write failing palette and frame-dimension tests**

```ts
it('defines distinct 32px normal silhouettes and larger bosses', () => {
  expect(PIXEL_SPRITES.player.width).toBe(32);
  expect(PIXEL_SPRITES.crossbow.width).toBe(32);
  expect(PIXEL_SPRITES.talisman.pixels).not.toEqual(PIXEL_SPRITES.crossbow.pixels);
  expect(PIXEL_SPRITES['boss-crimson'].width).toBeGreaterThanOrEqual(48);
});

it('uses only declared palette indices in every frame', () => {
  for (const sprite of Object.values(PIXEL_SPRITES)) {
    expect(sprite.frames.flat().every((index) => index >= 0 && index < sprite.palette.length)).toBe(true);
  }
});
```

- [ ] **Step 2: Run tests and confirm missing sprite definitions**

Run: `npm.cmd test -- tests/render/pixelArt.test.ts`

- [ ] **Step 3: Author pixel matrices and runtime texture registration**

Define compact indexed-color frames for idle, two-step movement, attack windup, attack, and hit. Player uses cyan, white, gold, and deep navy; ranged archetypes use distinct weapon silhouettes; Bosses use 48 or 64px matrices and type-specific accents. Draw each source pixel as one canvas pixel, register the canvas texture, and set Phaser texture filtering to nearest.

```ts
export function createPixelSprite(scene: Phaser.Scene, key: PixelSpriteKey): Phaser.GameObjects.Sprite {
  const sprite = scene.add.sprite(0, 0, key);
  sprite.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
  sprite.setOrigin(0.5, 0.5);
  return sprite;
}
```

- [ ] **Step 4: Replace entity Graphics maps with Sprite maps**

Choose texture and animation from enemy archetype, Boss type, firing windup, movement, and recent-hit state. Round sprite world positions before assignment. Keep health bars and telegraphs in Graphics layers above or below the sprites as appropriate.

- [ ] **Step 5: Configure pixel-perfect Phaser rendering**

Set `pixelArt: true`, `antialias: false`, and `roundPixels: true` in the game configuration. Verify canvas CSS does not apply smoothing or fractional transforms.

- [ ] **Step 6: Run render tests and build**

Run: `npm.cmd test -- tests/render/pixelArt.test.ts`

Run: `npm.cmd build`

Expected: tests and build PASS.

---

### Task 8: VFX Budget, Enemy Bullet Presentation, And Settings-Aware Feedback

**Files:**
- Create: `src/audio/GameAudio.ts`
- Create: `tests/audio/GameAudio.test.ts`
- Modify: `src/render/effectSpecs.ts`
- Modify: `src/render/EffectRenderer.ts`
- Modify: `src/render/ShapeFactory.ts`
- Modify: `src/scenes/GameScene.ts`
- Modify: `tests/render/effectSpecs.test.ts`

**Interfaces:**
- Adds effect kinds for bullet break, ranged windup, active cast, star volley, reprisal, and soul pin.
- `EffectRenderer` consumes `GameSettings` and enforces `EFFECT_BUDGETS = { low: 45, medium: 90, high: 160 }`.
- `GameAudio` consumes combat events and exposes `startMusic()`, `setVolumes(music, sound)`, `playEvents(events)`, and `dispose()`.

- [ ] **Step 1: Write failing effect mapping and budget tests**

```ts
it('maps bullet breaks and active casts to readable effects', () => {
  const specs = createEffectSpecs([
    { type: 'enemy-bullet-broken', x: 10, y: 20, by: 'blade' },
    { type: 'active-skill-cast', x: 30, y: 40, skill: 'tai-chi-ward', angle: 0 },
  ]);
  expect(specs.map((spec) => spec.kind)).toEqual(['bullet-break', 'active-cast']);
});

it('keeps critical telegraphs when the decorative budget is full', () => {
  expect(isCriticalEffect('ranged-windup')).toBe(true);
  expect(isCriticalEffect('boss-skill')).toBe(true);
});

it('applies independent music and sound gain values', () => {
  const audio = new GameAudio(fakeAudioContext());
  audio.setVolumes(0.35, 0.8);
  expect(audio.musicGain).toBeCloseTo(0.35);
  expect(audio.soundGain).toBeCloseTo(0.8);
});
```

- [ ] **Step 2: Run the focused test and confirm failure**

Run: `npm.cmd test -- tests/render/effectSpecs.test.ts`

- [ ] **Step 3: Render distinct bullets and mandatory telegraphs**

Draw bolts as narrow amber streaks, fan seals as magenta paper glyphs, and soul orbs as cyan cores with violet tails. Windups and Boss hazards use a critical layer that bypasses decorative budgets. Render active direction preview below enemies but above the arena floor.

- [ ] **Step 4: Add a lightweight synthesized audio layer**

Create one ambient pentatonic loop after the user's first interaction so browser autoplay rules are respected. Map projectile hit, bullet break, level-up, active cast, Boss arrival, chest reward, and player damage events to short synthesized tones/noise envelopes. Route ambient audio and combat sounds through separate gain nodes, stop every oscillator and disconnect every node in `dispose`, and keep audio disabled gracefully when `AudioContext` is unavailable.

- [ ] **Step 5: Add settings-aware feedback**

Low, medium, and high change particle count and trail persistence only. Gate camera shake on `screenShake`; gate floating damage text on `damageNumbers`; call `GameAudio.setVolumes` for the two volume sliders. Keep hit flash, enemy bullets, bullet collision, sound cues, and hazard warning available at every effect setting.

- [ ] **Step 6: Enforce object limits and pooling**

Reuse Graphics objects for short effects where possible. If the decorative budget is reached, omit the newest noncritical decoration. Always accept critical warnings and remove the oldest noncritical effect if necessary.

- [ ] **Step 7: Run audio, render, and full tests**

Run: `npm.cmd test -- tests/audio/GameAudio.test.ts tests/render/effectSpecs.test.ts tests/render/pixelArt.test.ts`

Run: `npm.cmd test`

Expected: all tests PASS.

---

### Task 9: Complete HUD, Paused Settings, Mobile Controls, And QA

**Files:**
- Modify: `src/ui/HudController.ts`
- Modify: `src/styles.css`
- Modify: `src/scenes/GameScene.ts`
- Modify: `src/main.ts`
- Create: `tests/ui/HudController.test.ts`

**Interfaces:**
- Extends `HudCallbacks` with active selection, active cast, treasure replacement, open/close settings, and settings-change callbacks.
- `HudController.render(state, settings)` renders four passive slots, one active slot, settings button, active selection, replacement flow, and settings controls.

- [ ] **Step 1: Write failing DOM behavior tests**

```ts
it('renders four stable passive slots and one active slot', () => {
  const hud = mountHud();
  hud.render(createDefaultState(), DEFAULT_GAME_SETTINGS);
  expect(document.querySelectorAll('.passive-slot')).toHaveLength(4);
  expect(document.querySelectorAll('.active-slot')).toHaveLength(1);
});

it('opens settings without advancing the simulation and persists speed', () => {
  const fixture = mountSceneFixture();
  fixture.openSettings();
  fixture.tick(1000);
  expect(fixture.simulation.state.elapsedMs).toBe(0);
  fixture.changeSetting('gameSpeed', '1.25');
  expect(fixture.storage.getItem('fu-tide-settings-v1')).toContain('1.25');
});
```

- [ ] **Step 2: Run the focused test and confirm failure**

Run: `npm.cmd test -- tests/ui/HudController.test.ts`

- [ ] **Step 3: Build the compact combat HUD**

Add four fixed passive slots with symbols, level pips, and awakening treatment. Add a separate active icon button with Space label on desktop and cooldown overlay. Use Lucide icons if an icon package already exists; because this project has no icon library, use a familiar text glyph only for the gear control and provide `aria-label="设置"` plus a tooltip.

- [ ] **Step 4: Build and wire the paused settings panel**

Use segmented controls for aim and game speed, range inputs for music and effects volume, switches for shake and damage numbers, and segmented controls for effect level and joystick opacity. Opening settings makes `GameScene.update` skip simulation updates and clears pending active input; closing restores play. Persist each validated change immediately.

- [ ] **Step 5: Finish responsive and accessibility styling**

Keep cards at 8px radius or less. On 390x844, ensure the start choice, treasure replacement, and settings panel fit with internal scrolling; reserve stable dimensions for skill slots and the active button; prevent labels from changing button dimensions. Apply joystick opacity only to mobile controls.

- [ ] **Step 6: Run all automated verification**

Run: `npm.cmd test`

Run: `npm.cmd build`

Expected: the full suite and production build succeed.

- [ ] **Step 7: Start a dedicated preview server**

Run: `npm.cmd run dev -- --port 5173`

If port 5173 is occupied, use the next free port and record the printed URL. Keep the server running through browser QA.

- [ ] **Step 8: Perform desktop browser QA**

At 1440x900, verify start active selection, four-slot progression, manual and automatic aim, all active cooldowns, each ranged warning and projectile, blade/barrier/shield interception, settings pause, speed changes, and treasure replacement. Inspect the browser console and correct all uncaught errors.

- [ ] **Step 9: Perform mobile browser QA**

At 390x844, verify movement, active-button drag aiming and cancel, settings scrolling, joystick opacity, no text overlap, no clipped panels, and readable enemy bullets. Capture screenshots of normal combat, settings, and a dense ranged encounter.

- [ ] **Step 10: Stress-test late-game readability and budgets**

Use deterministic development previews to populate ranged enemies, 180 enemy bullets, Boss hazards, awakened effects, and the active barrier. Confirm critical warnings remain visible at low/high effects, decorative limits hold, sprite positions remain pixel aligned, and the canvas is nonblank at desktop and mobile sizes.

- [ ] **Step 11: Final verification record**

Run: `npm.cmd test && npm.cmd build`

Record the exact passing test count, build result, preview URL, desktop/mobile viewport results, console status, and any remaining balance-only observations in the completion response.
