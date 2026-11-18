'use strict';
// Converte storyboard.json + words.json (transcrição da gravação) em cenas.json para o renderizador.
// Puro e determinístico: sem rede, sem IA, sem arquivos.

const r2=x=>Math.round(x*100)/100;
const norm=w=>String(w).normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'');

function prepareWords(words,inicio){
 if(!Array.isArray(words)) throw new Error('words must be an array');
 return words.map(w=>({w:String(w.w),n:norm(w.w),s:r2(Number(w.s)-inicio),e:r2(Number(w.e)-inicio)})).filter(w=>w.n&&w.s>=0);
}

// Procura a sequência de tokens de `palavra` a partir do índice `from`. Retorna o índice ou -1.
function findPhrase(words,palavra,from=0){
 const toks=String(palavra).split(/\s+/).map(norm).filter(Boolean);
 if(!toks.length) return -1;
 for(let i=Math.max(0,from);i<=words.length-toks.length;i++){
  if(toks.every((t,j)=>words[i+j].n===t)) return i;
 }
 return -1;
}

function fonteFor(scene,references){
 const ids=[...new Set((scene.claims||[]).flatMap(c=>c.pmids||[]).map(String))];
 if(!ids.length) return undefined;
 const known=new Set((references||[]).map(r=>String(r.pmid)));
 return 'Fonte: '+ids.filter(id=>known.has(id)).map(id=>'PMID '+id).join(' · ');
}

function emptyEntry(modelo,t0){
 const base={t0,t1:t0,modelo};
 if(modelo==='osciloscopio') Object.assign(base,{keyframes_hz:[],rotulos:[],chips:[]});
 if(modelo==='forca_fadiga') base.eventos={};
 if(modelo==='cartao') base.itens=[];
 return base;
}

function applyAction(entry,acao,t){
 for(const [k,v] of Object.entries(acao||{})){
  if(k==='keyframe_hz') (entry.keyframes_hz||(entry.keyframes_hz=[])).push([t,Number(v)]);
  else if(k==='rotulo') (entry.rotulos||(entry.rotulos=[])).push([t,...[].concat(v,'').slice(0,2)]);
  else if(k==='chip') (entry.chips||(entry.chips=[])).push([t,String(v)]);
  else if(k==='chips_fim') entry.chips_ate=t;
  else if(k==='evento') (entry.eventos||(entry.eventos={}))[String(v)]=t;
  else if(k==='item') (entry.itens||(entry.itens=[])).push([t,String(v)]);
  else throw new Error('unknown acao '+k);
 }
}

function buildCenas(sb,rawWords,{arquivo='src.mp4',inicio=0,fim,cx=960,saida,ctaDur=3.2,cameraIndisponivel=[]}={}){
 if(!sb||!Array.isArray(sb.cenas)||!sb.cenas.length) throw new Error('storyboard has no cenas');
 const words=prepareWords(rawWords,inicio);
 if(!words.length) throw new Error('no words after inicio');
 const end=fim!==undefined?Number(fim):inicio+words[words.length-1].e+0.3;
 const MAIN=Math.round((end-inicio)*100)/100;
 const naoEncontrados=[];
 let cursor=0,lastT=0;
 // 1) tempo de cada gatilho
 const timed=sb.cenas.map(scene=>{
  const hits=[];
  for(const g of scene.gatilhos||[]){
   const i=findPhrase(words,g.palavra,cursor);
   if(i<0){naoEncontrados.push({cena:scene.id,palavra:g.palavra});continue;}
   cursor=i+1;lastT=words[i].s;hits.push({t:lastT,acao:g.acao});
  }
  return {scene,hits,t0:hits.length?hits[0].t:lastT};
 });
 // 2) agrupa cenas consecutivas do mesmo modelo (o renderizador usa um bloco contínuo por modelo)
 const blocks=[];
 timed.forEach((x,i)=>{
  const next=timed[i+1];
  const t1=next?next.t0:MAIN;
  let b=blocks[blocks.length-1];
  if(!b||b.modelo!==x.scene.modelo){
   if(blocks.some(o=>o.modelo===x.scene.modelo)) throw new Error(`modelo ${x.scene.modelo} reappears in ${x.scene.id}; keep one continuous block per modelo`);
   b=emptyEntry(x.scene.modelo,x.t0);blocks.push(b);
  }
  Object.assign(b,x.scene.params||{});
  const fonte=fonteFor(x.scene,sb.references);if(fonte) b.fonte=fonte;
  for(const h of x.hits) applyAction(b,h.acao,h.t);
  b.t1=Math.max(b.t1,t1);
 });
 const hookEnd=Math.min(3,Math.max(1.5,blocks[0].t0));
 blocks[0].t0=hookEnd;
 for(const b of blocks){
  if(b.modelo==='osciloscopio'){
   if(!b.keyframes_hz.length) b.keyframes_hz.push([b.t0,10]);
   if(b.chips_ate===undefined) b.chips_ate=b.t1;
  }
 }
 const indisponivel=[...cameraIndisponivel];
 timed.forEach((x,i)=>{if(x.scene.layout==='full') indisponivel.push([x.t0,timed[i+1]?timed[i+1].t0:MAIN]);});
 const cenas=[
  {t0:0,t1:hookEnd,modelo:'gancho',titulo:sb.gancho?.titulo||[sb.titulo],kicker:sb.gancho?.kicker||''},
  ...blocks,
  {t0:MAIN,t1:Math.round((MAIN+ctaDur)*100)/100,modelo:'cta',...(sb.cta||{})}
 ];
 return {
  cenas:{fonte:{arquivo,inicio,fim:end,cx},saida:saida||`${sb.slug||'video'}_conteudo20.mp4`,
   camera_indisponivel:indisponivel,correcoes:sb.correcoes_previstas||{},destaques:sb.destaques||[],cenas},
  naoEncontrados
 };
}

module.exports={buildCenas,findPhrase,prepareWords,normalize:norm};
