# Tribulation Seals Design

## Goal

Make each five-minute tribulation choice leave a permanent, visible combat rule for the current run.

## Rules

- Selecting a thunder, blood-moon, or frost tribulation choice grants its matching seal for the rest of the run.
- Repeating a seal increases only that seal's rank; all three seal mechanics can coexist.
- The existing choice modifiers remain temporary and still clear at the next tribulation.

## Seal Mechanics

- Thunder Seal: every fourth player-fired sword releases a short chain-lightning strike from its first hit. Higher rank reduces the sword count required for a trigger, to a minimum of two.
- Blood Seal: elite kills charge Blood Echo. At three charges, it detonates at the player, damages nearby enemies, clears nearby enemy bullets, and restores a small amount of health. Higher rank reduces the required charges, to a minimum of one.
- Frost Seal: freezing a normal enemy creates a Frost Mirror at that location. Mirrors last six seconds, erase enemy bullets that touch them, and launch a reflected sword at the nearest enemy. Higher rank extends mirror duration; only one mirror may exist.

## Feedback

- HUD shows every owned seal and its rank beneath the active tribulation status.
- Selection emits a `tribulation-seal-gained` combat event; each mechanic emits a `tribulation-seal-triggered` event.
- The effect renderer gives the three seals distinct cyan, crimson, and ice-blue feedback.

## Boundaries

- No new menus, persistence, or out-of-run power is added.
- Bosses may be slowed by Frost Seal's existing freeze rules but never create Frost Mirrors.
- All new behavior must be deterministic through the existing simulation state and covered by simulation/UI tests.
