import type { CombatEvent } from '../sim/types';

export class GameAudio {
  private readonly context: AudioContext | null;
  private readonly musicNode: GainNode | null;
  private readonly soundNode: GainNode | null;
  private musicTimer: ReturnType<typeof setInterval> | null = null;
  private musicStarted = false;
  private musicVolume = 0;
  private musicNoteIndex = 0;

  public constructor(context: AudioContext | null = createAudioContext()) {
    this.context = context;
    this.musicNode = this.context?.createGain() ?? null;
    this.soundNode = this.context?.createGain() ?? null;
    this.musicNode?.connect(this.context!.destination);
    this.soundNode?.connect(this.context!.destination);
  }

  public setVolumes(music: number, sound: number): void {
    if (!this.context) return;
    this.musicVolume = clamp(music);
    this.musicNode!.gain.setValueAtTime(this.musicVolume * 0.12, this.context.currentTime);
    this.soundNode!.gain.setValueAtTime(clamp(sound) * 0.22, this.context.currentTime);
    if (this.musicVolume === 0) {
      this.stopMusicTimer();
    } else if (this.musicStarted && this.musicTimer === null) {
      this.scheduleMusic();
    }
  }

  public startMusic(): void {
    if (!this.context || this.musicStarted) return;
    this.musicStarted = true;
    void this.context.resume();
    if (this.musicVolume > 0) this.scheduleMusic();
  }

  public playEvents(events: CombatEvent[]): void {
    if (!this.context || events.length === 0) return;
    void this.context.resume();
    for (const event of events.slice(0, 8)) {
      const tone = toneForEvent(event);
      if (!tone) continue;
      const oscillator = this.context.createOscillator();
      const gain = this.context.createGain();
      oscillator.type = tone.type;
      oscillator.frequency.setValueAtTime(tone.frequency, this.context.currentTime);
      gain.gain.setValueAtTime(tone.gain, this.context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.context.currentTime + tone.duration);
      oscillator.connect(gain);
      gain.connect(this.soundNode!);
      oscillator.start();
      oscillator.stop(this.context.currentTime + tone.duration);
    }
  }

  public dispose(): void {
    this.stopMusicTimer();
    this.musicStarted = false;
    void this.context?.close();
  }

  private scheduleMusic(): void {
    this.playMusicNote();
    this.musicTimer = setInterval(() => this.playMusicNote(), 6500);
  }

  private stopMusicTimer(): void {
    if (this.musicTimer !== null) clearInterval(this.musicTimer);
    this.musicTimer = null;
  }

  private playMusicNote(): void {
    if (!this.context || this.musicVolume === 0) return;
    const notes = [220, 293.66, 329.63, 440];
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(notes[this.musicNoteIndex % notes.length], this.context.currentTime);
    this.musicNoteIndex += 1;
    gain.gain.setValueAtTime(0.08, this.context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, this.context.currentTime + 0.9);
    oscillator.connect(gain);
    gain.connect(this.musicNode!);
    oscillator.start();
    oscillator.stop(this.context.currentTime + 0.9);
  }
}

interface Tone {
  frequency: number;
  duration: number;
  gain: number;
  type: OscillatorType;
}

function toneForEvent(event: CombatEvent): Tone | null {
  if (event.type === 'enemy-bullet-broken') return { frequency: 740, duration: 0.08, gain: 0.4, type: 'triangle' };
  if (event.type === 'projectile-hit') return { frequency: 240, duration: 0.09, gain: 0.3, type: 'square' };
  if (event.type === 'active-skill-cast') return { frequency: 520, duration: 0.35, gain: 0.45, type: 'sine' };
  if (event.type === 'level-up' || event.type === 'skill-awakened' || event.type === 'active-skill-leveled') return { frequency: 660, duration: 0.45, gain: 0.4, type: 'triangle' };
  if (event.type === 'boss-spawned') return { frequency: 62, duration: 1.05, gain: 0.72, type: 'sawtooth' };
  if (event.type === 'boss-cast-started') return { frequency: 98, duration: 0.48, gain: 0.52, type: 'triangle' };
  if (event.type === 'boss-skill-activated') return { frequency: 72, duration: 0.34, gain: 0.64, type: 'sawtooth' };
  if (event.type === 'boss-phase-changed') return { frequency: 54, duration: 0.9, gain: 0.72, type: 'sawtooth' };
  if (event.type === 'boss-objective-spawned') return { frequency: 128, duration: 0.54, gain: 0.52, type: 'triangle' };
  if (event.type === 'boss-objective-resolved') return event.success
    ? { frequency: 720, duration: 0.45, gain: 0.48, type: 'sine' }
    : { frequency: 68, duration: 0.62, gain: 0.66, type: 'sawtooth' };
  if (event.type === 'player-damaged') return { frequency: 120, duration: 0.16, gain: 0.5, type: 'square' };
  if (event.type === 'player-healed') return { frequency: 680, duration: 0.12, gain: 0.24, type: 'sine' };
  if (event.type === 'siege-pressure') return { frequency: 82, duration: 0.2, gain: 0.34, type: 'triangle' };
  if (event.type === 'glyph-volley') return event.ritual === 'bolt'
    ? { frequency: 560, duration: 0.08, gain: 0.16, type: 'triangle' }
    : { frequency: 420, duration: 0.16, gain: 0.25, type: 'sine' };
  if (event.type === 'boss-reward-burst') return { frequency: 880, duration: 0.5, gain: 0.35, type: 'sine' };
  if (event.type === 'synergy-triggered') return { frequency: 760, duration: 0.22, gain: 0.32, type: 'triangle' };
  if (event.type === 'elite-squad-spawned') return { frequency: 150, duration: 0.42, gain: 0.38, type: 'sawtooth' };
  if (event.type === 'tribulation-changed') return { frequency: 240, duration: 0.7, gain: 0.42, type: 'triangle' };
  if (event.type === 'tribulation-choice-offered') return { frequency: 330, duration: 0.34, gain: 0.32, type: 'triangle' };
  if (event.type === 'tribulation-choice-selected') return { frequency: 610, duration: 0.26, gain: 0.28, type: 'sine' };
  return null;
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function createAudioContext(): AudioContext | null {
  if (typeof window === 'undefined' || !window.AudioContext) return null;
  return new window.AudioContext();
}
