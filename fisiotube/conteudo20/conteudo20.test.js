'use strict';
const test=require('node:test');const assert=require('node:assert/strict');
const path=require('path');
const {createStoryboard,validateStoryboard,assertRenderable,slugify}=require('./storyboard');
const {buildCenas,findPhrase,prepareWords,normalize}=require('./sync');
const exemplo=require('./exemplo/storyboard.json');
const words=require('./exemplo/words.json');
const clone=o=>JSON.parse(JSON.stringify(o));

test('skeleton keeps safety defaults and PubMed references',()=>{
 const sb=createStoryboard({topic:'TENS e hipertensão',draft:{references:[{pmid:'123',doi:'10.1/x',title:'Trial',url:'u'}]}});
 assert.equal(sb.publishingEnabled,false);assert.equal(sb.scientificReviewRequired,true);
 assert.equal(sb.status,'DRAFT_REVIEW_REQUIRED');assert.equal(sb.references[0].pmid,'123');
 assert.equal(sb.slug,'tens-e-hipertensao');
 assert.throws(()=>createStoryboard({}),/topic is required/);
});

test('slugify strips accents and symbols',()=>{assert.equal(slugify('Frequência & Tetania!'),'frequencia-tetania');});

test('example storyboard is valid',()=>{const v=validateStoryboard(exemplo);assert.equal(v.ok,true,v.errors.join('; '));});

test('claims without a known PMID are rejected',()=>{
 const sb=clone(exemplo);
 sb.cenas[0].claims=[{text:'10 Hz melhora a força',pmids:['999']}];
 assert.match(validateStoryboard(sb).errors.join(),/without traceable source/);
 sb.references=[{pmid:'999'}];
 assert.equal(validateStoryboard(sb).ok,true);
});

test('publishing can never be enabled through the storyboard',()=>{
 const sb=clone(exemplo);sb.publishingEnabled=true;
 assert.match(validateStoryboard(sb).errors.join(),/publishingEnabled/);
});

test('render gate requires human review of every scene',()=>{
 const sb=clone(exemplo);sb.cenas[1].revisado=false;
 assert.throws(()=>assertRenderable(sb),/pending human review: C2/);
 assert.doesNotThrow(()=>assertRenderable(exemplo));
});

test('normalize and multi-word phrase search',()=>{
 assert.equal(normalize('Tetânica,'),'tetanica');
 const w=prepareWords([{w:'a',s:0,e:.1},{w:'Intensidade',s:1,e:1.2},{w:'máxima.',s:1.3,e:1.5}],0);
 assert.equal(findPhrase(w,'intensidade máxima'),1);
 assert.equal(findPhrase(w,'intensidade máxima',2),-1);
});

test('sync turns trigger words into timed scenes',()=>{
 const {cenas,naoEncontrados}=buildCenas(exemplo,words,{inicio:0});
 assert.deepEqual(naoEncontrados,[]);
 const mods=cenas.cenas.map(c=>c.modelo);
 assert.deepEqual(mods,['gancho','osciloscopio','forca_fadiga','cta']);
 const osc=cenas.cenas[1];
 const at=palavra=>prepareWords(words,0)[findPhrase(prepareWords(words,0),palavra)].s;
 assert.deepEqual(osc.keyframes_hz.map(k=>k[1]),[10,15,20,30,50,80]);
 assert.equal(osc.keyframes_hz[0][0],at('10'));
 assert.equal(osc.rotulos.find(r=>r[1]==='Tetania')[0],at('tetânica'));
 assert.equal(osc.chips_ate,at('20'));
 const ff=cenas.cenas[2];
 assert.equal(ff.eventos.fadiga,at('mas também'));
 assert.ok(ff.t0<ff.eventos.freq_sobe&&ff.eventos.freq_sobe<ff.eventos.forca);
 assert.equal(cenas.cenas[0].t1,osc.t0);
 assert.equal(cenas.cenas[3].t0,ff.t1);
 assert.ok(cenas.camera_indisponivel.length>=2,'full-layout scenes become camera-off intervals');
});

test('missing trigger words are reported, not invented',()=>{
 const sb=clone(exemplo);sb.cenas[2].gatilhos.push({palavra:'palavra inexistente',acao:{chip:'x'}});
 const {naoEncontrados}=buildCenas(sb,words,{inicio:0});
 assert.deepEqual(naoEncontrados,[{cena:'C3',palavra:'palavra inexistente'}]);
});

test('time offset from the recording start is applied',()=>{
 const {cenas}=buildCenas(exemplo,words.map(w=>({...w,s:w.s+10,e:w.e+10})),{inicio:10});
 assert.deepEqual(cenas.cenas[1].keyframes_hz,buildCenas(exemplo,words,{inicio:0}).cenas.cenas[1].keyframes_hz);
 assert.equal(cenas.fonte.inicio,10);
});

test('a modelo cannot reappear after another block',()=>{
 const sb=clone(exemplo);sb.cenas.push({...clone(sb.cenas[0]),id:'C6',gatilhos:[]});
 assert.throws(()=>buildCenas(sb,words,{inicio:0}),/reappears/);
});

test('scene claims become an on-screen PMID source',()=>{
 const sb=clone(exemplo);sb.references=[{pmid:'123'}];sb.cenas[3].claims=[{text:'x',pmids:['123']}];
 const {cenas}=buildCenas(sb,words,{inicio:0});
 assert.equal(cenas.cenas[2].fonte,'Fonte: PMID 123');
});

test('cli parse handles flags and positional args',()=>{
 const {parse}=require(path.join('..','conteudo20-cli'));
 assert.deepEqual(parse(['a.json','--inicio','5','--x']),{pos:['a.json'],opt:{inicio:'5',x:true}});
});

test('novo_bloco allows repeated multi-block models; singletons stay unique',()=>{
 const sb=clone(exemplo);
 sb.cenas=[
  {id:'A',layout:'split',modelo:'cartao',params:{titulo:'Um'},gatilhos:[{palavra:'10',acao:{item:'x'}}]},
  {id:'B',layout:'split',modelo:'cartao',novo_bloco:true,params:{titulo:'Dois'},gatilhos:[{palavra:'tetânica',acao:{item:'y'}}]},
  {id:'C',layout:'split',modelo:'equacao',gatilhos:[{palavra:'aumenta a frequência',acao:{evento:'a'}}]}
 ];
 assert.equal(validateStoryboard(sb).ok,true);
 const {cenas}=buildCenas(sb,words,{inicio:0});
 const blocks=cenas.cenas.slice(1,-1);
 assert.deepEqual(blocks.map(b=>[b.modelo,b.titulo]),[['cartao','Um'],['cartao','Dois'],['equacao',undefined]]);
 assert.equal(blocks[2].eventos.a>blocks[1].t0,true);
});

test('camera_substituta passes through to cenas.json',()=>{
 const sb=clone(exemplo);sb.camera_substituta=[[0,5,12.3]];
 assert.deepEqual(buildCenas(sb,words,{inicio:0}).cenas.camera_substituta,[[0,5,12.3]]);
});

test('camera_substituta accepts b-roll video specs',()=>{
 const sb=clone(exemplo);sb.camera_substituta=[[0,5,{video:'broll/ex13.mp4',inicio:0,rotulo:'Exercício 13'}]];
 assert.equal(buildCenas(sb,words,{inicio:0}).cenas.camera_substituta[0][2].video,'broll/ex13.mp4');
});

// ---- formato v2 ----
const {validateRoteiro,assertRenderableV2}=require('./roteiro_v2');
const rv2=require('./exemplo/roteiro_v2.json');

test('v2 example roteiro is valid',()=>{const v=validateRoteiro(rv2);assert.equal(v.ok,true,v.errors.join('; '));assert.equal(v.totalSeconds,30.8);assert.deepEqual(v.warnings,[]);});

test('v2 prova needs a PMID present in references',()=>{
 const r=clone(rv2);r.cenas[4].fonte='Fulano 2024';
 assert.match(validateRoteiro(r).errors.join(),/without a PMID/);
 r.cenas[4].fonte='Fulano · PMID 999';
 assert.match(validateRoteiro(r).errors.join(),/without a PMID/);
});

test('v2 video scenes need a clip and objects a known icone',()=>{
 const r=clone(rv2);delete r.cenas[0].clip;r.cenas[2].icone='robo';
 const e=validateRoteiro(r).errors.join();
 assert.match(e,/C1: tipo hook needs clip/);assert.match(e,/C3: unknown icone/);
});

test('v2 warns on repeated screen type and slow rhythm',()=>{
 const r=clone(rv2);r.cenas[2]={...clone(r.cenas[1]),id:'C3'};r.cenas[3].dur=8;
 const w=validateRoteiro(r).warnings.join();
 assert.match(w,/same tipo as previous/);assert.match(w,/outside 1.5-6s/);
});

test('v2 render gate: publishing locked and human review required',()=>{
 const r=clone(rv2);r.cenas[3].revisado=false;
 assert.throws(()=>assertRenderableV2(r),/pending human review: C4/);
 const p=clone(rv2);p.publishingEnabled=true;
 assert.throws(()=>assertRenderableV2(p),/publishingEnabled/);
 assert.doesNotThrow(()=>assertRenderableV2(rv2));
});

test('v2 sales screens: lista needs itens, preco needs price source',()=>{
 const r=clone(rv2);
 r.cenas.splice(5,0,{id:'L',tipo:'lista',dur:5,kicker:'VOCÊ RECEBE',titulo:'Curso',itens:[],revisado:true},
  {id:'P',tipo:'preco',dur:5,kicker:'INSCRIÇÕES',plano:'Vitalício',por:'R$ 950',revisado:true});
 const e=validateRoteiro(r).errors.join();
 assert.match(e,/L: lista needs itens/);assert.match(e,/P: preco needs fonte_preco/);
 r.cenas[5].itens=['Certificado'];r.cenas[6].fonte_preco='site oficial, 19/11/2026';
 assert.equal(validateRoteiro(r).ok,true);
});

test('storyboard keeps study year, journal and design from the draft',()=>{
 const sb=createStoryboard({topic:'x',draft:{references:[{pmid:'1',title:'T',year:2020,journal:'J',design:'ecr'}]}});
 assert.equal(sb.references[0].design,'ecr');assert.equal(sb.references[0].year,2020);assert.equal(sb.references[0].journal,'J');
});
