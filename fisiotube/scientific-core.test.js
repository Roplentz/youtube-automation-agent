'use strict';
const test=require('node:test');const assert=require('node:assert/strict');
const {searchPubMed,fetchPubMedArticles,assessClaims,createDraft}=require('./scientific-core');
test('search validates query and bounds',async()=>{await assert.rejects(searchPubMed(''),/Invalid query/);await assert.rejects(searchPubMed('x',{maxResults:100}),/maxResults/);});
test('search returns validated PMIDs',async()=>{const ids=await searchPubMed('TENS hypertension',{fetchImpl:async()=>({ok:true,json:async()=>({esearchresult:{idlist:['123','456']}})})});assert.deepEqual(ids,['123','456']);});
test('fetch parses PMID and DOI',async()=>{const a=await fetchPubMedArticles(['123'],{fetchImpl:async()=>({ok:true,text:async()=>'<PubmedArticle><PMID>123</PMID><ArticleTitle>Example trial</ArticleTitle><ArticleId IdType="doi">10.1/test</ArticleId></PubmedArticle>'})});assert.equal(a[0].doi,'10.1/test');});
test('claims never get automatically verified',()=>{const a=assessClaims([{text:'TENS works',pmids:['123']}],[{pmid:'123'}]);assert.equal(a[0].status,'source_linked_unverified');});
test('draft cannot publish',()=>{const d=createDraft('TENS e hipertensão',[]);assert.equal(d.publishingEnabled,false);assert.equal(d.status,'DRAFT_REVIEW_REQUIRED');});
