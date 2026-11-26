'use strict';
// Fotografa os cards em HTML quadro a quadro com o Playwright (Chromium) e grava PNGs transparentes em
// <pasta>/_cards/<id>/, que o render_v2.py sobrepõe ao vídeo. Só a entrada é animada (até movimento.max_s);
// depois disso o render repete o último quadro. Cenas sem mudança são reaproveitadas pelo hash.
const fs=require('fs');
const path=require('path');
const crypto=require('crypto');
const {cardHtml,HTML_TIPOS}=require('./templates');
const {loadTokens}=require('../../design/tokens');

const FPS=30;
const FONT_EXT=/\.(ttf|otf|woff2?)$/i;

// @font-face para fontes deixadas em render/fonts ou em CONTEUDO20_FONT_DIR (as do sistema já funcionam).
function fontFaces(){
 const dirs=[process.env.CONTEUDO20_FONT_DIR,path.join(__dirname,'..','render','fonts')].filter(d=>d&&fs.existsSync(d));
 const out=[];
 for(const dir of dirs) for(const f of fs.readdirSync(dir).filter(n=>FONT_EXT.test(n))){
  const fam=f.replace(FONT_EXT,'').replace(/\[.*\]/,'').split('-')[0];
  const url='file://'+path.resolve(dir,f).replace(/\\/g,'/');
  out.push(`@font-face{font-family:'${fam}';src:url('${url}');font-weight:100 900;}`);
 }
 return out.join('');
}

function cenasHtml(rt){return (rt.cenas||[]).filter(c=>HTML_TIPOS.has(c.tipo));}

async function renderCards(dir,file='roteiro.json',{fps=FPS,log=console.log}={}){
 const rt=JSON.parse(fs.readFileSync(path.join(dir,file),'utf8'));
 const cenas=cenasHtml(rt);
 if(!cenas.length) return {cenas:0,quadros:0};
 const maxS=loadTokens().movimento.max_s;
 const fontes=fontFaces();
 const {chromium}=require('playwright');
 const browser=await chromium.launch();
 let quadros=0;
 try{
  const page=await browser.newPage({deviceScaleFactor:1});
  for(const c of cenas){
   const {html,largura,altura}=cardHtml(c,rt,{fontes});
   const out=path.join(dir,'_cards',String(c.id));
   const n=Math.ceil(Math.min(Number(c.dur)||maxS,maxS)*fps)+1;
   const hash=crypto.createHash('sha1').update(html+n).digest('hex');
   const manifestPath=path.join(out,'manifest.json');
   if(fs.existsSync(manifestPath)&&JSON.parse(fs.readFileSync(manifestPath,'utf8')).hash===hash){log(`  ${c.id}: sem mudança`);continue;}
   fs.rmSync(out,{recursive:true,force:true});fs.mkdirSync(out,{recursive:true});
   const htmlPath=path.join(out,'card.html');
   fs.writeFileSync(htmlPath,html);
   await page.setViewportSize({width:largura,height:altura});
   await page.goto('file://'+path.resolve(htmlPath).replace(/\\/g,'/'));
   await page.evaluate(async()=>{await document.fonts.ready;window.__caber();});
   for(let i=0;i<n;i++){
    await page.evaluate(ms=>{for(const a of document.getAnimations()){a.pause();a.currentTime=ms;}},i*1000/fps);
    await page.screenshot({path:path.join(out,String(i).padStart(4,'0')+'.png'),omitBackground:true});
   }
   fs.writeFileSync(manifestPath,JSON.stringify({hash,quadros:n,fps,largura,altura,tipo:c.tipo}));
   quadros+=n;log(`  ${c.id}: ${n} quadros (${c.tipo})`);
  }
 }finally{await browser.close();}
 return {cenas:cenas.length,quadros};
}

module.exports={renderCards,cenasHtml,fontFaces};
