import {describe,it,expect,vi} from 'vitest';
import {displayNickname,isNgNickname,NAME_POLICY_VERSION,NG_NAME_MESSAGE} from '../src/name-policy';
import {RankingClient} from '../src/ranking';
import policy from '../src/ng-names.json';

describe('NG nicknames',()=>{
  it('matches kana, half-width characters, separators, small kana and decorated variants',()=>{
    for(const [name,masked] of [
      ['おまんこ','お***'], ['うんこ','***'], ['ウンコ','***'], ['ｳﾝｺ','***'], ['ぅんこ','***'],
      ['う ん こ','* * *'], ['う・ん・こ','*・*・*'], ['う💩んこ','*💩**'], ['う\u200bんこ','*\u200b**'],
      ['おマンコ太郎','お***太郎'], ['ちんこ','***'], ['チンポ','***'], ['セックス','****'],
      ['ｵﾅﾆｰ','****'], ['パチンコうんこ','パチンコ***'], ['う*ん*こ','*****'],
    ]) {
      expect(isNgNickname(name),name).toBe(true);
      expect(displayNickname(name),name).toBe(masked);
    }
  });
  it('covers the curated categories and masks multiple or overlapping matches without damaging surrounding text',()=>{
    for(const group of policy.groups) for(const word of group.words) expect(isNgNickname(word),`${group.category}: ${word}`).toBe(true);
    for(const [name,masked] of [
      ['うんこ太郎','***太郎'], ['猫おまんこ王','猫お***王'], ['うんこまんこ','******'],
      ['母motherfucker子','母************子'], ['田中 Fuck 123','田中 **** 123'], ['Tom Fuck Guy','Tom **** Guy'], ['F.U.C.Kさん','*.*.*.*さん'],
      ['UNKO太郎','****太郎'], ['ＳＨＩＴ99','****99'], ['SH1T王','****王'], ['氏ね太郎','**太郎'], ['王基地外猫','王***猫'],
      ['ﾊﾟｶﾞｲｼﾞ太郎','ﾊﾟ***太郎'], ['か\u3099いし\u3099王','***王'], ['🇯🇵うんこ🦁','🇯🇵***🦁'],
      ['e\u0301うんこé','e\u0301***é'], ['㍑うんこさん','㍑***さん'], ['くうんこそ','く***そ'],
      ['パチンコちんこ','パチンコ***'], ['やくそくくそ王','やくそく**王'],
      ['下痢便マスター田原','***マスター田原'], ['中出しガンジャマン','*******マン'],
    ]) {
      expect(isNgNickname(name),name).toBe(true);
      expect(displayNickname(name),name).toBe(masked);
    }
  });
  it('preserves ordinary names and handles the benign pachinko exception without exempting other words',()=>{
    for(const name of ['とうふ','しおどめ','坂本壱','NIKU','Yoshito','うんどう','まんが','たんこぶ','くすのき','パチンコ好き','パチンコぱちんこ',
      'Yoshi\u200bto','Assassin','Scunthorpe','Hancock','Dickinson','Dickens','Sussex','Classic','Analysis','Shine','Tintin','Écume','Écunté','Heroine','しゃぶしゃぶ',
      'パチンコ王','チンチン電車','うんちく博士','シネマ好き','やくそく','もくそう','薬草','チンゲンサイ','まんげつ','かげろう','ちょんまげ','あほうどり','ばかり']) {
      expect(isNgNickname(name),name).toBe(false);
      expect(displayNickname(name),name).toBe(name);
    }
  });
  it('masks an old locally saved nickname',()=>{
    const client=new RankingClient({getItem:()=>JSON.stringify({name:'おまんこ'})} as Storage);
    expect(client.name).toBe('お***');
  });
  it('does not mask extra characters when reading a response already processed by the current server',async()=>{
    const fetch=vi.fn().mockResolvedValue(new Response(JSON.stringify({namePolicyVersion:NAME_POLICY_VERSION,entries:[{id:'old',nickname:'く***そ',score:10,rank:1}]})));
    vi.stubGlobal('fetch',fetch);
    try { expect(await new RankingClient(null).list()).toMatchObject([{nickname:'く***そ'}]); }
    finally { vi.unstubAllGlobals(); }
  });
  it('persists the original saved name so signing in and reloading does not accumulate masks',async()=>{
    let saved=JSON.stringify({name:'くうんこそ'});
    const storage={getItem:()=>saved,setItem:(_key:string,value:string)=>{saved=value;}} as Storage;
    const fetch=vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({id:'test',token:'a'.repeat(64)})))
      .mockResolvedValueOnce(new Response(JSON.stringify({id:'round',seed:42,rulesVersion:'2'})));
    vi.stubGlobal('fetch',fetch);
    vi.stubGlobal('navigator',{userAgent:'Windows',maxTouchPoints:0});
    try {
      const client=new RankingClient(storage);
      expect(client.name).toBe('く***そ');
      await client.start();
      expect(new RankingClient(storage).name).toBe('く***そ');
    } finally { vi.unstubAllGlobals(); }
  });
  it('rejects a blocked submission before making a request and allows a corrected name',async()=>{
    const fetch=vi.fn().mockResolvedValue(new Response(JSON.stringify({score:10,rank:1}),{status:200}));
    vi.stubGlobal('fetch',fetch);
    try {
      const client=new RankingClient(null);
      const round={id:'round',seed:42,rulesVersion:'2'};
      await expect(client.submit(round,'おまんこ',[])).rejects.toThrow(NG_NAME_MESSAGE);
      expect(fetch).not.toHaveBeenCalled();
      await expect(client.submit(round,'とうふ',[])).resolves.toMatchObject({score:10,rank:1});
      expect(fetch).toHaveBeenCalledTimes(1);
    } finally { vi.unstubAllGlobals(); }
  });
});
