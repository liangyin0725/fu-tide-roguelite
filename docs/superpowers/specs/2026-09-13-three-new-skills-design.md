# Three New Skills Design

## Goal

Add three six-level skill upgrades that expand crowd control, multi-pass projectile play, and enemy grouping without changing the single-player or local co-op loadout rules.

## Skills

### 玄霜禁域 (`frost-domain`)

- Every 7.2 to 4.4 seconds, create a circular domain around the player for 1.6 seconds.
- Enemies in the domain are slowed, and ordinary enemies receive a brief freeze at rank 4+.
- At rank 6, the domain becomes an awakened frost field: it freezes ordinary enemies, strongly slows bosses, and intercepts enemy bullets inside the circle.

### 裂空回环 (`rift-return`)

- Every 6.8 to 3.8 seconds, launch a blade toward the nearest enemy and then return it to its caster.
- The outward and returning passes can independently hit enemies, creating a path-dependent damage pattern rather than a plain damage multiplier.
- At rank 6, the returning blade splits into two homing echoes when it reaches the caster.

### 引星法阵 (`star-pull`)

- Every 8.5 to 4.8 seconds, place a field at the densest nearby enemy cluster for 1.4 seconds.
- Normal enemies in the field are pulled toward its center and take a final burst when it expires; bosses are slowed instead of displaced.
- At rank 6, the field also bends enemy projectiles toward its center and destroys bullets that reach the core.

## Integration

- All three are `skill` upgrades with six levels, appear in ordinary upgrades, chests, beta loadouts, and each co-op player's independent pool.
- Each has a distinct persistent/periodic effect event and an awakening surge summary.
- Their runtime state is represented on `Player` so both local players can use independent instances.

## Constraints

- No new dependencies.
- Preserve existing single-player five-skill and local co-op four-skill slot limits.
- Keep existing damage statistics valid by reporting new damage through existing compatible damage sources.
- Cover runtime behavior and catalog membership in Vitest; run the full suite and production build.
