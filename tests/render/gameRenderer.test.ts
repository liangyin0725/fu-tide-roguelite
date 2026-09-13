import { describe, expect, it } from 'vitest';
import { GAME_RENDERER } from '../../src/gameConfig';

describe('game renderer', () => {
  it('uses the Canvas renderer for reliable pixel-art output', () => {
    expect(GAME_RENDERER).toBe(1);
  });
});
