import { describe, expect, it } from 'vitest';
import html from '../index.html?raw';

describe('game entry page', () => {
  it('shows a local launch fallback when opened from the file protocol', () => {
    expect(html).toContain("location.protocol === 'file:'");
    expect(html).toContain('start-game.cmd');
    expect(html).toContain('http://127.0.0.1:5173/');
  });
});
