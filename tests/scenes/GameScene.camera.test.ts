import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({
  default: {
    Scene: class {},
    Math: {
      Clamp: (value: number, min: number, max: number) => Math.min(max, Math.max(min, value)),
      Distance: { Between: (x1: number, y1: number, x2: number, y2: number) => Math.hypot(x2 - x1, y2 - y1) },
    },
  },
}));

import { GameScene } from '../../src/scenes/GameScene';

describe('GameScene co-op camera', () => {
  it('zooms out far enough to keep widely separated players inside the viewport', () => {
    const setZoom = vi.fn();
    const centerOn = vi.fn();
    const scene = {
      simulation: {
        state: {
          player: { x: 300, y: 700 },
          partner: { x: 3300, y: 700 },
        },
      },
      cameras: { main: { width: 1280, height: 720, setZoom, centerOn } },
    };

    (GameScene.prototype as any).centerCoopCamera.call(scene);

    expect(setZoom).toHaveBeenCalledWith(expect.any(Number));
    expect(setZoom.mock.calls[0][0]).toBeLessThanOrEqual(0.41);
    expect(centerOn).toHaveBeenCalledWith(1800, 700);
  });
});
