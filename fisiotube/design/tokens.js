'use strict';
// Carrega o design system e o expõe como variáveis CSS para os cards em HTML.
const fs=require('fs');
const path=require('path');

const TOKENS_PATH=path.join(__dirname,'tokens.json');
let cache=null;
function loadTokens(){
 if(!cache) cache=JSON.parse(fs.readFileSync(TOKENS_PATH,'utf8'));
 return cache;
}

const familia=list=>list.map(f=>/\s/.test(f)&&!f.includes('-')?`'${f}'`:f).join(', ');

function cssVars(t=loadTokens()){
 const linhas=[];
 for(const [k,v] of Object.entries(t.cor)) linhas.push(`--${k.replace(/_/g,'-')}: ${v};`);
 for(const [k,v] of Object.entries(t.nivel)) linhas.push(`--nivel-${k}: ${v};`);
 linhas.push(`--fonte-titulo: ${familia(t.fonte.titulo)};`,`--fonte-texto: ${familia(t.fonte.texto)};`);
 linhas.push(`--raio-card: ${t.raio.card}px;`,`--raio-pill: ${t.raio.pill}px;`);
 linhas.push(`--margem: ${t.espaco.margem}px;`,`--card: ${t.espaco.card}px;`,`--interno: ${t.espaco.interno}px;`);
 linhas.push(`--entrada: ${t.movimento.entrada_ms}ms;`,`--atraso: ${t.movimento.atraso_ms}ms;`,`--curva: ${t.movimento.curva};`);
 return `:root{${linhas.join('')}}`;
}

module.exports={loadTokens,cssVars,TOKENS_PATH};
