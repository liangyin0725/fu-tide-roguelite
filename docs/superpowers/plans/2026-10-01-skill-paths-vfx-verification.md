# Skill Paths And Combat Layering Delivery

Branch: `codex/high-detail-generated-pixel-art`. Main was not modified.

## Implemented

- All 18 skills have two Lv.3 choices (36 routes), route-specific Lv.4/5 mechanisms and gated Lv.6 awakening.
- Choice flow pauses simulation and resumes queued co-op upgrades. Both players own separate route state and awakening origins.
- Treasure replacement clears the removed route. Beta configuration exposes route selectors and rejects incomplete high-level loadouts.
- Upgrade previews and slot tooltips expose selected routes. A level-six skill lacking its required enhancement is not labeled awakened.
- Generated pixel textures are reused with skill colors and route geometry. Moving persistent fields reuse their identity and follow their damage positions.
- Frame admission separates critical danger, combat feedback and ambient decoration. Important combat effects evict lower-priority decoration.
- Damage labels merge ordinary same-target/source hits within 120ms; burst hits stay separate. Disabling numbers destroys existing labels.
- Ordinary camera shake chooses the strongest admitted event per frame with an 80ms cooldown. Boss phase/spawn and awakening bypass it.
- Bosses, objectives and large active hazards outside the viewport receive immediate edge indicators.
- Chinese and English route UI, beta configuration and combat HUD were exercised in the browser.

## Implementation Rulings

- Route runtime lives in bounded, player-owned helper modules rather than adding permanent derived statistics to `Player`. Original base upgrade formulas are unchanged; route bonuses are supplementary mechanics.
- Core on-hit routes consume explicit owner-tagged primary skill triggers, not generic HP decreases. Derived projectiles do not recursively trigger primary on-hit skills.
- Damage calculation receives the actual attacking player, including P2 route attacks and projectiles.
- Interception events carry bullet identity, velocity and player ownership so fresh bullets can produce immediate route counters.
- Existing arena brightness and generated art assets are preserved. No new art atlas or gameplay pacing changes were included.

## Verification

- `npm.cmd test -- --reporter=dot`: 50 files, 449 tests passed.
- `npm.cmd run build`: passed (TypeScript and Vite). Existing large Phaser bundle warning remains.
- Browser checks: 1280x720 and 691x704 route selection; Chinese/English beta route selection, level adjustment, reachable launch button and actual combat launch.
- Canvas pixel sampling confirms nonblank rendered combat; browser checks reported no page errors.
- Renderer saturation test advances 24,000 frames at 50ms (20 minutes equivalent), verifies bounded ambient allocations and complete cleanup. This is an allocation test, not a claim of 20 minutes of manual gameplay or FPS benchmarking.
- HTTP preview: `http://127.0.0.1:5175/` returned 200.
- Review regressions cover primary-trigger ownership, P2 boss multipliers, fresh mirror interception, persistent decal movement, saturation admission and critical objective depth.

## Manual Follow-Up Coverage

Not every possible five-skill combination has been manually played through a full late-game run. Route mechanisms, growth, cleanup and ownership have focused automated coverage; balance tuning can use subsequent play sessions.
