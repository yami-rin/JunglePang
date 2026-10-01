import { describe, it, expect } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { handle, replay, nickname, type Database } from '../api/worker';
import { PangEngine } from '../src/engine';
import { roundAnimals } from '../src/animals';

function database(): Database {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(readFileSync('api/migrations/0001_ranking.sql','utf8'));
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
});
