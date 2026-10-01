import type { SkillId } from '../sim/skillPaths';

export const SKILL_PATH_VISUALS = {
  'thunder-ring': { texture: 'generated-persistent-thunder-ring', color: 0x61f5ff },
  'chain-lightning': { texture: 'generated-vfx-lightning', color: 0x8cffec },
  'fire-burst': { texture: 'generated-vfx-fire', color: 0xff7448 },
  'golden-shield': { texture: 'generated-persistent-golden-shield', color: 0xffdf78 },
  'frost-seal': { texture: 'generated-vfx-frost', color: 0xa9eaff },
  'orbiting-blades': { texture: 'generated-vfx-sword', color: 0xc1ffe5 },
  'meteor-seal': { texture: 'generated-vfx-fire', color: 0xffbe52 },
  'north-star': { texture: 'generated-vfx-lightning', color: 0xa6baff },
  'bullet-reprisal': { texture: 'generated-vfx-sword', color: 0xf3bfff },
  'soul-pin': { texture: 'generated-vfx-frost', color: 0xff8bb9 },
  'solar-ray': { texture: 'generated-vfx-sword', color: 0xfff3a2 },
  'void-bell': { texture: 'generated-persistent-thunder-ring', color: 0xc6a4ff },
  'spirit-sword-rain': { texture: 'generated-vfx-sword', color: 0xccfaff },
  'storm-net': { texture: 'generated-vfx-lightning', color: 0x82ffce },
  'mirror-sigil': { texture: 'generated-persistent-golden-shield', color: 0xf5b4ff },
  'frost-domain': { texture: 'generated-vfx-frost', color: 0x87d6ff },
  'rift-return': { texture: 'generated-vfx-sword', color: 0xbf9aff },
  'star-pull': { texture: 'generated-persistent-thunder-ring', color: 0xffa0d6 },
} as const satisfies Record<SkillId, { texture: string; color: number }>;
