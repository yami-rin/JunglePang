import {readdir, readFile} from 'node:fs/promises';

// Publishing must fail if the local automation UI or input driver leaks into dist.
const forbidden = ['auto-input', '自動入力', '最速（端末依存）'];
async function check(dir) {
  for (const entry of await readdir(dir, {withFileTypes:true})) {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) await check(path);
    else if (/\.(html|js|css)$/.test(entry.name)) {
      const content = await readFile(path, 'utf8');
      for (const marker of forbidden)
        if (content.includes(marker)) throw new Error(`Local automation found in public build: ${path} (${marker})`);
    }
  }
}
await check('dist');
console.log('Public build: local automation excluded');
