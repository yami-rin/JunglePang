import { test, expect } from "@playwright/test";

test("public entry loads without login and accepts a native tap", async ({ page, isMobile }) => {
  const errors: string[] = [];
  const failedRequests: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("requestfailed", request => failedRequests.push(request.url()));
  page.on("response", response => {
    if (response.status() >= 400) failedRequests.push(`${response.status()} ${response.url()}`);
  });
  const response = await page.goto("./");
  expect(response?.status()).toBe(200);
  await expect(page.locator("#start")).toBeEnabled();
  // Regular visitors never need the diagnostics used by the game regression tests.
  expect(await page.evaluate(() => "__pang" in window)).toBe(false);
  const button = page.locator("#start");
  if (isMobile) await button.tap();
  else await button.click();
  await expect(page.locator("#app")).toHaveAttribute("data-screen", "playing");
  const animal = page.locator("#monkey");
  if (isMobile) await animal.tap();
  else await animal.click();
  // A random first animal is either scored or reported as a miss immediately.
  await expect.poll(async () =>
    await page.locator("#score").textContent() === "10" || await page.locator("#lock").isVisible()
  ).toBe(true);
  expect(errors).toEqual([]);
  expect(failedRequests).toEqual([]);
});
