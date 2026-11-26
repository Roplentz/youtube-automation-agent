'use strict';
// Formato v2 do Conteúdo 2.0: o Reel é uma sequência de cenas com duração própria que alternam 6 tipos de tela.
// Este módulo só valida o roteiro e aplica as travas; quem desenha é render/render_v2.py.
const {assessClaims}=require('../scientific-core');
const {seloCena}=require('../evidencia');

const TIPOS=new Set(['hook','footage','kinetic','objeto','prova','dados','icone','lista','preco','final']);
const GRAFICOS=new Set(['icones','efeito','antes_depois']);
const COM_FONTE=new Set(['prova','dados']);
const num=v=>typeof v==='number'&&Number.isFinite(v);
const COM_VIDEO=new Set(['hook','footage','prova','icone']);
const ICONES=new Set(['exo','bolt','sensor','escudo']);
const DUR_MIN=1.5,DUR_MAX=6;
// Reels são ranqueados primeiro por tempo assistido/conclusão e depois por envios por alcance:
// gancho curto, vídeo enxuto e CTA que peça para enviar a alguém.
const GANCHO_MAX=3,TOTAL_MAX=60;
const CTA_ENVIO=/\b(ENVI|MAND|COMPARTILH|MARQU)/i;

// Campos de cada gráfico da tela `dados`. Os números vêm do estudo; o validador só checa coerência.
function validarDados(c){
 const e=[];
 if(!GRAFICOS.has(c.grafico)) return [`dados needs grafico: ${[...GRAFICOS].join(', ')}`];
 if(!c.titulo) e.push('dados needs titulo');
 if(c.grafico==='icones'){
  const total=c.total??100;
  if(!Number.isInteger(total)||total<10||total>100||total%10) e.push('icones: total must be 10..100 in steps of 10');
  for(const [rot,v] of [['valor',c.valor],['comparacao.valor',c.comparacao?.valor]]){
   if(rot==='comparacao.valor'&&!c.comparacao) continue;
   if(!Number.isInteger(v)||v<0||v>total) e.push(`icones: ${rot} must be an integer 0..${total}`);
  }
 }
 if(c.grafico==='efeito'){
  if(!num(c.estimativa)||!Array.isArray(c.ic)||!c.ic.every(num)) e.push('efeito needs estimativa and ic [inferior, superior]');
  else if(!(c.ic[0]<=c.estimativa&&c.estimativa<=c.ic[1])) e.push('efeito: estimativa must lie inside ic');
  if(c.escala_log&&Array.isArray(c.ic)&&!(c.ic[0]>0)) e.push('efeito: escala_log needs positive values (RR, OR, HR)');
  if(!c.medida) e.push('efeito needs medida (ex.: "diferença média, m" ou "RR")');
 }
 if(c.grafico==='antes_depois'&&!(num(c.antes)&&num(c.depois))) e.push('antes_depois needs antes and depois (numbers)');
 return e;
}

function validateRoteiro(rt){
 const errors=[],warnings=[];
 if(!rt||typeof rt!=='object') return {ok:false,errors:['roteiro must be an object'],warnings};
 if(rt.publishingEnabled!==false) errors.push('publishingEnabled must be false');
 if(rt.scientificReviewRequired!==true) errors.push('scientificReviewRequired must be true');
 const cenas=Array.isArray(rt.cenas)?rt.cenas:[];
 if(!cenas.length) errors.push('cenas must be a non-empty array');
 let total=0,prev=null;const evidencia=[];
 for(const c of cenas){
  const id=c.id||'?';
  if(!TIPOS.has(c.tipo)){errors.push(`${id}: unknown tipo ${c.tipo}`);continue;}
  if(!(c.dur>=DUR_MIN&&c.dur<=DUR_MAX)) warnings.push(`${id}: dur ${c.dur}s outside ${DUR_MIN}-${DUR_MAX}s (rhythm)`);
  total+=Number(c.dur)||0;
  if(prev&&prev===c.tipo&&c.tipo!=='footage') warnings.push(`${id}: same tipo as previous scene (${c.tipo})`);
  prev=c.tipo;
  if(COM_VIDEO.has(c.tipo)&&!(Array.isArray(c.clip)&&typeof c.clip[0]==='string')) errors.push(`${id}: tipo ${c.tipo} needs clip [arquivo, inicio]`);
  if((c.tipo==='objeto'||c.tipo==='icone')&&!ICONES.has(c.icone)) errors.push(`${id}: unknown icone ${c.icone}`);
  if(c.tipo==='lista'&&!(Array.isArray(c.itens)&&c.itens.length)) errors.push(`${id}: lista needs itens`);
  if(c.tipo==='preco'){
   if(!c.por||!c.plano) errors.push(`${id}: preco needs plano and por`);
   if(!c.fonte_preco) errors.push(`${id}: preco needs fonte_preco (where and when the price was checked)`);
  }
  if(c.tipo==='dados') for(const e of validarDados(c)) errors.push(`${id}: ${e}`);
  if(COM_FONTE.has(c.tipo)){
   const selo=seloCena(c,rt.references||[]);
   evidencia.push({id,nivel:selo?.nivel||null,selo:selo?.texto||null});
   if(!selo) warnings.push(`${id}: ${c.tipo} sem nível de evidência (rode o comando referencias ou defina nivel na cena)`);
   else if(selo.nivel==='D'&&!c.ressalva) warnings.push(`${id}: evidência fraca (nível D); inclua uma ressalva no card (campo ressalva)`);
   const pmids=String(c.fonte||'').match(/PMID\s*(\d+)/g)?.map(x=>x.replace(/\D/g,''))||[];
   for(const a of assessClaims([{text:c.achado||c.titulo||'',pmids}],rt.references||[])){
    if(a.status==='missing_source') errors.push(`${id}: ${c.tipo} without a PMID listed in references: "${a.claim}"`);
   }
  }
 }
 if(cenas.length){
  const primeira=cenas[0];
  if(primeira.tipo!=='hook') warnings.push(`${primeira.id||'?'}: o vídeo deveria abrir com uma cena hook`);
  else if(Number(primeira.dur)>GANCHO_MAX) warnings.push(`${primeira.id||'?'}: gancho de ${primeira.dur}s; mantenha até ${GANCHO_MAX}s para segurar os primeiros segundos`);
  const fim=cenas.at(-1);
  if(fim.tipo!=='final') warnings.push('o vídeo deveria fechar com uma cena final (CTA)');
  else if(!CTA_ENVIO.test((fim.palavras||[]).join(' '))) warnings.push(`${fim.id||'?'}: CTA não pede envio; envios por DM pesam mais que curtidas para alcançar quem não segue (ex.: MANDA PRA / UM COLEGA)`);
 }
 if(total>TOTAL_MAX) warnings.push(`total ${total.toFixed(1)}s passa de ${TOTAL_MAX}s; Reels mais curtos tendem a ter mais conclusão e replay`);
 return {ok:!errors.length,errors,warnings,totalSeconds:Math.round(total*10)/10,evidencia};
}

function assertRenderableV2(rt){
 const v=validateRoteiro(rt);
 const pending=(rt.cenas||[]).filter(c=>c.revisado!==true).map(c=>c.id);
 if(pending.length) v.errors.push(`scenes pending human review: ${pending.join(', ')}`);
 if(v.errors.length){const e=new Error('Roteiro not renderable:\n- '+v.errors.join('\n- '));e.errors=v.errors;throw e;}
 return v;
}

module.exports={validateRoteiro,validarDados,assertRenderableV2,TIPOS,ICONES,GRAFICOS,GANCHO_MAX,TOTAL_MAX};
