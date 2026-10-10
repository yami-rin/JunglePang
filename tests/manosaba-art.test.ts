import { describe, expect, it } from 'vitest';
import { ANIMALS, roundAnimals, validSelection } from '../src/animals';

const people = ['ema','hiro','annan','noah','reia','miria','margo','nanoka','arisa','sherie','hanna','koko','meruru'];

describe('character roster', () => {
  it('includes all thirteen portraits for either side and rejects the same portrait twice', () => {
    expect(people.every(id => ANIMALS.some(art => art.id === id))).toBe(true);
    for (const id of people) {
      expect(validSelection({left:id,right:'monkey'})).toBe(true);
      expect(validSelection({left:'monkey',right:id})).toBe(true);
      expect(validSelection({left:id,right:id})).toBe(false);
    }
  });

  it('can randomly choose every added character without a duplicate pair', () => {
    const seen = new Set<string>();
    for (let seed = 0; seed < 5000; seed++) {
      const pair = roundAnimals(seed);
      expect(pair.monkey.id).not.toBe(pair.tiger.id);
      seen.add(pair.monkey.id);
      seen.add(pair.tiger.id);
    }
    expect(people.every(id => seen.has(id))).toBe(true);
  });
});
