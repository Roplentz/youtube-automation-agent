'use strict';
const test=require('node:test');const assert=require('node:assert/strict');
const {prepareScientificStrategy}=require('./strategy-adapter');
test('bridges mocked PubMed search into a safe upstream strategy',async()=>{
 const calls=[];
 const fetchImpl=async url=>{
  calls.push(String(url));
  if(String(url).includes('esearch.fcgi'))return {ok:true,json:async()=>({esearchresult:{idlist:['123']}})};
  return {ok:true,text:async()=>'<PubmedArticle><MedlineCitation><PMID>123</PMID><Article><ArticleTitle>Trial</ArticleTitle><Abstract><AbstractText>Sample</AbstractText></Abstract></Article></MedlineCitation></PubmedArticle>'};
 };
 const x=await prepareScientificStrategy({topic:'TENS e hipertensão',query:'TENS hypertension',fetchImpl});
 assert.equal(x.articleCount,1);assert.equal(x.strategy.researchSources[0].pmid,'123');
 assert.equal(x.strategy.scientificReviewRequired,true);
 assert.equal(x.strategy.publishingEnabled,false);
 assert.equal(x.draft.status,'DRAFT_REVIEW_REQUIRED');
 assert.equal(calls.length,2);
});
test('missing topic is rejected without network calls',async()=>{await assert.rejects(prepareScientificStrategy({}),/topic is required/);});
