'use strict';
const test=require('node:test');const assert=require('node:assert/strict');
const fs=require('fs');const os=require('os');const path=require('path');
const {escala,dominio,ticksLineares,ticksLog,matrizIcones,graficoEfeito,antesDepois,fmt}=require('./graficos');
const {cardHtml,esc}=require('./templates');
const {cssVars,loadTokens}=require('../../design/tokens');
const {validateRoteiro}=require('../roteiro_v2');

const refs=[{pmid:'1',design:'metanalise',year:2024}];
const rt={publishingEnabled:false,scientificReviewRequired:true,references:refs,cenas:[]};

test('tokens expose CSS variables and evidence colors',()=>{
 const css=cssVars();
 assert.match(css,/--acento: #D9773A;/);assert.match(css,/--nivel-A: /);assert.match(css,/--fonte-titulo: Montserrat/);
 assert.equal(Object.keys(loadTokens().nivel).join(''),'ABCD');
});
test('linear and log scales',()=>{
 const x=escala({min:0,max:10,largura:100});assert.equal(x(5),50);
 const l=escala({min:0.5,max:2,log:true,largura:100});assert.equal(Math.round(l(1)),50);
 assert.throws(()=>escala({min:0,max:2,log:true,largura:1}),/positive/);
});
test('domain always contains the null line',()=>{
 const [a,b]=dominio({estimativa:5,ic:[3,7],nulo:0});assert.ok(a<0&&b>7);
 const [la,lb]=dominio({estimativa:1.65,ic:[1.21,2.25],nulo:1,log:true});assert.ok(la<1&&lb>2.25);
});
test('ticks are round numbers',()=>{
 assert.deepEqual(ticksLineares(0,10),[0,2.5,5,7.5,10]);
 assert.ok(!graficoEfeito({estimativa:0.36,ic:[0.16,0.57],medida:'DMP'}).includes('>-0<'));
 assert.ok(!Object.is(ticksLineares(-0.08,0.65)[0],-0));
 assert.deepEqual(ticksLog(0.4,3),[0.5,1,2]);
});
test('pt-BR number format',()=>{assert.equal(fmt(1.65,2),'1,65');assert.equal(fmt(4224),'4.224');});
test('icon array fills exactly valor of total',()=>{
 const h=matrizIcones({valor:31,total:100});
 assert.equal((h.match(/class="ic on"/g)||[]).length,31);assert.equal((h.match(/class="ic/g)||[]).length,100);
});
test('effect chart prints estimate and CI in pt-BR',()=>{
 const h=graficoEfeito({estimativa:1.65,ic:[1.21,2.25],escala_log:true,medida:'OR'});
 assert.match(h,/>1,65</);assert.match(h,/IC 95%: 1,21 a 2,25 · OR/);assert.match(h,/SEM DIFERENÇA/);
});
test('before/after computes the difference instead of trusting a typed one',()=>{
 const h=antesDepois({antes:312,depois:378,unidade:'m'});
 assert.match(h,/\+66 m/);assert.match(h,/\(\+21%\)/);
 assert.match(antesDepois({antes:8,depois:5,unidade:'pontos'}),/−3 pontos/);
});
test('templates escape text and show the evidence badge',()=>{
 assert.equal(esc('<b>&'),'&lt;b&gt;&amp;');
 const p=cardHtml({id:'p',tipo:'prova',numero:'<x>',achado:'a',fonte:'PMID 1',tag:'T'},rt);
 assert.equal(p.altura,900);assert.match(p.html,/&lt;x&gt;/);assert.match(p.html,/EVIDÊNCIA FORTE · METANÁLISE 2024/);
 const d=cardHtml({id:'d',tipo:'dados',grafico:'icones',titulo:'T',valor:3,total:10,fonte:'PMID 1'},rt);
 assert.equal(d.altura,1920);assert.match(d.html,/var\(--nivel-A\)/);
});
test('validator checks dados fields',()=>{
 const base=c=>({...rt,cenas:[{id:'h',tipo:'hook',dur:2.5,clip:['v.mp4',0]},{id:'d',tipo:'dados',dur:4,fonte:'PMID 1',titulo:'T',...c},{id:'f',tipo:'final',dur:3,palavras:['MANDA']}]});
 const errs=c=>validateRoteiro(base(c)).errors.join(' | ');
 assert.equal(errs({grafico:'icones',valor:31}),'');
 assert.match(errs({grafico:'pizza'}),/needs grafico/);
 assert.match(errs({grafico:'icones',valor:120}),/valor must be an integer/);
 assert.match(errs({grafico:'icones',valor:3,total:15}),/total must be/);
 assert.match(errs({grafico:'efeito',estimativa:3,ic:[1,2],medida:'MD'}),/inside ic/);
 assert.match(errs({grafico:'efeito',estimativa:0.5,ic:[-1,2],escala_log:true,medida:'RR'}),/positive/);
 assert.match(errs({grafico:'efeito',estimativa:1,ic:[0,2]}),/needs medida/);
 assert.match(errs({grafico:'antes_depois',antes:'x',depois:2}),/needs antes and depois/);
 assert.match(errs({grafico:'icones',valor:3,fonte:'PMID 9'}),/dados without a PMID/);
});
test('example files are valid',()=>{
 for(const f of ['roteiro_v2.json','dados_ilustrativo.json']){
  const v=validateRoteiro(JSON.parse(fs.readFileSync(path.join(__dirname,'..','exemplo',f),'utf8')));
  assert.equal(v.ok,true,f+': '+v.errors.join('; '));
 }
});

// Integração: só roda onde o Playwright e o Chromium estão instalados.
let chromiumOk=false;
try{const {chromium}=require('playwright');chromiumOk=fs.existsSync(chromium.executablePath());}catch{chromiumOk=false;}
test('renders transparent PNG frames and reuses unchanged cards',{skip:!chromiumOk&&'Playwright/Chromium not installed'},async()=>{
 const {renderCards}=require('./render-cards');
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'cards-'));
 fs.writeFileSync(path.join(dir,'roteiro.json'),JSON.stringify({...rt,cenas:[{id:'d1',tipo:'dados',dur:0.2,grafico:'antes_depois',titulo:'T',antes:1,depois:2,fonte:'PMID 1'}]}));
 const r=await renderCards(dir,'roteiro.json',{log:()=>{}});
 assert.equal(r.quadros,7);
 const png=fs.readFileSync(path.join(dir,'_cards','d1','0006.png'));
 assert.equal(png.readUInt32BE(16),1080);assert.equal(png.readUInt32BE(20),1920);assert.equal(png[25],6); // RGBA
 const again=await renderCards(dir,'roteiro.json',{log:()=>{}});
 assert.equal(again.quadros,0);
 fs.rmSync(dir,{recursive:true,force:true});
});
