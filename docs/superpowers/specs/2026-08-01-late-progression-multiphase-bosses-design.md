# Late Progression and Multiphase Bosses Design

## Goal

Improve the pace of late-game upgrades, expand the boss roster from one presentation to three distinct bosses, and give every boss readable telegraphed skills with a two-phase fight.

## Progression

### Normal-enemy experience

- The first five minutes retain the current normal-enemy experience value of `3`.
- Starting at 5:00, normal-enemy experience increases by 20% every five minutes.
- The multiplier is deterministic: `1.2 ** floor(elapsedMs / 300000)`.
- The value is captured when an enemy spawns, so an enemy's reward does not change while it remains alive.
- Fractional experience values are allowed and continue to use the existing shard and experience-multiplier pipeline.

Examples:

| Run time | Normal-enemy experience |
| --- | ---: |
| 0:00-4:59 | 3.00 |
| 5:00-9:59 | 3.60 |
| 10:00-14:59 | 4.32 |
| 15:00-19:59 | 5.184 |

### Level requirements

- Levels 1 through 11 keep the current next-level formula: `floor(previous * 1.22 + 4)`.
- When the player reaches level 12, and for every level afterward, the next-level formula becomes `floor(previous * 1.14 + 4)`.
- Existing skill caps, awakening rules, treasure rewards, and the all-skills-maxed fallback remain unchanged.

## Boss Roster and Rotation

Bosses continue to appear every five minutes. Boss type is derived from wave number and is never random:

1. Wave 1: `crimson` - 赤煞劫主
2. Wave 2: `thunder` - 雷狱劫主
3. Wave 3: `blood-moon` - 血月劫主
4. Wave 4 repeats `crimson`, and the three-boss cycle continues indefinitely.

All bosses continue to use the existing wave-based health, contact damage, speed, chest reward, and experience-burst scaling. Their silhouettes, colors, HUD names, and skill effects differ by boss type.

## Shared Boss Phase Rules

- Every boss starts in phase 1.
- The first time its health reaches or drops below 50% of maximum health, it enters phase 2.
- A phase transition occurs once per boss and emits a `boss-phase-changed` combat event.
- Transitioning clears that boss's unresolved phase-1 hazards, delays its next cast by 1 second, and displays a prominent HUD/effect notice.
- Upgrade, treasure, and awakening phases pause boss timers, hazards, combat, and elapsed run time through the existing simulation pause behavior.
- Killing a boss immediately removes every hazard owned by that boss.
- Boss skill damage uses the same shield, dodge, invulnerability, damage event, and death checks as contact damage.
- Each hazard can damage the player at most once. Separate simultaneous hazards can each deal damage only if shared invulnerability permits it.

## Boss Skills

### 赤煞劫主

Visual identity: red-black body, gold edges, broad rectangular warnings.

**Phase 1 - 煞影冲锋**

- Cooldown: 7 seconds.
- Records the player's position when casting begins.
- Displays a 520 by 80 warning corridor for 0.9 seconds.
- The boss then traverses the corridor over 0.6 seconds.
- Contact with the charge corridor deals `boss.damage * 1.25` once.

**Phase 2 - 赤煞震环**

- Charge cooldown shortens to 5.2 seconds.
- Every completed charge releases a ring expanding from radius 40 to 230 over 0.9 seconds.
- The damaging ring band is 24 units wide and deals `boss.damage * 0.75` once.

### 雷狱劫主

Visual identity: cyan-white core, angular lightning marks, circular and cross-shaped warnings.

**Phase 1 - 九霄落雷**

- Cooldown: 6.5 seconds.
- Creates three radius-54 warning circles near the player's position.
- Circles warn for 1 second, then strike simultaneously.
- Each strike deals `boss.damage` once.

**Phase 2 - 雷狱交叉**

- 落雷 cooldown shortens to 4.8 seconds and creates five circles.
- Every second 落雷 cast also records the player's position and creates perpendicular 600-unit lightning lines.
- The cross warns for 0.9 seconds, has a line width of 28, and deals `boss.damage * 0.8` once.

### 血月劫主

Visual identity: magenta-red body, pale moon core, circular sigils and pools.

**Phase 1 - 血月潮汐**

- Cooldown: 7 seconds.
- Shows a circular origin warning for 0.8 seconds.
- A damaging ring then expands from radius 35 to 260 over 1.2 seconds.
- The ring band is 26 units wide and deals `boss.damage` once.

**Phase 2 - 噬生血印**

- 血月潮汐 cooldown shortens to 5.2 seconds.
- Every 9 seconds, three radius-62 blood seals appear around the player's recorded position.
- Seals warn for 1.2 seconds, then explode for `boss.damage * 1.1`.
- If a seal damages the player, the boss heals 4% of maximum health, capped at maximum health.

## Simulation Model

### Enemy state

Boss enemies gain:

- `bossType: 'crimson' | 'thunder' | 'blood-moon'`
- `bossPhase: 1 | 2`
- `bossSkillTimerMs`
- `bossSecondaryTimerMs`
- `bossCastCount`

Normal enemies do not use these fields.

### Hazard state

`GameState` gains a `bossHazards` collection. Each hazard has:

- Stable ID and owner boss ID
- Hazard kind
- Geometry needed for collision and rendering
- Telegraph, active, and expiry timing
- Damage multiplier
- Whether it has already damaged the player

The simulation owns hazard creation, timing, collision, cleanup, and damage. Phaser renders the hazard collection and consumes combat events, but does not decide hits.

### Events

Add presentation events for:

- `boss-cast-started`
- `boss-skill-activated`
- `boss-phase-changed`
- `boss-healed`

Events include boss ID/type and the geometry or position needed by the effect renderer.

## Presentation

- Boss HUD displays the Chinese boss name, wave, phase, and health.
- The 50% transition briefly displays `二阶段` plus the newly unlocked skill name.
- Telegraphs remain visible beneath enemies and the player, while active strikes render above ground effects.
- Crimson warnings use red and gold, thunder warnings use cyan and white, and blood-moon warnings use magenta and pale red.
- Telegraph opacity and outlines must remain readable against the existing dark arena without obscuring the player.
- Desktop and mobile HUD layouts must not overlap the boss health bar or phase notice.

## Determinism and Edge Cases

- Boss rotation depends only on wave number.
- Skill placement uses the simulation's seeded random generator where offsets are needed.
- A dead or removed boss cannot create new hazards or receive healing.
- Phase transition cleanup happens before any same-frame skill activation.
- Large update deltas may advance timers, but each boss creates at most one primary and one secondary cast per update to prevent burst stacking after pauses.
- Multiple living bosses retain independent phase and skill timers.

## Testing and Verification

Automated tests cover:

- Experience values before and after each five-minute boundary.
- The formula switch when reaching level 12.
- Deterministic three-boss rotation across at least six waves.
- Phase transition at 50%, single transition event, and hazard cleanup.
- Telegraph-before-damage timing for every skill.
- Charge, circle, line, and ring collision geometry.
- Shared shield, dodge, and invulnerability behavior for skill damage.
- Blood-seal healing only after a successful hit.
- Hazard removal when its owner dies.
- Independent timers for simultaneous bosses.

Final verification runs the full test suite and production build, then checks desktop and mobile browser previews for all three bosses, their telegraphs, phase notices, HUD labels, canvas rendering, and console errors.
