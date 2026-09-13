import type { DamageSource, Enemy, GameState, RunStats } from './types';
import { getTribulationChoiceModifiers } from './tribulationChoices';

const SOURCES: DamageSource[] = [
  'flying-sword', 'thunder', 'chain', 'fire', 'orbit', 'meteor', 'north-star',
  'reprisal', 'soul', 'active', 'solar-ray', 'void-bell', 'sword-rain', 'glyph',
];

export const DAMAGE_SOURCE_NAMES: Record<DamageSource, string> = {
  'flying-sword': '飞剑', thunder: '雷环', chain: '连锁雷法', fire: '爆炎', orbit: '绕身剑轮',
  meteor: '天火陨印', 'north-star': '北斗星芒', reprisal: '破魔反击', soul: '钉魂斩劫',
  active: '主动技能', 'solar-ray': '日轮剑光', 'void-bell': '太虚钟', 'sword-rain': '灵泉剑瀑', glyph: '觉醒符咒',
};

export function createEmptyRunStats(): RunStats {
  return {
    damageBySource: Object.fromEntries(SOURCES.map((source) => [source, 0])) as Record<DamageSource, number>,
    bulletsBlocked: 0,
    elitesDefeated: 0,
    objectivesCompleted: 0,
  };
}

export function dealPlayerDamage(state: GameState, enemy: Enemy, damage: number, source: DamageSource): number {
  const bossMultiplier = enemy.kind === 'boss' ? state.player.bossDamageMultiplier : 1;
  const protectedByIronWall = state.enemies.some((candidate) => (
    candidate.id !== enemy.id
    && candidate.hp > 0
    && candidate.eliteAffix === 'iron-wall'
    && Math.hypot(candidate.x - enemy.x, candidate.y - enemy.y) <= 190
  ));
  const eliteReduction = enemy.eliteAffix === 'iron-wall' ? 0.6 : protectedByIronWall ? 0.75 : 1;
  const choiceMultiplier = getTribulationChoiceModifiers(state.activeTribulationChoiceId).playerDamage;
  const finalDamage = damage * bossMultiplier * eliteReduction * choiceMultiplier;
  const dealt = Math.max(0, Math.min(enemy.hp, finalDamage));
  enemy.hp -= finalDamage;
  state.runStats.damageBySource[source] += dealt;
  return dealt;
}
