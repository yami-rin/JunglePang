export const AUTO_INPUT_RATES = [1, 5, 10, 15, 30, 60, 120, 'max'] as const;
export type AutoInputRate = typeof AUTO_INPUT_RATES[number];

export function validAutoInputRate(value: unknown): value is AutoInputRate {
  return AUTO_INPUT_RATES.some(rate => rate === value);
}

export function rateLabel(rate: AutoInputRate): string {
  return rate === 'max' ? '最速（端末依存）' : `${rate}回/秒`;
}

/** One real button activation per task. Delayed tasks never fabricate past taps. */
export class AutoInput {
  private timer: ReturnType<typeof setTimeout> | undefined;
  private generation = 0;

  start(rate: AutoInputRate, activate: () => boolean): void {
    this.stop();
    const generation = this.generation;
    const interval = rate === 'max' ? 0 : 1000 / rate;
    let nextAt = performance.now();
    const tick = () => {
      if (generation !== this.generation) return;
      this.timer = undefined;
      const now = performance.now();
      if (now < nextAt) {
        this.timer = setTimeout(tick, Math.ceil(nextAt - now));
        return;
      }
      if (!activate() || generation !== this.generation) return;
      nextAt = now + interval;
      this.timer = setTimeout(tick, Math.max(0, Math.ceil(nextAt - performance.now())));
    };
    this.timer = setTimeout(tick, 0);
  }

  stop(): void {
    this.generation++;
    clearTimeout(this.timer);
    this.timer = undefined;
  }
}
