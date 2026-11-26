'use strict';
const test=require('node:test');const assert=require('node:assert/strict');
const {searchPubMed,fetchPubMedArticles,assessClaims,createDraft,classifyDesign,buildTerm}=require('./scientific-core');
test('search validates query and bounds',async()=>{await assert.rejects(searchPubMed(''),/Invalid query/);await assert.rejects(searchPubMed('x',{maxResults:100}),/maxResults/);});
test('search returns validated PMIDs',async()=>{const ids=await searchPubMed('TENS hypertension',{fetchImpl:async()=>({ok:true,json:async()=>({esearchresult:{idlist:['123','456']}})})});assert.deepEqual(ids,['123','456']);});
test('fetch parses PMID and DOI',async()=>{const a=await fetchPubMedArticles(['123'],{fetchImpl:async()=>({ok:true,text:async()=>'<PubmedArticle><PMID>123</PMID><ArticleTitle>Example trial</ArticleTitle><ArticleId IdType="doi">10.1/test</ArticleId></PubmedArticle>'})});assert.equal(a[0].doi,'10.1/test');});
test('claims never get automatically verified',()=>{const a=assessClaims([{text:'TENS works',pmids:['123']}],[{pmid:'123'}]);assert.equal(a[0].status,'source_linked_unverified');});
test('draft cannot publish',()=>{const d=createDraft('TENS e hipertensão',[]);assert.equal(d.publishingEnabled,false);assert.equal(d.status,'DRAFT_REVIEW_REQUIRED');});

test('structured abstracts and HTML entities',async()=>{
 const xml='<PubmedArticle><MedlineCitation><PMID>123</PMID><Article><ArticleTitle>TENS &amp; hypertension</ArticleTitle><Abstract><AbstractText Label="BACKGROUND">First &amp; second.</AbstractText><AbstractText Label="RESULTS">Reduction observed.</AbstractText></Abstract></Article></MedlineCitation><PubmedData><ArticleIdList><ArticleId IdType="doi">10.1/test</ArticleId></ArticleIdList></PubmedData></PubmedArticle>';
 const a=await fetchPubMedArticles(['123'],{fetchImpl:async()=>({ok:true,text:async()=>xml})});
 assert.equal(a[0].title,'TENS & hypertension');
 assert.equal(a[0].abstract,'First & second. Reduction observed.');
});
test('unrequested PMID is excluded',async()=>{
 const a=await fetchPubMedArticles(['123'],{fetchImpl:async()=>({ok:true,text:async()=>'<PubmedArticle><PMID>999</PMID></PubmedArticle>'})});
 assert.equal(a.length,0);
});

test('DOI comes from the article, never from its reference list',async()=>{
 const xml='<PubmedArticle><MedlineCitation><PMID>123</PMID><Article><ArticleTitle>T</ArticleTitle></Article></MedlineCitation><PubmedData><ArticleIdList><ArticleId IdType="pubmed">123</ArticleId></ArticleIdList><ReferenceList><Reference><ArticleIdList><ArticleId IdType="doi">10.9/cited-paper</ArticleId></ArticleIdList></Reference></ReferenceList></PubmedData></PubmedArticle>';
 const a=await fetchPubMedArticles(['123'],{fetchImpl:async()=>({ok:true,text:async()=>xml})});
 assert.equal(a[0].doi,null);
});
test('DOI falls back to ELocationID',async()=>{
 const xml='<PubmedArticle><MedlineCitation><PMID>123</PMID><Article><ELocationID EIdType="doi" ValidYN="Y">10.1/eloc</ELocationID></Article></MedlineCitation><PubmedData><ArticleIdList><ArticleId IdType="pubmed">123</ArticleId></ArticleIdList></PubmedData></PubmedArticle>';
 const a=await fetchPubMedArticles(['123'],{fetchImpl:async()=>({ok:true,text:async()=>xml})});
 assert.equal(a[0].doi,'10.1/eloc');
});
test('parses year, journal and study design',async()=>{
 const xml='<PubmedArticle><MedlineCitation><PMID>123</PMID><Article><Journal><JournalIssue><PubDate><Year>2021</Year><Month>Mar</Month></PubDate></JournalIssue><Title>Physical Therapy</Title><ISOAbbreviation>Phys Ther</ISOAbbreviation></Journal><ArticleTitle>T</ArticleTitle><PublicationTypeList><PublicationType UI="D016428">Journal Article</PublicationType><PublicationType UI="D016449">Randomized Controlled Trial</PublicationType></PublicationTypeList></Article></MedlineCitation></PubmedArticle>';
 const a=await fetchPubMedArticles(['123'],{fetchImpl:async()=>({ok:true,text:async()=>xml})});
 assert.equal(a[0].year,2021);assert.equal(a[0].journal,'Phys Ther');assert.equal(a[0].design,'ecr');
 const d=createDraft('x',a);assert.equal(d.references[0].design,'ecr');assert.match(d.sections[1].text,/PMID 123 \(ecr, 2021\)/);
});
test('design ranking prefers the strongest publication type',()=>{
 assert.equal(classifyDesign(['Review','Systematic Review','Meta-Analysis']),'metanalise');
 assert.equal(classifyDesign(['Clinical Trial, Phase II']),'ensaio_clinico');
 assert.equal(classifyDesign(['Journal Article']),'outro');
});
test('search sends date range, study types and sort',async()=>{
 let url;
 await searchPubMed('TENS',{desde:'2015',ate:'2026/06',tipos:['ecr','revisao_sistematica'],ordem:'pub_date',fetchImpl:async u=>{url=new URL(String(u));return {ok:true,json:async()=>({esearchresult:{idlist:[]}})};}});
 assert.equal(url.searchParams.get('term'),'(TENS) AND (randomized controlled trial[pt] OR systematic review[pt])');
 assert.equal(url.searchParams.get('mindate'),'2015');assert.equal(url.searchParams.get('maxdate'),'2026/06');
 assert.equal(url.searchParams.get('datetype'),'pdat');assert.equal(url.searchParams.get('sort'),'pub_date');
 assert.equal(url.searchParams.get('tool'),'FisioTubeAI');
});
test('search rejects bad filters',async()=>{
 await assert.rejects(searchPubMed('x',{desde:'ontem'}),/Dates/);
 await assert.rejects(searchPubMed('x',{tipos:['opiniao']}),/Unknown study type/);
 assert.equal(buildTerm('x'),'x');
});
