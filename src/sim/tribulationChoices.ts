import type { TribulationChoiceId, TribulationType } from './types';

export interface TribulationChoiceModifiers {
  playerDamage: number;
  experience: number;
  enemyDamage: number;
  enemyProjectileSpeed: number;
  playerSpeed: number;
  enemySpeed: number;
}

export interface TribulationChoiceDefinition {
  id: TribulationChoiceId;
  tribulation: Exclude<TribulationType, 'calm'>;
  name: string;
  symbol: string;
  benefit: string;
  pressure: string;
  modifiers: TribulationChoiceModifiers;
}

const NEUTRAL_MODIFIERS: TribulationChoiceModifiers = {
  playerDamage: 1,
  experience: 1,
  enemyDamage: 1,
  enemyProjectileSpeed: 1,
  playerSpeed: 1,
  enemySpeed: 1,
};

export const TRIBULATION_CHOICE_IDS: TribulationChoiceId[] = [
  'thunder-conduit',
  'thunder-seal',
  'blood-pact',
  'blood-calm',
  'frost-edge',
  'frost-ward',
];

export const TRIBULATION_CHOICES: Record<TribulationChoiceId, TribulationChoiceDefinition> = {
  'thunder-conduit': {
    id: 'thunder-conduit', tribulation: 'thunder', name: '引雷入体', symbol: '雷',
    benefit: '所有伤害 +30%', pressure: '敌方弹幕速度 +25%',
    modifiers: { ...NEUTRAL_MODIFIERS, playerDamage: 1.3, enemyProjectileSpeed: 1.25 },
  },
  'thunder-seal': {
    id: 'thunder-seal', tribulation: 'thunder', name: '镇雷符', symbol: '符',
    benefit: '所有伤害 +10%', pressure: '敌方弹幕速度 -20%',
    modifiers: { ...NEUTRAL_MODIFIERS, playerDamage: 1.1, enemyProjectileSpeed: 0.8 },
  },
  'blood-pact': {
    id: 'blood-pact', tribulation: 'blood-moon', name: '饮月血契', symbol: '血',
    benefit: '获取经验 +35%', pressure: '敌人伤害 +25%',
    modifiers: { ...NEUTRAL_MODIFIERS, experience: 1.35, enemyDamage: 1.25 },
  },
  'blood-calm': {
    id: 'blood-calm', tribulation: 'blood-moon', name: '清心月印', symbol: '月',
    benefit: '所有伤害 +10%', pressure: '敌人移动速度 -15%',
    modifiers: { ...NEUTRAL_MODIFIERS, playerDamage: 1.1, enemySpeed: 0.85 },
  },
  'frost-edge': {
    id: 'frost-edge', tribulation: 'frost', name: '碎霜剑意', symbol: '霜',
    benefit: '所有伤害 +28%', pressure: '玩家移动速度 -12%',
    modifiers: { ...NEUTRAL_MODIFIERS, playerDamage: 1.28, playerSpeed: 0.88 },
  },
  'frost-ward': {
    id: 'frost-ward', tribulation: 'frost', name: '护霜灵符', symbol: '印',
    benefit: '所有伤害 +10%', pressure: '敌人移动速度 -20%',
    modifiers: { ...NEUTRAL_MODIFIERS, playerDamage: 1.1, enemySpeed: 0.8 },
  },
};

export function getTribulationChoices(tribulation: TribulationType): TribulationChoiceId[] {
  return TRIBULATION_CHOICE_IDS.filter((id) => TRIBULATION_CHOICES[id].tribulation === tribulation);
}

export function getTribulationChoiceModifiers(
  choice: TribulationChoiceId | null,
): TribulationChoiceModifiers {
  return choice ? TRIBULATION_CHOICES[choice].modifiers : NEUTRAL_MODIFIERS;
}
