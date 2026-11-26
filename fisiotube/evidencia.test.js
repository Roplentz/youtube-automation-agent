'use strict';
const test=require('node:test');const assert=require('node:assert/strict');
const {nivelDesenho,nivelReferencia,nivelCena,seloCena}=require('./evidencia');

test('design maps to A–D',()=>{
 assert.equal(nivelDesenho('metanalise'),'A');assert.equal(nivelDesenho('ecr'),'B');
 assert.equal(nivelDesenho('observacional'),'C');assert.equal(nivelDesenho('relato_de_caso'),'D');
 assert.equal(nivelDesenho('desconhecido'),null);
});
test('reviewer level overrides the design level',()=>{
 assert.equal(nivelReferencia({design:'ecr',nivel:'C'}),'C');
 assert.equal(nivelReferencia({design:'ecr',nivel:'Z'}),'B');
});
test('card takes the strongest cited study unless the scene sets nivel',()=>{
 const refs=[{pmid:'1',design:'ecr',year:2020},{pmid:'2',design:'metanalise',year:2024}];
 assert.equal(nivelCena({fonte:'PMID 1; PMID 2'},refs).nivel,'A');
 assert.equal(nivelCena({fonte:'PMID 2',nivel:'B'},refs).nivel,'B');
 assert.deepEqual(seloCena({fonte:'PMID 2'},refs),{nivel:'A',texto:'EVIDÊNCIA FORTE · METANÁLISE 2024'});
 assert.equal(seloCena({fonte:'PMID 9'},refs),null);
});
