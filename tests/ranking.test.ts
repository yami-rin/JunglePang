import { describe, it, expect } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { handle, replay, nickname, type Database } from '../api/worker';
import { PangEngine } from '../src/engine';
import { roundAnimals } from '../src/animals';
import { deviceType } from '../src/platform';
import {NAME_POLICY_VERSION,NG_NAME_MESSAGE} from '../src/name-policy';

function database(): Database {
  const sqlite = new DatabaseSync(':memory:');
  for (const migration of readdirSync('api/migrations').filter(name=>name.endsWith('.sql')).sort()) sqlite.exec(readFileSync(`api/migrations/${migration}`,'utf8'));
  const db: Database = {
    prepare(sql) {
      let values: any[] = [];
      return {
        bind(...args) { values = args; return this; },
        async first<T>() { return sqlite.prepare(sql).get(...values) as T ?? null; },
        async all<T>() { return { results: sqlite.prepare(sql).all(...values) as T[] }; },
        async run() { return { meta: { changes: Number(sqlite.prepare(sql).run(...values).changes) } }; },
      };
    },
    async batch(statements) {
      sqlite.exec('BEGIN');
      try { const results = []; for (const statement of statements) results.push(await statement.run()); sqlite.exec('COMMIT'); return results; }
      catch(error) { sqlite.exec('ROLLBACK'); throw error; }
    },
  };
  return db;
}
const request = (path: string, data?: unknown, token?: string) => new Request(`https://ranking.test${path}`, {
  method: data === undefined ? 'GET' : 'POST',
  headers: { origin:'https://yami-rin.github.io', ...(data === undefined ? {} : {'content-type':'application/json'}), ...(token ? {authorization:`Bearer ${token}`} : {}) },
  body: data === undefined ? undefined : JSON.stringify(data),
});
const trace = (seed: number, hits: number) => {
  const engine = new PangEngine(seed); engine.start(0);
  for (let i=0; i<hits; i++) engine.input(engine.queue[0],100+i*80);
  return engine.log.map(({at,input})=>({at,input}));
};
describe('shared national ranking', () => {
  it('masks existing NG names in every category without changing scores, ranks or stored records',async()=>{
    const env={DB:database()};
    const records=[['old1','おまんこ',160,'お***'],['old2','う・ん・こ',120,'*・*・*'],['old3','うんこ太郎',100,'***太郎'],['old4','くうんこそ',95,'く***そ'],['good','とうふ',90,'とうふ']] as const;
    for(const [id,name,score] of records) {
      await env.DB.prepare('INSERT INTO players(id,token_hash,nickname,score,hits,max_combo,achieved_at) VALUES(?,?,?,?,16,16,5)').bind(id,id+'-hash',name,score).run();
      for(const device of ['mobile','pc']) await env.DB.prepare('INSERT INTO device_scores(player_id,device,nickname,score,hits,max_combo,achieved_at) VALUES(?,?,?,?,16,16,5)').bind(id,device,name,score).run();
    }
    for(const category of ['all','mobile','pc']) {
      const response=await handle(request(`/api/ranking?category=${category}`),env);
      const {entries,namePolicyVersion}=await response.json() as any;
      expect(namePolicyVersion).toBe(NAME_POLICY_VERSION);
      expect(entries).toEqual(records.map(([id,_name,score,masked],index)=>({id,nickname:masked,score,hits:16,max_combo:16,rank:index+1})));
      expect(JSON.stringify(entries)).not.toContain('おまんこ');
      expect(JSON.stringify(entries)).not.toContain('う・ん・こ');
    }
    expect(await env.DB.prepare('SELECT nickname,score FROM players WHERE id=?').bind('old1').first()).toMatchObject({nickname:'おまんこ',score:160});
    expect(await env.DB.prepare('SELECT nickname,score FROM device_scores WHERE player_id=? AND device=?').bind('old2','mobile').first()).toMatchObject({nickname:'う・ん・こ',score:120});
  });
  it('rejects NG names on the server without consuming the round so a corrected name can register',async()=>{
    const env={DB:database()}; const time=100000;
    const player=await (await handle(request('/api/players',{}),env,time)).json() as any;
    const round=await (await handle(request('/api/rounds',{device:'mobile'},player.token),env,time)).json() as any;
    for(const name of ['おまんこ','う ん こ','ｳﾝｺ','基地外太郎','氏ね','fuck','unko','う*ん*こ']) {
      const response=await handle(request('/api/scores',{roundId:round.id,nickname:name,inputs:trace(round.seed,1)},player.token),env,time+41000);
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({error:NG_NAME_MESSAGE});
    }
    expect(await env.DB.prepare('SELECT consumed FROM rounds WHERE id=?').bind(round.id).first()).toMatchObject({consumed:null});
    expect(await env.DB.prepare('SELECT score FROM players WHERE id=?').bind(player.id).first()).toMatchObject({score:0});
    expect(await env.DB.prepare('SELECT COUNT(*) AS count FROM device_scores').first()).toMatchObject({count:0});
    const corrected=await handle(request('/api/scores',{roundId:round.id,nickname:'とうふ',inputs:trace(round.seed,1)},player.token),env,time+42000);
    expect(corrected.status).toBe(200);
    expect(await corrected.json()).toMatchObject({score:10,deviceScore:10});
  });
  it('returns only the top fifty and preserves equal-score ranks at the boundary',async()=>{
    const env={DB:database()};
    for(let i=0;i<100;i++) await env.DB.prepare('INSERT INTO players(id,token_hash,nickname,score,achieved_at) VALUES(?,?,?,?,?)').bind('p'+i,'hash'+i,'参加者'+i,Math.floor(i/2)*10,i).run();
    const entries=(await (await handle(request('/api/ranking'),env)).json() as any).entries;
    expect(entries).toHaveLength(50);
    expect(entries.slice(0,3).map((entry:any)=>({score:entry.score,rank:entry.rank}))).toEqual([{score:490,rank:1},{score:490,rank:1},{score:480,rank:3}]);
    expect(entries[49]).toMatchObject({score:250,rank:49});
  });
  it('recomputes scores with server rules and rejects malformed input traces', () => {
    expect(replay(42, trace(42,12)).score).toBe(135);
    for (const inputs of [[], [{at:-1,input:'monkey'}], [{at:40000,input:'monkey'}], [{at:1,input:'lion'}], [{at:2,input:'monkey'},{at:1,input:'tiger'}]]) expect(()=>replay(42,inputs)).toThrow();
    expect(()=>nickname('<script>')).toThrow();
    expect(()=>nickname('1234567890123')).toThrow();
  });
  it('shares two players across requests, sorts records, and never trusts a submitted score', async () => {
    const env = { DB: database() }; const time = 100000;
    const players = [];
    for (let i=0;i<2;i++) {
      const player = await (await handle(request('/api/players',{}),env,time)).json() as any;
      const round = await (await handle(request('/api/rounds',{},player.token),env,time)).json() as any;
      const inputs = trace(round.seed,(i+1)*3);
      const early = await handle(request('/api/scores',{roundId:round.id,nickname:'参加者'+i,inputs},player.token),env,time+39999);
      expect(early.status).toBe(400);
      const result = await handle(request('/api/scores',{roundId:round.id,nickname:'参加者'+i,inputs,score:9999999},player.token),env,time+41000);
      expect(result.status).toBe(200);
      expect(await result.json()).toMatchObject({accepted:true,score:(i+1)*30,rank:1});
      const duplicate = await handle(request('/api/scores',{roundId:round.id,nickname:'改ざん',inputs:trace(round.seed,50)},player.token),env,time+42000);
      expect(await duplicate.json()).toMatchObject({score:(i+1)*30});
      players.push(player);
    }
    const board = await handle(request('/api/ranking'),env,time+43000);
    expect(board.headers.get('access-control-allow-origin')).toBe('https://yami-rin.github.io');
    const entries = (await board.json() as any).entries;
    expect(entries.map((entry:any)=>entry.score)).toEqual([60,30]);
    expect(entries.map((entry:any)=>entry.nickname)).toEqual(['参加者1','参加者0']);
    expect(JSON.stringify(entries)).not.toContain('token');
    const round = await (await handle(request('/api/rounds',{},players[1].token),env,time+50000)).json() as any;
    const lower = await handle(request('/api/scores',{roundId:round.id,nickname:'低い記録',inputs:trace(round.seed,1)},players[1].token),env,time+91000);
    expect(await lower.json()).toMatchObject({score:60});
  });
  it('requires ownership, expires old challenges, and rate limits repeated starts', async () => {
    const env={ DB: database() }; const time=100000;
    expect((await handle(request('/api/rounds',{}),env,time)).status).toBe(401);
    const player=await (await handle(request('/api/players',{}),env,time)).json() as any;
    let round:any;
    for(let i=0;i<12;i++) {
      const response=await handle(request('/api/rounds',{},player.token),env,time);
      expect(response.status).toBe(201); round=await response.json();
    }
    expect((await handle(request('/api/rounds',{},player.token),env,time)).status).toBe(429);
    expect((await handle(request('/api/scores',{roundId:round.id,nickname:'テスト',inputs:trace(round.seed,1)},player.token),env,time+600001)).status).toBe(410);
    const blocked=new Request('https://ranking.test/api/players',{method:'POST',headers:{origin:'https://unrelated.example'}});
    expect((await handle(blocked,env,time)).status).toBe(403);
  });
});
describe('distinct random animals',()=>{
  it('keeps a reproducible pair for the round and chooses varied shapes and colors',()=>{
    const pairs=new Set<string>(); const animals=new Set<string>();
    for(let seed=1;seed<=100;seed++) {
      const pair=roundAnimals(seed);
      expect(pair).toEqual(roundAnimals(seed));
      expect(pair.monkey.id).not.toBe(pair.tiger.id);
      expect(pair.monkey.color).not.toBe(pair.tiger.color);
      pairs.add(pair.monkey.id+':'+pair.tiger.id); animals.add(pair.monkey.id); animals.add(pair.tiger.id);
    }
    expect(animals.size).toBe(6); expect(pairs.size).toBeGreaterThan(10);
  });
  it('uses the chosen pair independently of the random seed and falls back for invalid pairs',()=>{
    for (const seed of [1,42,98765]) expect(roundAnimals(seed,{left:'frog',right:'hippo'})).toMatchObject({monkey:{id:'frog'},tiger:{id:'hippo'}});
    expect(roundAnimals(42,{left:'frog',right:'frog'})).toEqual(roundAnimals(42));
    expect(roundAnimals(42,{left:'unknown',right:'hippo'})).toEqual(roundAnimals(42));
  });
});

describe('device rankings',()=>{
  it('classifies phones and iPadOS without treating touchscreen PCs as phones',()=>{
    expect(deviceType('Mozilla Android')).toBe('mobile');
    expect(deviceType('Mozilla iPhone')).toBe('mobile');
    expect(deviceType('Mozilla Macintosh',5)).toBe('mobile');
    expect(deviceType('Mozilla Windows NT 10.0',10)).toBe('pc');
    expect(deviceType('Mozilla Macintosh')).toBe('pc');
    expect(deviceType('Unknown',0,true)).toBe('mobile');
  });
  it('preserves legacy scores without inventing a device category',()=>{
    const sqlite=new DatabaseSync(':memory:');
    sqlite.exec(readFileSync('api/migrations/0001_ranking.sql','utf8'));
    sqlite.exec("INSERT INTO players(id,token_hash,nickname,score) VALUES('old','hash','既存',123); INSERT INTO rounds(id,player_id,seed,created_at) VALUES('old-round','old',42,0)");
    sqlite.exec(readFileSync('api/migrations/0002_device_rankings.sql','utf8'));
    expect(sqlite.prepare('SELECT score FROM players').get()).toMatchObject({score:123});
    expect(sqlite.prepare('SELECT device FROM rounds').get()).toMatchObject({device:'unknown'});
    expect(sqlite.prepare('SELECT COUNT(*) AS count FROM device_scores').get()).toMatchObject({count:0});
    sqlite.close();
  });
  it('stores a best per device, combines only the overall best, and keeps retries in the original category',async()=>{
    const env={DB:database()}; const time=100000;
    const player=await (await handle(request('/api/players',{}),env,time)).json() as any;
    const submit=async(device:string,hits:number,offset:number)=>{
      const round=await (await handle(request('/api/rounds',{device},player.token),env,time+offset)).json() as any;
      expect(round.device).toBe(device);
      const payload={roundId:round.id,nickname:device==='mobile'?'スマホ記録':'PC記録',inputs:trace(round.seed,hits),device:device==='mobile'?'pc':'mobile'};
      const response=await handle(request('/api/scores',payload,player.token),env,time+offset+41000);
      expect(response.status).toBe(200);
      return {result:await response.json() as any,round,payload};
    };
    expect((await submit('pc',12,0)).result).toMatchObject({score:135,device:'pc',deviceScore:135,deviceRank:1});
    const mobile=await submit('mobile',3,50000);
    expect(mobile.result).toMatchObject({score:135,device:'mobile',deviceScore:30,deviceRank:1});
    expect((await submit('mobile',1,100000)).result.deviceScore).toBe(30);
    const duplicate=await handle(request('/api/scores',{...mobile.payload,inputs:trace(mobile.round.seed,100)},player.token),env,time+160000);
    expect(await duplicate.json()).toMatchObject({score:135,device:'mobile',deviceScore:30});
    for(const [category,score,nickname] of [['all',135,'PC記録'],['pc',135,'PC記録'],['mobile',30,'スマホ記録']] as const) {
      const board=await handle(request(`/api/ranking?category=${category}`),env,time);
      const value=await board.json() as any;
      expect(value.category).toBe(category);
      expect(value.entries).toHaveLength(1);
      expect(value.entries[0]).toMatchObject({id:player.id,score,nickname,rank:1});
    }
    expect((await handle(request('/api/ranking?category=bad'),env,time)).status).toBe(400);
    expect((await handle(request('/api/rounds',{device:'all'},player.token),env,time)).status).toBe(400);
  });
  it('sorts each category independently, supports ties, and excludes records from other devices',async()=>{
    const env={DB:database()};
    for(const [id,device,score] of [['a','mobile',30],['b','mobile',30],['c','mobile',10],['d','pc',60]] as const) {
      await env.DB.prepare('INSERT INTO players(id,token_hash,nickname,score) VALUES(?,?,?,?)').bind(id,'hash-'+id,id,score).run();
      await env.DB.prepare('INSERT INTO device_scores(player_id,device,nickname,score,hits,max_combo,achieved_at) VALUES(?,?,?,?,1,1,0)').bind(id,device,id,score).run();
    }
    const mobile=await (await handle(request('/api/ranking?category=mobile'),env)).json() as any;
    expect(mobile.entries.map((entry:any)=>[entry.id,entry.rank])).toEqual([['a',1],['b',1],['c',3]]);
    const pc=await (await handle(request('/api/ranking?category=pc'),env)).json() as any;
    expect(pc.entries.map((entry:any)=>[entry.id,entry.rank])).toEqual([['d',1]]);
  });
});
