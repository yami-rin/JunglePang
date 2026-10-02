import rules from "./rules.json" with {type:'json'};

export type Animal = "monkey" | "tiger";
export type Phase = "ready" | "running" | "locked" | "finished";
export type EndReason = "time" | "background" | "quit";
export type Outcome = "correct" | "wrong" | "locked" | "inactive" | "expired";
export type Rules = typeof rules;
export const DEFAULT_RULES: Readonly<Rules> = Object.freeze({ ...rules });
export const RULES_VERSION = '3';

export interface InputRecord {
  at: number;
  input: Animal;
  target: Animal;
  outcome: Outcome;
  score: number;
  combo: number;
}

export interface RoundResult {
  score: number;
  hits: number;
  misses: number;
  maxCombo: number;
  accuracy: number;
  elapsedMs: number;
  reason: EndReason;
  eligible: boolean;
}

/** The clock is supplied by callers. Rendering and animation never gate scoring. */
export class PangEngine {
  readonly rules: Rules;
  phase: Phase = "ready";
  queue: Animal[] = [];
  score = 0;
  hits = 0;
  misses = 0;
  combo = 0;
  maxCombo = 0;
  startAt = 0;
  deadline = 0;
  lockUntil = 0;
  result: RoundResult | null = null;
  readonly log: InputRecord[] = [];
  private seed: number;
  private now = 0;
  private lastAnimal: Animal | undefined;
  private consecutive = 0;

  constructor(
    seed = 1,
    overrides: Partial<Rules> = {},
    initialQueue?: Animal[],
  ) {
    this.rules = { ...DEFAULT_RULES, ...overrides };
    this.seed = seed >>> 0 || 1;
    this.queue = initialQueue?.slice(0, this.rules.visiblePieces) ?? [];
    for (const animal of this.queue) this.recordGenerated(animal);
    while (this.queue.length < this.rules.visiblePieces)
      this.queue.push(this.nextAnimal());
  }

  start(now: number): void {
    if (this.phase !== "ready") return;
    this.now = now;
    this.startAt = now;
    this.deadline = now + this.rules.durationMs;
    this.phase = "running";
  }

  advance(now: number): void {
    this.now = Math.max(this.now, now);
    if (this.phase === "ready" || this.phase === "finished") return;
    if (this.now >= this.deadline) this.finish("time", this.deadline);
    else if (this.phase === "locked" && this.now >= this.lockUntil)
      this.phase = "running";
  }

  input(animal: Animal, now: number): Outcome {
    this.advance(now);
    const target = this.queue[0];
    let outcome: Outcome;
    if (this.phase === "finished") outcome = "expired";
    else if (this.phase === "ready") outcome = "inactive";
    else if (this.phase === "locked") outcome = "locked";
    else if (animal !== target) {
      outcome = "wrong";
      this.misses += 1;
      this.combo = 0;
      this.lockUntil = this.now + this.rules.missLockMs;
      this.phase = "locked";
    } else {
      outcome = "correct";
      this.hits += 1;
      this.combo += 1;
      this.maxCombo = Math.max(this.maxCombo, this.combo);
      const steps = Math.min(
        Math.floor(this.combo / this.rules.comboStep),
        this.rules.maxBonusSteps,
      );
      this.score += this.rules.basePoints + steps * this.rules.comboBonus;
      this.queue.shift();
      this.queue.push(this.nextAnimal());
    }
    if (this.log.length < this.rules.logLimit)
      this.log.push({
        at: Math.max(0, this.now - this.startAt),
        input: animal,
        target,
        outcome,
        score: this.score,
        combo: this.combo,
      });
    return outcome;
  }

  remaining(now: number): number {
    if (this.phase === "ready") return this.rules.durationMs;
    if (this.phase === "finished") return 0;
    return Math.max(0, this.deadline - Math.max(now, this.now));
  }

  finish(reason: EndReason, now: number): void {
    if (this.phase === "ready" || this.phase === "finished") return;
    // Time expiry wins even when the tab-hidden event arrives after the deadline.
    if (now >= this.deadline) reason = "time";
    this.now = Math.max(this.now, Math.min(now, this.deadline));
    this.phase = "finished";
    this.result = {
      score: this.score,
      hits: this.hits,
      misses: this.misses,
      maxCombo: this.maxCombo,
      accuracy:
        this.hits + this.misses === 0
          ? 0
          : this.hits / (this.hits + this.misses),
      elapsedMs: Math.min(
        this.rules.durationMs,
        Math.max(0, this.now - this.startAt),
      ),
      reason,
      eligible: reason === "time",
    };
  }

  private nextAnimal(): Animal {
    let x = this.seed;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.seed = x >>> 0;
    let animal: Animal = (this.seed & 1) === 0 ? "monkey" : "tiger";
    if (this.rules.maxConsecutive > 0 && animal === this.lastAnimal && this.consecutive >= this.rules.maxConsecutive)
      animal = animal === 'monkey' ? 'tiger' : 'monkey';
    this.recordGenerated(animal);
    return animal;
  }

  private recordGenerated(animal: Animal): void {
    this.consecutive = animal === this.lastAnimal ? this.consecutive + 1 : 1;
    this.lastAnimal = animal;
  }
}
