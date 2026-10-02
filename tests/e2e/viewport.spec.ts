import {test,expect,type Page} from '@playwright/test';
import config from '../../src/ranking-config.json' with {type:'json'};

test.use({trace:'off'});
const settle=async(page:Page)=>page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));
const bounds=async(page:Page)=>Promise.all(['#app','#game-canvas','#monkey'].map(selector=>page.locator(selector).boundingBox()));

test('mobile browser chrome height changes keep the game and controls fixed',async({page,isMobile})=>{
  test.skip(!isMobile,'Mobile chrome expands and collapses independently of the layout');
  await page.setViewportSize({width:390,height:640});
  await page.goto('./?debug=1');
  await expect(page.locator('#start')).toBeEnabled();
  await page.evaluate(()=>window.__pang.reset(42));
  const before=await bounds(page);
  await page.setViewportSize({width:390,height:844});
  await settle(page);
  expect(await bounds(page)).toEqual(before);
  await page.setViewportSize({width:390,height:640});
  await settle(page);
  expect(await bounds(page)).toEqual(before);
  await expect(page.locator('#monkey')).toBeInViewport({ratio:1});
  expect(await page.evaluate(()=>[scrollX,scrollY])).toEqual([0,0]);
});

test('mobile double taps on the game surface keep scale and count native inputs once',async({page,isMobile})=>{
  test.skip(!isMobile,'Uses native touchscreen gestures');
  await page.goto('./?debug=1');
  await expect(page.locator('#start')).toBeEnabled();
  const target=await page.evaluate(()=>{
    for(let seed=1;seed<100;seed++) {
      window.__pang.reset(seed);
      const {queue}=window.__pang.snapshot();
      if(queue[0]===queue[1]) return queue[0];
    }
    throw new Error('No repeated pair');
  });
  // The whole game must opt out before the gesture begins, including the blank arena.
  await expect(page.locator('#app')).toHaveCSS('touch-action','none');
  const before=await bounds(page);
  for(const selector of [`#${target}`,'#time','#game-canvas']) {
    const rect=await page.locator(selector).boundingBox();
    expect(rect).not.toBeNull();
    const x=rect!.x+rect!.width/2, y=rect!.y+rect!.height/2;
    await page.touchscreen.tap(x,y);
    await page.touchscreen.tap(x,y);
  }
  await settle(page);
  expect(await page.evaluate(()=>visualViewport?.scale)).toBe(1);
  expect(await bounds(page)).toEqual(before);
  expect(await page.evaluate(()=>window.__pang.snapshot().hits)).toBe(2);
});

test('rotation and desktop resizing refit the available screen',async({page,isMobile})=>{
  await page.setViewportSize({width:390,height:640});
  await page.goto('./?debug=1');
  await expect(page.locator('#start')).toBeEnabled();
  await page.evaluate(()=>window.__pang.reset(42));
  await page.setViewportSize({width:844,height:390});
  await expect.poll(async()=>(await page.locator('#app').boundingBox())?.height).toBe(390);
  await expect(page.locator('#monkey')).toBeInViewport({ratio:1});
  await expect(page.locator('#tiger')).toBeInViewport({ratio:1});
  await page.setViewportSize({width:390,height:640});
  await expect.poll(async()=>(await page.locator('#app').boundingBox())?.height).toBe(640);
  if(!isMobile) {
    await page.setViewportSize({width:390,height:800});
    await expect.poll(async()=>(await page.locator('#app').boundingBox())?.height).toBe(800);
  }
});

test('a fixed mobile page still allows native scrolling inside a ranking dialog',async({page,isMobile,context,browserName})=>{
  test.skip(!isMobile || browserName!=='chromium','Uses Chromium native touch movement');
  await page.route(`${config.apiURL}/api/ranking*`,route=>route.fulfill({json:{namePolicyVersion:2,entries:Array.from({length:50},(_,i)=>({id:String(i),nickname:'参加者'+i,score:500-i,rank:i+1}))}}));
  await page.goto('./');
  await page.locator('#ranking').click();
  await expect(page.locator('#ranking-list li')).toHaveCount(50);
  const rect=await page.locator('#ranking-dialog').boundingBox();
  const cdp=await context.newCDPSession(page);
  try {
    const x=rect!.x+rect!.width/2, y=rect!.y+rect!.height-70;
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
    for(let i=1;i<=12;i++) {
      await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y-i*25}]});
      await page.waitForTimeout(16);
    }
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await expect.poll(()=>page.locator('#ranking-dialog').evaluate(node=>node.scrollTop)).toBeGreaterThan(100);
    expect(await page.evaluate(()=>[scrollX,scrollY])).toEqual([0,0]);
  } finally {await cdp.detach();}
});

test('mobile nickname entry stays reachable when the keyboard reduces the visible area',async({page,isMobile})=>{
  test.skip(!isMobile,'Models the reduced viewport of a software keyboard');
  await page.setViewportSize({width:390,height:760});
  await page.goto('./?debug=1');
  await expect(page.locator('#start')).toBeEnabled();
  await page.evaluate(()=>{
    window.__pang.reset(42); window.__pang.expire();
    // Isolate form layout without writing a production score or waiting 40 seconds.
    (document.getElementById('ranking-form') as HTMLElement).hidden=false;
  });
  await page.locator('#nickname').fill('とうふ');
  await page.setViewportSize({width:390,height:380});
  await expect(page.locator('#nickname')).toBeInViewport({ratio:1});
  await expect(page.locator('#nickname')).toHaveValue('とうふ');
  await page.setViewportSize({width:390,height:760});
  await expect(page.locator('#retry')).toBeInViewport();
});
