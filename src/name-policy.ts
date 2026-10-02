import policy from './ng-names.json';

export const NAME_POLICY_VERSION = policy.version;
export const NG_NAME_MESSAGE = 'このニックネームは使用できません。別の名前を入力してください';

const small = 'ぁぃぅぇぉっゃゅょゎ';
const large = 'あいうえおつやゆよわ';
const ignored = /[\p{M}\p{Z}\p{P}\p{S}\p{C}ー]/gu;

function searchName(value: string): string {
  return value.normalize('NFKC').toLowerCase()
    .replace(/[\u30a1-\u30f6]/g, character => String.fromCharCode(character.charCodeAt(0) - 0x60))
    .replace(/[ぁぃぅぇぉっゃゅょゎ]/g, character => large[small.indexOf(character)])
    .replace(ignored, '');
}

const rules = policy.groups.flatMap(group => group.words.map(word => ({word: searchName(word), match: group.match, longEnding: word.endsWith('ー')})));
const exceptions = policy.exceptions.map(searchName);

function indexedName(value: string) {
  const original: string[] = [];
  for (const character of value) {
    // Keep combining accents, variation selectors and half-width dakuten with their base.
    if (original.length && /[\p{M}\uff9e\uff9f]/u.test(character)) original[original.length - 1] += character;
    else original.push(character);
  }
  const positions: number[] = [];
  const text = original.map((character, index) => {
    const key = searchName(character);
    for (let i = 0; i < key.length; i++) positions.push(index);
    return key;
  }).join('');
  return {original, text, positions};
}

function blockedParts(value: string): {original: string[]; blocked: Set<number>} {
  const {original, text, positions} = indexedName(value);
  const protectedPositions = new Set<number>();
  for (const exception of exceptions) {
    for (let start = text.indexOf(exception); start !== -1; start = text.indexOf(exception, start + 1)) {
      for (let i = start; i < start + exception.length; i++) protectedPositions.add(i);
    }
  }
  const latinNeighbor = (index: number, edge: number): boolean => {
    if (!/\p{Script=Latin}/u.test(text[index] ?? '')) return false;
    const first = Math.min(positions[index], positions[edge]);
    const last = Math.max(positions[index], positions[edge]);
    // Spaces/punctuation delimit words; invisible formatting alone does not.
    return !/[\p{Z}\p{P}\p{S}]/u.test(original.slice(first + 1, last).join(''));
  };
  const blocked = new Set<number>();
  for (const {word, match, longEnding} of rules) {
    for (let start = text.indexOf(word); start !== -1; start = text.indexOf(word, start + 1)) {
      const end = start + word.length;
      if (match === 'exact' && (start !== 0 || end !== text.length)) continue;
      if (match === 'word' && (latinNeighbor(start - 1, start) || latinNeighbor(end, end - 1))) continue;
      if (Array.from({length: word.length}, (_, i) => start + i).every(i => protectedPositions.has(i))) continue;
      for (let i = start; i < end; i++) blocked.add(positions[i]);
      if (longEnding && original[positions[end - 1] + 1]?.normalize('NFKC') === 'ー') blocked.add(positions[end - 1] + 1);
    }
  }
  return {original, blocked};
}

export function isNgNickname(value: string): boolean {
  return blockedParts(value).blocked.size > 0;
}

// Only raw names pass through this function. API responses carry their policy
// version so the client does not join fragments across already generated '*'.
export function displayNickname(value: string): string {
  const {original, blocked} = blockedParts(value);
  return original.map((character, index) => blocked.has(index) ? '*' : character).join('');
}
