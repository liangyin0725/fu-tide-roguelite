import type {
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

export type GeneratedEffectTextureKey = `generated-vfx-${keyof typeof GENERATED_EFFECT_CELLS}`;
export type PersistentEffectKey = keyof typeof GENERATED_PERSISTENT_EFFECT_CELLS;

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
  if (kind === 'soul-orb') return 0.21;
  if (kind === 'fan-seal') return 0.18;
  return 0.15;
}

export function getPersistentEffectVisuals(
  input: PersistentEffectInput,
): Record<PersistentEffectKey, PersistentEffectVisual> {
  const barrierActive = input.activeBarrierRemainingMs > 0 && input.activeBarrierRadius > 0;
  return {
    'thunder-ring': {
      visible: input.thunderRadius > 0,
      diameter: input.thunderRadius * 2,
      alpha: 0.32,
      rotation: input.timeMs * 0.00042,
    },
    'orbiting-blades': {
      visible: input.orbitingBladeCount > 0,
      diameter: input.orbitingBladeRadius * 2 + 24,
      alpha: Math.min(0.38, 0.26 + input.orbitingBladeCount * 0.02),
      rotation: -input.timeMs * 0.00055,
    },
    'golden-shield': {
      visible: barrierActive || input.shield > 0,
      diameter: barrierActive ? input.activeBarrierRadius * 2 + 16 : 96,
      alpha: barrierActive ? 0.4 : 0.3,
      rotation: input.timeMs * 0.0003,
    },
    'awakening-formation': {
      visible: input.awakenedSkillCount > 0,
      diameter: 160 + input.awakenedSkillCount * 24,
      alpha: Math.min(0.38, 0.24 + input.awakenedSkillCount * 0.04),
      rotation: input.timeMs * 0.00018,
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
