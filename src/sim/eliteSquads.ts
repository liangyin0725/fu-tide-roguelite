import type { EliteAffix, EnemyArchetype } from './types';

export interface EliteSquadMember {
  offsetX: number;
  offsetY: number;
  archetype: EnemyArchetype;
  eliteAffix?: EliteAffix;
}

const AFFIXES: EliteAffix[] = ['iron-wall', 'haste', 'mender', 'suppressor'];

export const ELITE_NAMES: Record<EliteAffix, string> = {
  'iron-wall': '铁壁',
  haste: '疾行',
  mender: '祭司',
  suppressor: '禁法',
};

export function createEliteSquadBlueprint(wave: number): EliteSquadMember[] {
  const affix = AFFIXES[(Math.max(1, wave) - 1) % AFFIXES.length];
  const formation = (wave - 1) % 3;
  const offsets = formation === 0
    ? [[0, 0], [-52, -42], [-52, 42], [-104, -74], [-104, 74]]
    : formation === 1
      ? [[0, 0], [-70, -60], [-70, -20], [-70, 20], [-70, 60]]
      : [[0, 0], [70, 0], [-70, 0], [0, 70], [0, -70]];
  const archetypes: EnemyArchetype[] = ['melee', 'crossbow', 'talisman', 'melee', 'soul-lamp'];
  return offsets.map(([offsetX, offsetY], index) => ({
    offsetX,
    offsetY,
    archetype: archetypes[index],
    eliteAffix: index === 0 ? affix : undefined,
  }));
}
