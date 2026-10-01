import { test, expect } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import config from '../../src/ranking-config.json' with { type: 'json' };

// Authenticated live requests must not leave participant tokens in trace artifacts.
test.use({trace:'off'});

test('national ranking loads safely and recovers after a network failure', async ({page})=>{
  let requests=0;
  await page.route(`${config.apiURL}/api/ranking*`,async route=>{
    requests++;
    if(requests===1) return route.abort();
    return route.fulfill({json:{entries:[{id:'sample',nickname:'<img src=x>',score:120,rank:1}]}});
  });
  await page.goto('./');
  await page.locator('#ranking').click();
  await expect(page.locator('#ranking-load-status')).toContainText('通信できません');
  await page.locator('#refresh-ranking').click();
  await expect(page.locator('#ranking-list')).toContainText('<img src=x>');
  await expect(page.locator('#ranking-list img')).toHaveCount(0);
  await page.getByRole('button',{name:'ランキングを閉じる'}).click();
  await expect(page.locator('#start')).toBeEnabled();
});

test('ranking unavailable never prevents a complete local game',async({page})=>{
  await page.route(`${config.apiURL}/api/**`,route=>route.abort());
  await page.goto('./');
  await page.locator('#start').click();
  await expect(page.locator('#app')).toHaveAttribute('data-screen','playing');
  const target=await page.locator('.tower-piece').first().getAttribute('src');
  const left=await page.locator('#monkey img').getAttribute('src');
  await page.locator(target===left?'#monkey':'#tiger').click();
  await expect(page.locator('#score')).toHaveText('10');
  await page.locator('#home').click();
  await expect(page.locator('#result-screen')).toBeVisible();
  await expect(page.locator('#ranking-form')).toBeHidden();
  await expect(page.locator('#ranking-status')).toContainText('中断');
});

test('live: completed round registers in overall and the detected device category',async({page,request,isMobile},testInfo)=>{
  test.skip(process.env.PANG_RANKING_LIVE!=='1','Opt-in production API smoke, followed by deletion of only this test identity');
  test.setTimeout(75000);
  await page.goto('./');
  await page.locator('#start').click();
  await expect(page.locator('#app')).toHaveAttribute('data-screen','playing');
  const id=await page.evaluate(()=>JSON.parse(localStorage.getItem('jungle-pang:ranking-v2')??'{}').id);
  expect(id).toMatch(/^[a-f0-9-]{36}$/);
  const device=isMobile?'mobile':'pc';
  const nickname=isMobile?'公開確認スマホ':'公開確認PC';
  await writeFile(`test-results/ranking-smoke-player-${testInfo.project.name}.json`,JSON.stringify({id,device,nickname}));
  for(let i=0;i<12;i++) {
    const target=await page.locator('.tower-piece').first().getAttribute('src');
    const left=await page.locator('#monkey img').getAttribute('src');
    const button=page.locator(target===left?'#monkey':'#tiger');
    if(isMobile) await button.tap(); else await button.click();
  }
  await expect(page.locator('#score')).toHaveText('135');
  await expect(page.locator('#result-screen')).toBeVisible({timeout:45000});
  await expect(page.locator('#ranking-form')).toBeVisible();
  await page.locator('#nickname').fill(nickname);
  await page.locator('#submit-score').click();
  await expect(page.locator('#ranking-status')).toContainText('登録しました',{timeout:12000});
  await expect(page.locator('#ranking-status')).toContainText(isMobile?'スマホ':'PC');
  // Independent request context has no browser identity/token.
  for(const category of ['all',device]) {
    const response=await request.get(`${config.apiURL}/api/ranking?category=${category}`);
    expect(response.ok()).toBe(true);
    const entries=(await response.json()).entries;
    expect(entries.find((entry:{id:string})=>entry.id===id)).toMatchObject({nickname,score:135,hits:12,max_combo:12});
  }
  const other=await request.get(`${config.apiURL}/api/ranking?category=${isMobile?'pc':'mobile'}`);
  expect((await other.json()).entries.some((entry:{id:string})=>entry.id===id)).toBe(false);
  await page.locator('#result-screen .ranking-open').click();
  await page.getByRole('tab',{name:isMobile?'スマホ':'PC',exact:true}).click();
  await expect(page.locator('#ranking-list')).toContainText(nickname);
  await page.screenshot({path:`test-results/ranking-live-${device}.png`,scale:'css'});
});
