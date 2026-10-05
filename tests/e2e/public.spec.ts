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

test('the former auto-input URL opens regular play with no automation controls',async({page,isMobile})=>{
  await page.goto('./?tool=auto-input');
  await expect(page.locator('#start')).toBeEnabled();
  await expect(page.locator('#title-screen')).toBeVisible();
  expect(await page.evaluate(()=>document.querySelectorAll('[id*="auto-input"]').length)).toBe(0);
  await expect(page.locator('#title-screen')).not.toContainText('自動入力');
  // A deterministic local round avoids writing any production ranking data.
  await page.goto('./?tool=auto-input&debug=1');
  await expect(page.locator('#start')).toBeEnabled();
  await page.locator('#start').click();
  await expect(page.locator('#app')).toHaveAttribute('data-screen','playing');
  await page.waitForTimeout(300);
  await expect(page.locator('#score')).toHaveText('0');
  const target=await page.locator('.tower-piece').first().getAttribute('src');
  const left=await page.locator('#monkey img').getAttribute('src');
  const button=page.locator(target===left?'#monkey':'#tiger');
  if(isMobile) await button.tap(); else await button.click();
  await expect(page.locator('#score')).toHaveText('10');
  await page.evaluate(()=>window.__pang.expire());
  await expect(page.locator('#result-heading')).toHaveText('結果');
  await expect(page.locator('#best')).toHaveText('10');
});
