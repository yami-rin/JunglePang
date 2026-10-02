import config from './ranking-config.json';
import type { InputRecord } from './engine';
import { deviceType, type Device, type RankingCategory } from './platform';
import { isNgNickname, displayNickname, NG_NAME_MESSAGE, NAME_POLICY_VERSION } from './name-policy';

interface Identity { id: string; token: string; }
export interface RankedRound { id: string; seed: number; rulesVersion: string; device?: Device; autoResetVersion?: number; attempt?: number; }
export interface SubmittedScore { score: number; rank: number; device?: Device; deviceScore?: number; deviceRank?: number | null; }
export interface Entry { id: string; nickname: string; score: number; hits: number; max_combo: number; rank: number; }
const KEY = 'jungle-pang:ranking-v2';
export class RankingClient {
  private identity: Identity | null = null;
  private pending: Promise<Identity> | null = null;
  private storedName = '名無しのパング';
  name = '名無しのパング';
  constructor(private readonly storage: Storage | null) {
    try {
      const value = JSON.parse(storage?.getItem(KEY) ?? 'null');
      if (value && typeof value.id === 'string' && /^[a-f0-9]{64}$/.test(value.token)) this.identity = {id:value.id,token:value.token};
      if (value && typeof value.name === 'string') {
        this.storedName = Array.from(value.name).slice(0,12).join('');
        this.name = displayNickname(this.storedName);
      }
    } catch { /* A blocked store does not prevent playing. */ }
  }
  get playerId(): string | undefined { return this.identity?.id; }
  private persist(): void {
    try { this.storage?.setItem(KEY,JSON.stringify({...this.identity,name:this.storedName})); } catch { /* Session identity still works. */ }
  }
  private async api<T>(path: string, data?: unknown, authenticated = false): Promise<T> {
    if (!config.apiURL) throw new Error('ランキングに接続できません');
    const response = await fetch(config.apiURL+path, {
      method: data === undefined ? 'GET' : 'POST',
      headers: {...(data === undefined ? {} : {'Content-Type':'application/json'}), ...(authenticated && this.identity ? {Authorization:`Bearer ${this.identity.token}`} : {})},
      body: data === undefined ? undefined : JSON.stringify(data),
      signal: AbortSignal.timeout(7000),
      cache:'no-store',
      credentials:'omit',
    });
    const value = await response.json();
    if (!response.ok) {
      if (response.status === 401) { this.identity=null; this.persist(); }
      throw new Error(value.error ?? '通信できません。あとでお試しください');
    }
    return value as T;
  }
  private async identify(): Promise<Identity> {
    if (this.identity) return this.identity;
    if (!this.pending) this.pending = this.api<Identity>('/api/players',{}).then(identity=>{
      this.identity=identity; this.persist(); return identity;
    }).finally(()=>{this.pending=null;});
    return this.pending;
  }
  async start(): Promise<RankedRound> {
    await this.identify();
    return this.api<RankedRound>('/api/rounds',{ device: deviceType(navigator.userAgent, navigator.maxTouchPoints, (navigator as Navigator & {userAgentData?: {mobile:boolean}}).userAgentData?.mobile) },true);
  }
  async list(category: RankingCategory = 'all'): Promise<Entry[]> {
    const {entries,namePolicyVersion} = await this.api<{entries:Entry[];namePolicyVersion?:number}>(`/api/ranking?category=${category}`);
    return namePolicyVersion === NAME_POLICY_VERSION ? entries : entries.map(entry=>({...entry,nickname:displayNickname(entry.nickname)}));
  }
  async submit(round: RankedRound, name: string, log: InputRecord[]): Promise<SubmittedScore> {
    if (isNgNickname(name)) throw new Error(NG_NAME_MESSAGE);
    const inputs = log.filter(record=>record.outcome === 'correct' || record.outcome === 'wrong').map(({at,input})=>({at,input}));
    const result = await this.api<SubmittedScore>('/api/scores',{roundId:round.id,nickname:name,inputs,...(round.attempt === undefined ? {} : {attempt:round.attempt})},true);
    this.storedName=this.name=name; this.persist(); return result;
  }
}
