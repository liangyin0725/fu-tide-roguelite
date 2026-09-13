# Fu Tide Roguelite Design

## Concept

`符潮残夜` is a 2D browser roguelite prototype in the Vampire Survivors family. The player is a cyber daoist who survives a five-minute night tide by moving through enemy waves while talismans, flying swords, and lightning charms auto-fire.

## Core Loop

The player starts from a menu, enters one arena, survives as enemies spawn from offscreen, collects experience shards, and levels up into a three-choice upgrade pause. Defeat shows a death summary. Reaching the timer goal shows a victory summary.

## First Version Scope

- Phaser, TypeScript, and Vite.
- Thin Phaser scene backed by a pure TypeScript simulation system.
- Keyboard movement with WASD and arrow keys.
- Auto-targeting projectile attacks.
- Enemy chasing, contact damage, kill count, experience drops, and level-up choices.
- DOM HUD for health, level, timer, kills, and modal screens.
- Programmatic neon cyber-daoist visuals using Phaser shapes and particles.

## Out Of Scope

Persistent meta-progression, external art packs, audio, multiple characters, multiple maps, saved games, and complex item synergies are deferred.

## Testing

Pure simulation rules are covered by Vitest. Browser playtesting checks boot, first actionable screen, keyboard movement, visible enemies/projectiles, HUD readability, upgrade modal behavior, and desktop/mobile viewport sanity.
