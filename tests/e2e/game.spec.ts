import { test, expect, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
const evidenceDir = process.env.PANG_EVIDENCE_DIR ?? "artifacts";

interface Snapshot {
  phase: string;
  screen: string;
  queue: ("monkey" | "tiger")[];
  score: number;
  combo: number;
  hits: number;
  misses: number;
  remaining: number;
  gameObjects: number;
  result: { score: number; eligible: boolean; reason: string } | null;
  log: unknown[];
  renderTarget: string;
  tower: { animal: string; y: number; restY: number }[];
}
declare global {
  interface Window {
    __pang: {
      snapshot(): Snapshot;
      reset(seed?: number): void;
      expire(): void;
      background(): void;
      audio(): { unavailable: boolean };
    };
  }
}
const snap = (page: Page) => page.evaluate(() => window.__pang.snapshot());
const correctTap = async (page: Page) => {
  const { queue } = await snap(page);
  // Pointer down/up followed by a compatibility click: one input only.
  const button = page.locator(`#${queue[0]}`);
  await button.dispatchEvent("pointerdown", {
    pointerId: 1,
    pointerType: "touch",
    button: 0,
  });
  await button.dispatchEvent("pointerup", {
    pointerId: 1,
    pointerType: "touch",
    button: 0,
  });
  await button.dispatchEvent("click", { detail: 1 });
};

test.beforeEach(async ({ page }) => {
  // Keep the deployment's directory (for example /JunglePang/ on Pages).
  await page.goto("./?debug=1");
  await expect(page.locator("#start")).toBeEnabled();
});

test("real start → 40 seconds → result → retry → saved personal best", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.locator("#start").click();
  await expect(page.locator("#app")).toHaveAttribute("data-screen", "playing");
  const first = await snap(page);
  expect(first.remaining).toBeGreaterThan(38000);
  for (let i = 0; i < 5; i++) await correctTap(page);
  await expect(page.locator("#score")).toHaveText("50");
  await expect(page.locator("#result-screen")).toBeVisible({ timeout: 45000 });
  expect((await snap(page)).result).toMatchObject({
    score: 50,
    eligible: true,
    reason: "time",
  });
  await expect(page.locator("#new-best")).toBeVisible();
  await expect(page.locator("#result-score")).toHaveText("50");
  await page.locator("#retry").click();
  await expect(page.locator("#app")).toHaveAttribute("data-screen", "playing");
  expect((await snap(page)).score).toBe(0);
  expect((await snap(page)).remaining).toBeGreaterThan(38000);
  await page.reload();
  await expect(page.locator("#title-best")).toHaveText("50");
  expect(errors).toEqual([]);
});

test("pointer compatibility, holds, multiple fingers, slide-in, and keyboard repeat", async ({
  page,
}) => {
  await page.evaluate(() => window.__pang.reset(42));
  await correctTap(page);
  expect((await snap(page)).hits).toBe(1);
  const queue = (await snap(page)).queue;
  const selected = page.locator(`#${queue[0]}`);
  await selected.dispatchEvent("pointerdown", {
    pointerId: 2,
    pointerType: "touch",
    button: 0,
  });
  await selected.dispatchEvent("pointerdown", {
    pointerId: 2,
    pointerType: "touch",
    button: 0,
  });
  expect((await snap(page)).hits).toBe(2);
  await selected.dispatchEvent("pointercancel", { pointerId: 2 });
  const next = page.locator(`#${(await snap(page)).queue[0]}`);
  await next.dispatchEvent("pointerenter", {
    pointerId: 3,
    pointerType: "touch",
  });
  expect((await snap(page)).hits).toBe(2);
  // A different finger is accepted while another is held.
  await next.dispatchEvent("pointerdown", {
    pointerId: 4,
    pointerType: "touch",
    button: 0,
  });
  expect((await snap(page)).hits).toBe(3);
  await next.dispatchEvent("pointerup", { pointerId: 4 });
  const key =
    (await snap(page)).queue[0] === "monkey" ? "ArrowLeft" : "ArrowRight";
  await page.keyboard.down(key);
  await page.keyboard.down(key);
  expect((await snap(page)).hits).toBe(4);
  await page.keyboard.up(key);
  // Native Enter on a focused animal also counts once when held.
  await page.locator(`#${(await snap(page)).queue[0]}`).focus();
  await page.keyboard.down("Enter");
  await page.keyboard.down("Enter");
  await page.keyboard.up("Enter");
  expect((await snap(page)).hits).toBe(5);
});

test("a miss keeps the target, drops taps while locked, and time continues", async ({
  page,
}) => {
  await page.evaluate(() => window.__pang.reset(42));
  const before = await snap(page);
  const wrong = before.queue[0] === "monkey" ? "tiger" : "monkey";
  await page.locator(`#${wrong}`).dispatchEvent("click", { detail: 0 });
  await expect(page.locator("#lock")).toBeVisible();
  await correctTap(page);
  const locked = await snap(page);
  expect(locked.hits).toBe(0);
  expect(locked.misses).toBe(1);
  expect(locked.queue).toEqual(before.queue);
  expect(locked.remaining).toBeLessThan(before.remaining);
  await expect(page.locator("#lock")).toBeHidden();
  await correctTap(page);
  expect((await snap(page)).score).toBe(10);
});

test("native mouse or touchscreen input advances exactly once and matches the visible target", async ({
  page,
  isMobile,
}) => {
  await page.evaluate(() => window.__pang.reset(42));
  for (let i = 0; i < 12; i++) {
    const state = await snap(page);
    expect(state.renderTarget).toBe(state.queue[0]);
    const button = page.locator(`#${state.queue[0]}`);
    if (isMobile) await button.tap();
    else await button.click();
    const after = await snap(page);
    expect(after.hits).toBe(i + 1);
    expect(after.misses).toBe(0);
    expect(after.renderTarget).toBe(after.queue[0]);
  }
});

test("bottom row falls with the tower while accepting the next tap", async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.reload();
  await expect(page.locator("#start")).toBeEnabled();
  const motion = await page.evaluate(async () => {
    window.__pang.reset(42);
    const press = () => {
      const animal = window.__pang.snapshot().queue[0];
      const button = document.getElementById(animal)!;
      button.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerId: 8, pointerType: "touch", button: 0 }));
      button.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerId: 8, pointerType: "touch", button: 0 }));
      return window.__pang.snapshot();
    };
    const before = window.__pang.snapshot();
    const first = press();
    // A second tap in the same JS turn arrives before any animation frame.
    const second = press();
    const samples = [{ elapsed: 0, y: second.tower[0].y }];
    const begin = performance.now();
    while (performance.now() - begin < 180) {
      await new Promise(requestAnimationFrame);
      samples.push({ elapsed: performance.now() - begin, y: window.__pang.snapshot().tower[0].y });
    }
    return { before, first, second, samples, settled: window.__pang.snapshot() };
  });
  expect(motion.first.tower[0].y).toBeLessThan(motion.first.tower[0].restY - 1);
  expect(motion.first.tower.every(piece => piece.y < piece.restY - 1)).toBe(true);
  expect(motion.first.tower[0].animal).toBe(motion.first.queue[0]);
  expect(motion.second.hits).toBe(2);
  expect(motion.second.misses).toBe(0);
  expect(motion.second.renderTarget).toBe(motion.second.queue[0]);
  expect(motion.samples.some(sample => sample.y > motion.samples[0].y + 1)).toBe(true);
  expect(motion.settled.tower[0].y).toBeCloseTo(motion.settled.tower[0].restY, 2);
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(`${evidenceDir}/fall-${testInfo.project.name}.json`, JSON.stringify(motion, null, 2));
});

test("bottom row respects reduced motion without delaying scoring", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.reload();
  await expect(page.locator("#start")).toBeEnabled();
  await page.evaluate(() => window.__pang.reset(42));
  await correctTap(page);
  const state = await snap(page);
  expect(state.hits).toBe(1);
  expect(state.tower.every(piece => piece.y === piece.restY)).toBe(true);
  expect(state.renderTarget).toBe(state.queue[0]);
});

test("15 inputs per second do not double-count or lose taps", async ({
  page,
  browserName,
}, testInfo) => {
  await page.evaluate(() => window.__pang.reset(123));
  await page.evaluate(async () => {
    const total = 90;
    const begin = performance.now();
    for (let i = 0; i < total; i++) {
      const target = document.getElementById(
        window.__pang.snapshot().queue[0],
      )!;
      target.dispatchEvent(
        new PointerEvent("pointerdown", {
          bubbles: true,
          pointerId: 7,
          pointerType: "touch",
          button: 0,
        }),
      );
      target.dispatchEvent(
        new PointerEvent("pointerup", {
          bubbles: true,
          pointerId: 7,
          pointerType: "touch",
          button: 0,
        }),
      );
      target.dispatchEvent(
        new MouseEvent("click", { bubbles: true, detail: 1 }),
      );
      const delay = begin + ((i + 1) * 1000) / 15 - performance.now();
      await new Promise((resolve) => setTimeout(resolve, Math.max(0, delay)));
    }
  });
  const state = await snap(page);
  expect(state.hits).toBe(90);
  expect(state.misses).toBe(0);
  expect(state.log).toHaveLength(90);
  expect(state.score).toBe(2580);
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(
    `${evidenceDir}/input-${testInfo.project.name}.json`,
    JSON.stringify(
      {
        testedAt: new Date().toISOString(),
        browserName,
        project: testInfo.project.name,
        seed: 123,
        inputHz: 15,
        inputs: 90,
        result: state,
      },
      null,
      2,
    ),
  );
});

test("background interruption ends the round without saving its score", async ({
  page,
}) => {
  await page.evaluate(() => window.__pang.reset(42));
  await correctTap(page);
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await expect(page.locator("#result-screen")).toBeVisible();
  expect((await snap(page)).result).toMatchObject({
    score: 10,
    reason: "background",
    eligible: false,
  });
  expect(await page.locator("#result-best").textContent()).toBe("0");
});

test("20 retries keep one input binding and a fixed render-object count; no scoring after expiry", async ({
  page,
}) => {
  const count = (await snap(page)).gameObjects;
  for (let i = 0; i < 20; i++) {
    await page.evaluate((seed) => window.__pang.reset(seed), i + 1);
    await correctTap(page);
    expect((await snap(page)).hits).toBe(1);
    await page.evaluate(() => window.__pang.expire());
    expect((await snap(page)).gameObjects).toBe(count);
    await page.locator("#monkey").dispatchEvent("click", { detail: 0 });
    expect((await snap(page)).score).toBe(10);
  }
});

test("sound preferences survive reload; corrupt or unavailable storage does not prevent play", async ({
  page,
}) => {
  await page.locator("#sound").click();
  await page.locator("#settings").click();
  await page.locator("#volume").fill("23");
  await page.locator("#music").uncheck();
  await page.getByRole("button", { name: "設定を閉じる" }).click();
  await page.reload();
  await expect(page.locator("#start")).toBeEnabled();
  await expect(page.locator("#sound")).toHaveAttribute("aria-pressed", "true");
  await page.locator("#settings").click();
  await expect(page.locator("#volume")).toHaveValue("23");
  await expect(page.locator("#music")).not.toBeChecked();
  await page.getByRole("button", { name: "設定を閉じる" }).click();
  await page.evaluate(() => localStorage.setItem("jungle-pang:v1", "{broken"));
  await page.reload();
  await expect(page.locator("#start")).toBeEnabled();
  await expect(page.locator("#title-best")).toHaveText("0");
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      get: () => {
        throw new Error("blocked");
      },
    });
  });
  await page.reload();
  await expect(page.locator("#start")).toBeEnabled();
  await expect(page.locator("#storage-note")).toBeVisible();
  await page.locator("#start").click();
  await expect(page.locator("#app")).toHaveAttribute("data-screen", "playing");
});

test("small and tall screens keep the tower and buttons visible, with no overflow", async ({
  page,
}) => {
  await mkdir(evidenceDir, { recursive: true });
  for (const size of [
    { width: 320, height: 568 },
    { width: 360, height: 640 },
    { width: 390, height: 844 },
    { width: 430, height: 932 },
  ]) {
    await page.setViewportSize(size);
    await expect(page.locator("#start")).toBeInViewport();
    await page.evaluate(() => window.__pang.reset(42));
    await expect(page.locator("#monkey")).toBeInViewport({ ratio: 1 });
    await expect(page.locator("#tiger")).toBeInViewport({ ratio: 1 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `${evidenceDir}/play-${size.width}x${size.height}.png`,
      scale: "css",
    });
    await page.locator("#home").click();
    await expect(page.locator("#result-screen")).toBeVisible();
    await expect(page.locator("#retry")).toBeInViewport();
    await page.locator("#back-to-title").click();
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: `${evidenceDir}/title-desktop.png`, scale: "css" });
  await page.locator("#app").screenshot({ path: `${evidenceDir}/title-preview.png`, scale: "css" });
});
