'use strict';
const test=require('node:test');const assert=require('node:assert/strict');
const {corrigirTranscricao}=require('./transcricao');
const {buildCenas}=require('./sync');

const w=(...xs)=>xs.map(([t,s])=>({w:t,s,e:s+0.2}));

test('joins hyphen continuations and loose percent signs',()=>{
 const {words}=corrigirTranscricao(w(['Numa',1],['meta',1.2],['-análise',1.4],['de',1.7],['35',2],['%',2.3],['do',2.6]));
 assert.deepEqual(words.map(x=>x.w),['Numa','metanálise','de','35%','do']);
 assert.equal(words[1].s,1.2);assert.ok(Math.abs(words[1].e-1.6)<1e-9);
});
test('applies multi-word corrections and keeps trailing punctuation',()=>{
 const {words,aplicadas}=corrigirTranscricao(w(['O',0],['zempique',0.1],['emagrece,',0.6],['usa',5],['o',5.2],['zempique.',5.3]),{'o zempique':'Ozempic'});
 assert.deepEqual(words.map(x=>x.w),['Ozempic','emagrece,','usa','Ozempic.']);
 assert.ok(Math.abs(words[0].e-0.3)<1e-9);
 assert.equal(aplicadas.length,2);
});
test('time-scoped correction only touches the nearby occurrence',()=>{
 const {words}=corrigirTranscricao(w(['mais',3],['real',3.2],['mais',9],['tarde',9.2]),{'mais@3':'mas'});
 assert.deepEqual(words.map(x=>x.w),['mas','real','mais','tarde']);
});
test('sync finds triggers only after correction',()=>{
 const sb={cenas:[{id:'c1',modelo:'numero',gatilhos:[{palavra:'metanálise',acao:{}},{palavra:'35',acao:{evento:'conta'}}]}]};
 const raw=w(['Numa',4],['meta',4.2],['-análise',4.4],['cerca',5],['de',5.2],['35',5.4],['%',5.6],['fim',8]);
 assert.equal(buildCenas(sb,raw).naoEncontrados.length,1);
 const {words}=corrigirTranscricao(raw);
 const r=buildCenas(sb,words);
 assert.deepEqual(r.naoEncontrados,[]);
 assert.equal(r.cenas.cenas[1].eventos.conta,5.4);
});

test('Ozempic example storyboard is valid and renderable',()=>{
 const {assertRenderable}=require('./storyboard');
 const sb=require('./exemplo/ozempic/storyboard.json');
 assertRenderable(sb);
 assert.ok(Array.isArray(sb.camera_substituta)&&sb.camera_substituta.length===6);
 assert.equal(sb.correcoes_transcricao['o zempique'],'Ozempic');
});
