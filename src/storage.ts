import { validSelection, type AnimalSelection } from './animals';
import { validAutoInputRate, type AutoInputRate } from './auto-input';
export const STORAGE_KEY = "jungle-pang:v1";
export interface Preferences {
  best: number;
  volume: number;
  muted: boolean;
  music: boolean;
  randomAnimals: boolean;
  autoReset: boolean;
  autoInputRate: AutoInputRate;
  animals: AnimalSelection;
}
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}
const defaults: Preferences = {
  best: 0,
  volume: 0.45,
  muted: false,
  music: true,
  randomAnimals: true,
  autoReset: false,
  autoInputRate: 60,
  animals: { left: 'monkey', right: 'elephant' },
};

export class PangStorage {
  value: Preferences = { ...defaults };
  available = true;
  constructor(private readonly storage: StorageLike | null) {
    try {
      if (!storage) throw new Error("Storage unavailable");
      const raw = storage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data: unknown = JSON.parse(raw);
      if (!data || typeof data !== "object") return;
      const v = data as Partial<Preferences>;
      if (
        typeof v.best === "number" &&
        Number.isSafeInteger(v.best) &&
        v.best >= 0
      )
        this.value.best = v.best;
      if (typeof v.volume === "number" && Number.isFinite(v.volume))
        this.value.volume = Math.min(1, Math.max(0, v.volume));
      if (typeof v.muted === "boolean") this.value.muted = v.muted;
      if (typeof v.music === "boolean") this.value.music = v.music;
      if (typeof v.randomAnimals === 'boolean') this.value.randomAnimals = v.randomAnimals;
      if (typeof v.autoReset === 'boolean') this.value.autoReset = v.autoReset;
      if (import.meta.env.DEV && validAutoInputRate(v.autoInputRate)) this.value.autoInputRate = v.autoInputRate;
      if (validSelection(v.animals)) this.value.animals = { ...v.animals };
    } catch {
      this.available = false;
    }
  }

  update(patch: Partial<Preferences>): boolean {
    this.value = { ...this.value, ...patch };
    try {
      if (!this.storage) throw new Error("Storage unavailable");
      this.storage.setItem(STORAGE_KEY, JSON.stringify(this.value));
      this.available = true;
    } catch {
      this.available = false;
    }
    return this.available;
  }
}
