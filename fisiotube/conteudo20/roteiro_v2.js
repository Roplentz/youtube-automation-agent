'use strict';
// Formato v2 do Conteúdo 2.0: o Reel é uma sequência de cenas com duração própria que alternam 6 tipos de tela.
// Este módulo só valida o roteiro e aplica as travas; quem desenha é render/render_v2.py.
const {assessClaims}=require('../scientific-core');
const {seloCena}=require('../evidencia');

const TIPOS=new Set(['hook','footage','kinetic','objeto','prova','icone','lista','preco','final']);
const COM_VIDEO=new Set(['hook','footage','prova','icone']);
const ICONES=new Set(['exo','bolt','sensor','escudo']);
const DUR_MIN=1.5,DUR_MAX=6;
// Reels são ranqueados primeiro por tempo assistido/conclusão e depois por envios por alcance:
// gancho curto, vídeo enxuto e CTA que peça para enviar a alguém.
const GANCHO_MAX=3,TOTAL_MAX=60;
const CTA_ENVIO=/\b(ENVI|MAND|COMPARTILH|MARQU)/i;

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
  if(c.tipo==='prova'){
   const selo=seloCena(c,rt.references||[]);
   evidencia.push({id,nivel:selo?.nivel||null,selo:selo?.texto||null});
   if(!selo) warnings.push(`${id}: prova sem nível de evidência (rode o comando referencias ou defina nivel na cena)`);
   else if(selo.nivel==='D'&&!c.ressalva) warnings.push(`${id}: evidência fraca (nível D); inclua uma ressalva no card (campo ressalva)`);
   const pmids=String(c.fonte||'').match(/PMID\s*(\d+)/g)?.map(x=>x.replace(/\D/g,''))||[];
   for(const a of assessClaims([{text:c.achado||'',pmids}],rt.references||[])){
    if(a.status==='missing_source') errors.push(`${id}: prova without a PMID listed in references: "${a.claim}"`);
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

module.exports={validateRoteiro,assertRenderableV2,TIPOS,ICONES,GANCHO_MAX,TOTAL_MAX};
