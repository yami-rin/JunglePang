import { afterEach, describe, expect, it, vi } from 'vitest';
import { AutoInput } from '../src/auto-input';
import { PangStorage } from '../src/storage';

afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

describe('real-time automatic button activation', () => {
  it('paces real callbacks and cancels all future input on stop', () => {
    vi.useFakeTimers({toFake:['setTimeout','clearTimeout','performance']});
    const driver = new AutoInput();
    const at: number[] = [];
    driver.start(15, () => { at.push(performance.now()); return true; });
    vi.advanceTimersByTime(1000);
    expect(at.length).toBeGreaterThanOrEqual(14);
    expect(at.length).toBeLessThanOrEqual(16);
    for (let i=1; i<at.length; i++) expect(at[i]-at[i-1]).toBeGreaterThanOrEqual(1000/15);
    driver.stop();
    vi.advanceTimersByTime(5000);
    expect(at.length).toBeLessThanOrEqual(16);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('does not catch up with fabricated taps after a delayed task', () => {
    vi.useFakeTimers({toFake:['setTimeout','clearTimeout','performance']});
    const driver = new AutoInput();
    const activate = vi.fn(() => true);
    driver.start(60, activate);
    vi.advanceTimersByTime(1);
    expect(activate).toHaveBeenCalledTimes(1);
    const now = vi.spyOn(performance, 'now').mockReturnValue(10000);
    vi.advanceTimersByTime(17);
    expect(activate).toHaveBeenCalledTimes(2);
    now.mockRestore();
    driver.stop();
  });

  it('stops when the page no longer accepts input and drops stale callbacks when restarted inside one', () => {
    vi.useFakeTimers({toFake:['setTimeout','clearTimeout','performance']});
    const driver = new AutoInput();
    const stopped = vi.fn(() => false);
    driver.start(60, stopped);
    vi.advanceTimersByTime(100);
    expect(stopped).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
    const next = vi.fn(() => true);
    const old = vi.fn(() => { driver.start(1, next); return true; });
    driver.start(120, old);
    vi.advanceTimersByTime(500);
    expect(old).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(1);
    driver.stop();
  });
});

it('remembers speed without enabling automation, and rejects corrupt speeds', () => {
  let data: string | null = null;
  const backend = {getItem:()=>data,setItem:(_key:string,next:string)=>{data=next;}};
  new PangStorage(backend).update({autoInputRate:'max',best:135});
  expect(new PangStorage(backend).value).toMatchObject({autoInputRate:'max',best:135});
  for (const rate of [0,-1,1000000,'60','broken',null]) {
    data=JSON.stringify({autoInputRate:rate});
    expect(new PangStorage(backend).value.autoInputRate).toBe(60);
  }
});
