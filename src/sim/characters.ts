import type { CharacterId } from './types';

export interface CharacterDefinition {
  name: string;
  symbol: string;
  trait: string;
  hidden?: boolean;
  unlockHint?: string;
}

export const CHARACTERS: Record<CharacterId, CharacterDefinition> = {
  'xuan-jian': { name: '玄剑', symbol: '剑', trait: '飞剑基础伤害提高 10%' },
  'lei-zhuan': { name: '雷篆', symbol: '雷', trait: '术法伤害提高 20%，最大生命降低 10%' },
  'shou-yi': { name: '守一', symbol: '守', trait: '最大生命和护盾提高 25%，移动速度降低 5%' },
  'jing-po': {
    name: '镜魄',
    symbol: '镜',
    trait: '镜阵与弹幕反击强化，擅长反射弹幕和控场',
    hidden: true,
    unlockHint: '击败血月劫主并成功破除血祭魔井',
  },
};

export const CHARACTER_IDS = Object.keys(CHARACTERS) as CharacterId[];
export const STARTING_CHARACTER_IDS = CHARACTER_IDS.filter((id) => !CHARACTERS[id].hidden);
