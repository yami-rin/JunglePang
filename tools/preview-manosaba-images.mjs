import sharp from 'sharp';
const groups = [
  ['monkey','tiger','elephant','frog','hippo','chick'],
  ['ema','hiro','annan','noah','reia','miria'],
  ['margo','nanoka','arisa','sherie','hanna','koko'],
  ['meruru'],
];
const layers=[];
for (let row=0;row<groups.length;row++) for(let col=0;col<groups[row].length;col++) {
  const id=groups[row][col], left=col*210+5, top=row*190+8;
  const art=await sharp(`public/art/${id}.${row===0?'svg':'png'}`).resize(200,132).png().toBuffer();
  layers.push({input:art,left,top});
  const text=Buffer.from(`<svg width="200" height="40"><text x="100" y="25" text-anchor="middle" font-size="19" font-family="Arial" fill="#253a2b">${id}</text></svg>`);
  layers.push({input:text,left,top:top+135});
}
await sharp({create:{width:1260,height:760,channels:4,background:'#f4f2df'}}).composite(layers).png().toFile('artifacts/manosaba-imagegen-sheet.png');
