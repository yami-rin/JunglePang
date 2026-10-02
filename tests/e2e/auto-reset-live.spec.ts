import { test, expect } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import config from '../../src/ranking-config.json' with {type:'json'};

test.use({trace:'off'});
test('live: fresh AutoReset attempts complete and register in the original device category',async({page,request,isMobile},testInfo)=>{
  test.skip(process.env.PANG_RANKING_LIVE!=='1','Opt-in real registration; remove only these test identities afterward');
  test.setTimeout(75000);
  await page.goto('./');
  await page.locator('#settings').click();
  await page.locator('#auto-reset').check();
  await page.getByRole('button',{name:'とじる',exact:true}).click();
  await page.locator('#start').click();
  await expect(page.locator('#app')).toHaveAttribute('data-screen','playing');
  const id=await page.evaluate(()=>JSON.parse(localStorage.getItem('jungle-pang:ranking-v2')??'{}').id);
  expect(id).toMatch(/^[a-f0-9-]{36}$/);
  const device=isMobile?'mobile':'pc';
  const nickname=isMobile?'再開確認スマホ':'再開確認PC';
  await writeFile(`test-results/autoreset-smoke-player-${testInfo.project.name}.json`,JSON.stringify({id,device,nickname}));
  const tower=()=>page.locator('.tower-piece').evaluateAll(nodes=>nodes.map(node=>(node as HTMLImageElement).src));
  const left=await page.locator('#monkey img').getAttribute('src');
  const right=await page.locator('#tiger img').getAttribute('src');
  const tap=async(correct:boolean)=>{
    const target=await page.locator('.tower-piece').first().getAttribute('src');
    const button=page.locator((target===left)===correct?'#monkey':'#tiger');
    if(isMobile) await button.tap();else await button.click();
  };
  let previousInitial=await tower();
  for(let i=0;i<3;i++) {
    await tap(true);
    await expect(page.locator('#score')).toHaveText('10');
    const before=await tower();
    await tap(false);
    await expect(page.locator('#score')).toHaveText('0');
    await expect(page.locator('#time')).toHaveText('40s');
    await expect(page.locator('#countdown')).toBeHidden();
    const after=await tower();
    expect(after).not.toEqual(previousInitial);
    expect(after).not.toEqual(before);
    previousInitial=after;
    await expect(page.locator('#monkey img')).toHaveAttribute('src',left!);
    await expect(page.locator('#tiger img')).toHaveAttribute('src',right!);
  }
  for(let i=0;i<12;i++) await tap(true);
  await expect(page.locator('#score')).toHaveText('135');
  await expect(page.locator('#result-screen')).toBeVisible({timeout:45000});
  await expect(page.locator('#ranking-form')).toBeVisible();
  await page.locator('#nickname').fill(nickname);
  const submission=page.waitForRequest(value=>value.url()===config.apiURL+'/api/scores' && value.method()==='POST');
  await page.locator('#submit-score').click();
  const payload=(await submission).postDataJSON();
  expect(payload.attempt).toBeGreaterThanOrEqual(3);
  expect(payload.inputs).toHaveLength(12);
  await expect(page.locator('#ranking-status')).toContainText('登録しました',{timeout:12000});
  for(const category of ['all',device]) {
    const response=await request.get(`${config.apiURL}/api/ranking?category=${category}`);
    const data=await response.json();
    expect(data.entries.find((entry:{id:string})=>entry.id===id)).toMatchObject({nickname,score:135,hits:12,max_combo:12});
  }
});
