import {test,expect,type Page} from '@playwright/test';
import config from '../../src/ranking-config.json' with {type:'json'};
import {PangEngine,RULES_VERSION} from '../../src/engine';
import {mkdir,writeFile} from 'node:fs/promises';

test.skip(process.env.PANG_LOCAL_AUTO_INPUT !== '1', '自動入力はローカルの開発サーバー専用');

declare global { interface Window { __autoInputTaps:number[]; } }

async function scoringState(page:Page) {
  const s=await page.evaluate(()=>window.__pang.snapshot());
  return {phase:s.phase,score:s.score,hits:s.hits,misses:s.misses,queue:s.queue,log:s.log,result:s.result};
}

async function startTool(page:Page,rate='60') {
  await page.goto('./?debug=1&tool=auto-input');
  await expect(page.locator('#auto-input-dialog')).toBeVisible();
  await page.locator('#auto-input-rate').selectOption(rate);
  await page.locator('#start-auto-input').click();
  await expect(page.locator('#app')).toHaveAttribute('data-screen','playing');
}

test('automatically activates the real correct buttons, changes speed, and stops immediately',async({page,isMobile})=>{
  await startTool(page,'15');
  await expect.poll(async()=>page.evaluate(()=>window.__pang.snapshot().hits)).toBeGreaterThan(12);
  const snapshot=await page.evaluate(()=>window.__pang.snapshot());
  expect(snapshot.misses).toBe(0);
  expect(snapshot.log.length).toBe(snapshot.hits);
  expect(snapshot.renderTarget).toBe(snapshot.queue[0]);
  expect(snapshot.gameObjects).toBe(17);
  await expect(page.locator('.animal-button.pressed').first()).toBeVisible();
  await page.locator('#auto-input-live-rate').selectOption('120');
  const before=(await page.evaluate(()=>window.__pang.snapshot())).hits;
  await expect.poll(async()=>page.evaluate(()=>window.__pang.snapshot().hits)).toBeGreaterThan(before+60);
  const stop=page.locator('#stop-auto-input');
  if(isMobile) await stop.tap(); else await stop.click();
  await expect(page.locator('#result-screen')).toBeVisible();
  await expect(page.locator('#result-heading')).toHaveText('自動入力の結果');
  await expect(page.locator('#result-auto-input')).toContainText('実測');
  await expect(page.locator('#ranking-form')).toBeHidden();
  const ended=await scoringState(page);
  await page.waitForTimeout(300);
  expect(await scoringState(page)).toEqual(ended);
  await expect(page.locator('#best')).toHaveText('0');
  await page.locator('#back-to-title').click();
  await page.reload();
  await expect(page.locator('#auto-input-rate')).toHaveValue('120');
});

test('fastest mode, retry, and background leave no running input tasks',async({page})=>{
  await startTool(page,'max');
  await expect.poll(async()=>page.evaluate(()=>window.__pang.snapshot().hits)).toBeGreaterThan(60);
  await page.locator('#quick-retry').click();
  await expect(page.locator('#app')).toHaveAttribute('data-screen','countdown');
  await expect(page.locator('#score')).toHaveText('0');
  await expect(page.locator('#best')).toHaveText('0');
  await expect(page.locator('#app')).toHaveAttribute('data-screen','playing');
  await expect.poll(async()=>page.evaluate(()=>window.__pang.snapshot().hits)).toBeGreaterThan(40);
  await page.evaluate(()=>window.__pang.background());
  await expect(page.locator('#result-screen')).toBeVisible();
  const ended=await scoringState(page);
  await page.waitForTimeout(300);
  expect(await scoringState(page)).toEqual(ended);
  await expect(page.locator('#ranking-form')).toBeHidden();
});

test('small and rotated phones keep the tool, speed picker, and stop button accessible',async({page})=>{
  for(const size of [{width:320,height:568},{width:844,height:390}]) {
    await page.setViewportSize(size);
    await page.goto('./?debug=1');
    await page.locator('#open-auto-input').click();
    await page.locator('#auto-input-rate').selectOption('max');
    await page.locator('#start-auto-input').click();
    await expect(page.locator('#app')).toHaveAttribute('data-screen','playing');
    await expect(page.locator('#stop-auto-input')).toBeInViewport({ratio:1});
    await expect(page.locator('#auto-input-live-rate')).toBeInViewport({ratio:1});
    await expect.poll(async()=>page.evaluate(()=>window.__pang.snapshot().hits)).toBeGreaterThan(20);
    await page.locator('#stop-auto-input').click();
    await page.locator('#back-to-title').click();
    await page.locator('#start').click();
    await expect(page.locator('#app')).toHaveAttribute('data-screen','playing');
    await expect(page.locator('#auto-input-controls')).toBeHidden();
    await expect(page.locator('#score')).toHaveText('0');
  }
});

test('a real 40-second automatic run measures the game score without API calls or saving a personal best',async({page},info)=>{
  const requests:string[]=[];
  page.on('request',request=>{if(request.url().startsWith(config.apiURL)) requests.push(request.url());});
  const errors:string[]=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(()=>{
    localStorage.setItem('jungle-pang:v1',JSON.stringify({best:135,muted:true}));
    window.__autoInputTaps=[];
    document.addEventListener('click',event=>{
      if(event.target instanceof HTMLElement && ['monkey','tiger'].includes(event.target.id)) window.__autoInputTaps.push(performance.now());
    });
  });
  await page.goto('./?tool=auto-input');
  expect(await page.evaluate(()=>typeof window.__pang)).toBe('undefined');
  const rate=process.env.PANG_AUTO_INPUT_FASTEST==='1'?'max':'60';
  await page.locator('#auto-input-rate').selectOption(rate);
  const evidenceDir=process.env.PANG_EVIDENCE_DIR;
  if(evidenceDir) {
    await mkdir(evidenceDir,{recursive:true});
    await page.screenshot({path:`${evidenceDir}/auto-input-tool-${info.project.name}.png`,scale:'css'});
  }
  await page.locator('#start-auto-input').click();
  await expect(page.locator('#app')).toHaveAttribute('data-screen','playing');
  await expect(page.locator('#score')).not.toHaveText('0');
  await expect(page.locator('#result-screen')).toBeVisible({timeout:45000});
  const hits=Number(await page.locator('#result-hits').textContent());
  const taps=await page.evaluate(()=>window.__autoInputTaps);
  expect(hits).toBeGreaterThan(200);
  if(rate==='60') expect(hits).toBeLessThanOrEqual(2401);
  // One final button activation may reach the deadline and be rejected by the game.
  expect(taps.length).toBeGreaterThanOrEqual(hits);
  expect(taps.length).toBeLessThanOrEqual(hits+1);
  expect(taps.at(-1)!-taps[0]).toBeGreaterThan(39000);
  const replay=new PangEngine(42);
  replay.start(0);
  for(let i=0;i<hits;i++) replay.input(replay.queue[0],i*40000/hits);
  expect(Number((await page.locator('#result-score').textContent())!.replaceAll(',',''))).toBe(replay.score);
  await expect(page.locator('#result-accuracy')).toHaveText('100%');
  await expect(page.locator('#result-combo')).toHaveText(String(hits));
  await expect(page.locator('#result-auto-input')).toContainText('40.0秒');
  await expect(page.locator('#best')).toHaveText('135');
  await expect(page.locator('#new-best')).toBeHidden();
  await expect(page.locator('#ranking-form')).toBeHidden();
  expect(requests).toEqual([]);
  if(evidenceDir) {
    await page.screenshot({path:`${evidenceDir}/auto-input-result-${info.project.name}.png`,scale:'css'});
    await writeFile(`${evidenceDir}/auto-input-${info.project.name}.json`,JSON.stringify({url:page.url(),rate,hits,activations:taps.length,score:replay.score,actualRate:hits/40,tapSpanMs:taps.at(-1)!-taps[0],apiRequests:requests,errors},null,2)+'\n');
  }
  await page.locator('#back-to-title').click();
  await expect(page.locator('#auto-input-controls')).toBeHidden();
  await page.route(`${config.apiURL}/api/players`,route=>route.fulfill({json:{id:'fixture',token:'0'.repeat(64)}}));
  await page.route(`${config.apiURL}/api/rounds`,route=>route.fulfill({json:{id:'manual',seed:42,rulesVersion:RULES_VERSION,device:'pc'}}));
  await page.locator('#start').click();
  await expect(page.locator('#app')).toHaveAttribute('data-screen','playing');
  await expect(page.locator('#score')).toHaveText('0');
  await expect(page.locator('#auto-input-controls')).toBeHidden();
  expect(requests.filter(url=>url.endsWith('/api/rounds'))).toHaveLength(1);
  await page.locator('#home').click();
  expect(errors).toEqual([]);
});
