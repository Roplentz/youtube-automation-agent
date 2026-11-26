'use strict';
const test=require('node:test');const assert=require('node:assert/strict');
const {collectPmids,mergeReferences,enrichReferences}=require('./referencias');

const roteiro={references:[{pmid:'111',nota:'ler texto completo'}],cenas:[{id:'c1',tipo:'prova',fonte:'Silva 2021, PMID 222'},{id:'c2',tipo:'kinetic'}]};

test('collects PMIDs from references, prova sources and claims',()=>{
 assert.deepEqual(collectPmids(roteiro),['111','222']);
 assert.deepEqual(collectPmids({cenas:[{claims:[{pmids:['333']}]}]}),['333']);
});
test('merge fills metadata, keeps reviewer notes and reports gaps',()=>{
 const {doc,naoEncontrados,fracos}=mergeReferences(roteiro,[{pmid:'111',title:'Trial',doi:'10.1/x',sourceUrl:'u',year:2020,journal:'J',design:'case_reports_placeholder'}]);
 assert.equal(doc.references[0].nota,'ler texto completo');
 assert.equal(doc.references[0].title,'Trial');assert.equal(doc.references[0].year,2020);
 assert.deepEqual(doc.references[1],{pmid:'222'});
 assert.deepEqual(naoEncontrados,['222']);
 assert.deepEqual(fracos,[]);
 assert.notEqual(doc,roteiro);
});
test('flags weak designs',()=>{
 const {fracos}=mergeReferences({references:[{pmid:'1'}]},[{pmid:'1',design:'relato_de_caso'}]);
 assert.deepEqual(fracos,['1']);
});
test('enrich calls PubMed once for up to 20 PMIDs',async()=>{
 let calls=0;
 const fetchImpl=async()=>{calls++;return {ok:true,text:async()=>'<PubmedArticle><MedlineCitation><PMID>222</PMID><Article><ArticleTitle>Found</ArticleTitle></Article></MedlineCitation></PubmedArticle>'};};
 const {doc,naoEncontrados}=await enrichReferences(roteiro,{fetchImpl});
 assert.equal(calls,1);assert.equal(doc.references[1].title,'Found');assert.deepEqual(naoEncontrados,['111']);
});
