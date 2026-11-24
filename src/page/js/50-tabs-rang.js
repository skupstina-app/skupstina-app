/* tabs (phones) */
const setTab=t=>{document.body.dataset.tab=t;$$(".tabbar button").forEach(b=>b.toggleAttribute("aria-current",b.dataset.tab===t));$$(".tabbar button[aria-current]").forEach(b=>b.setAttribute("aria-current","page"));scrollTo(0,0);store.set("tab",t);if(t==="sala")requestAnimationFrame(()=>{drawMap();mpLens.run()})};
$$(".tabbar button").forEach(b=>b.onclick=()=>setTab(b.dataset.tab));
setTab("live");
/* rang liste */
if(!V1){const cnt=f=>{const c=new Map();talks.forEach(t=>{if(f(t))c.set(t.m,(c.get(t.m)||0)+1)});return c};
 const fromMap=(m,fmt)=>[...m.entries()].sort((a,b)=>b[1]-a[1]).slice(0,5).map(([mp,v])=>({mp,v:fmt(v)}));
 const longest=[...talks].filter(t=>!t.live).sort((a,b)=>b.d-a.d).slice(0,5).map(t=>({mp:t.m,v:dur(t.d),sub:"u "+hm(t.t)}));
 const AW=[
  ["Najviše za govornicom",fromMap(new Map(mps.filter(m=>m.t).map(m=>[m,m.t])),dur)],
  ["Najviše opomena",fromMap(new Map(mps.filter(m=>m.w).map(m=>[m,m.w])),v=>v)],
  ["Najviše javljanja",fromMap(cnt(()=>true),v=>v)],
  ["Najduži govor",longest],
  ["Najviše replika",fromMap(cnt(t=>/^Replika/.test(t.l)),v=>v)],
  ["Najviše povreda Poslovnika",fromMap(cnt(t=>/Poslovnika/.test(t.l)),v=>v)]];
 const big=v=>String(v).replace(" min","m").replace(" h ","h ");
 $("#awards").innerHTML=AW.map(([title,list])=>{const w=list[0];return `<article class="aw"><div class="t">${I_TROPHY}${title}</div>${w?`<div class="top"><b>${w.mp.name}</b><span class="px">${big(w.v)}</span><span class="g"><i style="background:${SH[w.mp.g]}"></i>${groups[w.mp.g][1]}${w.sub?", "+w.sub:""}</span></div><ol>${list.slice(1).map((x,j)=>`<li><span class="n">${j+2}</span><i style="background:${SH[x.mp.g]}"></i><span>${x.mp.name}</span><span class="val">${x.v}</span></li>`).join("")}</ol>`:`<p class="m">Još nema podataka</p>`}</article>`}).join("");
 $$("#rangSeg button").forEach(b=>b.onclick=()=>$$("#rangSeg button").forEach(x=>x.setAttribute("aria-pressed",x===b)));
}
