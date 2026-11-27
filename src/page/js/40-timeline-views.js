/* day timeline */
const tl=$("#tl");
tl.innerHTML=sp.map((s,i)=>s.pause?`<li class="pause"><button type="button" tabindex="-1"><span class="t">${hm(s.t)}</span><span class="m">Pauza</span><span class="d">1 h</span></button></li>`
 :`<li data-i="${i}"><button type="button"><span class="t">${hm(s.t)}</span><span class="nm">${s.m.name}</span><span class="d">${s.live?'<i class="sq"></i>':dur(s.d)}</span><span class="l">${groups[s.m.g][1]}, ${s.l.charAt(0).toLowerCase()+s.l.slice(1)}${s.warn?", opomena":""}</span></button></li>`).join("");
const dayLens=lens(tl,i=>{active=sp[i];if(view==="day")drawMap()});
/* views */
const setView=v=>{if(v!=="groups")closePop();if(v!=="mps"){mpZoom=false;openF(false)}view=v;board.dataset.view=v;$$("#salaSeg button").forEach(b=>b.setAttribute("aria-pressed",b.dataset.v===v));
 requestAnimationFrame(()=>{if(v==="mps"){mpl.scrollTop=0;mpLens.run()}if(v==="day"){if(!setView.d){dayLens.center(sp.indexOf(live));setView.d=1}dayLens.run()}drawMap()})};
$$("#salaSeg button").forEach(b=>b.onclick=()=>setView(b.dataset.v));
$$(".links a[data-v]").forEach(a=>a.addEventListener("click",()=>setView(a.dataset.v)));

