export const STORAGE_KEY = "jungle-pang:v1";
export interface Preferences {
  best: number;
  volume: number;
  muted: boolean;
  music: boolean;
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
