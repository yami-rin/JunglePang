import { describe, it, expect } from "vitest";
import { PangEngine, type Animal } from "../src/engine";
import { PangStorage, STORAGE_KEY, type StorageLike } from "../src/storage";
import { attemptSeed, nextAttempt } from '../src/attempt';

describe('fresh AutoReset attempts',()=>{
  it('always replaces both the previous starting tower and the progressed tower, with capped reproducible refills',()=>{
    for(let base=1;base<=64;base++) {
      let index=0;
      let engine=new PangEngine(base);
      for(let retry=0;retry<100;retry++) {
        const initial=[...engine.queue];
        engine.start(0);
        for(let hit=0;hit<retry%17;hit++) engine.input(engine.queue[0],hit);
        const progressed=[...engine.queue];
        const next=nextAttempt(base,index,initial,progressed);
        expect(next.index).toBeGreaterThan(index);
        expect(next.seed).toBe(attemptSeed(base,next.index));
        index=next.index;
        engine=new PangEngine(next.seed);
        expect(engine.queue).not.toEqual(initial);
        expect(engine.queue).not.toEqual(progressed);
        expect(engine.queue.join(',')).not.toMatch(/(monkey,){4}monkey|(tiger,){4}tiger/);
      }
    }
  });
  it('preserves initial challenges and rejects invalid attempt indices',()=>{
    expect(attemptSeed(42,0)).toBe(42);
    expect(attemptSeed(42,1)).toBe(attemptSeed(42,1));
    expect(attemptSeed(42,0xffffffff)).toBeGreaterThan(0);
    for(const index of [-1,0.5,NaN,Infinity,0x100000000]) expect(()=>attemptSeed(42,index)).toThrow(RangeError);
  });
});

describe("40-second rules", () => {
  it('caps consecutive animals at four across the initial tower and every refill',()=>{
    let longest = 0;
    for (let seed=1;seed<=128;seed++) {
      const engine = new PangEngine(seed);
      const sequence = [...engine.queue];
      engine.start(0);
      for (let i=0;i<2500;i++) {
        engine.input(engine.queue[0],i);
        sequence.push(engine.queue.at(-1)!);
      }
      let streak=0;
      for (let i=0;i<sequence.length;i++) {
        streak = sequence[i] === sequence[i-1] ? streak+1 : 1;
        longest = Math.max(longest,streak);
        if (streak>4) throw new Error(`Seed ${seed}: ${streak} consecutive animals at ${i}`);
      }
    }
    expect(longest).toBe(4);
    expect(new PangEngine(1).queue).toEqual(['tiger','tiger','tiger','tiger','monkey','monkey']);
    expect(new PangEngine(1,{maxConsecutive:0}).queue.slice(0,5)).toEqual(Array(5).fill('tiger'));
  });
  it("does not accept input before starting, and only starts once", () => {
    const engine = new PangEngine(1, {}, ["monkey", "tiger"]);
    expect(engine.input("monkey", 20)).toBe("inactive");
    expect(engine.score).toBe(0);
    engine.start(1000);
    engine.start(20000);
    expect(engine.deadline).toBe(41000);
    expect(engine.input("monkey", 1000)).toBe("correct");
    expect(engine.score).toBe(10);
    expect(engine.queue[0]).toBe("tiger");
  });
  it("leaves the missed piece in place, consumes wall-clock time, and drops locked inputs", () => {
    const engine = new PangEngine(42, {}, ["monkey", "tiger", "monkey"]);
    engine.start(100);
    engine.input("monkey", 110);
    expect(engine.input("monkey", 200)).toBe("wrong");
    expect(engine.input("tiger", 849)).toBe("locked");
    expect(engine.queue[0]).toBe("tiger");
    expect(engine.combo).toBe(0);
    expect(engine.score).toBe(10);
    expect(engine.remaining(849)).toBe(39251);
    expect(engine.input("tiger", 850)).toBe("correct");
    expect(engine.score).toBe(20);
    expect(engine.hits).toBe(2);
    expect(engine.misses).toBe(1);
    expect(engine.maxCombo).toBe(1);
  });
  it("awards configured combo points without an animation cooldown", () => {
    const engine = new PangEngine(42);
    engine.start(0);
    for (let i = 0; i < 12; i++)
      expect(engine.input(engine.queue[0], 10)).toBe("correct");
    expect(engine.score).toBe(135); // 9 × 10, then 3 × 15.
    expect(engine.maxCombo).toBe(12);
    expect(engine.hits).toBe(12);
  });
  it("accepts just before expiry and rejects at and after expiry even without a render frame", () => {
    const engine = new PangEngine(1, {}, ["monkey", "tiger"]);
    engine.start(1000);
    expect(engine.input("monkey", 40999.99)).toBe("correct");
    expect(engine.input("tiger", 41000)).toBe("expired");
    expect(engine.input("tiger", 41001)).toBe("expired");
    expect(engine.result).toMatchObject({
      score: 10,
      hits: 1,
      elapsedMs: 40000,
      reason: "time",
      eligible: true,
    });
  });
  it("expires while locked, and cannot change a finished result", () => {
    const engine = new PangEngine(1, {}, ["monkey"]);
    engine.start(0);
    engine.input("tiger", 39900);
    engine.advance(40000);
    const result = structuredClone(engine.result);
    engine.finish("quit", 99999);
    engine.input("monkey", 99999);
    expect(engine.result).toEqual(result);
    expect(engine.result?.misses).toBe(1);
  });
  it("marks background interruption ineligible; an already expired run remains eligible", () => {
    const engine = new PangEngine(1);
    engine.start(0);
    engine.finish("background", 12000);
    expect(engine.result).toMatchObject({
      elapsedMs: 12000,
      reason: "background",
      eligible: false,
    });
    const expired = new PangEngine(1);
    expired.start(0);
    expired.finish("background", 45000);
    expect(expired.result).toMatchObject({
      elapsedMs: 40000,
      reason: "time",
      eligible: true,
    });
  });
  it("supports rule replacement and caps bonus steps", () => {
    const engine = new PangEngine(1, {
      basePoints: 1,
      comboStep: 2,
      comboBonus: 2,
      maxBonusSteps: 1,
    });
    engine.start(0);
    for (let i = 0; i < 6; i++) engine.input(engine.queue[0], i);
    expect(engine.score).toBe(16);
  });
  it("bounds the diagnostic log and keeps processing input", () => {
    const engine = new PangEngine(1, { logLimit: 3 });
    engine.start(0);
    for (let i = 0; i < 10; i++) engine.input(engine.queue[0], i);
    expect(engine.log).toHaveLength(3);
    expect(engine.hits).toBe(10);
  });
  it("replays the same recorded inputs identically at 30 / 60 / 120 fps", () => {
    const inputs: { at: number; animal: Animal }[] = [
      { at: 1, animal: "monkey" },
      { at: 12, animal: "tiger" },
      { at: 24, animal: "tiger" },
      { at: 675, animal: "monkey" },
      { at: 740, animal: "tiger" },
      { at: 920, animal: "monkey" },
      { at: 39000, animal: "tiger" },
      { at: 39999, animal: "monkey" },
      { at: 40000, animal: "tiger" },
      { at: 40001, animal: "tiger" },
    ];
    const replay = (fps: number) => {
      const engine = new PangEngine(42, {}, [
        "monkey",
        "tiger",
        "monkey",
        "tiger",
        "monkey",
        "tiger",
      ]);
      engine.start(0);
      const events = inputs.map((input) => ({
        at: input.at,
        animal: input.animal as Animal | undefined,
      }));
      for (let at = 0; at <= 40010; at += 1000 / fps)
        events.push({ at, animal: undefined });
      events.sort((a, b) => a.at - b.at);
      for (const event of events) {
        if (event.animal) engine.input(event.animal, event.at);
        else engine.advance(event.at);
      }
      return { result: engine.result, queue: engine.queue, log: engine.log };
    };
    expect(replay(30)).toEqual(replay(60));
    expect(replay(120)).toEqual(replay(60));
    // Two correct taps, one miss, then five correct taps after the 650 ms lock.
    expect(replay(60).result).toMatchObject({
      hits: 7,
      misses: 1,
      score: 70,
      maxCombo: 5,
      elapsedMs: 40000,
    });
  });
  it("creates independent clocks and scores for 25 retries", () => {
    for (let i = 0; i < 25; i++) {
      const engine = new PangEngine(42);
      engine.start(i * 100000);
      engine.input(engine.queue[0], i * 100000 + 10);
      engine.advance(i * 100000 + 40000);
      expect(engine.result).toMatchObject({
        score: 10,
        hits: 1,
        misses: 0,
        elapsedMs: 40000,
      });
    }
  });
});

describe("device-local persistence", () => {
  const fake = (data: string | null): StorageLike => ({
    getItem: () => data,
    setItem: (_key, next) => {
      data = next;
    },
  });
  it("saves and loads best, volume, mute, music, and AutoReset", () => {
    const backend = fake(null);
    const first = new PangStorage(backend);
    expect(
      first.update({ best: 1900, volume: 0.7, muted: true, music: false, autoReset: true }),
    ).toBe(true);
    expect(new PangStorage(backend).value).toMatchObject({
      best: 1900,
      volume: 0.7,
      muted: true,
      music: false,
      autoReset: true,
    });
    expect(STORAGE_KEY).toBe("jungle-pang:v1");
  });
  it("recovers from malformed and invalid saved data", () => {
    expect(new PangStorage(fake("{broken")).value.best).toBe(0);
    const invalid = new PangStorage(
      fake('{"best":-10,"volume":12,"muted":"false","music":null,"autoReset":"true"}'),
    );
    expect(invalid.value).toMatchObject({
      best: 0,
      volume: 1,
      muted: false,
      music: true,
      autoReset: false,
    });
    expect(new PangStorage(fake("null")).value.best).toBe(0);
  });
  it("keeps the game and session record usable when storage access is blocked", () => {
    const store = new PangStorage({
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("full");
      },
    });
    expect(store.available).toBe(false);
    expect(store.update({ best: 120 })).toBe(false);
    expect(store.value.best).toBe(120);
    expect(new PangStorage(null).update({ muted: true })).toBe(false);
  });
  it('persists animal choices and rejects corrupt or duplicate selections',()=>{
    const backend=fake(null);
    const store=new PangStorage(backend);
    store.update({randomAnimals:false,animals:{left:'frog',right:'chick'}});
    expect(new PangStorage(backend).value).toMatchObject({randomAnimals:false,animals:{left:'frog',right:'chick'}});
    for(const animals of [{left:'frog',right:'frog'},{left:'broken',right:'tiger'}]) {
      const recovered=new PangStorage(fake(JSON.stringify({animals})));
      expect(recovered.value.animals).toEqual({left:'monkey',right:'elephant'});
    }
  });
});
