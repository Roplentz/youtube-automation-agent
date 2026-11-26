'use strict';
// Nível de evidência simplificado (A–D) a partir do desenho do estudo, no espírito da pirâmide de evidências.
// É um ponto de partida: GRADE de verdade considera risco de viés, inconsistência, imprecisão e evidência
// indireta, então o revisor pode sobrescrever com `nivel` (e `nivel_motivo`) na referência ou na cena.

const NIVEL_POR_DESENHO={
 metanalise:'A',revisao_sistematica:'A',diretriz:'A',
 ecr:'B',ensaio_clinico:'B',
 observacional:'C',
 relato_de_caso:'D',revisao_narrativa:'D',outro:'D'
};
const ROTULO_NIVEL={A:'EVIDÊNCIA FORTE',B:'EVIDÊNCIA MODERADA',C:'EVIDÊNCIA LIMITADA',D:'EVIDÊNCIA FRACA'};
const ROTULO_DESENHO={
 metanalise:'METANÁLISE',revisao_sistematica:'REVISÃO SISTEMÁTICA',diretriz:'DIRETRIZ',
 ecr:'ECR',ensaio_clinico:'ENSAIO CLÍNICO',observacional:'OBSERVACIONAL',
 relato_de_caso:'RELATO DE CASO',revisao_narrativa:'REVISÃO NARRATIVA',outro:'ESTUDO'
};
const ORDEM=['A','B','C','D'];
const valido=n=>ORDEM.includes(n);

function nivelDesenho(design){return NIVEL_POR_DESENHO[design]||null;}

// Nível efetivo de uma referência: o do revisor, se houver; senão o derivado do desenho.
function nivelReferencia(ref){
 if(!ref) return null;
 if(valido(ref.nivel)) return ref.nivel;
 return valido(ref.nivel_desenho)?ref.nivel_desenho:nivelDesenho(ref.design);
}

// Para um card que cita vários estudos, vale o mais forte, salvo se o revisor fixou `nivel` na cena.
function nivelCena(cena,references=[]){
 if(valido(cena?.nivel)) return {nivel:cena.nivel,ref:null};
 const pmids=[...String(cena?.fonte||'').matchAll(/PMID\s*:?\s*(\d+)/gi)].map(m=>m[1]);
 const refs=pmids.map(id=>references.find(r=>String(r.pmid)===id)).filter(Boolean);
 let best=null;
 for(const r of refs){const n=nivelReferencia(r);if(n&&(!best||ORDEM.indexOf(n)<ORDEM.indexOf(best.nivel))) best={nivel:n,ref:r};}
 return best||{nivel:null,ref:null};
}

// Texto do selo exibido no card de prova, ex.: "EVIDÊNCIA FORTE · METANÁLISE 2025".
function seloCena(cena,references=[]){
 const {nivel,ref}=nivelCena(cena,references);
 if(!nivel) return null;
 const partes=[ROTULO_NIVEL[nivel]];
 const desenho=ref?ROTULO_DESENHO[ref.design]:null;
 if(desenho) partes.push(desenho+(ref.year?' '+ref.year:''));
 return {nivel,texto:partes.join(' · ')};
}

module.exports={nivelDesenho,nivelReferencia,nivelCena,seloCena,NIVEL_POR_DESENHO,ROTULO_NIVEL,ROTULO_DESENHO};
