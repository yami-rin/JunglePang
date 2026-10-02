import { test, expect, type Page } from '@playwright/test';
import config from '../../src/ranking-config.json' with {type:'json'};
import { PangEngine, RULES_VERSION } from '../../src/engine';
import { AUTO_RESET_VERSION, attemptSeed } from '../../src/attempt';

test.use({trace:'off'});
const towerImages=(page:Page)=>page.locator('.tower-piece').evaluateAll(nodes=>nodes.map(node=>(node as HTMLImageElement).src));
const snapshot=(page:Page)=>page.evaluate(()=>window.__pang.snapshot());
async function enableAutoReset(page:Page):Promise<void> {
  await page.locator('#settings').click();
  await page.locator('#auto-reset').check();
  await page.getByRole('button',{name:'とじる',exact:true}).click();
}

test('the visible countdown tower and animals stay unchanged through the start',async({page})=>{
  await page.addInitScript(()=>{
    Object.defineProperty(crypto,'getRandomValues',{value:(array:Uint32Array)=>array.fill(1)});
  });
  await page.route(`${config.apiURL}/api/players`,route=>route.fulfill({json:{id:'fixture',token:'0'.repeat(64)}}));
  await page.route(`${config.apiURL}/api/rounds`,async route=>{
    await new Promise(resolve=>setTimeout(resolve,600));
    await route.fulfill({json:{id:'round',seed:42,rulesVersion:RULES_VERSION,device:'pc'}});
  });
  await page.goto('./');
  await page.locator('#start').click();
  await expect(page.locator('#game-canvas')).toBeVisible();
  const images=()=>page.locator('.tower-piece').evaluateAll(nodes=>nodes.map(node=>(node as HTMLImageElement).src));
  const tower=await images();
  const animals=await page.locator('.animal-button').evaluateAll(nodes=>nodes.map(node=>node.getAttribute('data-animal')));
  await expect(page.locator('#app')).toHaveAttribute('data-screen','playing');
  expect(await images()).toEqual(tower);
  expect(await page.locator('.animal-button').evaluateAll(nodes=>nodes.map(node=>node.getAttribute('data-animal')))).toEqual(animals);
});

test('AutoReset persists and immediately replaces the tower and resets clock and score after a native miss',async({page,isMobile})=>{
  await page.goto('./?debug=1');
  await page.locator('#settings').click();
  await expect(page.locator('#auto-reset')).not.toBeChecked();
  await page.getByRole('button',{name:'とじる',exact:true}).click();
  await enableAutoReset(page);
  await expect(page.locator('#howto-foot')).toContainText('ミスで即リセット');
  await page.reload();
  await page.locator('#settings').click();
  await expect(page.locator('#auto-reset')).toBeChecked();
  await page.getByRole('button',{name:'とじる',exact:true}).click();
  await page.locator('#start').click();
  await expect(page.locator('#app')).toHaveAttribute('data-screen','playing');
  const first=await snapshot(page);
  const firstTower=await towerImages(page);
  const tap=async(id:string)=>isMobile ? page.locator(`#${id}`).tap() : page.locator(`#${id}`).click();
  for(let i=0;i<5;i++) await tap((await snapshot(page)).queue[0]);
  await expect(page.locator('#score')).toHaveText('50');
  const before=await snapshot(page);
  await tap(before.queue[0]==='monkey'?'tiger':'monkey');
  const after=await snapshot(page);
  expect(after).toMatchObject({screen:'playing',phase:'running',score:0,hits:0,misses:0,combo:0,result:null,log:[]});
  expect(after.remaining).toBeGreaterThan(39500);
  expect(after.remaining).toBeGreaterThan(before.remaining);
  expect(after.queue).not.toEqual(first.queue);
  expect(after.queue).not.toEqual(before.queue);
  expect(after.animals).toEqual(first.animals);
  expect(await towerImages(page)).not.toEqual(firstTower);
  expect(after.renderTarget).toBe(after.queue[0]);
  await expect(page.locator('#countdown')).toBeHidden();
  await expect(page.locator('#lock')).toBeHidden();
  await expect(page.locator('#result-screen')).toBeHidden();
  await expect(page.locator('#best')).toHaveText('0');
  await expect(page.locator('#play-hint')).toContainText('AutoReset ON');
  await tap(after.queue[0]);
  await expect(page.locator('#score')).toHaveText('10');
  // Finishing, rather than a miss, still presents and saves the completed result.
  await page.evaluate(()=>window.__pang.expire());
  await expect(page.locator('#result-screen')).toBeVisible();
  await expect(page.locator('#result-score')).toHaveText('10');
  await expect(page.locator('#best')).toHaveText('10');
  await page.locator('#settings').click();
  await page.locator('#auto-reset').uncheck();
  await page.getByRole('button',{name:'とじる',exact:true}).click();
  await page.evaluate(()=>window.__pang.reset(42));
  const normal=await snapshot(page);
  await tap(normal.queue[0]==='monkey'?'tiger':'monkey');
  await expect(page.locator('#lock')).toBeVisible();
  expect((await snapshot(page)).misses).toBe(1);
});

test('repeated resets preserve the selected pair and suppress held fingers and compatibility clicks',async({page})=>{
  await page.addInitScript(()=>localStorage.setItem('jungle-pang:v1',JSON.stringify({autoReset:true,randomAnimals:false,animals:{left:'frog',right:'chick'}})));
  await page.goto('./?debug=1');
  await page.evaluate(()=>window.__pang.reset(1));
  const original=await snapshot(page);
  for(let i=0;i<25;i++) {
    const before=await snapshot(page);
    const wrong=before.queue[0]==='monkey'?'tiger':'monkey';
    const button=page.locator(`#${wrong}`);
    await button.dispatchEvent('pointerdown',{pointerId:1,pointerType:'touch',button:0});
    const reset=await snapshot(page);
    expect(reset.queue).not.toEqual(before.queue);
    await button.dispatchEvent('pointerdown',{pointerId:1,pointerType:'touch',button:0});
    await button.dispatchEvent('pointerup',{pointerId:1,pointerType:'touch',button:0});
    await button.dispatchEvent('click',{detail:1});
    expect(await snapshot(page)).toMatchObject({queue:reset.queue,animals:original.animals,hits:0,misses:0,score:0,log:[],gameObjects:17});
  }
  await expect(page.locator('#monkey')).toHaveAttribute('data-animal','frog');
  await expect(page.locator('#tiger')).toHaveAttribute('data-animal','chick');
  const key=(await snapshot(page)).queue[0]==='monkey'?'ArrowLeft':'ArrowRight';
  await page.keyboard.down(key);
  await page.keyboard.down(key);
  await page.keyboard.up(key);
  expect((await snapshot(page)).hits).toBe(1);
});

test('each AutoReset builds a different tower after different lengths of native play',async({page,isMobile})=>{
  await page.goto('./?debug=1');
  await enableAutoReset(page);
  await page.evaluate(()=>window.__pang.reset(42));
  const first=await snapshot(page);
  let previousInitial=first.queue;
  const tap=async(id:string)=>isMobile ? page.locator(`#${id}`).tap() : page.locator(`#${id}`).click();
  for(const hits of [1,4,11,27,3,18]) {
    for(let i=0;i<hits;i++) await tap((await snapshot(page)).queue[0]);
    const before=await snapshot(page);
    expect(before.hits).toBe(hits);
    await tap(before.queue[0]==='monkey'?'tiger':'monkey');
    const after=await snapshot(page);
    expect(after).toMatchObject({phase:'running',score:0,hits:0,misses:0,combo:0,animals:first.animals});
    expect(after.queue).not.toEqual(previousInitial);
    expect(after.queue).not.toEqual(before.queue);
    expect(after.renderTarget).toBe(after.queue[0]);
    expect((await towerImages(page)).map(url=>new URL(url).pathname.split('/').at(-1))).toEqual(after.queue.map(animal=>after.animals[animal].id+'.svg'));
    previousInitial=after.queue;
    expect(after.tower.every(piece=>Math.abs(piece.y-piece.restY)<1)).toBe(true);
  }
});

test('late and abandoned ranking preparations cannot change a tower or its challenge',async({page})=>{
  await page.route(`${config.apiURL}/api/players`,route=>route.fulfill({json:{id:'fixture',token:'0'.repeat(64)}}));
  let starts=0;
  await page.route(`${config.apiURL}/api/rounds`,async route=>{
    const attempt=++starts;
    await new Promise(resolve=>setTimeout(resolve,attempt===1?2200:300));
    await route.fulfill({json:{id:`round-${attempt}`,seed:attempt===1?1:42,rulesVersion:RULES_VERSION,device:'pc'}});
  });
  await page.goto('./');
  await page.locator('#start').click();
  await expect(page.locator('#countdown')).toHaveText('準備中…');
  await page.locator('#quick-retry').click();
  await expect(page.locator('#game-canvas')).toBeVisible();
  const tower=await towerImages(page);
  await expect(page.locator('#app')).toHaveAttribute('data-screen','playing');
  expect(starts).toBe(2);
  expect(await towerImages(page)).toEqual(tower);
  const target=await page.locator('.tower-piece').first().getAttribute('src');
  const left=await page.locator('#monkey img').getAttribute('src');
  await page.locator(target===left?'#monkey':'#tiger').click();
  await expect(page.locator('#score')).toHaveText('10');
});

test('AutoReset reuses one ranking challenge and submits only the final attempt',async({page})=>{
  await page.clock.install();
  let starts=0;
  let submitted:any;
  await page.route(`${config.apiURL}/api/players`,route=>route.fulfill({json:{id:'fixture',token:'0'.repeat(64)}}));
  await page.route(`${config.apiURL}/api/rounds`,route=>{
    starts++;
    return route.fulfill({json:{id:'ranked',seed:42,rulesVersion:RULES_VERSION,device:'pc',autoResetVersion:AUTO_RESET_VERSION}});
  });
  await page.route(`${config.apiURL}/api/scores`,route=>{
    submitted=route.request().postDataJSON();
    return route.fulfill({json:{score:10,rank:1,device:'pc',deviceRank:1}});
  });
  await page.goto('./');
  await enableAutoReset(page);
  await page.locator('#start').click();
  await expect(page.locator('#app')).not.toHaveAttribute('data-preparing','true');
  await page.clock.fastForward(1800);
  await expect(page.locator('#app')).toHaveAttribute('data-screen','playing');
  let previousInitial=await towerImages(page);
  for(let i=0;i<3;i++) {
    const target=await page.locator('.tower-piece').first().getAttribute('src');
    const left=await page.locator('#monkey img').getAttribute('src');
    await page.locator(target===left?'#monkey':'#tiger').click();
    await expect(page.locator('#score')).toHaveText('10');
    const next=await page.locator('.tower-piece').first().getAttribute('src');
    await page.locator(next===left?'#tiger':'#monkey').click();
    await expect(page.locator('#score')).toHaveText('0');
    const nextTower=await towerImages(page);
    expect(nextTower).not.toEqual(previousInitial);
    previousInitial=nextTower;
  }
  const target=await page.locator('.tower-piece').first().getAttribute('src');
  const left=await page.locator('#monkey img').getAttribute('src');
  await page.locator(target===left?'#monkey':'#tiger').click();
  await page.clock.fastForward(41000);
  await expect(page.locator('#result-screen')).toBeVisible();
  await expect(page.locator('#ranking-form')).toBeVisible();
  await page.locator('#nickname').fill('テスト');
  await page.locator('#submit-score').click();
  await expect(page.locator('#ranking-status')).toContainText('登録しました');
  expect(starts).toBe(1);
  expect(submitted).toMatchObject({roundId:'ranked',nickname:'テスト'});
  expect(submitted.inputs).toHaveLength(1);
  expect(submitted.attempt).toBeGreaterThanOrEqual(3);
  expect(submitted.inputs[0].input).toBe(new PangEngine(attemptSeed(42,submitted.attempt)).queue[0]);
});

test('a timed out ranking request leaves the local tower fixed and playing without a network dependency',async({page})=>{
  await page.route(`${config.apiURL}/api/players`,route=>route.fulfill({json:{id:'fixture',token:'0'.repeat(64)}}));
  await page.route(`${config.apiURL}/api/rounds`,async route=>{
    await new Promise(resolve=>setTimeout(resolve,2200));
    await route.fulfill({json:{id:'too-late',seed:42,rulesVersion:RULES_VERSION,device:'pc'}});
  });
  await page.goto('./');
  await enableAutoReset(page);
  await page.locator('#start').click();
  await expect(page.locator('#game-canvas')).toBeVisible();
  const tower=await towerImages(page);
  await expect(page.locator('#app')).toHaveAttribute('data-screen','playing');
  expect(await towerImages(page)).toEqual(tower);
  const target=await page.locator('.tower-piece').first().getAttribute('src');
  const left=await page.locator('#monkey img').getAttribute('src');
  await page.locator(target===left?'#tiger':'#monkey').click();
  await expect(page.locator('#app')).toHaveAttribute('data-screen','playing');
  await expect(page.locator('#countdown')).toBeHidden();
  expect(await towerImages(page)).not.toEqual(tower);
});
