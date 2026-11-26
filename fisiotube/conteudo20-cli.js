#!/usr/bin/env node
'use strict';
// Conteúdo 2.0 — comandos manuais e locais. Nada é publicado; nenhuma API paga é chamada.
//   storyboard "<tema>" [--query "<busca PubMed>"] [--desde 2015] [--ate 2026] [--tipos ecr,revisao_sistematica] [--formato reel|vsl] [--marca X] [--out storyboard.json]
//   referencias <roteiro.json|storyboard.json>   preenche references (título, DOI, ano, revista, desenho) pelos PMIDs citados
//   validate <storyboard.json>
//   transcribe <video.mp4> [words.json]
//   sync <storyboard.json> <words.json> --inicio 5 [--fim 61.3] [--arquivo src.mp4] [--cx 960] [--sem-camera 8.6-19.2,52.8-56.3] [--out cenas.json]
//   render <pasta>   (exige cenas.json, storyboard.json revisado e o vídeo-fonte na pasta)
//   validate-v2 <roteiro.json>          formato v2 (6 tipos de tela alternados)
//   render-v2 <pasta> [roteiro.json]     exige roteiro revisado + os vídeos citados em clip
const fs=require('fs');
const path=require('path');
const {spawnSync}=require('child_process');
const {createStoryboard,validateStoryboard,assertRenderable}=require('./conteudo20/storyboard');
const {buildCenas}=require('./conteudo20/sync');
const {validateRoteiro,assertRenderableV2}=require('./conteudo20/roteiro_v2');
const {enrichReferences}=require('./conteudo20/referencias');

const RENDER_DIR=path.join(__dirname,'conteudo20','render');
const readJson=f=>JSON.parse(fs.readFileSync(f,'utf8'));
const writeJson=(f,o)=>fs.writeFileSync(f,JSON.stringify(o,null,1)+'\n');

function parse(argv){
 const pos=[],opt={};
 for(let i=0;i<argv.length;i++){
  if(argv[i].startsWith('--')) opt[argv[i].slice(2)]=argv[i+1]!==undefined&&!argv[i+1].startsWith('--')?argv[++i]:true;
  else pos.push(argv[i]);
 }
 return {pos,opt};
}

function python(script,args,cwd){
 const bin=process.env.PYTHON||(process.platform==='win32'?'python':'python3');
 const r=spawnSync(bin,[path.join(RENDER_DIR,script),...args],{cwd,stdio:'inherit'});
 if(r.error) throw r.error;
 if(r.status!==0) throw new Error(`${script} exited with ${r.status}`);
}

async function main(argv=process.argv.slice(2)){
 const [cmd,...rest]=argv;const {pos,opt}=parse(rest);
 if(cmd==='storyboard'){
  const topic=pos.join(' ').trim();
  if(!topic) throw new Error('Usage: storyboard "<tema>" [--query "..."]');
  let draft={references:[]};
  if(opt.query!==undefined||opt.pubmed||opt.desde||opt.tipos){
   const {prepareScientificStrategy}=require('./strategy-adapter');
   ({draft}=await prepareScientificStrategy({topic,query:typeof opt.query==='string'?opt.query:topic,maxResults:5,
    desde:typeof opt.desde==='string'?opt.desde:undefined,ate:typeof opt.ate==='string'?opt.ate:undefined,
    tipos:typeof opt.tipos==='string'?opt.tipos.split(',').map(t=>t.trim()).filter(Boolean):[]}));
  }
  const sb=createStoryboard({topic,draft,formato:opt.formato||'reel',marca:opt.marca||'FisioTube'});
  const out=opt.out||`${sb.slug}.storyboard.json`;
  writeJson(out,sb);
  console.log(`Storyboard skeleton -> ${out} (${sb.references.length} referências). Preencha cenas e revise.`);
 }else if(cmd==='referencias'){
  if(!pos[0]) throw new Error('Usage: referencias <roteiro.json|storyboard.json>');
  const {doc,naoEncontrados,fracos}=await enrichReferences(readJson(pos[0]));
  writeJson(pos[0],doc);
  console.log(`${doc.references.length} referências atualizadas em ${pos[0]}.`);
  for(const r of doc.references) console.log(`  PMID ${r.pmid}: ${r.design||'?'}${r.year?', '+r.year:''} — ${r.title||'(sem título)'}`);
  if(fracos.length) console.warn('Atenção: desenho de evidência fraco (relato de caso, revisão narrativa ou outro): PMID '+fracos.join(', '));
  if(naoEncontrados.length){console.warn('PMIDs não encontrados no PubMed: '+naoEncontrados.join(', '));process.exitCode=3;}
 }else if(cmd==='validate'){
  const v=validateStoryboard(readJson(pos[0]));
  console.log(JSON.stringify(v,null,2));
  if(!v.ok) process.exitCode=1;
 }else if(cmd==='transcribe'){
  if(!pos[0]) throw new Error('Usage: transcribe <video.mp4> [words.json]');
  python('transcribe.py',[path.resolve(pos[0]),path.resolve(pos[1]||'words.json')],process.cwd());
 }else if(cmd==='sync'){
  if(pos.length<2) throw new Error('Usage: sync <storyboard.json> <words.json> --inicio <s>');
  const sb=readJson(pos[0]);
  const {cenas,naoEncontrados}=buildCenas(sb,readJson(pos[1]),{
   arquivo:opt.arquivo||'src.mp4',inicio:Number(opt.inicio||0),fim:opt.fim!==undefined?Number(opt.fim):undefined,cx:Number(opt.cx||960),
   cameraIndisponivel:typeof opt['sem-camera']==='string'?opt['sem-camera'].split(',').map(r=>r.split('-').map(Number)):[]});
  writeJson(opt.out||'cenas.json',cenas);
  console.log(`cenas.json -> ${opt.out||'cenas.json'}`);
  if(naoEncontrados.length){console.warn('Gatilhos não encontrados na fala (ajuste o storyboard):');for(const x of naoEncontrados) console.warn(`  ${x.cena}: "${x.palavra}"`);process.exitCode=3;}
 }else if(cmd==='render'){
  const dir=path.resolve(pos[0]||'.');
  assertRenderable(readJson(path.join(dir,'storyboard.json')));
  python('render.py',[],dir);
  console.log('Vídeo gerado como RASCUNHO. Revisão humana obrigatória antes de qualquer publicação.');
 }else if(cmd==='validate-v2'){
  const v=validateRoteiro(readJson(pos[0]));
  console.log(JSON.stringify(v,null,2));
  if(!v.ok) process.exitCode=1;
 }else if(cmd==='render-v2'){
  const dir=path.resolve(pos[0]||'.');const file=pos[1]||'roteiro.json';
  const rt=readJson(path.join(dir,file));
  assertRenderableV2(rt);
  const missing=rt.cenas.filter(c=>c.clip).map(c=>c.clip[0]).filter(f=>!fs.existsSync(path.join(dir,f)));
  if(missing.length) throw new Error('Vídeos não encontrados na pasta: '+[...new Set(missing)].join(', '));
  python('render_v2.py',[file],dir);
  console.log('Vídeo gerado como RASCUNHO. Revisão humana obrigatória antes de qualquer publicação.');
 }else{
  console.error('Commands: storyboard | referencias | validate | transcribe | sync | render | validate-v2 | render-v2');process.exitCode=2;
 }
}

if(require.main===module)main().catch(err=>{console.error('Conteúdo 2.0 failed:',err.message);process.exitCode=1;});
module.exports={main,parse};
