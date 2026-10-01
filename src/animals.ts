import type { Animal } from './engine';
export interface AnimalArt { id: string; name: string; color: string; light: string; }
export const ANIMALS: readonly AnimalArt[] = [
  { id: 'monkey', name: 'サル', color: '#ad6b45', light: '#f5d7b5' },
  { id: 'tiger', name: 'トラ', color: '#e89226', light: '#ffe2a0' },
  { id: 'elephant', name: 'ゾウ', color: '#338ac9', light: '#c5e8ff' },
  { id: 'frog', name: 'カエル', color: '#43a750', light: '#d2f4b5' },
  { id: 'hippo', name: 'カバ', color: '#9662c9', light: '#ead8ff' },
  { id: 'chick', name: 'ヒヨコ', color: '#eed03a', light: '#fff3ab' },
];
// Separate hues AND silhouettes. Avoid brown/orange and orange/yellow pairings.
const PAIRS = [[0,2],[0,3],[0,4],[1,2],[1,3],[1,4],[2,4],[2,5],[3,4],[4,5]] as const;
export function roundAnimals(seed: number): Record<Animal, AnimalArt> {
  let x = seed >>> 0;
  x = Math.imul(x ^ x >>> 16, 0x7feb352d);
  x = Math.imul(x ^ x >>> 15, 0x846ca68b);
  x = (x ^ x >>> 16) >>> 0;
  const [a,b] = PAIRS[x % PAIRS.length];
  return x & 0x100 ? { monkey: ANIMALS[a], tiger: ANIMALS[b] } : { monkey: ANIMALS[b], tiger: ANIMALS[a] };
}
export const artURL = (art: AnimalArt) => `${import.meta.env.BASE_URL}art/${art.id}.svg`;
