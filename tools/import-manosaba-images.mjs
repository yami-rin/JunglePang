// Mechanical alpha-bound normalization only; artwork is generated, not drawn here.
import sharp from 'sharp';
import {readFile, writeFile, mkdir, copyFile} from 'node:fs/promises';
const manifest = JSON.parse(await readFile('art/imagegen/manosaba-prompts.json', 'utf8'));
await mkdir('art/imagegen/originals', {recursive:true});
for (const item of manifest) {
  const original = `art/imagegen/originals/${item.id}.png`;
  if (item.source) await copyFile(item.source, original);
  const {data,info} = await sharp(original).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  let minX=info.width, minY=info.height, maxX=-1, maxY=-1, transparent=0;
  for(let y=0;y<info.height;y++) for(let x=0;x<info.width;x++) {
    const alpha=data[(y*info.width+x)*4+3];
    if(alpha===0) transparent++;
    if(alpha>8) {minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);}
  }
  if(!transparent || maxX<minX) throw new Error(`Missing transparent sprite: ${item.id}`);
  const sprite=await sharp(original).extract({left:minX,top:minY,width:maxX-minX+1,height:maxY-minY+1})
    .resize({width:540,height:354,fit:'inside'}).png().toBuffer();
  const size=await sharp(sprite).metadata();
  const shadow=Buffer.from('<svg width="600" height="396"><ellipse cx="300" cy="375" rx="192" ry="15" fill="#173d22" opacity="0.18"/></svg>');
  await sharp({create:{width:600,height:396,channels:4,background:'#00000000'}})
    .composite([{input:shadow},{input:sprite,left:Math.round((600-size.width)/2),top:366-size.height}])
    .png({compressionLevel:9}).toFile(`public/art/${item.id}.png`);
  console.log(`${item.id}: ${info.width}x${info.height}, transparent ${Math.round(100*transparent/(info.width*info.height))}%, head ${size.width}x${size.height}`);
  delete item.source;
}
await writeFile('art/imagegen/manosaba-prompts.json',JSON.stringify(manifest,null,2)+'\n');
