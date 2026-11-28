/* Poslovnik: the Rules of Procedure (/poslovnik.json, made from the Assembly's page by scripts/poslovnik.py).
   - "više" panel → book tab: type the article, and the stav after it ("107 1", "107.1"); stavovi are numbered rows, the asked one lit
   - live: when a crowd opens the same article at once (ChatRoom's pslHot), a small book button shows next to "više" for a while
   - Arhiva: a small book chip while an MP's "povreda Poslovnika, član N" plays (doc.psl, found by arhiva.js); tap → that article */
let PSL=null,PSLA=[],pslP=null;
const pslLoad=()=>pslP||(pslP=fetch("/poslovnik.json").then(r=>{if(!r.ok)throw r.status;return r.json()}).then(d=>{PSLA=d.a;PSL=new Map(d.a.map(a=>[a.n,a]));return PSL}).catch(e=>{pslP=null;throw e}));
const I_BOOK=$("#xPsl .psl-q svg").outerHTML;
/* "107", "107 1", "107.1", "107/1" → [107, 1] */
const pslParse=q=>{const m=/^\s*(\d{1,3})(?:\s*[\s.,/:-]\s*(\d{1,2}))?/.exec(q||"");return m?[String(+m[1]),m[2]?+m[2]:null]:null};

/* one article: stavovi as numbered rows (no number when there is only one), alineje / tačke under their stav */
function pslArt(a,st){
 const one=a.s.length===1;
 const item=x=>{const m=/^(\d+\))\s*(.*)$/.exec(x);return `<li><i>${m?m[1]:"–"}</i><span>${esc(m?m[2]:x)}</span></li>`};
 return `<article class="psa"><header><b>Član ${esc(a.n)}.</b><small>${esc(a.o||a.g)}</small></header>`+
  (a.s.length>2?`<nav class="pst" aria-label="Stav">${a.s.map((_,i)=>`<button type="button" data-st="${i+1}"${i+1===st?' aria-current="true"':""}>${i+1}</button>`).join("")}</nav>`:"")+
  `<ol class="pss${one?" one":""}">${a.s.map((p,i)=>`<li data-sn="${i+1}"${i+1===st?' class="on"':""}>${one?"":`<span class="psn nt">${i+1}</span>`}<div><p>${esc(p[0])}</p>${p.length>1?`<ul>${p.slice(1).map(item).join("")}</ul>`:""}</div></li>`).join("")}</ol></article>`;
}
const pslNav=a=>{const i=PSLA.indexOf(a),p=PSLA[i-1],n=PSLA[i+1];
 return `<nav class="psp">${p?`<button type="button" data-go="${p.n}">‹ <span class="nt">${p.n}</span></button>`:"<span></span>"}${n?`<button type="button" data-go="${n.n}"><span class="nt">${n.n}</span> ›</button>`:""}</nav>`};
/* nothing typed: every article by glava, its first words */
const pslIndex=()=>{let g="",h="";for(const a of PSLA){if(a.g!==g){h+=(g?"</ol>":"")+`<h4>${esc(a.g)}</h4><ol class="psi">`;g=a.g}
 h+=`<li><button type="button" data-go="${a.n}"><b class="nt">${a.n}</b><span>${esc(a.s[0][0])}</span></button></li>`}return h+"</ol>"};

/* the panel's tabs: speech stats / Poslovnik (remembered) */
let xsub=store.get("x-sub")==="psl"?"psl":"stats",pslCur=null,pslPrev=false,pslHot=null,pslSent=null,pslT=0;
$$(".xtabs [data-x]").forEach(b=>b.onclick=()=>{xsub=b.dataset.x;store.set("x-sub",xsub);xSub()});
function xSub(){
 $$(".xtabs [data-x]").forEach(b=>b.setAttribute("aria-selected",b.dataset.x===xsub));
 $("#xStats").hidden=xsub!=="stats";$("#xPsl").hidden=xsub!=="psl";
 if(xv!=="stats")pslPin=null;else if(xsub==="psl")pslShow(false);
 pslSay();pslHotShow();
}
/* pslPin: the article the live button opened, shown as a preview until the viewer types; pslAll: the full list was asked for */
let pslPin=null,pslAll=false;
async function pslShow(scroll){
 const q=$("#pslQ").value,k=pslParse(q),out=$("#pslOut");
 $("#pslX").hidden=!q;
 try{await pslLoad()}catch(e){out.innerHTML='<p class="m pse">Poslovnik trenutno nije dostupan.</p>';return}
 let a=null,st=null;pslPrev=false;
 if(k){pslPin=null;a=PSL.get(k[0]);st=k[1];if(!a){pslCur=null;out.innerHTML=`<p class="m pse">Nema člana ${esc(k[0])}.</p>`;apply(out);pslSay();return}}
 else if(!q.trim()&&pslPin&&PSL.get(pslPin)){a=PSL.get(pslPin);pslPrev=true}
 pslCur=a?a.n:null;
 out.innerHTML=a?pslArt(a,st)+pslNav(a):q.trim()?"":pslAll?pslIndex():'<button type="button" class="psall" data-all>Svi članovi</button>';
 apply(out);pslSay();
 const li=st&&out.querySelector(`[data-sn="${st}"]`);if(li&&scroll!==false)pslTo(li);
}
/* scroll a stav (or the panel) to just under the player, which stays stuck on top on phones */
const pslTo=el=>{const v=$(".vsticky"),top=v&&getComputedStyle(v).position==="sticky"?v.getBoundingClientRect().bottom:0,pane=$("#p-stats");
 if(pane.scrollHeight>pane.clientHeight+2&&getComputedStyle(pane).overflowY!=="visible")pane.scrollBy({top:el.getBoundingClientRect().top-pane.getBoundingClientRect().top-8,behavior:reduce?"auto":"smooth"});
 else scrollBy({top:el.getBoundingClientRect().top-top-8,behavior:reduce?"auto":"smooth"})};
const pslGo=(n,st)=>{$("#pslQ").value=n+(st?"."+st:"");pslShow();if(!st)pslTo($("#xPsl"))};
$("#pslQ").addEventListener("input",()=>{pslAll=false;pslShow()});
$("#pslQ").addEventListener("keydown",e=>{if(e.key==="Enter")e.target.blur()});
$("#pslX").onclick=()=>{$("#pslQ").value="";pslPin=null;pslAll=false;pslShow();$("#pslQ").focus()};
$("#pslOut").addEventListener("click",e=>{const g=e.target.closest("[data-go]"),s=e.target.closest("[data-st]");
 if(e.target.closest("[data-all]")){pslAll=true;pslShow();return}
 if(g)pslGo(g.dataset.go);else if(s&&pslCur)pslGo(pslCur,+s.dataset.st)});

/* live: tell the room which article this viewer reads (typed or picked, held 2 s; a preview doesn't count) */
function pslSay(fresh){if(fresh)pslSent=null;clearTimeout(pslT);
 const n=xv==="stats"&&xsub==="psl"&&pslCur&&!pslPrev?pslCur:null;if(n===pslSent)return;
 pslT=setTimeout(()=>{if(send({t:"psl",n}))pslSent=n},n?2000:0)}
/* the room says a crowd just looked up one article (pslHot in worker.js is strict): a small pulsing book button appears next to
   the "više" button, only on Uživo during a broadcast, not for someone already in the Poslovnik, once per article in 10 min,
   gone after 40 s or when the burst ends. No counts anywhere: it just appears. */
const pslDemo=new URLSearchParams(location.search).get("poslovnik"),pslHotSeen=new Map();
let pslHotT=0,pslHotOn=null;
function pslLive(h,demo){pslHot=h&&h.n?h:null;
 if(!pslHot){if(pslHotOn&&!demo){pslHotOn=null;pslHotShow()}return}
 if(pslHot.n===pslHotOn||Date.now()-(pslHotSeen.get(pslHot.n)||0)<6e5)return;
 let live=!!demo;try{live=live||apiLive||plLive}catch(e){}
 if(!live||(xv==="stats"&&xsub==="psl"))return;
 if(!PSL){const h0=pslHot;pslLoad().then(()=>{if(pslHot===h0)pslLive(h0,demo)},()=>{});return}
 if(!PSL.has(pslHot.n))return;
 pslHotSeen.set(pslHot.n,Date.now());pslHotOn=pslHot.n;pslHotShow();
 clearTimeout(pslHotT);pslHotT=setTimeout(()=>{pslHotOn=null;pslHotShow()},4e4)}
function pslHotShow(){const b=$("#pslHotB"),on=!!pslHotOn&&!(xv==="stats"&&xsub==="psl");
 if(on){$("#pslHotN").textContent=pslHotOn;b.setAttribute("aria-label",`Poslovnik, član ${pslHotOn}`)}
 b.hidden=!on}
/* tap: the Poslovnik opens on that article as a preview (a preview isn't counted, so the button can't feed itself) */
$("#pslHotB").onclick=()=>{pslPin=pslHotOn;pslHotOn=null;pslAll=false;$("#pslQ").value="";xsub="psl";store.set("x-sub",xsub);if(xv==="stats")xSub();else xView("stats")};
/* ?poslovnik=107 shows the button without a broadcast, to see how it looks */
if(/^\d{1,3}$/.test(pslDemo||""))setTimeout(()=>pslLive({n:pslDemo,c:0},true),1500);

/* Arhiva: chips for the articles named in the speech playing now; the bubble shows one */
let arPslK="",arPslD=null,arPslOpen="";
function arPslTick(t){
 if(arDoc!==arPslD){arPslD=arDoc;arPslK="";arPslShut();$("#arPslC").innerHTML=""}
 const L=(arDoc&&arDoc.psl)||[];if(!L.length&&!arPslK)return;
 if(L.length&&!PSL){pslLoad().catch(()=>{});return}
 const on=L.filter(x=>t>=x[0]-1&&t<=x[1]+5&&PSL.has(String(x[2]))),k=on.map(x=>x[2]+"."+(x[3]||"")).join();
 if(k===arPslK)return;arPslK=k;
 $("#arPslC").innerHTML=on.map(x=>{const id=x[2]+"."+(x[3]||"");return `<button type="button" class="ar-psl" data-psl="${id}" aria-expanded="${id===arPslOpen}" aria-label="Poslovnik, član ${x[2]}">${I_BOOK}<span class="nt">${x[2]}</span></button>`}).join("");
}
/* the bubble lies over the timeline, chips and list: from the video's bottom edge down to the tab bar (or the screen's end) */
function arPslFit(){const box=$("#arPslB");if(box.hidden)return;const v=$("#arVid"),st=$(".ar-stick"),tb=$(".tabbar"),
 r=v.getBoundingClientRect(),end=tb&&tb.offsetParent?tb.getBoundingClientRect().top:innerHeight;
 box.style.top=(r.bottom-st.getBoundingClientRect().top)+"px";box.style.height=Math.max(160,end-r.bottom-8)+"px"}
addEventListener("resize",arPslFit);addEventListener("scroll",arPslFit,{passive:true});
function arPslShut(){arPslOpen="";$("#arPslB").hidden=true;$$("#arPslC [data-psl]").forEach(b=>b.setAttribute("aria-expanded","false"))}
$("#arPslC").addEventListener("click",e=>{const b=e.target.closest("[data-psl]");if(!b)return;const id=b.dataset.psl;
 if(id===arPslOpen)return arPslShut();
 const [n,st]=pslParse(id),a=PSL&&PSL.get(n),box=$("#arPslB");if(!a)return;
 arPslOpen=id;$$("#arPslC [data-psl]").forEach(x=>x.setAttribute("aria-expanded",x.dataset.psl===id));
 box.innerHTML=`<button type="button" class="psx" aria-label="Zatvori">${I_X}</button>`+pslArt(a,st);apply(box);box.hidden=false;arPslFit();box.scrollTop=0;
 const li=st&&box.querySelector(`[data-sn="${st}"]`);if(li)box.scrollTop=li.offsetTop-box.offsetTop-8});
$("#arPslB").addEventListener("click",e=>{if(e.target.closest(".psx"))return arPslShut();
 const s=e.target.closest("[data-st]"),box=$("#arPslB");if(!s)return;
 box.querySelectorAll(".pss>li").forEach(li=>li.classList.toggle("on",li.dataset.sn===s.dataset.st));
 box.querySelectorAll(".pst [data-st]").forEach(x=>x===s?x.setAttribute("aria-current","true"):x.removeAttribute("aria-current"));
 const li=box.querySelector(`[data-sn="${s.dataset.st}"]`);if(li)box.scrollTop=li.offsetTop-box.offsetTop-8});
