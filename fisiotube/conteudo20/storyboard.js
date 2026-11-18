'use strict';
// Storyboard "Conteúdo 2.0": contrato entre roteiro, revisão científica e renderização.
// Nunca gera vídeo, nunca publica e nunca marca uma afirmação como verificada sozinho.
const {assessClaims}=require('../scientific-core');

const LAYOUTS=new Set(['cam','split','full']);
const MODELOS=new Set(['osciloscopio','forca_fadiga','cartao','equacao','numero']);
const ACOES=new Set(['keyframe_hz','rotulo','chip','chips_fim','evento','item']);
const WORDS_PER_SECOND=2.4;

function slugify(text){
 return String(text).normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,60)||'video';
}

function createStoryboard({topic,draft,formato='reel',marca='FisioTube',slug}={}){
 if(typeof topic!=='string'||!topic.trim()) throw new Error('topic is required');
 if(!['reel','vsl'].includes(formato)) throw new Error('formato must be reel or vsl');
 const references=(draft?.references||[]).map(r=>({pmid:String(r.pmid),doi:r.doi||null,title:r.title||'',url:r.url||null}));
 return {
  titulo:topic.trim(),slug:slug||slugify(topic),formato,duracao_alvo:formato==='vsl'?120:55,marca,
  status:'DRAFT_REVIEW_REQUIRED',scientificReviewRequired:true,publishingEnabled:false,
  gancho:{titulo:['','',''],kicker:String(marca).toUpperCase(),alternativas:[]},
  cenas:[],
  cta:{linha1:'Salve para',destaque:'revisar depois',linha2:'',rodape:''},
  destaques:[],correcoes_previstas:{},modelos_novos:[],references,legenda_post:''
 };
}

function sceneWords(scene){return String(scene.fala||'').trim().split(/\s+/).filter(Boolean).length;}
function estimateDuration(sb){return Math.round((sb.cenas||[]).reduce((n,c)=>n+sceneWords(c),0)/WORDS_PER_SECOND*10)/10;}

function validateStoryboard(sb){
 const errors=[],warnings=[];
 if(!sb||typeof sb!=='object') return {ok:false,errors:['storyboard must be an object'],warnings};
 if(sb.publishingEnabled!==false) errors.push('publishingEnabled must be false');
 if(sb.scientificReviewRequired!==true) errors.push('scientificReviewRequired must be true');
 if(!Array.isArray(sb.cenas)||!sb.cenas.length) errors.push('cenas must be a non-empty array');
 const novos=new Set((sb.modelos_novos||[]).map(m=>m.nome));
 const ids=new Set();
 for(const c of sb.cenas||[]){
  const id=c.id||'?';
  if(ids.has(id)) errors.push(`${id}: duplicated id`); ids.add(id);
  if(!LAYOUTS.has(c.layout)) errors.push(`${id}: invalid layout ${c.layout}`);
  if(!MODELOS.has(c.modelo)&&!novos.has(c.modelo)) errors.push(`${id}: unknown modelo ${c.modelo}`);
  if(!Array.isArray(c.gatilhos)) errors.push(`${id}: gatilhos must be an array`);
  for(const g of c.gatilhos||[]){
   if(typeof g.palavra!=='string'||!g.palavra.trim()) errors.push(`${id}: gatilho without palavra`);
   for(const k of Object.keys(g.acao||{})) if(!ACOES.has(k)) errors.push(`${id}: unknown acao ${k}`);
  }
  for(const a of assessClaims(c.claims||[],sb.references||[])){
   if(a.status==='missing_source') errors.push(`${id}: claim without traceable source: "${a.claim}"`);
  }
 }
 const dur=estimateDuration(sb);
 if(sb.duracao_alvo&&Math.abs(dur-sb.duracao_alvo)>sb.duracao_alvo*0.25) warnings.push(`estimated ${dur}s vs target ${sb.duracao_alvo}s`);
 return {ok:!errors.length,errors,warnings,estimatedSeconds:dur};
}

// Gate before any render: valid storyboard + every scene approved by a human reviewer.
function assertRenderable(sb){
 const v=validateStoryboard(sb);
 const pending=(sb.cenas||[]).filter(c=>c.revisado!==true).map(c=>c.id);
 if(pending.length) v.errors.push(`scenes pending human review: ${pending.join(', ')}`);
 if(v.errors.length){const e=new Error('Storyboard not renderable:\n- '+v.errors.join('\n- '));e.errors=v.errors;throw e;}
 return v;
}

module.exports={createStoryboard,validateStoryboard,assertRenderable,estimateDuration,slugify,LAYOUTS,MODELOS,ACOES};
