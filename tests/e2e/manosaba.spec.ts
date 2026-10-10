import { test, expect } from '@playwright/test';

test('every generated character can be used on either side of the tower', async ({page}) => {
  test.setTimeout(120000);
  for (const id of ['ema','hiro','annan','noah','reia','miria','margo','nanoka','arisa','sherie','hanna','koko','meruru']) {
    for (const side of ['left','right']) {
      await page.goto('./?debug=1');
      await page.locator('#choose-animals').click();
      // First select two original animals so the previous round cannot disable this choice.
      await page.locator('#animal-options-left label:has(input[value="monkey"])').click();
      await page.locator('#animal-options-right label:has(input[value="frog"])').click();
      await page.locator(`#animal-options-${side} label:has(input[value="${id}"])`).click();
      await page.getByRole('button',{name:'決定',exact:true}).click();
      await page.locator('#start').click();
      await expect(page.locator('#app')).toHaveAttribute('data-screen','playing');
      await page.evaluate(() => window.__pang.reset(42));
      const control=page.locator(side==='left'?'#monkey':'#tiger');
      await expect(control).toHaveAttribute('data-animal',id);
      const pieces=page.locator(`.tower-piece[src$="/${id}.png"]`);
      await expect(pieces.first()).toBeVisible();
      expect(await pieces.evaluateAll(nodes => nodes.every(node => (node as HTMLImageElement).naturalWidth===600))).toBe(true);
      const overflow=await page.evaluate(() => document.documentElement.scrollWidth>innerWidth);
      expect(overflow).toBe(false);
    }
  }
});

test('new portraits work in the picker, tower and controls', async ({page}, testInfo) => {
  await page.goto('./?debug=1');
  await page.locator('#choose-animals').click();
  for (const id of ['ema','hiro','annan','noah','reia','miria','margo','nanoka','arisa','sherie','hanna','koko','meruru']) {
    await expect(page.locator(`#animal-options-left input[value="${id}"]`)).toHaveCount(1);
    await expect(page.locator(`#animal-options-right input[value="${id}"]`)).toHaveCount(1);
    for (const side of ['left','right']) {
      const image = page.locator(`#animal-options-${side} label:has(input[value="${id}"]) img`);
      await expect(image).toHaveAttribute('src', new RegExp(`/${id}\\.png$`));
      await expect.poll(() => image.evaluate(node => (node as HTMLImageElement).naturalWidth)).toBe(600);
    }
  }
  await page.locator('#animals-dialog').screenshot({path:`artifacts/manosaba-picker-${testInfo.project.name}.png`});
  await page.locator('#animal-options-left label:has(input[value="ema"])').click();
  await page.locator('#animal-options-right label:has(input[value="hiro"])').click();
  await expect(page.locator('#animal-options-right input[value="ema"]')).toBeDisabled();
  await expect(page.locator('#animal-options-left input[value="ema"]')).toBeChecked();
  await page.getByRole('button',{name:'決定',exact:true}).click();
  await expect(page.locator('#animal-selection-summary')).toHaveText('エマ / ヒロ');
  await page.locator('#start').click();
  await expect(page.locator('#app')).toHaveAttribute('data-screen','playing');
  await expect(page.locator('#monkey')).toHaveAttribute('data-animal','ema');
  await expect(page.locator('#tiger')).toHaveAttribute('data-animal','hiro');
  await expect(page.locator('#monkey .animal-name')).toHaveText('エマ');
  await expect(page.locator('#tiger .animal-name')).toHaveText('ヒロ');
  await expect(page.locator('.tower-piece')).toHaveCount(6);
  expect(await page.locator('.tower-piece').evaluateAll(images => images.every(image => /\/(ema|hiro)\.png$/.test((image as HTMLImageElement).src) && (image as HTMLImageElement).naturalWidth > 0))).toBe(true);
  const first = await page.locator('.tower-piece').first().getAttribute('src');
  await page.locator(first?.endsWith('ema.png') ? '#monkey' : '#tiger').click();
  await expect(page.locator('#score')).toHaveText('10');
  await page.screenshot({path:`artifacts/manosaba-play-${testInfo.project.name}.png`});
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
});

test('a new portrait mixes with an animal and survives AutoReset', async ({page}, testInfo) => {
  await page.goto('./?debug=1');
  await page.locator('#choose-animals').click();
  await page.locator('#animal-options-left label:has(input[value="ema"])').click();
  await page.locator('#animal-options-right label:has(input[value="frog"])').click();
  await page.getByRole('button',{name:'決定',exact:true}).click();
  await page.locator('#settings').click();
  await page.locator('#auto-reset').check();
  await page.getByRole('button',{name:'とじる',exact:true}).click();
  await page.locator('#start').click();
  await expect(page.locator('#app')).toHaveAttribute('data-screen','playing');
  expect(await page.locator('.tower-piece').evaluateAll(images => images.every(image => /\/(ema\.png|frog\.svg)$/.test((image as HTMLImageElement).src)))).toBe(true);
  const first = await page.locator('.tower-piece').first().getAttribute('src');
  await page.locator(first?.endsWith('ema.png') ? '#monkey' : '#tiger').click();
  await expect(page.locator('#score')).toHaveText('10');
  await page.screenshot({path:`artifacts/manosaba-mixed-${testInfo.project.name}.png`});
  const next = await page.locator('.tower-piece').first().getAttribute('src');
  await page.locator(next?.endsWith('ema.png') ? '#tiger' : '#monkey').click();
  await expect(page.locator('#score')).toHaveText('0');
  await expect(page.locator('#monkey')).toHaveAttribute('data-animal','ema');
  await expect(page.locator('#tiger')).toHaveAttribute('data-animal','frog');
  await expect(page.locator('#app')).toHaveAttribute('data-screen','playing');
});
