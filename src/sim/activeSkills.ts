import type { ActiveSkillId, CombatEvent, Enemy, GameState, Player, Vector } from './types';
import { hasSynergy } from './synergies';
import { dealPlayerDamage } from './combatStats';

export const ACTIVE_SKILLS = {
  'talisman-ruin': { cooldownMs: 18_000, damage: 140, range: 420, halfAngle: 0.48 },
  'dimension-step': { cooldownMs: 12_000, distance: 230, invulnerableMs: 420 },
  'tai-chi-ward': { cooldownMs: 20_000, durationMs: 4_500, radius: 120, slowMultiplier: 0.55 },
} as const;

const ACTIVE_LEVELS = {
  'talisman-ruin': [
    { damage: 140, range: 420, halfAngle: 0.48 },
    { damage: 190, range: 450, halfAngle: 0.56 },
    { damage: 250, range: 480, halfAngle: 0.64 },
    { damage: 340, range: 520, halfAngle: 0.72 },
  ],
  'dimension-step': [
    { distance: 230, invulnerableMs: 420 },
    { distance: 270, invulnerableMs: 520 },
    { distance: 310, invulnerableMs: 620 },
    { distance: 350, invulnerableMs: 800 },
  ],
  'tai-chi-ward': [
    { durationMs: 4500, radius: 120 },
    { durationMs: 5500, radius: 135 },
    { durationMs: 6500, radius: 150 },
    { durationMs: 8000, radius: 175 },
  ],
} as const;

export function resolveActiveAim(
  state: GameState,
  manualAim: Vector,
  mode: 'auto' | 'manual',
  player: Player = state.player,
): Vector {
  if (mode === 'auto' && state.enemies.length > 0) {
    const target = state.enemies
      .filter((enemy) => enemy.hp > 0)
      .sort((a, b) => distance(a, player) - distance(b, player))[0];
    if (target) return normalize({ x: target.x - player.x, y: target.y - player.y });
  }
  const manual = normalize(manualAim);
  if (manual.x !== 0 || manual.y !== 0) return manual;
  const lastMove = normalize(player.lastMoveDirection);
  if (lastMove.x !== 0 || lastMove.y !== 0) return lastMove;
  return { x: 0, y: -1 };
}

export function tryActivateActiveSkill(state: GameState, aim: Vector, player: Player = state.player): CombatEvent[] {
  const skill = player.activeSkill;
  if (!skill || player.activeCooldownRemainingMs > 0) return [];
  const direction = normalize(aim);
  const resolved = direction.x === 0 && direction.y === 0 ? { x: 0, y: -1 } : direction;
  const events: CombatEvent[] = [];
  const angle = Math.atan2(resolved.y, resolved.x);

  if (skill === 'talisman-ruin') {
    const config = ACTIVE_LEVELS[skill][clampLevel(player.activeSkillLevel) - 1];
    const hit: typeof state.enemies = [];
    for (const enemy of state.enemies) {
      const offset = { x: enemy.x - player.x, y: enemy.y - player.y };
      const range = Math.hypot(offset.x, offset.y);
      const difference = Math.abs(wrapAngle(Math.atan2(offset.y, offset.x) - angle));
      if (range <= config.range && difference <= config.halfAngle) {
        dealActiveDamage(state, player, enemy, config.damage, events);
        hit.push(enemy);
      }
    }
    if (player.activeSkillLevel >= 4) {
      for (const origin of hit) {
        for (const enemy of state.enemies) {
          if (enemy.id !== origin.id && distance(enemy, origin) <= 85) {
            dealActiveDamage(state, player, enemy, config.damage * 0.5, events);
          }
        }
      }
    }
  } else if (skill === 'dimension-step') {
    const config = ACTIVE_LEVELS[skill][clampLevel(player.activeSkillLevel) - 1];
    const start = { x: player.x, y: player.y };
    player.x = clamp(player.x + resolved.x * config.distance, player.radius, state.arena.width - player.radius);
    player.y = clamp(player.y + resolved.y * config.distance, player.radius, state.arena.height - player.radius);
    player.invulnerableMs = Math.max(player.invulnerableMs, config.invulnerableMs);
    if (player.activeSkillLevel >= 4) {
      for (const enemy of state.enemies) {
        if (segmentDistance(start, player, enemy) <= enemy.radius + player.radius) {
          dealActiveDamage(state, player, enemy, 90, events);
        }
      }
    }
    state.enemyProjectiles = state.enemyProjectiles.filter((bullet) => {
      if (segmentDistance(start, player, bullet) > bullet.radius + player.radius) return true;
      state.runStats.bulletsBlocked += 1;
      events.push({ type: 'enemy-bullet-broken', x: bullet.x, y: bullet.y, by: 'dash' });
      return false;
    });
  } else {
    const config = ACTIVE_LEVELS[skill][clampLevel(player.activeSkillLevel) - 1];
    player.activeBarrierRemainingMs = config.durationMs;
    player.activeBarrierRadius = config.radius;
    if (player.activeSkillLevel >= 4) {
      for (const enemy of state.enemies) {
        if (distance(enemy, player) <= config.radius) {
          dealActiveDamage(state, player, enemy, 70, events);
        }
      }
    }
  }

  const immortalEcho = hasSynergy(player, 'immortal-echo');
  player.activeCooldownRemainingMs = ACTIVE_SKILLS[skill].cooldownMs
    * player.activeCooldownMultiplier
    * (immortalEcho ? 0.65 : 1);
  player.hp = Math.min(player.maxHp, player.hp + player.activeCastHeal);
  player.shield = Math.min(player.maxShield, player.shield + player.activeCastShield);
  events.push({ type: 'active-skill-cast', x: player.x, y: player.y, skill, angle });
  if (immortalEcho) {
    player.shield = Math.min(player.maxShield, player.shield + player.maxShield * 0.5);
    player.invulnerableMs = Math.max(player.invulnerableMs, 700);
    events.push({ type: 'synergy-triggered', x: player.x, y: player.y, synergy: 'immortal-echo' });
  }
  return events;
}

function dealActiveDamage(
  state: GameState,
  player: Player,
  enemy: Enemy,
  amount: number,
  events: CombatEvent[],
): void {
  const dealt = dealPlayerDamage(state, enemy, amount * player.arcaneDamageMultiplier, 'active');
  if (dealt >= 1) events.push({ type: 'damage-dealt', x: enemy.x, y: enemy.y, amount: dealt, source: 'active' });
}

export function getActiveSkillLevelSummary(skill: ActiveSkillId, level: number): string {
  const capped = clampLevel(level);
  if (skill === 'talisman-ruin') return `伤害 ${ACTIVE_LEVELS[skill][capped - 1].damage}`;
  if (skill === 'dimension-step') return `位移 ${ACTIVE_LEVELS[skill][capped - 1].distance}`;
  return `玄阵范围 ${ACTIVE_LEVELS[skill][capped - 1].radius}`;
}

export function getActiveSkillName(skill: ActiveSkillId): string {
  if (skill === 'talisman-ruin') return '万符归墟';
  if (skill === 'dimension-step') return '乾坤挪移';
  return '太极玄阵';
}

function normalize(vector: Vector): Vector {
  const length = Math.hypot(vector.x, vector.y);
  return length === 0 ? { x: 0, y: 0 } : { x: vector.x / length, y: vector.y / length };
}

function wrapAngle(angle: number): number {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

function segmentDistance(start: Vector, end: Vector, point: Vector): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared === 0
    ? 0
    : clamp(((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared, 0, 1);
  return Math.hypot(point.x - (start.x + dx * t), point.y - (start.y + dy * t));
}

function distance(a: Vector, b: Vector): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function clampLevel(level: number): 1 | 2 | 3 | 4 {
  return Math.max(1, Math.min(4, Math.floor(level))) as 1 | 2 | 3 | 4;
}
