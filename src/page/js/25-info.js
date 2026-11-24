/* info: upcoming features */
{const b=$("#infoBtn"),p=$("#infoPop");const set=o=>{p.hidden=!o;b.setAttribute("aria-expanded",o)};
b.onclick=e=>{e.stopPropagation();set(p.hidden)};
document.addEventListener("click",e=>{if(!p.hidden&&!p.contains(e.target))set(false)});
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!p.hidden){set(false);b.focus()}});}

const rowHTML=(s,i,tag="div")=>s.pause?`<div class="row"><span class="t">${hm(s.t)}</span><span class="m">Pauza</span><span class="d">1 h</span></div>`
 :`<${tag} ${tag==="button"?'type="button" ':''}class="row${s.live?" live":""}" data-i="${i}"><span class="t">${hm(s.t)}</span><span>${s.m.name}</span><span class="d">${s.live?'<i class="sq"></i>':dur(s.d)}</span><span class="l">${groups[s.m.g][1]}, ${s.l.charAt(0).toLowerCase()+s.l.slice(1)}${s.warn?", opomena":""}</span></${tag}>`;

const elapsed=live.t+live.d-36000-3600,spoke=new Set(talks.map(s=>s.m.i)),warns=talks.filter(s=>s.warn).length;
const KP=[["Trajanje",dur(elapsed)],["Govori",talks.length],["Govornici",spoke.size+" / 250"],["Opomene",warns]];

$$('[role=tab]').forEach(b=>b.onclick=()=>{$$('[role=tab]').forEach(x=>{const on=x===b;x.setAttribute("aria-selected",on);$("#"+x.getAttribute("aria-controls")).hidden=!on});$("#compose").hidden=b.id!=="t-chat"});


