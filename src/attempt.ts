import { PangEngine, type Animal } from './engine';

export const AUTO_RESET_VERSION = 1;
export const MAX_ATTEMPT_INDEX = 0xffffffff;

/** Derive reproducible fresh seeds from a server-issued challenge, without new requests. */
export function attemptSeed(baseSeed: number, index: number): number {
  if (!Number.isSafeInteger(index) || index < 0 || index > MAX_ATTEMPT_INDEX) throw new RangeError('Invalid attempt index');
  if (index === 0) return baseSeed;
  let value = (baseSeed ^ Math.imul(index, 0x9e3779b9)) >>> 0;
  value = Math.imul(value ^ (value >>> 16), 0x85ebca6b);
  value = Math.imul(value ^ (value >>> 13), 0xc2b2ae35);
  return (value ^ (value >>> 16)) >>> 0 || 1;
}

export function nextAttempt(baseSeed: number, index: number, ...previous: Animal[][]): { index: number; seed: number } {
  let seed: number;
  let queue: Animal[];
  do {
    seed = attemptSeed(baseSeed, ++index);
    queue = new PangEngine(seed).queue;
  } while (previous.some(old => old.length === queue.length && old.every((animal, i) => animal === queue[i])));
  return { index, seed };
}
