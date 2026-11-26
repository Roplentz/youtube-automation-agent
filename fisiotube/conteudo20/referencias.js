'use strict';
// Preenche `references` de um roteiro v2 ou storyboard com os metadados do PubMed (título, DOI, ano,
// revista, desenho do estudo e nível A–D pelo desenho) a partir dos PMIDs citados. Não avalia evidência nem marca nada como revisado.
const {fetchPubMedArticles,toReference}=require('../scientific-core');
const {nivelDesenho,nivelReferencia}=require('../evidencia');

const PMID_IN_TEXT=/PMID\s*:?\s*(\d+)/gi;

function collectPmids(doc){
 const ids=new Set();
 for(const r of doc?.references||[]) if(/^\d+$/.test(String(r.pmid))) ids.add(String(r.pmid));
 for(const c of doc?.cenas||[]){
  for(const m of String(c.fonte||'').matchAll(PMID_IN_TEXT)) ids.add(m[1]);
  for(const claim of c.claims||[]) for(const id of claim.pmids||[]) if(/^\d+$/.test(String(id))) ids.add(String(id));
 }
 return [...ids];
}

// Mantém campos escritos à mão (ex.: notas do revisor) e só sobrescreve os metadados bibliográficos.
function mergeReferences(doc,articles){
 const byId=new Map(articles.map(a=>[String(a.pmid),toReference(a)]));
 const pmids=collectPmids(doc);
 const old=new Map((doc.references||[]).map(r=>[String(r.pmid),r]));
 const references=pmids.map(id=>{
  if(!byId.has(id)) return old.get(id)||{pmid:id};
  const ref={...old.get(id),...byId.get(id)};
  ref.nivel_desenho=nivelDesenho(ref.design);
  return ref;
 });
 const naoEncontrados=pmids.filter(id=>!byId.has(id));
 const fracos=references.filter(r=>nivelReferencia(r)==='D').map(r=>r.pmid);
 return {doc:{...doc,references},naoEncontrados,fracos};
}

async function enrichReferences(doc,{fetchImpl}={}){
 const pmids=collectPmids(doc);
 const articles=[];
 for(let i=0;i<pmids.length;i+=20) articles.push(...await fetchPubMedArticles(pmids.slice(i,i+20),{fetchImpl}));
 return mergeReferences(doc,articles);
}

module.exports={collectPmids,mergeReferences,enrichReferences};
