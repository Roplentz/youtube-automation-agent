'use strict';
// Gera uma folha de conferência: cada card de prova lado a lado com o resumo do(s) estudo(s) citado(s),
// para o revisor (ou o Claude, numa conversa) checar se o resumo sustenta a frase. Não decide nada sozinho.
const {fetchPubMedArticles}=require('../scientific-core');
const {seloCena}=require('../evidencia');

const COM_FONTE=new Set(['prova','dados']);
const numerosDados=c=>c.grafico==='icones'?`${c.valor} de ${c.total||100}${c.comparacao?` vs ${c.comparacao.valor} (${c.comparacao.rotulo||'controle'})`:''} ${c.unidade_texto||''}`
 :c.grafico==='efeito'?`${c.estimativa} (IC 95% ${c.ic?.[0]} a ${c.ic?.[1]}) ${c.medida||''}`
 :c.grafico==='antes_depois'?`${c.antes} → ${c.depois} ${c.unidade||''}`:'—';
const pmidsDe=c=>[...String(c.fonte||'').matchAll(/PMID\s*:?\s*(\d+)/gi)].map(m=>m[1]);

function buildConferencia(rt,articles){
 const byId=new Map(articles.map(a=>[String(a.pmid),a]));
 const provas=(rt.cenas||[]).filter(c=>COM_FONTE.has(c.tipo));
 const out=[`# Conferência de evidência — ${rt.titulo||rt.slug||'roteiro'}`,'',
  'Para cada card: o resumo sustenta o número e o achado, na mesma população e no mesmo desfecho? A força da frase combina com o nível?','',
  'Marque `revisado: true` na cena só depois de conferir.',''];
 if(!provas.length) out.push('_Nenhuma cena do tipo prova ou dados._');
 for(const c of provas){
  const selo=seloCena(c,rt.references||[]);
  out.push(`## ${c.id||'?'}${selo?' — '+selo.texto:' — nível não definido'}`,'',
   c.tipo==='dados'?`- **Gráfico (${c.grafico}):** ${c.titulo||''} · ${numerosDados(c).trim()}`:`- **Número no card:** ${c.numero||'—'}`,`- **Achado no card:** ${c.achado||'—'}`,`- **Fonte:** ${c.fonte||'—'}`);
  if(c.ressalva) out.push(`- **Ressalva:** ${c.ressalva}`);
  out.push('');
  for(const id of pmidsDe(c)){
   const a=byId.get(id);
   if(!a){out.push(`### PMID ${id}`,'','_Não encontrado no PubMed._','');continue;}
   out.push(`### PMID ${id} — ${a.title}`,'',`${a.journal||''}${a.year?' ('+a.year+')':''}${a.doi?' · doi:'+a.doi:''} · ${a.sourceUrl}`,'',
    a.abstract?'> '+a.abstract:'_Sem resumo no PubMed: confira no texto completo._','');
  }
  out.push('- [ ] O resumo sustenta o número','- [ ] O resumo sustenta o achado (população, intervenção, desfecho)','- [ ] A força da frase combina com o nível de evidência','');
 }
 return out.join('\n');
}

async function conferir(rt,{fetchImpl}={}){
 const ids=[...new Set((rt.cenas||[]).filter(c=>COM_FONTE.has(c.tipo)).flatMap(pmidsDe))];
 const articles=[];
 for(let i=0;i<ids.length;i+=20) articles.push(...await fetchPubMedArticles(ids.slice(i,i+20),{fetchImpl}));
 return buildConferencia(rt,articles);
}

module.exports={buildConferencia,conferir};
