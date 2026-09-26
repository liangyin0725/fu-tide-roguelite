import type {
  BossHazard,
  BossHazardKind,
  BossType,
  CombatEvent,
  EnemyProjectileKind,
  Projectile,
  TribulationType,
} from '../sim/types';
import type { PixelSpriteKey } from './pixelArt';

export type GeneratedAtlasKey = keyof typeof GENERATED_PIXEL_ASSETS;

export interface GeneratedAtlasAsset {
  textureKey: string;
  url: string;
  columns: number;
  rows: number;
}

export interface GeneratedAtlasCell {
  atlas: GeneratedAtlasKey;
  column: number;
  row: number;
  outputSize: number;
}

export const GENERATED_PIXEL_ASSETS = {
  actors: {
    textureKey: 'generated-atlas-actors',
    url: '/assets/generated/actors-atlas.png',
    columns: 4,
    rows: 3,
  },
  bosses: {
    textureKey: 'generated-atlas-bosses',
    url: '/assets/generated/bosses-atlas.png',
    columns: 3,
    rows: 1,
  },
  worldVfx: {
    textureKey: 'generated-atlas-world-vfx',
    url: '/assets/generated/world-vfx-atlas.png',
    columns: 4,
    rows: 2,
  },
  combat: {
    textureKey: 'generated-atlas-combat',
    url: '/assets/generated/combat-atlas.png',
    columns: 4,
    rows: 2,
  },
  bossVfx: {
    textureKey: 'generated-atlas-boss-vfx',
    url: '/assets/generated/boss-vfx-atlas.png',
    columns: 4,
    rows: 3,
  },
} as const satisfies Record<string, GeneratedAtlasAsset>;

const actor = (column: number, row: number): GeneratedAtlasCell => ({
  atlas: 'actors', column, row, outputSize: 64,
});

const boss = (column: number): GeneratedAtlasCell => ({
  atlas: 'bosses', column, row: 0, outputSize: 96,
});

export const GENERATED_SPRITE_CELLS: Record<PixelSpriteKey, GeneratedAtlasCell> = {
  player: actor(0, 0),
  'player-xuan-jian': actor(0, 0),
  'player-lei-zhuan': actor(1, 0),
  'player-shou-yi': actor(2, 0),
  'player-jing-po': actor(3, 0),
  melee: actor(0, 1),
  crossbow: actor(1, 1),
  talisman: actor(2, 1),
  'soul-lamp': actor(3, 1),
  'boss-crimson': boss(0),
  'boss-thunder': boss(1),
  'boss-blood-moon': boss(2),
};

export const GENERATED_ARENA_CELLS: Record<TribulationType, GeneratedAtlasCell> = {
  calm: { atlas: 'worldVfx', column: 0, row: 0, outputSize: 512 },
  thunder: { atlas: 'worldVfx', column: 1, row: 0, outputSize: 512 },
  'blood-moon': { atlas: 'worldVfx', column: 2, row: 0, outputSize: 512 },
  frost: { atlas: 'worldVfx', column: 3, row: 0, outputSize: 512 },
};

export const GENERATED_EFFECT_CELLS = {
  sword: { atlas: 'worldVfx', column: 0, row: 1, outputSize: 192 },
  fire: { atlas: 'worldVfx', column: 1, row: 1, outputSize: 192 },
  lightning: { atlas: 'worldVfx', column: 2, row: 1, outputSize: 192 },
  frost: { atlas: 'worldVfx', column: 3, row: 1, outputSize: 192 },
} as const satisfies Record<string, GeneratedAtlasCell>;

export const GENERATED_ENEMY_PROJECTILE_CELLS = {
  bolt: { atlas: 'combat', column: 0, row: 0, outputSize: 96 },
  'fan-seal': { atlas: 'combat', column: 1, row: 0, outputSize: 96 },
  'soul-orb': { atlas: 'combat', column: 2, row: 0, outputSize: 96 },
} as const satisfies Record<EnemyProjectileKind, GeneratedAtlasCell>;

export const GENERATED_PERSISTENT_EFFECT_CELLS = {
  'thunder-ring': { atlas: 'combat', column: 0, row: 1, outputSize: 384 },
  'orbiting-blades': { atlas: 'combat', column: 1, row: 1, outputSize: 384 },
  'golden-shield': { atlas: 'combat', column: 2, row: 1, outputSize: 384 },
  'awakening-formation': { atlas: 'combat', column: 3, row: 1, outputSize: 384 },
} as const satisfies Record<string, GeneratedAtlasCell>;

export const GENERATED_BOSS_EFFECT_CELLS = {
  'crimson-charge': { atlas: 'bossVfx', column: 0, row: 0, outputSize: 384 },
  'crimson-circle': { atlas: 'bossVfx', column: 1, row: 0, outputSize: 384 },
  'crimson-line': { atlas: 'bossVfx', column: 2, row: 0, outputSize: 384 },
  'crimson-ring': { atlas: 'bossVfx', column: 3, row: 0, outputSize: 384 },
  'thunder-charge': { atlas: 'bossVfx', column: 0, row: 1, outputSize: 384 },
  'thunder-circle': { atlas: 'bossVfx', column: 1, row: 1, outputSize: 384 },
  'thunder-line': { atlas: 'bossVfx', column: 2, row: 1, outputSize: 384 },
  'thunder-ring': { atlas: 'bossVfx', column: 3, row: 1, outputSize: 384 },
  'blood-moon-charge': { atlas: 'bossVfx', column: 0, row: 2, outputSize: 384 },
  'blood-moon-circle': { atlas: 'bossVfx', column: 1, row: 2, outputSize: 384 },
  'blood-moon-line': { atlas: 'bossVfx', column: 2, row: 2, outputSize: 384 },
  'blood-moon-ring': { atlas: 'bossVfx', column: 3, row: 2, outputSize: 384 },
} as const satisfies Record<string, GeneratedAtlasCell>;

export type GeneratedEffectTextureKey = `generated-vfx-${keyof typeof GENERATED_EFFECT_CELLS}`;
export type GeneratedBossEffectTextureKey = `generated-boss-${keyof typeof GENERATED_BOSS_EFFECT_CELLS}`;
export type PersistentEffectKey = keyof typeof GENERATED_PERSISTENT_EFFECT_CELLS;

export interface GeneratedBossHazardVisual {
  textureKey: GeneratedBossEffectTextureKey;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  alpha: number;
}

export interface PersistentEffectInput {
  thunderRadius: number;
  orbitingBladeCount: number;
  orbitingBladeRadius: number;
  shield: number;
  activeBarrierRemainingMs: number;
  activeBarrierRadius: number;
  awakenedSkillCount: number;
  timeMs: number;
}

export interface PersistentEffectVisual {
  visible: boolean;
  diameter: number;
  alpha: number;
  rotation: number;
  originX: number;
  originY: number;
}

export function generatedArenaTextureKey(tribulation: TribulationType): string {
  return `generated-arena-${tribulation}`;
}

export function getGeneratedEffectTexture(
  eventType: CombatEvent['type'],
): GeneratedEffectTextureKey | null {
  switch (eventType) {
    case 'projectile-fired':
    case 'projectile-hit':
    case 'star-volley':
    case 'rift-return':
      return 'generated-vfx-sword';
    case 'fire-burst':
    case 'meteor-strike':
      return 'generated-vfx-fire';
    case 'chain-lightning':
    case 'shield-broken':
      return 'generated-vfx-lightning';
    case 'frost-hit':
    case 'frost-domain':
      return 'generated-vfx-frost';
    default:
      return null;
  }
}

export function getGeneratedProjectileTexture(
  kind: Projectile['kind'],
): GeneratedEffectTextureKey {
  if (kind === 'star') return 'generated-vfx-lightning';
  if (kind === 'glyph') return 'generated-vfx-frost';
  return 'generated-vfx-sword';
}

export function getGeneratedEnemyProjectileTexture(kind: EnemyProjectileKind): string {
  return `generated-enemy-${kind}`;
}

export function getGeneratedEnemyProjectileScale(kind: EnemyProjectileKind): number {
  if (kind === 'soul-orb') return 0.34;
  if (kind === 'fan-seal') return 0.28;
  return 0.22;
}

export function getGeneratedBossHazardTexture(
  bossType: BossType,
  kind: BossHazardKind,
): GeneratedBossEffectTextureKey {
  return `generated-boss-${bossType}-${kind}` as GeneratedBossEffectTextureKey;
}

export function getGeneratedBossEventTexture(
  event: CombatEvent,
): GeneratedBossEffectTextureKey | null {
  switch (event.type) {
    case 'boss-spawned':
      return getGeneratedBossHazardTexture(event.bossType, 'ring');
    case 'boss-cast-started':
      return getGeneratedBossHazardTexture(event.bossType, event.kind === 'primary' ? 'charge' : 'ring');
    case 'boss-skill-activated':
      return getGeneratedBossHazardTexture(event.bossType, event.kind);
    case 'boss-phase-changed':
      return getGeneratedBossHazardTexture(event.bossType, 'ring');
    case 'boss-objective-spawned':
    case 'boss-objective-resolved':
    case 'boss-healed':
      return getGeneratedBossHazardTexture(event.bossType, 'circle');
    case 'boss-break-spawned':
    case 'boss-break-resolved':
      return getGeneratedBossHazardTexture(event.bossType, 'charge');
    default:
      return null;
  }
}

export function getGeneratedBossHazardVisual(
  hazard: BossHazard,
  timeMs: number,
): GeneratedBossHazardVisual {
  const telegraph = hazard.telegraphRemainingMs > 0;
  const alpha = telegraph
    ? 0.5 + Math.sin(timeMs * 0.012 + hazard.id) * 0.12
    : 0.86;
  if (hazard.kind === 'line' || hazard.kind === 'charge') {
    const dx = hazard.endX - hazard.x;
    const dy = hazard.endY - hazard.y;
    return {
      textureKey: getGeneratedBossHazardTexture(hazard.bossType, hazard.kind),
      x: hazard.x + dx / 2,
      y: hazard.y + dy / 2,
      width: Math.hypot(dx, dy) + 48,
      height: Math.max(42, hazard.lineWidth * 2 + 10),
      rotation: Math.atan2(dy, dx),
      alpha,
    };
  }
  const progress = 1 - hazard.activeRemainingMs / Math.max(1, hazard.activeDurationMs);
  const activeRingRadius = hazard.startRadius
    + (hazard.endRadius - hazard.startRadius) * Math.min(1, Math.max(0, progress));
  const radius = hazard.kind === 'ring'
    ? (telegraph ? hazard.startRadius : activeRingRadius)
    : hazard.radius;
  const size = radius * 2 + (hazard.kind === 'ring' ? hazard.bandWidth : 32);
  return {
    textureKey: getGeneratedBossHazardTexture(hazard.bossType, hazard.kind),
    x: hazard.x,
    y: hazard.y,
    width: size,
    height: size,
    rotation: (hazard.id % 2 === 0 ? 1 : -1) * timeMs * 0.00032,
    alpha,
  };
}

export function getPersistentEffectVisuals(
  input: PersistentEffectInput,
): Record<PersistentEffectKey, PersistentEffectVisual> {
  const barrierActive = input.activeBarrierRemainingMs > 0 && input.activeBarrierRadius > 0;
  return {
    'thunder-ring': {
      visible: input.thunderRadius > 0,
      diameter: input.thunderRadius * 2 + 38,
      alpha: 0.58,
      rotation: input.timeMs * 0.00042,
      originX: 0.5,
      originY: 0.485,
    },
    'orbiting-blades': {
      visible: input.orbitingBladeCount > 0,
      diameter: input.orbitingBladeRadius * 2 + 72,
      alpha: Math.min(0.68, 0.46 + input.orbitingBladeCount * 0.025),
      rotation: -input.timeMs * 0.00055,
      originX: 0.499,
      originY: 0.485,
    },
    'golden-shield': {
      visible: barrierActive || input.shield > 0,
      diameter: barrierActive ? input.activeBarrierRadius * 2 + 36 : 120,
      alpha: barrierActive ? 0.68 : 0.48,
      rotation: input.timeMs * 0.0003,
      originX: 0.5,
      originY: 0.489,
    },
    'awakening-formation': {
      visible: input.awakenedSkillCount > 0,
      diameter: 220 + input.awakenedSkillCount * 28,
      alpha: Math.min(0.62, 0.34 + input.awakenedSkillCount * 0.055),
      rotation: input.timeMs * 0.00018,
      originX: 0.486,
      originY: 0.481,
    },
  };
}

export function getGeneratedEffectOrigin(event: CombatEvent): { x: number; y: number } | null {
  if ('x' in event && 'y' in event && typeof event.x === 'number' && typeof event.y === 'number') {
    return { x: event.x, y: event.y };
  }
  if (event.type === 'chain-lightning' || event.type === 'rift-return') {
    return { x: event.toX, y: event.toY };
  }
  return null;
}
