'use strict';
// Matemática e SVG dos gráficos de dados (matriz de ícones, efeito com IC, antes/depois). Sem DOM: só strings.

const fmt=(n,dec)=>new Intl.NumberFormat('pt-BR',{minimumFractionDigits:dec??0,maximumFractionDigits:dec??2}).format(n);
const casas=n=>{const s=String(n);return s.includes('.')?Math.min(s.split('.')[1].length,3):0;};

// Escala linear ou logarítmica (razões: RR, OR, HR) de [min,max] para [0,largura].
function escala({min,max,log=false,largura}){
 if(log&&(min<=0||max<=0)) throw new Error('escala_log needs positive values');
 const f=log?Math.log:x=>x;
 const a=f(min),b=f(max);
 return v=>(f(v)-a)/(b-a)*largura;
}

// Limites com folga, sempre incluindo a linha de nulidade.
function dominio({estimativa,ic,nulo,escala:fixa,log}){
 if(Array.isArray(fixa)&&fixa.length===2) return fixa;
 const lo=Math.min(ic[0],nulo,estimativa),hi=Math.max(ic[1],nulo,estimativa);
 if(log){const r=Math.max(hi/nulo,nulo/lo)*1.25;return [nulo/r,nulo*r];}
 const pad=(hi-lo||Math.abs(hi)||1)*0.18;
 return [lo-pad,hi+pad];
}

function ticksLineares(min,max,alvo=5){
 const passoBruto=(max-min)/(alvo-1);
 const mag=10**Math.floor(Math.log10(passoBruto));
 const passo=[1,2,2.5,5,10].map(m=>m*mag).find(p=>p>=passoBruto)||10*mag;
 const out=[];
 for(let v=Math.ceil(min/passo)*passo;v<=max+1e-9;v+=passo) out.push(Math.round(v/passo)*passo);
 return out;
}
function ticksLog(min,max){
 const base=[0.1,0.2,0.25,0.5,1,2,4,5,10];
 const t=base.filter(v=>v>=min&&v<=max);
 return t.length>=3?t:[min,1,max].filter(v=>v>=min&&v<=max);
}

const PESSOA='<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="6.2" r="4.2"/><path d="M4.5 23v-5.5a7.5 7.5 0 0 1 15 0V23z"/></svg>';

// Matriz 10×N: `valor` ícones cheios de `total`. Cada ícone cheio entra em sequência (classe .ic.on, --i).
function matrizIcones({valor,total=100,classe=''}){
 const cells=[];
 for(let i=0;i<total;i++) cells.push(`<span class="ic${i<valor?' on':''}" style="--i:${i}">${PESSOA}</span>`);
 return `<div class="matriz ${classe}">${cells.join('')}</div>`;
}

// Gráfico de efeito (estilo forest plot de uma linha): eixo, linha de nulidade, IC e estimativa.
function graficoEfeito(s,{largura=860,altura=420}={}){
 const log=!!s.escala_log;
 const nulo=s.nulo??(log?1:0);
 const [min,max]=dominio({estimativa:s.estimativa,ic:s.ic,nulo,escala:s.escala,log});
 const x=escala({min,max,log,largura:largura-80});
 const X=v=>40+x(v);
 const yEixo=altura-90,yLinha=200;
 const ticks=log?ticksLog(min,max):ticksLineares(min,max);
 const dec=Math.max(casas(s.estimativa),casas(s.ic[0]),casas(s.ic[1]));
 const tickSvg=ticks.map(t=>`<g class="tick"><line x1="${X(t)}" x2="${X(t)}" y1="${yEixo}" y2="${yEixo+12}"/><text x="${X(t)}" y="${yEixo+46}">${fmt(t)}</text></g>`).join('');
 const xe=X(s.estimativa),x0=X(s.ic[0]),x1=X(s.ic[1]);
 return `<svg class="efeito" viewBox="0 0 ${largura} ${altura}" width="${largura}" height="${altura}">
  <line class="eixo" x1="40" x2="${largura-40}" y1="${yEixo}" y2="${yEixo}"/>${tickSvg}
  <line class="nulo" x1="${X(nulo)}" x2="${X(nulo)}" y1="70" y2="${yEixo}"/><text class="nulo-txt" x="${X(nulo)}" y="48">SEM DIFERENÇA</text>
  <g class="ic" style="transform-origin:${xe}px ${yLinha}px"><line x1="${x0}" x2="${x1}" y1="${yLinha}" y2="${yLinha}"/>
   <line x1="${x0}" x2="${x0}" y1="${yLinha-20}" y2="${yLinha+20}"/><line x1="${x1}" x2="${x1}" y1="${yLinha-20}" y2="${yLinha+20}"/></g>
  <g class="estimativa" style="transform-origin:${xe}px ${yLinha}px"><rect x="${xe-19}" y="${yLinha-19}" width="38" height="38" transform="rotate(45 ${xe} ${yLinha})"/></g>
  <text class="valor" x="${xe}" y="${yLinha-50}">${fmt(s.estimativa,dec)}</text>
 </svg>
 <div class="ic-texto">IC 95%: ${fmt(s.ic[0],dec)} a ${fmt(s.ic[1],dec)}${s.medida?' · '+s.medida:''}</div>`;
}

// Antes e depois: duas barras horizontais na mesma escala, com a diferença calculada (não digitada).
function antesDepois(s){
 const [r1,r2]=s.rotulos||['ANTES','DEPOIS'];
 const max=Math.max(s.antes,s.depois)*1.12||1;
 const dec=Math.max(casas(s.antes),casas(s.depois));
 const diff=s.depois-s.antes;
 const pct=s.antes?diff/Math.abs(s.antes)*100:null;
 const u=s.unidade?' '+s.unidade:'';
 const barra=(cls,rot,v)=>`<div class="barra ${cls}"><div class="rot">${rot}</div><div class="trilho"><div class="cheio" style="--w:${(v/max*100).toFixed(2)}%"></div></div><div class="num">${fmt(v,dec)}${u}</div></div>`;
 return `<div class="antes-depois">${barra('antes',r1,s.antes)}${barra('depois',r2,s.depois)}
  <div class="delta">${diff>0?'+':diff<0?'−':''}${fmt(Math.abs(diff),dec)}${u}${pct!==null&&Number.isFinite(pct)?` <span>(${pct>0?'+':pct<0?'−':''}${fmt(Math.abs(pct),0)}%)</span>`:''}</div></div>`;
}

module.exports={fmt,escala,dominio,ticksLineares,ticksLog,matrizIcones,graficoEfeito,antesDepois};
