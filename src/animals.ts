import type { Animal } from './engine';
export interface AnimalArt { id: string; name: string; color: string; light: string; image?: string; }
export interface AnimalSelection { left: string; right: string; }
export const ANIMALS: readonly AnimalArt[] = [
  { id: 'monkey', name: 'サル', color: '#ad6b45', light: '#f5d7b5' },
  { id: 'tiger', name: 'トラ', color: '#e89226', light: '#ffe2a0' },
  { id: 'elephant', name: 'ゾウ', color: '#338ac9', light: '#c5e8ff' },
  { id: 'frog', name: 'カエル', color: '#43a750', light: '#d2f4b5' },
  { id: 'hippo', name: 'カバ', color: '#9662c9', light: '#ead8ff' },
  { id: 'chick', name: 'ヒヨコ', color: '#eed03a', light: '#fff3ab' },
  { id: 'ema', image: 'ema.png', name: 'エマ', color: '#dd759b', light: '#ffe5ef' },
  { id: 'hiro', image: 'hiro.png', name: 'ヒロ', color: '#9d4057', light: '#f7dfe5' },
  { id: 'annan', image: 'annan.png', name: 'アンアン', color: '#617bb7', light: '#e4eafa' },
  { id: 'noah', image: 'noah.png', name: 'ノア', color: '#4ca7b2', light: '#ddf4f4' },
  { id: 'reia', image: 'reia.png', name: 'レイア', color: '#ae8867', light: '#f3e8d9' },
  { id: 'miria', image: 'miria.png', name: 'ミリア', color: '#d5a755', light: '#fff1d4' },
  { id: 'margo', image: 'margo.png', name: 'マーゴ', color: '#73548e', light: '#eee3f5' },
  { id: 'nanoka', image: 'nanoka.png', name: 'ナノカ', color: '#666b81', light: '#e6e8f0' },
  { id: 'arisa', image: 'arisa.png', name: 'アリサ', color: '#8d5265', light: '#f1dfe7' },
  { id: 'sherie', image: 'sherie.png', name: 'シェリー', color: '#3985bd', light: '#dfedf9' },
  { id: 'hanna', image: 'hanna.png', name: 'ハンナ', color: '#89a262', light: '#edf2dc' },
  { id: 'koko', image: 'koko.png', name: 'ココ', color: '#d4784f', light: '#f9e7db' },
  { id: 'meruru', image: 'meruru.png', name: 'メルル', color: '#9da8c9', light: '#edf0fa' },
];
// Keep random pairs easy to distinguish at game speed. Explicit selection may use any two different characters.
const PAIRS = [
  [0,2],[0,3],[0,4],[1,2],[1,3],[1,4],[2,4],[2,5],[3,4],[4,5],
  [6,3],[6,2], [7,2],[7,5], [8,5],[8,3], [9,0],[9,4],
  [10,3],[10,2], [11,2],[11,4], [12,5],[12,3], [13,3],[13,5],
  [14,2],[14,5], [15,0],[15,4], [16,4],[16,2], [17,2],[17,4],
  [18,1],[18,3],
] as const;
export function validSelection(value: unknown): value is AnimalSelection {
  if (!value || typeof value !== 'object') return false;
  const pair = value as AnimalSelection;
  return pair.left !== pair.right && ANIMALS.some(art => art.id === pair.left) && ANIMALS.some(art => art.id === pair.right);
}
export function roundAnimals(seed: number, selection?: AnimalSelection | null): Record<Animal, AnimalArt> {
  if (validSelection(selection)) return { monkey: ANIMALS.find(art => art.id === selection.left)!, tiger: ANIMALS.find(art => art.id === selection.right)! };
  let x = seed >>> 0;
  x = Math.imul(x ^ x >>> 16, 0x7feb352d);
  x = Math.imul(x ^ x >>> 15, 0x846ca68b);
  x = (x ^ x >>> 16) >>> 0;
  const [a,b] = PAIRS[x % PAIRS.length];
  return x & 0x100 ? { monkey: ANIMALS[a], tiger: ANIMALS[b] } : { monkey: ANIMALS[b], tiger: ANIMALS[a] };
}
export const artURL = (art: AnimalArt) => `${import.meta.env.BASE_URL}art/${art.image ?? `${art.id}.svg`}`;
