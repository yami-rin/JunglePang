import type { Preferences } from "./storage";

export class PangAudio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private voices = new Set<OscillatorNode>();
  private beat = 0;
  unavailable = false;
  constructor(private preferences: Preferences) {}

  unlock(): void {
    if (this.unavailable) return;
    try {
      if (!this.context) {
        this.context = new AudioContext();
        this.master = this.context.createGain();
        const limiter = this.context.createDynamicsCompressor();
        limiter.threshold.value = -12;
        limiter.ratio.value = 12;
        this.master.connect(limiter);
        limiter.connect(this.context.destination);
        this.apply(this.preferences);
      }
      if (this.context.state === "suspended")
        void this.context.resume().catch(() => {
          this.unavailable = true;
        });
    } catch {
      this.unavailable = true;
    }
  }

  apply(preferences: Preferences): void {
    this.preferences = { ...preferences };
    if (this.master && this.context)
      this.master.gain.setTargetAtTime(
        preferences.muted ? 0 : preferences.volume * 0.6,
        this.context.currentTime,
        0.02,
      );
  }

  private tone(
    frequency: number,
    duration = 0.08,
    volume = 0.22,
    type: OscillatorType = "sine",
    delay = 0,
    endFrequency?: number,
  ): void {
    const context = this.context;
    if (
      !context ||
      !this.master ||
      this.preferences.muted ||
      context.state !== "running" ||
      this.voices.size >= 24
    )
      return;
    try {
      const at = context.currentTime + delay;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, at);
      if (endFrequency)
        oscillator.frequency.exponentialRampToValueAtTime(
          endFrequency,
          at + duration,
        );
      gain.gain.setValueAtTime(0.001, at);
      gain.gain.exponentialRampToValueAtTime(volume, at + 0.006);
      gain.gain.exponentialRampToValueAtTime(0.001, at + duration);
      oscillator.connect(gain);
      gain.connect(this.master);
      this.voices.add(oscillator);
      oscillator.onended = () => {
        oscillator.disconnect();
        gain.disconnect();
        this.voices.delete(oscillator);
      };
      oscillator.start(at);
      oscillator.stop(at + duration + 0.01);
    } catch {
      /* Audio failure must never block a tap. */
    }
  }

  correct(combo: number): void {
    const notes = [523.25, 587.33, 659.25, 783.99, 880];
    this.tone(notes[(combo - 1) % notes.length], 0.065, 0.3, "triangle");
    if (combo % 10 === 0) {
      this.tone(1046.5, 0.15, 0.22, "sine", 0.04);
      this.tone(1318.5, 0.15, 0.18, "sine", 0.09);
    }
  }
  wrong(): void {
    this.tone(190, 0.18, 0.35, "triangle", 0, 75);
    this.tone(130, 0.18, 0.18, "sine", 0.12, 65);
  }
  countdown(): void {
    this.tone(440, 0.07, 0.15);
  }
  start(): void {
    this.tone(659, 0.12);
    this.tone(880, 0.14, 0.2, "sine", 0.09);
  }
  warning(): void {
    this.tone(1046.5, 0.07, 0.17);
  }
  finish(): void {
    [523.25, 659.25, 783.99, 1046.5].forEach((frequency, i) =>
      this.tone(frequency, 0.25, 0.18, "triangle", i * 0.08),
    );
  }

  startMusic(): void {
    this.stopMusic();
    this.beat = 0;
    this.timer = setInterval(() => {
      if (!this.preferences.music) return;
      const step = this.beat++ % 16;
      if (step % 4 === 0)
        this.tone(step === 0 ? 130.8 : 164.8, 0.11, 0.13, "sine");
      if (step % 2 === 1) this.tone(440, 0.022, 0.03, "triangle", 0, 220);
      if (step === 3 || step === 10 || step === 14)
        this.tone(step === 10 ? 392 : 329.6, 0.09, 0.06, "sine");
    }, 180);
  }
  stopMusic(): void {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
  }
  stopAll(): void {
    this.stopMusic();
    for (const voice of this.voices) {
      try {
        voice.stop();
      } catch {
        /* Already stopped. */
      }
    }
  }
  async dispose(): Promise<void> {
    this.stopAll();
    await this.context?.close();
  }
}
