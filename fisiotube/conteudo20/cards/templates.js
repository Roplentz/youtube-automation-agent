'use strict';
// Cards do Conteúdo 2.0 em HTML/CSS. Cada função devolve uma página completa, com fundo transparente,
// que o render-cards.js fotografa quadro a quadro. Animações em CSS ficam pausadas e são posicionadas
// no tempo pelo renderizador, então o resultado é determinístico.
const {cssVars,loadTokens}=require('../../design/tokens');
const {seloCena}=require('../../evidencia');
const {fmt,matrizIcones,graficoEfeito,antesDepois}=require('./graficos');

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

const CSS=`
*{box-sizing:border-box;margin:0;padding:0}
html,body{background:transparent;color:var(--texto);font-family:var(--fonte-texto);-webkit-font-smoothing:antialiased;text-rendering:geometricPrecision}
.palco{position:absolute;inset:0}
.card{position:absolute;left:var(--card);right:var(--card);border-radius:var(--raio-card);padding:56px var(--interno) 48px;
 background:linear-gradient(160deg,color-mix(in srgb,var(--superficie) 96%,var(--acento)) 0%,var(--superficie) 55%,color-mix(in srgb,var(--superficie) 92%,black) 100%);
 border:2px solid color-mix(in srgb,var(--acento) 45%,transparent);
 box-shadow:0 30px 80px rgba(0,0,0,.45),inset 0 1px 0 rgba(255,255,255,.06);display:flex;flex-direction:column}
.topo{display:flex;align-items:center;justify-content:space-between;gap:24px;min-height:56px}
.selo{display:flex;align-items:center;gap:14px;font:600 28px/1.1 var(--fonte-texto);letter-spacing:.06em;color:var(--c);white-space:nowrap;min-width:0;flex:1;overflow:hidden}
.selo i{width:22px;height:22px;border-radius:50%;background:var(--c);box-shadow:0 0 0 6px color-mix(in srgb,var(--c) 22%,transparent);flex:none}
.kicker{font:600 28px/1.1 var(--fonte-texto);letter-spacing:.12em;color:var(--acento)}
.tag{position:absolute;top:-26px;right:44px;font:800 26px/1 var(--fonte-titulo);letter-spacing:.04em;color:#140F0C;background:var(--acento);padding:14px 20px;border-radius:var(--raio-pill);transform:rotate(3deg);white-space:nowrap;box-shadow:0 10px 24px rgba(0,0,0,.35)}
.titulo{font:800 58px/1.12 var(--fonte-titulo);margin-top:40px;letter-spacing:-.01em}
.numero{font:700 54px/1.18 var(--fonte-titulo);margin-top:40px;font-variant-numeric:tabular-nums}
.achado{font:500 44px/1.38 var(--fonte-texto);margin-top:28px;color:color-mix(in srgb,var(--texto) 92%,transparent)}
.rodape{margin-top:auto;padding-top:28px}
.rodape .linha{display:block;width:200px;height:2px;background:var(--acento);margin-bottom:22px;transform-origin:left}
.fonte{font:500 26px/1.35 var(--fonte-texto);color:var(--texto-suave)}
.ressalva{font:500 26px/1.35 var(--fonte-texto);color:var(--nivel-C);margin-top:8px}
.grafico{margin:48px 0 8px;flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center}
.destaque-num{font:800 150px/1 var(--fonte-titulo);color:var(--acento);font-variant-numeric:tabular-nums;letter-spacing:-.03em}
.destaque-num small{font:700 48px/1 var(--fonte-titulo);color:var(--texto);margin-left:14px;letter-spacing:0}
.legenda-num{font:500 38px/1.3 var(--fonte-texto);margin:14px 0 40px;text-align:center}
.matriz{display:grid;grid-template-columns:repeat(10,var(--ic));gap:var(--gap)}
.matriz .ic{width:var(--ic);height:var(--ic);display:block}
.matriz svg{width:100%;height:100%;fill:var(--vazio)}
.matriz .ic.on svg{fill:var(--cheio,var(--acento))}
.grupos{display:flex;gap:56px;align-items:flex-start}
.grupo{display:flex;flex-direction:column;align-items:center;gap:18px}
.grupo h3{font:700 30px/1.2 var(--fonte-texto);text-align:center;max-width:400px}
.grupo .n{font:800 76px/1 var(--fonte-titulo);font-variant-numeric:tabular-nums}
.efeito .eixo,.efeito .tick line{stroke:var(--texto-suave);stroke-width:3}
.efeito .tick text{fill:var(--texto-suave);font:500 30px var(--fonte-texto);text-anchor:middle;font-variant-numeric:tabular-nums}
.efeito .nulo{stroke:var(--texto-suave);stroke-width:2;stroke-dasharray:8 8}
.efeito .ic line{stroke:var(--acento-claro);stroke-width:7;stroke-linecap:round}
.efeito .estimativa rect{fill:var(--acento)}
.efeito .nulo-txt{fill:var(--texto-suave);font:600 24px var(--fonte-texto);text-anchor:middle;letter-spacing:.06em}
.efeito .valor{fill:var(--texto);font:800 64px var(--fonte-titulo);text-anchor:middle;font-variant-numeric:tabular-nums}
.ic-texto{font:500 30px/1.3 var(--fonte-texto);color:var(--texto-suave);margin-top:6px;font-variant-numeric:tabular-nums}
.lados{display:flex;justify-content:space-between;width:860px;font:600 28px/1.2 var(--fonte-texto);color:var(--texto-suave);margin-top:18px}
.antes-depois{width:100%;display:flex;flex-direction:column;gap:34px}
.barra{display:grid;grid-template-columns:180px 1fr;grid-template-rows:auto auto;column-gap:24px;align-items:center}
.barra .rot{font:700 28px/1 var(--fonte-texto);letter-spacing:.08em;color:var(--texto-suave)}
.barra .trilho{height:64px;border-radius:14px;background:var(--vazio);overflow:hidden}
.barra .cheio{height:100%;width:var(--w);border-radius:14px;background:var(--texto-suave);transform-origin:left}
.barra.depois .cheio{background:linear-gradient(90deg,var(--acento-escuro),var(--acento))}
.barra .num{grid-column:2;font:800 46px/1.3 var(--fonte-titulo);font-variant-numeric:tabular-nums}
.delta{align-self:flex-end;font:800 64px/1 var(--fonte-titulo);color:var(--acento-claro);font-variant-numeric:tabular-nums}
.delta span{font:600 36px var(--fonte-texto);color:var(--texto-suave)}
@keyframes entra{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:none}}
@keyframes surge{from{opacity:0}to{opacity:1}}
@keyframes pop{0%{opacity:0;transform:scale(.4)}70%{opacity:1;transform:scale(1.12)}100%{opacity:1;transform:scale(1)}}
@keyframes estica{from{transform:scaleX(0)}to{transform:scaleX(1)}}
.e{animation:entra var(--entrada) var(--curva) calc(var(--d,0) * var(--atraso)) both}
.card{animation:entra 380ms var(--curva) both}
.tag{animation:pop 420ms var(--curva) 120ms both}
.rodape .linha,.barra .cheio{animation:estica 600ms var(--curva) calc(var(--d,0) * var(--atraso)) both}
.matriz .ic.on{animation:pop 260ms var(--curva) calc(500ms + var(--i) * 14ms) both}
.matriz .ic:not(.on){animation:surge 300ms linear 350ms both}
.efeito .ic{animation:estica 600ms var(--curva) 700ms both}
.efeito .estimativa{animation:pop 380ms var(--curva) 500ms both}
.efeito .valor{animation:surge 300ms linear 1100ms both}
`;

// Ajusta o tamanho da fonte para o card não estourar (roda na página antes da captura).
const FIT=`<script>
function caber(sel,min){document.querySelectorAll(sel).forEach(el=>{let s=parseFloat(getComputedStyle(el).fontSize);
 const card=el.closest('.card');while(card.scrollHeight>card.clientHeight+1&&s>min){s-=2;el.style.fontSize=s+'px';}});}
function caberLinha(sel,min){document.querySelectorAll(sel).forEach(el=>{let s=parseFloat(getComputedStyle(el).fontSize);
 while(el.scrollWidth>el.clientWidth+1&&s>min){s-=1;el.style.fontSize=s+'px';}});}
window.__caber=()=>{caberLinha('.selo',22);caber('.achado',30);caber('.numero',36);caber('.titulo',38);caber('.legenda-num',28);};
</script>`;

function pagina(corpo,{largura,altura,fontes=''}){
 return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><style>${fontes}${cssVars()}html,body{width:${largura}px;height:${altura}px}${CSS}</style></head>
<body><div class="palco">${corpo}</div>${FIT}</body></html>`;
}

function seloHtml(cena,rt,d=1){
 const selo=seloCena(cena,rt.references||[]);
 if(!selo) return `<div class="kicker e" style="--d:${d}">O QUE DIZ A EVIDÊNCIA</div>`;
 return `<div class="selo e" style="--d:${d};--c:var(--nivel-${selo.nivel})"><i></i>${esc(selo.texto)}</div>`;
}

function rodape(cena,d){
 return `<div class="rodape"><span class="linha" style="--d:${d}"></span><div class="fonte e" style="--d:${d+1}">${esc(cena.fonte)}</div>${cena.ressalva?`<div class="ressalva e" style="--d:${d+2}">${esc(cena.ressalva)}</div>`:''}</div>`;
}

// Card de prova: ocupa o topo do quadro (1080×900); o vídeo entra embaixo no render_v2.py.
function prova(cena,rt,opts={}){
 const corpo=`<div class="card" style="top:90px;height:750px">
  <div class="topo">${seloHtml(cena,rt)}${cena.tag?`<div class="tag">${esc(cena.tag)}</div>`:''}</div>
  <div class="numero e" style="--d:3">${esc(cena.numero)}</div>
  <div class="achado e" style="--d:5">${esc(cena.achado)}</div>
  ${rodape(cena,8)}</div>`;
 return {html:pagina(corpo,{largura:1080,altura:900,...opts}),largura:1080,altura:900};
}

function graficoDados(cena){
 if(cena.grafico==='icones'){
  const total=cena.total||100;
  if(cena.comparacao){
   const grupo=(rot,v,cor)=>`<div class="grupo"><div class="n" style="color:${cor}">${fmt(v)}<small style="font-size:34px;color:var(--texto-suave)"> /${total}</small></div>${matrizIcones({valor:v,total})}<h3>${esc(rot)}</h3></div>`;
   return `<div class="grafico e" style="--d:3;--ic:32px;--gap:7px">
    <div class="grupos" style="--cheio:var(--acento)">${grupo(cena.rotulo||'Intervenção',cena.valor,'var(--acento)')}
    <div style="--cheio:var(--texto-suave)">${grupo(cena.comparacao.rotulo||'Controle',cena.comparacao.valor,'var(--texto-suave)')}</div></div>
    ${cena.unidade_texto?`<div class="legenda-num" style="margin-top:34px">${esc(cena.unidade_texto)}</div>`:''}</div>`;
  }
  return `<div class="grafico e" style="--d:3;--ic:62px;--gap:14px">
   <div class="destaque-num">${fmt(cena.valor)}<small>de ${fmt(total)}</small></div>
   <div class="legenda-num">${esc(cena.unidade_texto||'')}</div>${matrizIcones({valor:cena.valor,total})}</div>`;
 }
 if(cena.grafico==='efeito'){
  const [esq,dir]=cena.lados||['favorece controle','favorece intervenção'];
  return `<div class="grafico e" style="--d:3">${graficoEfeito(cena)}<div class="lados"><span>← ${esc(esq)}</span><span>${esc(dir)} →</span></div></div>`;
 }
 if(cena.grafico==='antes_depois') return `<div class="grafico e" style="--d:3;width:100%">${antesDepois(cena)}</div>`;
 throw new Error(`grafico desconhecido: ${cena.grafico}`);
}

// Tela de dados: card cheio (1080×1920) com selo, título, gráfico, achado e fonte.
function dados(cena,rt,opts={}){
 const corpo=`<div class="card" style="top:150px;bottom:150px">
  <div class="topo">${seloHtml(cena,rt)}${cena.tag?`<div class="tag">${esc(cena.tag)}</div>`:''}</div>
  <div class="titulo e" style="--d:2">${esc(cena.titulo)}</div>
  ${graficoDados(cena)}
  ${cena.achado?`<div class="achado e" style="--d:9">${esc(cena.achado)}</div>`:''}
  ${rodape(cena,11)}</div>`;
 return {html:pagina(corpo,{largura:1080,altura:1920,...opts}),largura:1080,altura:1920};
}

const TEMPLATES={prova,dados};
const HTML_TIPOS=new Set(Object.keys(TEMPLATES));

function cardHtml(cena,rt,opts){
 const t=TEMPLATES[cena.tipo];
 if(!t) throw new Error(`sem template HTML para ${cena.tipo}`);
 return t(cena,rt,opts);
}

module.exports={cardHtml,HTML_TIPOS,esc,loadTokens};
