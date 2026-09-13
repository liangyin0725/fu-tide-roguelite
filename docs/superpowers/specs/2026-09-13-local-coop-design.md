# Local Co-op Design

## Goal

Add an optional two-player local co-op run while preserving existing single-player behavior and saves.

## Run Setup And Input

- The menu offers Solo and Local Co-op starts.
- Player one uses WASD and F. Player two uses arrow keys and Enter.
- Both players choose a character and an active skill before combat.

## Shared And Independent State

- Arena, enemies, Bosses, events, chests, tribulations, objectives, and experience shards are shared.
- Each player owns a separate `Player` build: health, shield, active skill, cooldowns, five skill slots, six enhancement slots, upgrades, awakenings, seals, and damage totals.
- Shared experience is awarded to both alive players. A level-up enqueues one upgrade selection per eligible player, resolving player one then player two while the simulation is paused.

## Downed And Revive Rules

- A player at zero health becomes downed for 12 seconds, cannot move or attack, and emits a revive prompt.
- A living teammate within 54 pixels revives them after three continuous seconds.
- Revival restores 35% maximum health and grants 1.2 seconds of invulnerability.
- The run ends only when every player is downed.

## World Rules

- Normal enemies choose the nearest living player each update. Ranged targeting and Boss hazards use that same target-selection helper.
- Camera centers between living players and zooms out smoothly as their distance grows.
- Projectiles and damage events carry their owner; effects and end-of-run totals remain attributable.

## UI

- HUD shows two color-coded health bars and two separate loadout docks in co-op.
- Upgrade overlay identifies whose choice is pending.
- A downed player shows revive progress above their world sprite and on the HUD.

## Compatibility

- Single-player remains the default and uses the existing player-one path.
- Co-op is local-only; no networking, persistence schema change, or mobile co-op controls are included.
