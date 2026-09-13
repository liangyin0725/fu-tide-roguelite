# Objective Fields Design

## Goal

Completed tribulation-chain objectives leave a short battlefield field that changes player decisions instead of only granting numeric rewards.

## Rules

- Completing a thunder pillar grants Storm Conduit for 18 seconds: thunder and chain effects gain an extra nearby target.
- Completing a blood well grants Crimson Harvest for 18 seconds: normal enemy kills have a visible small healing chance.
- Completing a frost core grants Stillwater Ward for 18 seconds: enemy bullets entering the player ward are frozen and removed.
- Fields are independent from the existing objective rewards, route choice, and failure penalty.
- A new field replaces an older field of the same kind; different fields can coexist.
- The HUD must show active field names and remaining time. Resolution emits a dedicated field event for the renderer.

## Scope

Touch simulation state, objective completion, event types, renderer effect specs, HUD, and focused regression tests. Do not change enemy scaling, objective deadlines, or chest rewards.
