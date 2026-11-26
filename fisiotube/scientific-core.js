'use strict';
// Evidence-first draft pipeline. No AI generation, OAuth, upload or paid services.
const BASE = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';
const TOOL = 'FisioTubeAI';

// Publication-type filters accepted by searchPubMed({tipos}). Keys are the names used in the CLI.
const TIPOS_ESTUDO = {
  metanalise: 'meta-analysis[pt]',
  revisao_sistematica: 'systematic review[pt]',
  ecr: 'randomized controlled trial[pt]',
  ensaio_clinico: 'clinical trial[pt]',
  diretriz: 'practice guideline[pt]',
  revisao: 'review[pt]',
};

const decode = s => s.replace(/&(?:amp|lt|gt|quot|apos);/g, x => ({'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'"}[x]));
const clean = s => decode(s.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim());
function textBetween(xml, tag) {
  const m = xml.match(new RegExp('<'+tag+'(?:\\s[^>]*)?>([\\s\\S]*?)<\\/'+tag+'>','i'));
  return m ? clean(m[1]) : '';
}

// NCBI allows 3 requests/s without an API key and 10/s with one. Requests are serialized through this queue.
let queue = Promise.resolve();
let lastRequest = 0;
function throttle(apiKey) {
  const gap = apiKey ? 110 : 350;
  const turn = queue.then(async () => {
    const wait = lastRequest + gap - Date.now();
    if (wait > 0) await new Promise(r => setTimeout(r, wait));
    lastRequest = Date.now();
  });
  queue = turn.catch(() => {});
  return turn;
}

function withNcbiParams(u, apiKey, email) {
  u.searchParams.set('tool', TOOL);
  if (email) u.searchParams.set('email', email);
  if (apiKey) u.searchParams.set('api_key', apiKey);
  return u;
}

async function get(url, {fetchImpl=globalThis.fetch, apiKey}={}) {
  if (fetchImpl === globalThis.fetch) await throttle(apiKey);
  const r = await fetchImpl(url, {headers:{'User-Agent':'FisioTubeAI/2.0 (academic prototype)'},signal:AbortSignal.timeout(15000)});
  if (!r.ok) throw new Error('PubMed HTTP '+r.status);
  return r;
}

const DATE = /^\d{4}(\/\d{2}(\/\d{2})?)?$/;

function buildTerm(query, tipos=[]) {
  if (!Array.isArray(tipos)) throw new Error('tipos must be an array');
  const filters = tipos.map(t => {
    if (!TIPOS_ESTUDO[t]) throw new Error('Unknown study type '+t+' (use: '+Object.keys(TIPOS_ESTUDO).join(', ')+')');
    return TIPOS_ESTUDO[t];
  });
  return filters.length ? '('+query+') AND ('+filters.join(' OR ')+')' : query;
}

async function searchPubMed(query,{maxResults=5,desde,ate,tipos=[],ordem='relevance',fetchImpl=globalThis.fetch,apiKey=process.env.NCBI_API_KEY,email=process.env.NCBI_EMAIL}={}) {
  if (typeof query!=='string'||!query.trim()||query.length>500) throw new Error('Invalid query');
  if (!Number.isInteger(maxResults)||maxResults<1||maxResults>20) throw new Error('maxResults must be 1..20');
  for (const d of [desde,ate]) if (d!==undefined && !DATE.test(String(d))) throw new Error('Dates must be YYYY, YYYY/MM or YYYY/MM/DD');
  if (!['relevance','pub_date'].includes(ordem)) throw new Error('ordem must be relevance or pub_date');
  const u=withNcbiParams(new URL(BASE+'/esearch.fcgi'),apiKey,email);
  u.searchParams.set('db','pubmed');u.searchParams.set('term',buildTerm(query,tipos));u.searchParams.set('retmode','json');
  u.searchParams.set('retmax',String(maxResults));u.searchParams.set('sort',ordem);
  if (desde!==undefined||ate!==undefined) {
    u.searchParams.set('datetype','pdat');
    u.searchParams.set('mindate',String(desde??'1800'));
    u.searchParams.set('maxdate',String(ate??'3000'));
  }
  const result=await (await get(u,{fetchImpl,apiKey})).json();
  const ids=result?.esearchresult?.idlist;
  if (!Array.isArray(ids)||!ids.every(id=>/^\d+$/.test(String(id)))) throw new Error('Invalid PubMed response');
  return ids.map(String);
}

// The article's own DOI lives in PubmedData/ArticleIdList. ReferenceList also carries ArticleId tags
// for every cited paper, so the search is limited to the part of the record before it.
function articleDoi(record) {
  const own = record.split(/<ReferenceList[\s>]/)[0];
  const ids = own.match(/<PubmedData(?:\s[^>]*)?>[\s\S]*?<ArticleIdList>([\s\S]*?)<\/ArticleIdList>/)?.[1];
  const doiTag = /<ArticleId\s+IdType="doi"[^>]*>([^<]+)<\/ArticleId>/i;
  const fromIds = (ids ?? own).match(doiTag)?.[1];
  const fromELocation = own.match(/<ELocationID\s+EIdType="doi"[^>]*>([^<]+)<\/ELocationID>/i)?.[1];
  return (fromIds||fromELocation||'').trim()||null;
}

function publicationYear(citation) {
  const pubDate = citation.match(/<PubDate>([\s\S]*?)<\/PubDate>/)?.[1]||'';
  const y = pubDate.match(/<Year>(\d{4})<\/Year>/)?.[1] || pubDate.match(/<MedlineDate>\s*(\d{4})/)?.[1];
  return y ? Number(y) : null;
}

// Coarse design label from PubMed publication types. It is a pointer for the reviewer, not an appraisal.
function classifyDesign(types=[]) {
  const t = types.map(x=>x.toLowerCase());
  if (t.includes('meta-analysis')) return 'metanalise';
  if (t.includes('systematic review')) return 'revisao_sistematica';
  if (t.includes('randomized controlled trial')) return 'ecr';
  if (t.some(x=>x.startsWith('clinical trial'))) return 'ensaio_clinico';
  if (t.includes('practice guideline')||t.includes('guideline')) return 'diretriz';
  if (t.includes('observational study')) return 'observacional';
  if (t.includes('case reports')) return 'relato_de_caso';
  if (t.includes('review')) return 'revisao_narrativa';
  return 'outro';
}

async function fetchPubMedArticles(pmids,{fetchImpl=globalThis.fetch,apiKey=process.env.NCBI_API_KEY,email=process.env.NCBI_EMAIL}={}) {
  if (!Array.isArray(pmids)||pmids.length>20||!pmids.every(id=>/^\d+$/.test(String(id)))) throw new Error('Invalid PMIDs');
  if (!pmids.length) return [];
  const u=withNcbiParams(new URL(BASE+'/efetch.fcgi'),apiKey,email);
  u.searchParams.set('db','pubmed');u.searchParams.set('id',pmids.join(','));u.searchParams.set('retmode','xml');
  const xml=await (await get(u,{fetchImpl,apiKey})).text();
  const records=[...xml.matchAll(/<PubmedArticle>([\s\S]*?)<\/PubmedArticle>/g)];
  return records.map(([,record])=>{
    const citation=record.match(/<MedlineCitation(?:\s[^>]*)?>([\s\S]*?)<\/MedlineCitation>/)?.[1]||record;
    const pmid=textBetween(citation,'PMID');
    const abstractXml=citation.match(/<Abstract(?:\s[^>]*)?>([\s\S]*?)<\/Abstract>/)?.[1]||'';
    const publicationTypes=[...citation.matchAll(/<PublicationType(?:\s[^>]*)?>([\s\S]*?)<\/PublicationType>/g)].map(m=>clean(m[1]));
    return {
      pmid,doi:articleDoi(record),title:textBetween(citation,'ArticleTitle'),
      abstract:[...abstractXml.matchAll(/<AbstractText(?:\s[^>]*)?>([\s\S]*?)<\/AbstractText>/g)].map(m=>clean(m[1])).join(' '),
      journal:textBetween(citation,'ISOAbbreviation')||textBetween(citation,'Title'),
      year:publicationYear(citation),publicationTypes,design:classifyDesign(publicationTypes),
      sourceUrl:'https://pubmed.ncbi.nlm.nih.gov/'+pmid+'/',retrievedAt:new Date().toISOString()
    };
  }).filter(x=>/^\d+$/.test(x.pmid)&&pmids.map(String).includes(x.pmid));
}

function assessClaims(claims,articles) {
  const ids=new Set(articles.map(a=>String(a.pmid)));
  return claims.map(c=>({claim:c.text,pmids:c.pmids||[],status:(c.pmids||[]).length && c.pmids.every(id=>ids.has(String(id)))?'source_linked_unverified':'missing_source',note:'Linkage is not evidence of support; expert review required.'}));
}

function toReference(a) {
  return {pmid:a.pmid,doi:a.doi,title:a.title,url:a.sourceUrl,year:a.year??null,journal:a.journal||null,design:a.design||null};
}

function createDraft(topic,articles) {
  const designs = articles.map(a=>`PMID ${a.pmid} (${a.design||'desenho não informado'}${a.year?', '+a.year:''})`);
  return {topic,status:'DRAFT_REVIEW_REQUIRED',publishingEnabled:false,paidGenerationEnabled:false,sections:[
    {type:'opening',text:'O que a pesquisa científica diz sobre '+topic+'?'},
    {type:'evidence',text:'Foram localizados '+articles.length+' registros no PubMed'+(designs.length?': '+designs.join('; ')+'.':'.')+' O desenho vem da classificação do PubMed e não substitui a leitura crítica dos estudos.'},
    {type:'closing',text:'Consulte as fontes e converse com um profissional qualificado antes de decisões clínicas.'}
  ],references:articles.map(toReference)};
}

module.exports={searchPubMed,fetchPubMedArticles,assessClaims,createDraft,classifyDesign,buildTerm,toReference,TIPOS_ESTUDO};
