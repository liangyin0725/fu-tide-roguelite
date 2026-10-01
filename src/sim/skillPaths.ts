import type { Player } from './types';
import { SKILL_IDS } from './upgradeCatalog';

export type SkillId = (typeof SKILL_IDS)[number];
export type SkillPathKey = 'a' | 'b';
export type SkillPathMap = Partial<Record<SkillId, SkillPathKey>>;

export interface SkillPathDefinition {
  skill: SkillId;
  key: SkillPathKey;
  nameZh: string;
  nameEn: string;
  coreZh: string;
  coreEn: string;
  level4Zh: string;
  level4En: string;
  level5Zh: string;
  level5En: string;
  awakeningNameZh: string;
  awakeningNameEn: string;
}

type SkillPathCopy = Omit<SkillPathDefinition, 'skill' | 'key'>;

function route(skill: SkillId, key: SkillPathKey, copy: SkillPathCopy): SkillPathDefinition {
  return { skill, key, ...copy };
}

export const SKILL_PATHS = {
  'thunder-ring': {
    a: route('thunder-ring', 'a', {
      nameZh: '近身雷狱', nameEn: 'Close Thunder Prison',
      coreZh: '雷环周期震退普通敌人', coreEn: 'The ring periodically knocks back normal enemies.',
      level4Zh: '震退间隔缩短', level4En: 'Knockback pulses occur more often.',
      level5Zh: '震退范围扩大', level5En: 'Knockback pulse radius increases.',
      awakeningNameZh: '雷狱断法', awakeningNameEn: 'Spellbreaking Thunder Prison',
    }),
    b: route('thunder-ring', 'b', {
      nameZh: '游雷法域', nameEn: 'Wandering Thunder Field',
      coreZh: '周期释放向外扩张的移动雷环', coreEn: 'Periodically releases an expanding traveling ring.',
      level4Zh: '移动雷环扩张更远', level4En: 'Traveling rings expand farther.',
      level5Zh: '每轮追加一道雷环', level5En: 'Each cycle adds another traveling ring.',
      awakeningNameZh: '往返游雷', awakeningNameEn: 'Returning Wandering Thunder',
    }),
  },
  'chain-lightning': {
    a: route('chain-lightning', 'a', {
      nameZh: '天雷分枝', nameEn: 'Forking Sky Thunder',
      coreZh: '雷链优先寻找未命中过的目标', coreEn: 'Lightning prioritizes targets not yet struck.',
      level4Zh: '每次连锁增加一处分枝', level4En: 'Each chain gains one extra fork.',
      level5Zh: '分枝可继续传导一次', level5En: 'Forks may conduct one additional time.',
      awakeningNameZh: '万雷开枝', awakeningNameEn: 'Myriad Thunder Branches',
    }),
    b: route('chain-lightning', 'b', {
      nameZh: '雷核回灌', nameEn: 'Thunder Core Return',
      coreZh: '雷链回到首个目标形成闭环', coreEn: 'The chain returns to its first target to close the circuit.',
      level4Zh: '闭环优先锁定精英', level4En: 'The return arc prioritizes elites.',
      level5Zh: '闭环命中后短暂蓄能', level5En: 'Closing the loop briefly charges the next cast.',
      awakeningNameZh: '九转雷核', awakeningNameEn: 'Ninefold Thunder Core',
    }),
  },
  'fire-burst': {
    a: route('fire-burst', 'a', {
      nameZh: '连环爆燃', nameEn: 'Chain Detonation',
      coreZh: '首次爆炸后产生较小二次爆炸', coreEn: 'The first blast triggers a smaller second detonation.',
      level4Zh: '二次爆炸延迟缩短', level4En: 'The secondary blast triggers sooner.',
      level5Zh: '二次爆炸可引燃击杀目标', level5En: 'Secondary blasts can ignite defeated targets.',
      awakeningNameZh: '无尽爆燃', awakeningNameEn: 'Endless Detonation',
    }),
    b: route('fire-burst', 'b', {
      nameZh: '留火余烬', nameEn: 'Lingering Ember',
      coreZh: '爆炸留下短时燃烧区域', coreEn: 'Explosions leave a short-lived burning field.',
      level4Zh: '燃烧区域持续更久', level4En: 'Burning fields last longer.',
      level5Zh: '新爆炎刷新重叠余烬', level5En: 'New bursts refresh overlapping embers.',
      awakeningNameZh: '不熄劫火', awakeningNameEn: 'Undying Calamity Flame',
    }),
  },
  'golden-shield': {
    a: route('golden-shield', 'a', {
      nameZh: '琉璃折光', nameEn: 'Glazed Refraction',
      coreZh: '护盾周期拦截弹幕并射出金光碎片', coreEn: 'The shield periodically intercepts a projectile and fires a golden shard.',
      level4Zh: '拦截恢复更快', level4En: 'Projectile interception recovers faster.',
      level5Zh: '金光碎片获得穿透', level5En: 'Golden shards gain piercing.',
      awakeningNameZh: '万镜琉璃身', awakeningNameEn: 'Myriad-Mirror Golden Body',
    }),
    b: route('golden-shield', 'b', {
      nameZh: '金身反震', nameEn: 'Golden Retaliation',
      coreZh: '承受伤害积累破盾反震', coreEn: 'Damage taken charges a retaliatory shield-break blast.',
      level4Zh: '反震蓄积上限提高', level4En: 'Retaliation charge cap increases.',
      level5Zh: '反震附带强力击退', level5En: 'Retaliation gains heavy knockback.',
      awakeningNameZh: '不坏震岳身', awakeningNameEn: 'Mountain-Shaking Adamant Body',
    }),
  },
  'frost-seal': {
    a: route('frost-seal', 'a', {
      nameZh: '寒髓封脉', nameEn: 'Marrow-Frost Seal',
      coreZh: '重复命中叠加寒髓并冻结普通敌人', coreEn: 'Repeated hits stack marrow frost and freeze normal enemies.',
      level4Zh: '叠层所需命中减少', level4En: 'Fewer hits are needed to complete a stack.',
      level5Zh: '冻结后短暂增伤', level5En: 'Frozen targets briefly take increased damage.',
      awakeningNameZh: '万脉凝绝', awakeningNameEn: 'Ten-Thousand Veins Stilled',
    }),
    b: route('frost-seal', 'b', {
      nameZh: '霜痕蔓延', nameEn: 'Creeping Frostmark',
      coreZh: '带霜痕敌人死亡时传播减速与冰伤', coreEn: 'Frostmarked enemies spread slow and frost damage on death.',
      level4Zh: '霜痕传播距离扩大', level4En: 'Frostmarks spread farther.',
      level5Zh: '传播可额外跳转一次', level5En: 'The spread can jump one additional time.',
      awakeningNameZh: '霜疫千里', awakeningNameEn: 'Thousand-League Frostblight',
    }),
  },
  'orbiting-blades': {
    a: route('orbiting-blades', 'a', {
      nameZh: '护主剑阵', nameEn: 'Guardian Blade Array',
      coreZh: '剑轮优先切碎靠近角色的弹幕', coreEn: 'Orbiting blades prioritize projectiles near the player.',
      level4Zh: '弹幕切割判定扩大', level4En: 'Projectile-cutting range increases.',
      level5Zh: '成功格挡后加速旋转', level5En: 'A successful block briefly accelerates the array.',
      awakeningNameZh: '无漏护主阵', awakeningNameEn: 'Flawless Guardian Array',
    }),
    b: route('orbiting-blades', 'b', {
      nameZh: '逐影飞轮', nameEn: 'Shadow-Chasing Blades',
      coreZh: '部分剑轮脱离角色追击精英后返回', coreEn: 'Some blades leave orbit to pursue elites before returning.',
      level4Zh: '追击距离增加', level4En: 'Pursuit range increases.',
      level5Zh: '飞轮返回时再次切割', level5En: 'Returning blades strike a second time.',
      awakeningNameZh: '万里逐影', awakeningNameEn: 'Ten-Thousand-League Pursuit',
    }),
  },
  'meteor-seal': {
    a: route('meteor-seal', 'a', {
      nameZh: '群星坠火', nameEn: 'Falling Starfire',
      coreZh: '每次施放分裂为一主两副陨火', coreEn: 'Each cast splits into one major and two minor meteors.',
      level4Zh: '副陨火散布范围扩大', level4En: 'Minor meteors spread across a wider area.',
      level5Zh: '副陨火优先覆盖新目标', level5En: 'Minor meteors prioritize fresh targets.',
      awakeningNameZh: '诸天星陨', awakeningNameEn: 'Heavensfall Starstorm',
    }),
    b: route('meteor-seal', 'b', {
      nameZh: '熔地天坑', nameEn: 'Molten Crater',
      coreZh: '主陨火留下持续灼烧并减速的熔岩坑', coreEn: 'The main meteor leaves a burning, slowing crater.',
      level4Zh: '熔岩坑持续更久', level4En: 'The crater lasts longer.',
      level5Zh: '重叠熔岩坑会迸发', level5En: 'Overlapping craters erupt.',
      awakeningNameZh: '地脉熔劫', awakeningNameEn: 'Leyline Molten Calamity',
    }),
  },
  'north-star': {
    a: route('north-star', 'a', {
      nameZh: '周天星阵', nameEn: 'Celestial Star Array',
      coreZh: '星芒绕身一周后射出', coreEn: 'Stars orbit the player once before firing.',
      level4Zh: '绕行时可撞击近敌', level4En: 'Orbiting stars can strike nearby enemies.',
      level5Zh: '绕行完成后齐射加速', level5En: 'The completed volley launches faster.',
      awakeningNameZh: '周天列宿', awakeningNameEn: 'Celestial Constellation',
    }),
    b: route('north-star', 'b', {
      nameZh: '追命星矢', nameEn: 'Fate-Seeking Starbolts',
      coreZh: '星芒轻度追踪远程与精英敌人', coreEn: 'Stars lightly home toward ranged and elite enemies.',
      level4Zh: '追踪转向增强', level4En: 'Homing turn strength increases.',
      level5Zh: '击杀后转向新目标', level5En: 'Kills redirect the star toward a new target.',
      awakeningNameZh: '命星不坠', awakeningNameEn: 'Unfailing Fate Star',
    }),
  },
  'bullet-reprisal': {
    a: route('bullet-reprisal', 'a', {
      nameZh: '玄镜反照', nameEn: 'Mystic Mirror Reversal',
      coreZh: '击碎弹幕后向来袭方向反射剑光', coreEn: 'Breaking a projectile reflects a blade ray toward its source.',
      level4Zh: '反射剑光获得穿透', level4En: 'Reflected blade rays gain piercing.',
      level5Zh: '连续反射扩大剑光', level5En: 'Successive reflections widen the blade ray.',
      awakeningNameZh: '万法返照', awakeningNameEn: 'Reflection of Myriad Arts',
    }),
    b: route('bullet-reprisal', 'b', {
      nameZh: '纳炁归元', nameEn: 'Qi Reversion',
      coreZh: '击碎弹幕积累炁层并释放净空震击', coreEn: 'Breaking projectiles stores qi and releases a clearing pulse.',
      level4Zh: '所需炁层减少', level4En: 'The clearing pulse requires fewer qi stacks.',
      level5Zh: '净空震击附带伤害', level5En: 'The clearing pulse also deals damage.',
      awakeningNameZh: '一炁归墟', awakeningNameEn: 'One Qi Returns to the Void',
    }),
  },
  'soul-pin': {
    a: route('soul-pin', 'a', {
      nameZh: '镇岳魂钉', nameEn: 'Mountain-Sealing Soul Pin',
      coreZh: '钉住目标并减速其附近敌人', coreEn: 'Pins a target and slows nearby enemies.',
      level4Zh: '减速区域扩大', level4En: 'The slowing area expands.',
      level5Zh: '钉住精英时区域增强', level5En: 'Pinning an elite empowers the area.',
      awakeningNameZh: '镇岳封魂', awakeningNameEn: 'Mountain Soul Seal',
    }),
    b: route('soul-pin', 'b', {
      nameZh: '连魂锁链', nameEn: 'Soulbinding Chain',
      coreZh: '在两名敌人间形成伤害锁链', coreEn: 'Forms a damaging chain between two enemies.',
      level4Zh: '锁链最大距离增加', level4En: 'Maximum chain distance increases.',
      level5Zh: '锁链可串联第三目标', level5En: 'The chain can bind a third target.',
      awakeningNameZh: '万魂同契', awakeningNameEn: 'Covenant of Ten Thousand Souls',
    }),
  },
  'solar-ray': {
    a: route('solar-ray', 'a', {
      nameZh: '大日横扫', nameEn: 'Great Sun Sweep',
      coreZh: '剑光缓慢扫过扇区并持续命中', coreEn: 'The ray slowly sweeps an arc and hits continuously.',
      level4Zh: '横扫角度扩大', level4En: 'The sweep angle widens.',
      level5Zh: '中心光束可重复命中', level5En: 'The central beam can hit repeatedly.',
      awakeningNameZh: '大日巡天', awakeningNameEn: 'Great Sun Patrols Heaven',
    }),
    b: route('solar-ray', 'b', {
      nameZh: '棱镜折射', nameEn: 'Prismatic Refraction',
      coreZh: '命中精英或劫主后折射至邻近目标', coreEn: 'Hitting an elite or boss refracts toward nearby targets.',
      level4Zh: '折射目标增加', level4En: 'Refraction gains another target.',
      level5Zh: '折射光可再次折射', level5En: 'Refracted rays may refract once more.',
      awakeningNameZh: '十方日轮', awakeningNameEn: 'Ten-Direction Sunwheel',
    }),
  },
  'void-bell': {
    a: route('void-bell', 'a', {
      nameZh: '寂灭外震', nameEn: 'Extinction Wave',
      coreZh: '震波向外扩张并清除近身弹幕', coreEn: 'An expanding wave pushes enemies and clears nearby projectiles.',
      level4Zh: '外震扩张速度提高', level4En: 'The wave expands faster.',
      level5Zh: '清弹后追加震伤', level5En: 'Cleared projectiles add shock damage.',
      awakeningNameZh: '寂灭洪钟', awakeningNameEn: 'Bell of Final Silence',
    }),
    b: route('void-bell', 'b', {
      nameZh: '归墟内塌', nameEn: 'Void Collapse',
      coreZh: '标记外圈后向中心收缩并牵引敌人', coreEn: 'Marks an outer ring, then collapses inward and pulls enemies.',
      level4Zh: '内塌牵引增强', level4En: 'The inward pull strengthens.',
      level5Zh: '阵心产生二次钟鸣', level5En: 'The center releases a second bell strike.',
      awakeningNameZh: '诸界归墟', awakeningNameEn: 'All Realms Return to Void',
    }),
  },
  'spirit-sword-rain': {
    a: route('spirit-sword-rain', 'a', {
      nameZh: '诛首剑雨', nameEn: 'Headsman Sword Rain',
      coreZh: '剑雨集中追踪生命最高的精英或劫主', coreEn: 'The rain focuses the highest-health elite or boss.',
      level4Zh: '集火剑获得穿透', level4En: 'Focused swords gain piercing.',
      level5Zh: '目标死亡后余剑转移', level5En: 'Remaining swords retarget after a kill.',
      awakeningNameZh: '天诛万剑', awakeningNameEn: 'Heavenly Execution Blades',
    }),
    b: route('spirit-sword-rain', 'b', {
      nameZh: '流云剑幕', nameEn: 'Flowing Cloud Swordwall',
      coreZh: '生成横向移动的剑幕切割敌群', coreEn: 'Creates a moving horizontal swordwall that cuts through groups.',
      level4Zh: '剑幕宽度增加', level4En: 'The swordwall becomes wider.',
      level5Zh: '剑幕末端折返一次', level5En: 'The swordwall reverses once at its endpoint.',
      awakeningNameZh: '云海无尽幕', awakeningNameEn: 'Endless Sea of Swords',
    }),
  },
  'storm-net': {
    a: route('storm-net', 'a', {
      nameZh: '镇域雷阵', nameEn: 'Domain-Sealing Storm Array',
      coreZh: '固定雷网持续束缚进入区域的普通敌人', coreEn: 'A fixed storm net repeatedly binds normal enemies entering it.',
      level4Zh: '雷阵持续时间增加', level4En: 'The array lasts longer.',
      level5Zh: '束缚可打断远程蓄力', level5En: 'Binding interrupts ranged windups.',
      awakeningNameZh: '九天镇域阵', awakeningNameEn: 'Nine-Heaven Domain Seal',
    }),
    b: route('storm-net', 'b', {
      nameZh: '巡天雷云', nameEn: 'Patrolling Stormcloud',
      coreZh: '雷云追随敌群并留下导电标记', coreEn: 'A stormcloud follows enemy groups and leaves conductive marks.',
      level4Zh: '雷云移动更快', level4En: 'The stormcloud moves faster.',
      level5Zh: '导电目标会互相传雷', level5En: 'Conductive targets arc lightning to each other.',
      awakeningNameZh: '巡天万雷云', awakeningNameEn: 'Heaven-Patrolling Thundercloud',
    }),
  },
  'mirror-sigil': {
    a: route('mirror-sigil', 'a', {
      nameZh: '返照法镜', nameEn: 'Reversing Dharma Mirror',
      coreZh: '拦截弹幕后沿原方向发射强化反击', coreEn: 'Intercepted projectiles fire an empowered counter along their origin line.',
      level4Zh: '反击射程增加', level4En: 'Counter range increases.',
      level5Zh: '反击可击碎沿途弹幕', level5En: 'Counters shatter projectiles along their path.',
      awakeningNameZh: '诸法返照镜', awakeningNameEn: 'Mirror of Returning Arts',
    }),
    b: route('mirror-sigil', 'b', {
      nameZh: '镜影分身', nameEn: 'Mirror Doppelganger',
      coreZh: '累计拦截后生成镜影复制下一次飞剑齐射', coreEn: 'Accumulated blocks create a mirror image that copies the next sword volley.',
      level4Zh: '生成镜影所需拦截减少', level4En: 'Fewer blocks are needed to create a mirror image.',
      level5Zh: '镜影齐射获得额外飞剑', level5En: 'The copied volley gains extra swords.',
      awakeningNameZh: '万象镜身', awakeningNameEn: 'Mirror Body of Myriad Forms',
    }),
  },
  'frost-domain': {
    a: route('frost-domain', 'a', {
      nameZh: '永冻核心', nameEn: 'Permafrost Core',
      coreZh: '领域中心更快积累冻结值', coreEn: 'Enemies near the center accumulate freeze much faster.',
      level4Zh: '核心范围扩大', level4En: 'The core area expands.',
      level5Zh: '冻结敌人产生冰爆', level5En: 'Frozen enemies release an ice burst.',
      awakeningNameZh: '永冻劫心', awakeningNameEn: 'Heart of Eternal Frost',
    }),
    b: route('frost-domain', 'b', {
      nameZh: '冰镜领域', nameEn: 'Ice Mirror Domain',
      coreZh: '领域周期冻结敌方弹幕', coreEn: 'The domain periodically freezes enemy projectiles.',
      level4Zh: '弹幕冻结时间增加', level4En: 'Projectiles remain frozen longer.',
      level5Zh: '解冻弹幕化为冰晶碎片', level5En: 'Thawing projectiles become ice shards.',
      awakeningNameZh: '镜雪万界', awakeningNameEn: 'Mirror Snow of Ten Thousand Realms',
    }),
  },
  'rift-return': {
    a: route('rift-return', 'a', {
      nameZh: '双界回刃', nameEn: 'Twin-Realm Return',
      coreZh: '回程产生平行裂隙残影形成双轨切割', coreEn: 'The return leaves a parallel rift echo for twin-track cuts.',
      level4Zh: '裂隙间距增加', level4En: 'The distance between rift tracks increases.',
      level5Zh: '残影延迟后再次切割', level5En: 'The rift echo cuts again after a delay.',
      awakeningNameZh: '双界同断', awakeningNameEn: 'Twin Realms Severed',
    }),
    b: route('rift-return', 'b', {
      nameZh: '虚空门扉', nameEn: 'Void Gateway',
      coreZh: '去程终点留下门扉并再次射出回刃', coreEn: 'The outbound endpoint leaves a gate that fires the returning blade again.',
      level4Zh: '门扉持续时间增加', level4En: 'The gateway lasts longer.',
      level5Zh: '门扉可储存两次回刃', level5En: 'The gateway can store two return blades.',
      awakeningNameZh: '万界门开', awakeningNameEn: 'Gate of Ten Thousand Realms',
    }),
  },
  'star-pull': {
    a: route('star-pull', 'a', {
      nameZh: '坠渊奇点', nameEn: 'Abyssal Singularity',
      coreZh: '结束时按聚集敌人数增强爆发', coreEn: 'The ending burst scales with the number of gathered enemies.',
      level4Zh: '牵引力随时间增强', level4En: 'Pull strength increases over time.',
      level5Zh: '爆发可短暂眩晕普通敌人', level5En: 'The burst briefly stuns normal enemies.',
      awakeningNameZh: '群星坠渊', awakeningNameEn: 'Stars Fall into the Abyss',
    }),
    b: route('star-pull', 'b', {
      nameZh: '周天星卫', nameEn: 'Celestial Starward',
      coreZh: '法阵结束后生成短时环绕星体', coreEn: 'The array ends by creating short-lived orbiting stars.',
      level4Zh: '环绕星体增加', level4En: 'Creates more orbiting stars.',
      level5Zh: '星体撞击后可转向新目标', level5En: 'Stars can retarget after impact.',
      awakeningNameZh: '周天星神卫', awakeningNameEn: 'Celestial Star Guardian',
    }),
  },
} as const satisfies Record<SkillId, Record<SkillPathKey, SkillPathDefinition>>;

export function getSkillPathDefinition(skill: SkillId, key: SkillPathKey): SkillPathDefinition {
  return SKILL_PATHS[skill][key];
}

export function hasSkillPath(player: Player, skill: SkillId, key?: SkillPathKey): boolean {
  const selected = player.skillPaths[skill];
  return (selected === 'a' || selected === 'b') && (key === undefined || selected === key);
}

export function needsSkillPath(player: Player, skill: SkillId): boolean {
  return player.upgradeLevels[skill] >= 3 && !hasSkillPath(player, skill);
}

export function clearSkillPath(player: Player, skill: SkillId): void {
  delete player.skillPaths[skill];
}
