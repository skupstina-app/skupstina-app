/* numbers: live fun cards (Uživo) + period card (Rang) */
const totalT=mps.reduce((a,m)=>a+m.t,0);const SHMX=Math.max(...groups.map((g,gi)=>Math.max(g[2]/250,mps.filter(m=>m.g===gi).reduce((a,m)=>a+m.t,0)/totalT)));
const shareCard=title=>`<h3>${title}<span class="keys"><span><i></i>mesta</span><span class="k2"><i></i>vreme</span></span></h3>${groups.map((g,gi)=>{const s=g[2]/250,tt=mps.filter(m=>m.g===gi).reduce((a,m)=>a+m.t,0)/totalT;return `<div class="sr"><span>${g[1]}</span><span class="tr"><i class="a" style="width:${s/SHMX*100}%"></i><i class="b2" style="width:${tt/SHMX*100}%;background:${SH[gi]}"></i></span><span class="v2">${Math.round(s*100)} / ${Math.round(tt*100)}%</span></div>`}).join("")}`;
if(!V1){const byT=[...mps].filter(m=>m.t).sort((a,b)=>b.t-a.t),lg=[...talks].filter(t=>!t.live).sort((a,b)=>b.d-a.d)[0],
  warnT=talks.filter(t=>t.warn),rep=talks.filter(t=>/^Replika/.test(t.l)),repBy=new Map();rep.forEach(t=>repBy.set(t.m,(repBy.get(t.m)||0)+1));
  const topRep=[...repBy.entries()].sort((a,b)=>b[1]-a[1])[0];
  const big=v=>String(v).replace(" min","m").replace(" h ","h ");
  const who=m=>`<span class="g"><i style="background:${SH[m.g]}"></i>${groups[m.g][1]}</span>`;
  
  $("#dayLen").innerHTML='<i class="sq"></i>u toku';
  $("#liveCards").innerHTML=[
   `<article class="lc wide kpi4">${KP.map(([a,v])=>`<div><span>${a}</span><b>${v}</b></div>`).join("")}</article>`,
   `<article class="lc wide"><h3>Sala danas<span class="keys"><span><i class="ho"></i>nije govorio</span><span><i></i>govorio, veće = duže</span></span></h3><div class="lfig" id="lhall"><svg id="lhallSvg" role="img" aria-label="Ko je danas govorio u sali"></svg><div class="tip" id="ltip"></div></div></article>`,
   `<article class="lc"><h3>Najviše govori</h3><div class="hero2"><b>${byT[0].name}</b><span class="px">${big(dur(byT[0].t))}</span>${who(byT[0])}</div><ol>${byT.slice(1,4).map((m,j)=>`<li><span class="n">${j+2}</span><i style="background:${SH[m.g]}"></i><span>${m.name}</span><span class="val">${dur(m.t)}</span></li>`).join("")}</ol></article>`,
   `<article class="lc"><h3>Najduži govor</h3><div class="hero2"><b>${lg.m.name}</b><span class="px">${big(dur(lg.d))}</span>${who(lg.m)}</div><p class="m">u ${hm(lg.t)}, ${lg.l.charAt(0).toLowerCase()+lg.l.slice(1)}</p></article>`,
   `<article class="lc"><h3>Opomene danas</h3><div class="hero2"><span class="px">${warnT.length}</span></div><ol>${warnT.slice(0,4).map(t=>`<li><span class="n">${hm(t.t)}</span><i style="background:${SH[t.m.g]}"></i><span>${t.m.name}</span><span class="val"></span></li>`).join("")}</ol></article>`,
   `<article class="lc"><h3>Replike danas</h3><div class="hero2"><span class="px">${rep.length}</span></div>${topRep?`<p class="m">Najviše: ${topRep[0].name} (${topRep[1]} ${topRep[1]===1?"replika":"replike"})</p>`:""}</article>`
  ].join("");}
if(!V1){const LIVEMAP={el:$("#lhall"),svg:$("#lhallSvg"),tip:$("#ltip"),geo:{},live:true};
const lhRO=new ResizeObserver(()=>drawMap(LIVEMAP));lhRO.observe(LIVEMAP.el);}

