import policy from './ng-names.json';

export const MASKED_NICKNAME = '＊＊＊';
export const NG_NAME_MESSAGE = 'このニックネームは使用できません。別の名前を入力してください';

function searchName(value: string): string {
  const small = 'ぁぃぅぇぉっゃゅょゎ';
  const large = 'あいうえおつやゆよわ';
  return value.normalize('NFKC').toLowerCase()
    .replace(/[\u30a1-\u30f6]/g, character => String.fromCharCode(character.charCodeAt(0)-0x60))
    .replace(/[ぁぃぅぇぉっゃゅょゎ]/g, character => large[small.indexOf(character)])
    .replace(/[\p{M}\p{Z}\p{P}\p{S}\p{C}ー]/gu, '');
}

const words = policy.words.map(searchName);
const exceptions = policy.exceptions.map(searchName);

export function isNgNickname(value: string): boolean {
  let name = searchName(value);
  // Ignore ordinary words such as パチンコ without exempting the rest of a name.
  for (const exception of exceptions) name = name.replaceAll(exception, '');
  return words.some(word => name.includes(word));
}

export function displayNickname(value: string): string {
  return isNgNickname(value) ? MASKED_NICKNAME : value;
}
