import { describe, expect, it } from 'vitest';
import gameSceneSource from '../../src/scenes/GameScene.ts?raw';
import effectRendererSource from '../../src/render/EffectRenderer.ts?raw';

describe('generated combat replacement layers', () => {
  it('does not stack legacy drawings under generated combat sprites', () => {
    expect(gameSceneSource).not.toContain('drawEnemyProjectile');
    expect(gameSceneSource).not.toContain('drawProjectile');
    expect(gameSceneSource).not.toContain('drawThunderAura');
    expect(gameSceneSource).not.toContain('drawOrbitingBlades');
    expect(gameSceneSource).not.toContain('drawAwakenedSkillGlyphs');
    expect(gameSceneSource).not.toContain('drawActiveBarrier');
    expect(gameSceneSource).not.toContain('drawBossHazard');
  });

  it('does not stack procedural event art under generated decals', () => {
    expect(effectRendererSource).toContain('if (effect.decal) return;');
  });
});
