import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

test('performance sample: identical six-second input and frame workload', async ({ page }, testInfo) => {
  await page.goto('./?debug=1');
  await expect(page.locator('#start')).toBeEnabled();
  const sample = await page.evaluate(async () => {
    const durations: number[] = [];
    const frames: number[] = [];
    let last = performance.now();
    let active = true;
    const frame = (now: number) => {
      frames.push(now - last);
      last = now;
      if (active) requestAnimationFrame(frame);
    };
    window.__pang.reset(123);
    requestAnimationFrame(frame);
    const started = performance.now();
    for (let i = 0; i < 90; i++) {
      const button = document.getElementById(window.__pang.snapshot().queue[0])!;
      const before = performance.now();
      button.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 8, button: 0 }));
      button.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 8, button: 0 }));
      durations.push(performance.now() - before);
      await new Promise(resolve => setTimeout(resolve, Math.max(0, started + (i + 1) * 1000 / 15 - performance.now())));
    }
    active = false;
    const percentile = (values: number[], fraction: number) => [...values].sort((a,b) => a-b)[Math.floor((values.length - 1) * fraction)];
    return {
      hits: window.__pang.snapshot().hits,
      inputMs: { median: percentile(durations, .5), p95: percentile(durations, .95), max: Math.max(...durations) },
      frameMs: { median: percentile(frames.slice(1), .5), p95: percentile(frames.slice(1), .95), max: Math.max(...frames.slice(1)) },
      frames: frames.length,
      jsHeapBytes: (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize,
    };
  });
  expect(sample.hits).toBe(90);
  await mkdir('artifacts', { recursive: true });
  await writeFile(`artifacts/performance-${process.env.PANG_PERF_LABEL ?? 'latest'}-${testInfo.project.name}.json`, JSON.stringify(sample, null, 2));
});
