import { PangEngine, DEFAULT_RULES, type Animal } from '../src/engine';

interface Statement {
  bind(...values: unknown[]): Statement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  run(): Promise<{ meta: { changes: number } }>;
}
export interface Database { prepare(sql: string): Statement; batch(statements: Statement[]): Promise<{ meta: { changes: number } }[]>; }
interface Env { DB: Database; }
interface Player { id: string; nickname: string; score: number; hits: number; max_combo: number; achieved_at: number; }
const origins = new Set(['https://yami-rin.github.io', 'http://localhost:5177', 'http://127.0.0.1:5177']);
class ApiError extends Error { constructor(public status: number, message: string) { super(message); } }
const digest = async (value: string) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))), byte => byte.toString(16).padStart(2,'0')).join('');

async function body(request: Request): Promise<Record<string, unknown>> {
  if (!request.headers.get('content-type')?.startsWith('application/json')) throw new ApiError(415, 'JSON形式で送信してください');
  if (Number(request.headers.get('content-length') ?? 0) > 150000) throw new ApiError(413, '送信内容が大きすぎます');
  const reader = request.body?.getReader();
  const chunks: Uint8Array[] = []; let bytes = 0;
  if (reader) while (true) {
    const {value,done} = await reader.read(); if (done) break;
    bytes += value.byteLength;
    if (bytes > 150000) { await reader.cancel(); throw new ApiError(413, '送信内容が大きすぎます'); }
    chunks.push(value);
  }
  const buffer = new Uint8Array(bytes); let offset = 0;
  for (const chunk of chunks) { buffer.set(chunk,offset); offset+=chunk.length; }
  const text = new TextDecoder().decode(buffer);
  let data: unknown;
  try { data = JSON.parse(text); } catch { throw new ApiError(400, '送信内容を読み取れません'); }
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new ApiError(400, '送信内容が不正です');
  return data as Record<string, unknown>;
}
async function limited(db: Database, key: string, now: number, cap: number, windowMs: number): Promise<void> {
  const bucket = `${key}:${Math.floor(now/windowMs)}`;
  const row = await db.prepare('INSERT INTO rate_limits(key,count,expires_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count').bind(bucket, now+windowMs*2).first<{ count: number }>();
  if (!row || row.count > cap) throw new ApiError(429, '少し待ってからもう一度お試しください');
}
async function authenticate(request: Request, db: Database): Promise<Player> {
  const header = request.headers.get('authorization') ?? '';
  if (!/^Bearer [a-f0-9]{64}$/.test(header)) throw new ApiError(401, '参加情報を再取得してください');
  const player = await db.prepare('SELECT id,nickname,score,hits,max_combo,achieved_at FROM players WHERE token_hash=?').bind(await digest(header.slice(7))).first<Player>();
  if (!player) throw new ApiError(401, '参加情報を再取得してください');
  return player;
}
export function replay(seed: number, inputs: unknown): PangEngine {
  if (!Array.isArray(inputs) || inputs.length === 0 || inputs.length > 2500) throw new ApiError(400, '入力記録が不正です');
  const engine = new PangEngine(seed);
  engine.start(0);
  let previous = -1;
  for (const value of inputs) {
    if (!value || typeof value !== 'object') throw new ApiError(400, '入力記録が不正です');
    const { at, input } = value as { at: unknown; input: unknown };
    if (typeof at !== 'number' || !Number.isFinite(at) || at < 0 || at >= DEFAULT_RULES.durationMs || at < previous || (input !== 'monkey' && input !== 'tiger')) throw new ApiError(400, '入力記録が不正です');
    engine.input(input as Animal, at);
    previous = at;
  }
  engine.advance(DEFAULT_RULES.durationMs);
  if (engine.hits > 1200) throw new ApiError(400, '入力回数が上限を超えています');
  return engine;
}
export function nickname(value: unknown): string {
  if (typeof value !== 'string') throw new ApiError(400, 'ニックネームを入力してください');
  const name = value.normalize('NFKC').trim();
  if (!name || [...name].length > 12 || /[\p{C}<>]/u.test(name)) throw new ApiError(400, 'ニックネームは12文字以内で入力してください');
  return name;
}
async function summary(db: Database, playerId: string): Promise<{ score: number; rank: number }> {
  const me = await db.prepare('SELECT score FROM players WHERE id=?').bind(playerId).first<{score:number}>();
  const above = await db.prepare('SELECT COUNT(*) AS count FROM players WHERE score>?').bind(me?.score ?? 0).first<{count:number}>();
  return {score: me?.score ?? 0, rank: (above?.count ?? 0)+1};
}
export async function handle(request: Request, env: Env, now = Date.now()): Promise<Response> {
  const url = new URL(request.url);
  const origin = request.headers.get('origin');
  const headers: Record<string,string> = { 'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store', 'Vary':'Origin', 'X-Content-Type-Options':'nosniff' };
  if (origin && origins.has(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS';
    headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization';
    headers['Access-Control-Max-Age'] = '86400';
  }
  const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), {status,headers});
  try {
    if (origin && !origins.has(origin)) throw new ApiError(403, 'この公開元からは利用できません');
    if (request.method === 'OPTIONS') return new Response(null,{status:204,headers});
    if (request.method === 'GET' && url.pathname === '/api/health') return json({ok:true,rulesVersion:'2'});
    if (request.method === 'GET' && url.pathname === '/api/ranking') {
      const { results } = await env.DB.prepare('WITH top AS (SELECT id,nickname,score,hits,max_combo,achieved_at FROM players WHERE score>0 ORDER BY score DESC,achieved_at ASC,id ASC LIMIT 50) SELECT id,nickname,score,hits,max_combo,RANK() OVER(ORDER BY score DESC) AS rank FROM top ORDER BY score DESC,achieved_at ASC,id ASC').all();
      headers['Cache-Control']='public, max-age=10';
      return json({entries:results});
    }
    if (request.method !== 'POST') throw new ApiError(404,'見つかりません');
    // Hash the IP with the date; raw addresses never enter the database.
    const ip = await digest(`${Math.floor(now/86400000)}:${request.headers.get('cf-connecting-ip') ?? 'local'}`);
    if (url.pathname === '/api/players') {
      await limited(env.DB,'identity:'+ip,now,50,3600000);
      const id = crypto.randomUUID();
      const token = [...crypto.getRandomValues(new Uint8Array(32))].map(byte=>byte.toString(16).padStart(2,'0')).join('');
      await env.DB.prepare('INSERT INTO players(id,token_hash) VALUES(?,?)').bind(id, await digest(token)).run();
      return json({id,token},201);
    }
    const player = await authenticate(request,env.DB);
    if (url.pathname === '/api/rounds') {
      await limited(env.DB,'round:'+player.id,now,12,60000);
      await limited(env.DB,'round-ip:'+ip,now,100,60000);
      const id = crypto.randomUUID();
      const seed = crypto.getRandomValues(new Uint32Array(1))[0] || 1;
      await env.DB.prepare('INSERT INTO rounds(id,player_id,seed,created_at) VALUES(?,?,?,?)').bind(id,player.id,seed,now).run();
      // Bounded cleanup uses an indexed age threshold. No leaderboard entries are removed.
      await env.DB.batch([
        env.DB.prepare('DELETE FROM rounds WHERE created_at<?').bind(now-86400000),
        env.DB.prepare('DELETE FROM rate_limits WHERE expires_at<?').bind(now),
      ]);
      return json({id,seed,rulesVersion:'2'},201);
    }
    if (url.pathname === '/api/scores') {
      await limited(env.DB,'submit:'+player.id,now,20,3600000);
      const data = await body(request);
      const name = nickname(data.nickname);
      if (typeof data.roundId !== 'string' || data.roundId.length > 64) throw new ApiError(400,'ゲームの記録が不正です');
      const round = await env.DB.prepare('SELECT seed,created_at,consumed,score FROM rounds WHERE id=? AND player_id=?').bind(data.roundId,player.id).first<{seed:number;created_at:number;consumed:string|null;score:number|null}>();
      if (!round) throw new ApiError(400,'ゲームの記録が見つかりません');
      if (round.consumed) return json({accepted:true,...await summary(env.DB,player.id)});
      if (now-round.created_at < DEFAULT_RULES.durationMs) throw new ApiError(400,'40秒終了した記録だけ登録できます');
      if (now-round.created_at > 600000) throw new ApiError(410,'登録期限が過ぎました。もう一度プレイしてください');
      const engine = replay(round.seed,data.inputs);
      if (engine.score <= 0) throw new ApiError(400,'1回以上正解した記録を登録できます');
      const claim = crypto.randomUUID();
      const updated = await env.DB.batch([
        env.DB.prepare('UPDATE rounds SET consumed=?,score=? WHERE id=? AND consumed IS NULL').bind(claim,engine.score,data.roundId),
        env.DB.prepare('UPDATE players SET nickname=?,score=?,hits=?,max_combo=?,achieved_at=? WHERE id=? AND score<? AND EXISTS(SELECT 1 FROM rounds WHERE id=? AND consumed=?)').bind(name,engine.score,engine.hits,engine.maxCombo,now,player.id,engine.score,data.roundId,claim),
      ]);
      if (!updated[0].meta.changes) return json({accepted:true,...await summary(env.DB,player.id)});
      return json({accepted:true,...await summary(env.DB,player.id)});
    }
    throw new ApiError(404,'見つかりません');
  } catch (error) {
    return json({error: error instanceof ApiError ? error.message : 'ランキングに接続できません。あとでお試しください'}, error instanceof ApiError ? error.status : 503);
  }
}
export default { fetch: (request: Request, env: Env) => handle(request,env) };
