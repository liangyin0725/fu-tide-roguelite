import type {
  CombatEvent,
  Enemy,
  EnemyProjectile,
  GameState,
  Player,
  Vector,
} from './types';
import { hasSynergy } from './synergies';
import { TRIBULATION_MODIFIERS } from './tribulations';
import { getTribulationChoiceModifiers } from './tribulationChoices';
import { dealPlayerDamage } from './combatStats';
import { PROJECTILE_SPEED } from './constants';

export const ENEMY_PROJECTILE_CAP = 180;

export const RANGED_ATTACKS = {
  crossbow: { cooldownMs: 2400, telegraphMs: 520, speed: 520, damage: 10 },
  talisman: { cooldownMs: 3600, telegraphMs: 700, speed: 245, damage: 7 },
  'soul-lamp': { cooldownMs: 4500, telegraphMs: 800, speed: 185, damage: 12 },
} as const;

export function getRangedSpawnRatio(elapsedMs: number): number {
  if (elapsedMs <= 60_000) return 0;
  return Math.min(0.35, ((elapsedMs - 60_000) / 840_000) * 0.35);
}

export function updateRangedAttacks(
  state: GameState,
  deltaMs: number,
  takeId: () => number,
): CombatEvent[] {
  const events: CombatEvent[] = [];
  for (const enemy of state.enemies) {
    if (
      enemy.kind !== 'normal'
      || enemy.archetype === 'melee'
      || enemy.hp <= 0
      || enemy.objectiveKind
      || enemy.bossObjectiveKind
    ) continue;
    const config = RANGED_ATTACKS[enemy.archetype];
    enemy.rangedAttackTimerMs = (enemy.rangedAttackTimerMs ?? 0) + deltaMs;
    const remaining = config.cooldownMs - enemy.rangedAttackTimerMs;
    if (remaining <= config.telegraphMs && !enemy.rangedTelegraphing) {
      enemy.rangedTelegraphing = true;
      events.push({
        type: 'ranged-windup',
        x: enemy.x,
        y: enemy.y,
        archetype: enemy.archetype,
      });
    }
    if (enemy.rangedAttackTimerMs < config.cooldownMs) continue;
    if (state.enemyProjectiles.length >= ENEMY_PROJECTILE_CAP) {
      enemy.rangedAttackTimerMs = config.cooldownMs;
      continue;
    }
    enemy.rangedAttackTimerMs = 0;
    enemy.rangedTelegraphing = false;
    const bullets = createShot(state, enemy, takeId);
    state.enemyProjectiles.push(...bullets.slice(0, ENEMY_PROJECTILE_CAP - state.enemyProjectiles.length));
    events.push({
      type: 'enemy-bullet-fired',
      x: enemy.x,
      y: enemy.y,
      archetype: enemy.archetype,
    });
  }
  return events;
}

export function updateEnemyProjectiles(
  state: GameState,
  deltaMs: number,
  applyPlayerDamage: (amount: number, player?: Player | import('./types').CoopPlayer) => void,
  takeId: () => number = () => state.nextId++,
): CombatEvent[] {
  const events: CombatEvent[] = [];
  const survivors: EnemyProjectile[] = [];
  for (const bullet of state.enemyProjectiles) {
    if (bullet.homingMs > 0) {
      steerTowardPlayer(bullet, state, deltaMs);
      bullet.homingMs = Math.max(0, bullet.homingMs - deltaMs);
    }
    bullet.x += bullet.vx * deltaMs / 1000;
    bullet.y += bullet.vy * deltaMs / 1000;
    bullet.ttlMs -= deltaMs;

    const breakCause = getBreakCause(state, bullet);
    if (breakCause) {
      state.runStats.bulletsBlocked += 1;
      events.push({ type: 'enemy-bullet-broken', x: bullet.x, y: bullet.y, by: breakCause });
      triggerReprisal(state, bullet.x, bullet.y, events);
      if (breakCause === 'mirror') {
        reflectProjectile(state, bullet, takeId);
        events.push({ type: 'tribulation-seal-triggered', x: bullet.x, y: bullet.y, seal: 'frost' });
      } else if (breakCause === 'blade' && hasSynergy(state.player, 'sword-ward')) {
        reflectProjectile(state, bullet, takeId);
        events.push({ type: 'synergy-triggered', x: bullet.x, y: bullet.y, synergy: 'sword-ward' });
      }
      continue;
    }
    const hitPlayer = getLivingPlayers(state)
      .find((player) => distance(bullet, player) <= bullet.radius + player.radius);
    if (hitPlayer) {
      applyPlayerDamage(bullet.damage, hitPlayer);
      continue;
    }
    if (
      bullet.ttlMs > 0 &&
      bullet.x >= -80 && bullet.x <= state.arena.width + 80 &&
      bullet.y >= -80 && bullet.y <= state.arena.height + 80
    ) {
      survivors.push(bullet);
    }
  }
  state.enemyProjectiles = survivors;
  return events;
}

function reflectProjectile(state: GameState, bullet: EnemyProjectile, takeId: () => number): void {
  const owner = state.enemies.find((enemy) => enemy.id === bullet.ownerId && enemy.hp > 0)
    ?? state.enemies
      .filter((enemy) => enemy.hp > 0)
      .sort((a, b) => distance(a, bullet) - distance(b, bullet))[0];
  if (!owner) return;
  const direction = normalize({ x: owner.x - bullet.x, y: owner.y - bullet.y });
  state.projectiles.push({
    id: takeId(),
    targetId: owner.id,
    x: bullet.x,
    y: bullet.y,
    vx: direction.x * PROJECTILE_SPEED * 1.2,
    vy: direction.y * PROJECTILE_SPEED * 1.2,
    radius: 7,
    damage: Math.max(state.player.bulletReprisalDamage, bullet.damage * 2),
    ttlMs: 900,
    pierceRemaining: 1,
    hitEnemyIds: [],
    kind: 'sword',
    source: 'reprisal',
  });
}

function createShot(state: GameState, enemy: Enemy, takeId: () => number): EnemyProjectile[] {
  const target = getNearestLivingPlayer(state, enemy);
  const targetAngle = Math.atan2(target.y - enemy.y, target.x - enemy.x);
  const speedMultiplier = TRIBULATION_MODIFIERS[state.tribulation].enemyProjectileSpeed
    * getTribulationChoiceModifiers(state.activeTribulationChoiceId).enemyProjectileSpeed;
  if (enemy.archetype === 'talisman') {
    return Array.from({ length: 5 }, (_, index) => createBullet(
      takeId(), enemy, 'fan-seal', targetAngle + (index - 2) * 0.175, 245 * speedMultiplier, 7, 5200,
    ));
  }
  if (enemy.archetype === 'soul-lamp') {
    return [createBullet(takeId(), enemy, 'soul-orb', targetAngle, 185 * speedMultiplier, 12, 6200, 2800, 1.8)];
  }
  return [createBullet(takeId(), enemy, 'bolt', targetAngle, 520 * speedMultiplier, 10, 3600)];
}

function createBullet(
  id: number,
  enemy: Enemy,
  kind: EnemyProjectile['kind'],
  angle: number,
  speed: number,
  damage: number,
  ttlMs: number,
  homingMs = 0,
  turnRate = 0,
): EnemyProjectile {
  return {
    id,
    ownerId: enemy.id,
    kind,
    x: enemy.x,
    y: enemy.y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    radius: kind === 'soul-orb' ? 8 : 6,
    damage,
    ttlMs,
    homingMs,
    turnRate,
  };
}

function steerTowardPlayer(bullet: EnemyProjectile, state: GameState, deltaMs: number): void {
  const speed = Math.hypot(bullet.vx, bullet.vy);
  const current = Math.atan2(bullet.vy, bullet.vx);
  const target = getNearestLivingPlayer(state, bullet);
  const desired = Math.atan2(target.y - bullet.y, target.x - bullet.x);
  const difference = wrapAngle(desired - current);
  const maxTurn = bullet.turnRate * deltaMs / 1000;
  const angle = current + Math.max(-maxTurn, Math.min(maxTurn, difference));
  bullet.vx = Math.cos(angle) * speed;
  bullet.vy = Math.sin(angle) * speed;
}

function getLivingPlayers(state: GameState): Array<Player | import('./types').CoopPlayer> {
  const players: Array<Player | import('./types').CoopPlayer> = state.playerDowned ? [] : [state.player];
  if (state.partner && !state.partner.downed) players.push(state.partner);
  return players.length > 0 ? players : [state.player];
}

function getNearestLivingPlayer(state: GameState, origin: Vector): Player | import('./types').CoopPlayer {
  return getLivingPlayers(state)
    .sort((left, right) => distance(left, origin) - distance(right, origin))[0];
}

function getBreakCause(
  state: GameState,
  bullet: EnemyProjectile,
): 'blade' | 'barrier' | 'mirror' | null {
  const player = state.player;
  const mirror = state.frostSealMirror;
  if (mirror && state.elapsedMs < mirror.expiresAtMs && distance(bullet, mirror) <= bullet.radius + 38) {
    return 'mirror';
  }
  if (player.orbitingBladeCount > 0) {
    const angle = Math.atan2(bullet.y - player.y, bullet.x - player.x);
    const radiusDelta = Math.abs(distance(bullet, player) - player.orbitingBladeRadius);
    const rotation = state.elapsedMs * 0.0025;
    const step = Math.PI * 2 / player.orbitingBladeCount;
    const angularDelta = Math.abs(wrapAngle(angle - rotation - Math.round((angle - rotation) / step) * step));
    if (
      hasSynergy(player, 'sword-ward')
        ? radiusDelta <= bullet.radius + 24
        : radiusDelta <= bullet.radius + 12 && angularDelta <= 0.23
    ) return 'blade';
  }
  if (player.activeBarrierRemainingMs > 0 && distance(bullet, player) <= player.activeBarrierRadius) {
    return 'barrier';
  }
  if (state.elapsedMs < state.objectiveFieldExpiresAtMs['frost-core'] && distance(bullet, player) <= 150) {
    return 'barrier';
  }
  return null;
}

function triggerReprisal(
  state: GameState,
  x: number,
  y: number,
  events: CombatEvent[],
): void {
  const player = state.player;
  if (player.bulletReprisalDamage <= 0) return;
  const targets = state.enemies
    .filter((enemy) => distance(enemy, { x, y }) <= player.bulletReprisalRadius)
    .sort((a, b) => distance(a, { x, y }) - distance(b, { x, y }))
    .slice(0, (hasSynergy(player, 'sword-ward') ? 2 : 1) + player.bulletReprisalChains);
  const multiplier = hasSynergy(player, 'sword-ward') ? 2.25 : 1;
  for (const target of targets) {
    const dealt = dealPlayerDamage(state, target, player.bulletReprisalDamage * multiplier, 'reprisal');
    if (dealt >= 1) {
      events.push({ type: 'damage-dealt', x: target.x, y: target.y, amount: dealt, source: 'reprisal' });
    }
  }
  events.push({ type: 'bullet-reprisal', x, y, radius: player.bulletReprisalRadius });
}

function wrapAngle(angle: number): number {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

function distance(a: Vector, b: Vector): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function normalize(vector: Vector): Vector {
  const length = Math.hypot(vector.x, vector.y);
  return length === 0 ? { x: 0, y: 0 } : { x: vector.x / length, y: vector.y / length };
}
