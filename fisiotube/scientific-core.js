'use strict';
// Evidence-first draft pipeline. No AI generation, OAuth, upload or paid services.
const BASE = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
function textBetween(xml, tag) {
  const m = xml.match(new RegExp('<'+tag+'(?:\\s[^>]*)?>([\\s\\S]*?)<\\/'+tag+'>','i'));
  return m ? m[1].replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim() : '';
}
async function get(url, fetchImpl=globalThis.fetch) {
  const r = await fetchImpl(url, {headers:{'User-Agent':'FisioTubeAI/2.0 (academic prototype)'}});
  if (!r.ok) throw new Error('PubMed HTTP '+r.status);
  return r;
}
async function searchPubMed(query,{maxResults=5,fetchImpl=globalThis.fetch}={}) {
  if (typeof query!=='string'||!query.trim()||query.length>500) throw new Error('Invalid query');
  if (!Number.isInteger(maxResults)||maxResults<1||maxResults>20) throw new Error('maxResults must be 1..20');
  const u=new URL(BASE+'/esearch.fcgi'); u.searchParams.set('db','pubmed');u.searchParams.set('term',query);u.searchParams.set('retmode','json');u.searchParams.set('retmax',String(maxResults));
  const result=await (await get(u,fetchImpl)).json();
  const ids=result?.esearchresult?.idlist;
  if (!Array.isArray(ids)||!ids.every(id=>/^\d+$/.test(String(id)))) throw new Error('Invalid PubMed response');
  return ids.map(String);
}
async function fetchPubMedArticles(pmids,{fetchImpl=globalThis.fetch}={}) {
  if (!Array.isArray(pmids)||pmids.length>20||!pmids.every(id=>/^\d+$/.test(String(id)))) throw new Error('Invalid PMIDs');
  if (!pmids.length) return [];
  const u=new URL(BASE+'/efetch.fcgi');u.searchParams.set('db','pubmed');u.searchParams.set('id',pmids.join(','));u.searchParams.set('retmode','xml');
  const xml=await (await get(u,fetchImpl)).text();
  const records=[...xml.matchAll(/<PubmedArticle>([\s\S]*?)<\/PubmedArticle>/g)];
  return records.map(([,record])=>{
    const pmid=textBetween(record,'PMID');
    const doi=record.match(/<ArticleId\s+IdType="doi"[^>]*>([^<]+)<\/ArticleId>/i)?.[1]||null;
    return {pmid,doi,title:textBetween(record,'ArticleTitle'),abstract:textBetween(record,'AbstractText'),sourceUrl:'https://pubmed.ncbi.nlm.nih.gov/'+pmid+'/',retrievedAt:new Date().toISOString()};
  }).filter(x=>/^\d+$/.test(x.pmid));
}
function assessClaims(claims,articles) {
  const ids=new Set(articles.map(a=>a.pmid));
  return claims.map(c=>({claim:c.text,pmids:c.pmids||[],status:(c.pmids||[]).length && c.pmids.every(id=>ids.has(String(id)))?'source_linked_unverified':'missing_source',note:'Linkage is not evidence of support; expert review required.'}));
}
function createDraft(topic,articles) {
  return {topic,status:'DRAFT_REVIEW_REQUIRED',publishingEnabled:false,paidGenerationEnabled:false,sections:[{type:'opening',text:'O que a pesquisa científica diz sobre '+topic+'?'},{type:'evidence',text:'Foram localizados '+articles.length+' registros no PubMed. A interpretação dos resultados depende da leitura crítica dos estudos.'},{type:'closing',text:'Consulte as fontes e converse com um profissional qualificado antes de decisões clínicas.'}],references:articles.map(a=>({pmid:a.pmid,doi:a.doi,title:a.title,url:a.sourceUrl}))};
}
module.exports={searchPubMed,fetchPubMedArticles,assessClaims,createDraft};
