'use strict';
const test=require('node:test');const assert=require('node:assert/strict');
const {validateRoteiro}=require('./roteiro_v2');
const {buildConferencia}=require('./conferencia');

const base=cenas=>({publishingEnabled:false,scientificReviewRequired:true,references:[{pmid:'1',design:'ecr',year:2021}],cenas});
const hook=dur=>({id:'h',tipo:'hook',dur,clip:['v.mp4',0]});
const fim=palavras=>({id:'f',tipo:'final',dur:3,palavras,rodape:'x'});
const has=(v,re)=>v.warnings.some(w=>re.test(w));

test('warns when the hook runs past 3 s or the video does not open with one',()=>{
 assert.ok(has(validateRoteiro(base([hook(3.6),fim(['MANDA PRA','UM COLEGA'])])),/gancho de 3.6s/));
 assert.ok(!has(validateRoteiro(base([hook(2.8),fim(['MANDA PRA','UM COLEGA'])])),/gancho/));
 assert.ok(has(validateRoteiro(base([{id:'k',tipo:'kinetic',dur:3,texto:'x'},fim(['MANDA'])])),/abrir com uma cena hook/));
});
test('asks for a send-oriented CTA',()=>{
 assert.ok(has(validateRoteiro(base([hook(2.5),fim(['SALVA','ESSE VÍDEO'])])),/CTA não pede envio/));
 assert.ok(!has(validateRoteiro(base([hook(2.5),fim(['ENVIE','PARA SUA EQUIPE'])])),/CTA/));
 assert.ok(has(validateRoteiro(base([hook(2.5)])),/fechar com uma cena final/));
});
test('warns past 60 s',()=>{
 const cenas=[hook(2.5),...Array.from({length:12},(_,i)=>({id:'k'+i,tipo:i%2?'kinetic':'footage',dur:5,texto:'x',clip:['v.mp4',0]})),fim(['MANDA'])];
 assert.ok(has(validateRoteiro(base(cenas)),/passa de 60s/));
});
test('prova reports its evidence level and asks for a caveat when weak',()=>{
 const prova={id:'p',tipo:'prova',dur:4,clip:['v.mp4',0],achado:'a',fonte:'PMID 1'};
 const v=validateRoteiro(base([hook(2.5),prova,fim(['MANDA'])]));
 assert.deepEqual(v.evidencia,[{id:'p',nivel:'B',selo:'EVIDÊNCIA MODERADA · ECR 2021'}]);
 const fraco=base([hook(2.5),prova,fim(['MANDA'])]);fraco.references[0].design='relato_de_caso';
 assert.ok(has(validateRoteiro(fraco),/inclua uma ressalva/));
 fraco.cenas[1].ressalva='Estudo único.';
 assert.ok(!has(validateRoteiro(fraco),/ressalva/));
 const sem=base([hook(2.5),prova,fim(['MANDA'])]);sem.references=[{pmid:'1'}];
 assert.ok(has(validateRoteiro(sem),/sem nível de evidência/));
});
test('conferencia pairs each prova with its abstract',()=>{
 const rt=base([{id:'p',tipo:'prova',numero:'n',achado:'a',fonte:'PMID 1; PMID 2'}]);
 const md=buildConferencia(rt,[{pmid:'1',title:'Trial',abstract:'Result X.',sourceUrl:'u',year:2021}]);
 assert.match(md,/## p — EVIDÊNCIA MODERADA · ECR 2021/);
 assert.match(md,/> Result X\./);
 assert.match(md,/PMID 2[\s\S]*Não encontrado/);
 assert.match(md,/- \[ \] O resumo sustenta o achado/);
});
