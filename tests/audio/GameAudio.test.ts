// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { GameAudio } from '../../src/audio/GameAudio';

describe('GameAudio background music', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('uses short scheduled notes instead of never-ending oscillators', () => {
    vi.useFakeTimers();
    const context = new FakeAudioContext();
    const audio = new GameAudio(context as unknown as AudioContext);
    audio.setVolumes(0.7, 0.8);

    audio.startMusic();

    expect(context.oscillators).toHaveLength(1);
    expect(context.oscillators[0].started).toBe(true);
    expect(context.oscillators[0].stopAt).toBeGreaterThan(context.currentTime);
    audio.dispose();
  });

  it('stops scheduling music notes when music volume reaches zero', () => {
    vi.useFakeTimers();
    const context = new FakeAudioContext();
    const audio = new GameAudio(context as unknown as AudioContext);
    audio.setVolumes(0.7, 0.8);
    audio.startMusic();
    audio.setVolumes(0, 0.8);

    vi.advanceTimersByTime(20_000);

    expect(context.oscillators).toHaveLength(1);
    audio.dispose();
  });
});

class FakeAudioContext {
  public currentTime = 1;
  public destination = {};
  public oscillators: FakeOscillator[] = [];

  public createGain() {
    return {
      gain: {
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
    };
  }

  public createOscillator(): FakeOscillator {
    const oscillator = new FakeOscillator();
    this.oscillators.push(oscillator);
    return oscillator;
  }

  public resume(): Promise<void> { return Promise.resolve(); }
  public close(): Promise<void> { return Promise.resolve(); }
}

class FakeOscillator {
  public type: OscillatorType = 'sine';
  public frequency = { value: 0, setValueAtTime: vi.fn() };
  public started = false;
  public stopAt = 0;
  public connect = vi.fn();

  public start(): void { this.started = true; }
  public stop(at = 0): void { this.stopAt = at; }
}
