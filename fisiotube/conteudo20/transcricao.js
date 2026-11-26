'use strict';
// Corrige a transcrição (words.json) antes da sincronia e das legendas, sem mexer nos tempos.
// 1) Junta automaticamente o que o Whisper costuma quebrar: continuação com hífen ("meta" + "-análise" =
//    "metanálise", fundindo a vogal repetida na emenda)
//    e o símbolo de porcentagem solto ("35" + "%").
// 2) Aplica `correcoes_transcricao` do storyboard: frase errada → forma certa, ex.
//    {"o zempique": "Ozempic", "aquilo@2.8": "quilo"}. A chave pode ter várias palavras (viram uma só);
//    "@tempo" limita a correção à ocorrência que começa perto daquele segundo (±1 s).
// Puro e determinístico: sem rede, sem IA.

const norm=w=>String(w).normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'');
const PONTUACAO_FINAL=/[.,!?;:…]+$/;

function juntarQuebras(words){
 const out=[];
 for(const w of words){
  const prev=out[out.length-1];
  const txt=String(w.w);
  if(prev&&/^-\p{L}/u.test(txt)){
   const cont=txt.slice(1);
   // vogal repetida na emenda se funde, como em meta + análise = metanálise
   const base=norm(prev.w.slice(-1))===norm(cont[0])&&/[aeiou]/.test(norm(cont[0]))?prev.w.slice(0,-1):prev.w;
   prev.w=base+cont;prev.e=w.e;prev._fix=true;continue;
  }
  if(prev&&/^%[.,!?;:]?$/.test(txt)&&/\d$/.test(prev.w)){prev.w+=txt;prev.e=w.e;prev._fix=true;continue;}
  out.push({...w});
 }
 return out;
}

function parseChave(chave){
 const m=String(chave).match(/^(.*?)@(\d+(?:\.\d+)?)$/);
 const frase=(m?m[1]:chave).trim();
 return {toks:frase.split(/\s+/).map(norm).filter(Boolean),t:m?Number(m[2]):null};
}

function corrigirTranscricao(words,mapa={}){
 if(!Array.isArray(words)) throw new Error('words must be an array');
 let ws=juntarQuebras(words);
 const aplicadas=ws.filter(w=>w._fix).map(w=>({de:'(quebra)',para:w.w,s:w.s}));
 for(const [chave,certo] of Object.entries(mapa||{})){
  const {toks,t}=parseChave(chave);
  if(!toks.length) continue;
  const out=[];
  for(let i=0;i<ws.length;i++){
   const casa=i+toks.length<=ws.length&&toks.every((tk,j)=>norm(ws[i+j].w)===tk)&&(t===null||Math.abs(ws[i].s-t)<=1);
   if(!casa){out.push(ws[i]);continue;}
   const ultimo=ws[i+toks.length-1];
   const pont=(String(ultimo.w).match(PONTUACAO_FINAL)||[''])[0];
   out.push({w:String(certo)+pont,s:ws[i].s,e:ultimo.e});
   aplicadas.push({de:ws.slice(i,i+toks.length).map(x=>x.w).join(' '),para:String(certo),s:ws[i].s});
   i+=toks.length-1;
  }
  ws=out;
 }
 return {words:ws.map(({_fix,...w})=>w),aplicadas};
}

module.exports={corrigirTranscricao,juntarQuebras};
