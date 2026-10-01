import {describe,it,expect,vi} from 'vitest';
import {displayNickname,isNgNickname,MASKED_NICKNAME,NG_NAME_MESSAGE} from '../src/name-policy';
import {RankingClient} from '../src/ranking';

describe('NG nicknames',()=>{
  it('matches kana, half-width characters, separators, small kana and decorated variants',()=>{
    for(const name of ['おまんこ','うんこ','ウンコ','ｳﾝｺ','ぅんこ','う ん こ','う・ん・こ','う💩んこ','う\u200bんこ','おマンコ太郎','ちんこ','チンポ','セックス','ｵﾅﾆｰ','パチンコうんこ']) {
      expect(isNgNickname(name),name).toBe(true);
      expect(displayNickname(name),name).toBe(MASKED_NICKNAME);
    }
  });
  it('preserves ordinary names and handles the benign pachinko exception without exempting other words',()=>{
    for(const name of ['とうふ','しおどめ','坂本壱','NIKU','Yoshito','うんどう','まんが','たんこぶ','くすのき','パチンコ好き','パチンコぱちんこ']) {
      expect(isNgNickname(name),name).toBe(false);
      expect(displayNickname(name),name).toBe(name);
    }
  });
  it('masks an old locally saved nickname',()=>{
    const client=new RankingClient({getItem:()=>JSON.stringify({name:'おまんこ'})} as Storage);
    expect(client.name).toBe(MASKED_NICKNAME);
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
