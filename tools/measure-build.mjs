import { readFile, readdir, writeFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
const receipt = JSON.parse(await readFile('artifacts/public-http.json','utf8'));
const before = receipt.results.filter(file=>file.path.endsWith('.js')).reduce((sum,file)=>sum+file.bytes,0);
let after = 0; let gzipBytes = 0;
for(const file of await readdir('dist/assets')) if(file.endsWith('.js')) {
  const bytes = await readFile('dist/assets/'+file);
  after += bytes.length; gzipBytes += gzipSync(bytes).length;
}
const profiles = {};
for(const device of ['desktop-chromium','mobile-chromium']) {
  const oldSample=JSON.parse(await readFile(`artifacts/performance-before-${device}.json`,'utf8'));
  const newSample=JSON.parse(await readFile(`artifacts/performance-after-${device}.json`,'utf8'));
  profiles[device]={before:oldSample,after:newSample,heapReductionPercent:100*(1-newSample.jsHeapBytes/oldSample.jsHeapBytes)};
}
const comparison={baselineVersion:'0.1.1',version:'0.2.0',uncompressedJavaScript:{before,after,reductionPercent:100*(1-after/before)},currentGzipJavaScript:gzipBytes,profiles,conditions:'Same Windows Chromium 151, desktop and Pixel 7 emulation; 90 synthetic inputs over 6 seconds. One sample per profile; not physical phone latency or a long heap profile.'};
await writeFile('artifacts/performance-comparison-020.json',JSON.stringify(comparison,null,2)+'\n');
console.log(JSON.stringify(comparison));
