import { test, expect } from '@playwright/test';
import config from '../../src/ranking-config.json' with {type:'json'};

test('ranking tabs filter the API, ignore stale responses, and support keyboard navigation',async({page})=>{
  await page.route(`${config.apiURL}/api/ranking*`,async route=>{
    const category=new URL(route.request().url()).searchParams.get('category');
    if(category==='all') await new Promise(resolve=>setTimeout(resolve,600));
    await route.fulfill({json:{entries:[{id:'sample',nickname:`記録-${category}`,score:120,rank:1}]}});
  });
  await page.goto('./');
  await page.locator('#ranking').click();
  await page.getByRole('tab',{name:'スマホ',exact:true}).click();
  await expect(page.locator('#ranking-list')).toContainText('記録-mobile');
  await page.waitForTimeout(700);
  await expect(page.locator('#ranking-list')).toContainText('記録-mobile');
  await page.getByRole('tab',{name:'PC',exact:true}).click();
  await expect(page.locator('#ranking-list')).toContainText('記録-pc');
  await expect(page.getByRole('tab',{name:'PC',exact:true})).toHaveAttribute('aria-selected','true');
  await page.getByRole('tab',{name:'PC',exact:true}).press('Home');
  await expect(page.locator('#ranking-list')).toContainText('記録-all');
  await expect(page.locator('#ranking-panel')).toHaveAttribute('aria-labelledby','ranking-tab-all');
});

test('chosen animals persist, match the tower and buttons, and can return to random mode',async({page,isMobile})=>{
  await page.goto('./?debug=1');
  await page.locator('#choose-animals').click();
  const left=page.locator('#animal-options-left label:has(input[value="frog"])');
  const right=page.locator('#animal-options-right label:has(input[value="chick"])');
  if(isMobile) { await left.tap(); await right.tap(); } else { await left.click(); await right.click(); }
  await expect(page.locator('#random-animals')).not.toBeChecked();
  await expect(page.locator('#animal-options-right input[value="frog"]')).toBeDisabled();
  await page.getByRole('button',{name:'決定',exact:true}).click();
  await expect(page.locator('#animal-selection-summary')).toHaveText('カエル / ヒヨコ');
  await page.reload();
  await expect(page.locator('#animal-selection-summary')).toHaveText('カエル / ヒヨコ');
  await expect(page.locator('#hero-left')).toHaveAttribute('src',/frog\.svg$/);
  await page.locator('#start').click();
  await expect(page.locator('#app')).toHaveAttribute('data-screen','playing');
  await expect(page.locator('#monkey')).toHaveAttribute('data-animal','frog');
  await expect(page.locator('#tiger')).toHaveAttribute('data-animal','chick');
  const target=await page.locator('.tower-piece').first().getAttribute('src');
  const button=page.locator(target?.endsWith('frog.svg')?'#monkey':'#tiger');
  if(isMobile) await button.tap(); else await button.click();
  await expect(page.locator('#score')).toHaveText('10');
  expect(await page.locator('.tower-piece').evaluateAll(images=>images.every(image=>/\/(frog|chick)\.svg$/.test((image as HTMLImageElement).src)))).toBe(true);
  await page.locator('#home').click();
  await expect(page.locator('#result-screen')).toBeVisible();
  await page.locator('#back-to-title').click();
  await page.locator('#choose-animals').click();
  await page.locator('#random-animals').check();
  await page.getByRole('button',{name:'決定',exact:true}).click();
  await page.reload();
  await expect(page.locator('#animal-selection-summary')).toHaveText('毎回ランダム');
});

test('refresh icon restarts immediately during play or countdown without saving the abandoned score',async({page,isMobile})=>{
  await page.goto('./?debug=1');
  await expect(page.locator('#quick-retry')).toBeHidden();
  await page.locator('#start').click();
  await expect(page.locator('#app')).toHaveAttribute('data-screen','playing');
  const target=await page.locator('.tower-piece').first().getAttribute('src');
  const left=await page.locator('#monkey img').getAttribute('src');
  const input=page.locator(target===left?'#monkey':'#tiger');
  if(isMobile) await input.tap(); else await input.click();
  await expect(page.locator('#score')).toHaveText('10');
  const retry=page.getByRole('button',{name:'すぐにやり直す',exact:true});
  if(isMobile) await retry.tap(); else await retry.click();
  await expect(page.locator('#app')).toHaveAttribute('data-screen','countdown');
  await expect(page.locator('#score')).toHaveText('0');
  await expect(page.locator('#best')).toHaveText('0');
  await expect(page.locator('#result-screen')).toBeHidden();
  await retry.click();
  await expect(page.locator('#app')).toHaveAttribute('data-screen','playing');
  const nextTarget=await page.locator('.tower-piece').first().getAttribute('src');
  const nextLeft=await page.locator('#monkey img').getAttribute('src');
  await page.locator(nextTarget===nextLeft?'#monkey':'#tiger').click();
  await expect(page.locator('#score')).toHaveText('10');
  expect(await page.evaluate(()=>window.__pang.snapshot().gameObjects)).toBe(17);
});
