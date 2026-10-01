import { describe, expect, it, vi } from 'vitest';
import type Phaser from 'phaser';
import { DEFAULT_GAME_SETTINGS } from '../../src/settings/gameSettings';
import type { CombatEvent } from '../../src/sim/types';

vi.mock('phaser', () => ({ default: {
  BlendModes: { ADD: 1 },
  Math: { Easing: { Cubic: { Out: (v: number) => v }, Quadratic: { Out: (v: number) => v }, Back: { Out: (v: number) => v } } },
} }));
import { EffectRenderer } from '../../src/render/EffectRenderer';

function setup() {
  const objects: { destroyed: boolean; x: number; y: number }[] = [];
  function object() {
    const target = { destroyed: false, x: 0, y: 0 };
    const proxy: object = new Proxy(target, { get: (value, key) => {
      if (key === 'destroyed') return value.destroyed;
      if (key === 'setPosition') return (x: number, y: number) => { value.x = x; value.y = y; return proxy; };
      if (key === 'destroy') return () => { value.destroyed = true; };
      return () => proxy;
    } });
    objects.push(target);
    return proxy;
  }
  const scene = { add: { graphics: object, text: object, image: object }, textures: { exists: () => false },
    time: { now: 0 }, cameras: { main: { shake: vi.fn(), flash: vi.fn() } } };
  const settings = { ...DEFAULT_GAME_SETTINGS, effectLevel: 'low' as const };
  const renderer = new EffectRenderer(scene as unknown as Phaser.Scene, () => settings);
  return { renderer, scene, settings, objects, count: () => objects.filter(o => !o.destroyed).length };
}

describe('renderer allocation and shake policy', () => {
  it('moves reused generated field artwork with its damaging geometry', () => {
    const { renderer, scene, objects } = setup();
    scene.textures.exists = () => true;
    const event: CombatEvent = { type: 'skill-path-effect', skill: 'storm-net', path: 'b', shape: 'field',
      x: 20, y: 30, radius: 50, durationMs: 200, identityKey: 'cloud:1' };
    renderer.render([event]); renderer.update(10);
    renderer.render([{ ...event, x: 200, y: 300 }]); renderer.update(10);
    expect(objects).toHaveLength(2);
    expect(objects[1]).toMatchObject({ x: 200, y: 300 });
  });
  it('evicts ambient saturation for awakening presentation', () => {
    const { renderer, scene, count } = setup();
    for (let i = 0; i < 6; i++) renderer.render(Array.from({ length: 8 }, () => ({ type: 'projectile-hit' as const, x: 0, y: 0 })));
    expect(count()).toBe(45);
    scene.time.now = 100;
    renderer.render([{ type: 'skill-awakened', x: 0, y: 0, upgrade: 'thunder-ring' }]);
    expect(count()).toBe(45);
    expect(scene.cameras.main.shake).toHaveBeenLastCalledWith(420, 0.012);
  });
  it('keeps a persistent identity alive once and destroys it on expiry', () => {
    const { renderer, count } = setup();
    const event: CombatEvent = { type: 'skill-path-effect', skill: 'fire-burst', path: 'b', shape: 'field',
      x: 20, y: 30, radius: 50, durationMs: 200, identityKey: 'p1:fire:1' };
    for (let i = 0; i < 100; i++) { renderer.render([event]); renderer.update(10); }
    expect(count()).toBe(1);
    renderer.update(200);
    expect(count()).toBe(0);
    renderer.render([event]);
    expect(count()).toBe(1);
    renderer.render([{ ...event, durationMs: 0 }]);
    expect(count()).toBe(0);
    renderer.render([event]);
    renderer.clear();
    expect(count()).toBe(0);
  });

  it('merges only same-target ordinary damage and cleans up when switched off', () => {
    const { renderer, settings, count } = setup();
    const event: CombatEvent = { type: 'damage-dealt', targetId: 1, source: 'thunder', amount: 2, x: 0, y: 0 };
    renderer.render([event]); renderer.update(50); renderer.render([event]);
    expect(count()).toBe(2);
    renderer.render([{ ...event, burst: true }]);
    expect(count()).toBe(4);
    settings.damageNumbers = false;
    renderer.render([]);
    expect(count()).toBe(0);
  });

  it('selects strongest shake once, observes cooldown and bypasses it for boss phase', () => {
    const { renderer, scene } = setup();
    const impact: CombatEvent = { type: 'projectile-hit', x: 0, y: 0 };
    renderer.render([{ type: 'player-damaged', amount: 5, x: 0, y: 0 }, impact]);
    expect(scene.cameras.main.shake).toHaveBeenCalledExactlyOnceWith(90, 0.006);
    scene.time.now = 40;
    renderer.render([impact]);
    expect(scene.cameras.main.shake).toHaveBeenCalledTimes(1);
    renderer.render([{ type: 'boss-phase-changed', bossId: 9, bossType: 'crimson', phase: 2, x: 0, y: 0 }]);
    expect(scene.cameras.main.shake).toHaveBeenLastCalledWith(480, 0.016);
  });

  it('bounds objects over twenty minutes of saturated combat frames', () => {
    const { renderer, count } = setup();
    const impacts: CombatEvent[] = Array.from({ length: 100 }, () => ({ type: 'projectile-hit', x: 0, y: 0 }));
    for (let frame = 0; frame < 24000; frame++) {
      renderer.render(impacts);
      renderer.update(50);
      if (frame % 1000 === 0) expect(count()).toBeLessThanOrEqual(45);
    }
    renderer.clear();
    expect(count()).toBe(0);
  }, 30000);
});
