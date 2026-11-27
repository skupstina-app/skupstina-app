/* arhiva: list of sitting days → one day → its recording with a timeline (html/arhiva.html, css/50-arhiva).
   Data: GET /api/arhiva (every day) and /api/arhiva/day?v=<video> (its speeches as [from, to, mp, talk], stream seconds),
   both from src/arhiva.js, made from the reader's live timeline. The recording is the whole YouTube stream of that day,
   so the reader's times fit it as they are. Clock times = the day's start_ms + stream seconds.
   While the site is in V1 only admins see it (body.arh): admSet() from 21-admin.js is wrapped below. */
const AR=$("#arhiva");
const AR_MON=["januar","februar","mart","april","maj","jun","jul","avgust","septembar","oktobar","novembar","decembar"];
const AR_WD=["ned","pon","uto","sre","čet","pet","sub"],AR_WDL=["Nedelja","Ponedeljak","Utorak","Sreda","Četvrtak","Petak","Subota"];
const arPx=r=>`<svg class="mi" viewBox="0 0 13 13" aria-hidden="true" shape-rendering="crispEdges" fill="currentColor">${r.map(([x,y,w,h])=>`<rect x="${x}" y="${y}" width="${w}" height="${h}"/>`).join("")}</svg>`;
const AI={
 sat:arPx([[4,0,5,1],[2,1,2,1],[9,1,2,1],[1,2,1,2],[11,2,1,2],[0,4,1,5],[12,4,1,5],[1,9,1,2],[11,9,1,2],[2,11,2,1],[9,11,2,1],[4,12,5,1],[6,3,1,4],[7,6,2,1]]),
 pesak:arPx([[2,0,9,1],[2,12,9,1],[3,1,1,2],[9,1,1,2],[4,3,1,1],[8,3,1,1],[5,4,3,1],[6,5,1,3],[5,8,1,1],[7,8,1,1],[4,9,1,1],[8,9,1,1],[3,10,1,2],[9,10,1,2],[4,11,5,1]]),
 play:arPx([[3,2,2,9],[5,3,2,7],[7,4,2,5],[9,5,2,3]]),
 pause:arPx([[3,2,3,9],[8,2,3,9]]),
 x:arPx([[2,2,2,2],[9,2,2,2],[4,4,2,1],[7,4,2,1],[5,5,3,3],[4,8,2,1],[7,8,2,1],[2,9,2,2],[9,9,2,2]])};
const arEsc=s=>String(s??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/"/g,"&quot;");
const arDur=s=>{s=Math.max(0,Math.round(s/60));const h=Math.floor(s/60),m=s%60;return h?`${h} h${m?` ${m} min`:""}`:`${m} min`};
const arMss=s=>{s=Math.max(0,Math.round(s));const h=Math.floor(s/3600),m=Math.floor(s%3600/60),x=String(s%60).padStart(2,"0");return h?`${h}:${String(m).padStart(2,"0")}:${x}`:`${m}:${x}`};
const arClk=(ms,sec)=>new Date(ms).toLocaleTimeString("en-GB",{timeZone:"Europe/Belgrade",hour:"2-digit",minute:"2-digit",second:sec?"2-digit":undefined,hour12:false}).replace(/^0(\d)/,"$1");
const arAt=(d,s,sec)=>d.start_ms?arClk(d.start_ms+s*1000,sec):arMss(s);/* clock time; stream time while the start is not known */
const arDan=d=>d.dan?` · ${d.dan}. dan`:"";
const arDate=s=>{const [y,m,d]=s.split("-").map(Number);return new Date(Date.UTC(y,m-1,d,12))};
let arMpBy=null;const arMp=id=>{if(!arMpBy)arMpBy=new Map(mps.map(m=>[Number(m.id),m]));return arMpBy.get(Number(id))};
const arGroup=m=>m?(m.g===6?"Srbija pobeđuje":groups[m.g][1]):"";

let arDays=null,arLoading=false,arDay=null,arSegs=null,arBy=null,arAll=false;
async function arLoad(){if(arDays||arLoading)return;arLoading=true;
 try{const r=await fetch("/api/arhiva");arDays=(await r.json()).days||[]}catch(e){arDays=[]}arLoading=false;arList()}

/* search: Serbian letters and script folded (sfold); every word must match, its last letter dropped when it is long
   so "generalni sekretar" also finds "generalnog sekretara" */
const arStem=w=>w.length>4?w.slice(0,-1):w;
function arHay(d){if(!d.hay){const names=(d.mps||[]).map(arMp).filter(Boolean).map(m=>m.name);const dt=arDate(d.date);
 d.names=names;d.hay=sfold([d.ses,`${dt.getUTCDate()}. ${AR_MON[dt.getUTCMonth()]}`,d.date,AR_WDL[dt.getUTCDay()],...names].join(" | "))}return d.hay}
function arList(){
 const box=$("#arDays");if(!arDays){box.innerHTML="";return}
 const q=sfold($("#arQ").value),ws=q.split(" ").filter(Boolean).map(arStem);$("#arQx").hidden=!q;
 const hits=arDays.filter(d=>ws.every(w=>arHay(d).includes(w)));
 if(!arDays.length){box.innerHTML='<p class="ar-none">Arhiva je još prazna.</p>';return}
 if(!hits.length){box.innerHTML='<p class="ar-none">Nema rezultata.</p>';return}
 let html="",mon="",n=0;const months=new Map();hits.forEach(d=>{const k=d.date.slice(0,7);months.set(k,(months.get(k)||0)+1)});
 hits.forEach((d,i)=>{const dt=arDate(d.date),k=d.date.slice(0,7);
  if(k!==mon){if(mon)html+="</ol>";mon=k;const c=months.get(k);html+=`<div class="ar-mon"><span>${AR_MON[dt.getUTCMonth()][0].toUpperCase()+AR_MON[dt.getUTCMonth()].slice(1)} ${dt.getUTCFullYear()}</span><span>${c} ${c===1?"dan":"dana"}</span></div><ol class="ar-days">`}
  const live=apiLive&&d.date===bgDay(Date.now())&&i===0;
  const hit=ws.length?(d.names||[]).filter(nm=>ws.some(w=>sfold(nm).includes(w))).slice(0,3):[];
  html+=`<li><a href="#arhiva" data-ard="${arEsc(d.video)}"><span class="ar-n"><b>${dt.getUTCDate()}</b><small>${AR_WD[dt.getUTCDay()]}</small></span><span class="ar-c"><b>${arEsc(d.ses)}</b><span class="ar-s">${d.dan?d.dan+". dan · ":""}${arAt(d,d.first_s)}–${arAt(d,d.last_s)}</span><span class="ar-f"><span>${AI.sat}<span class="px">${arDur(d.last_s-d.first_s)}</span></span>${live?'<span class="ar-tag live"><i class="sq"></i>uživo</span>':d.status==="snimak"?`<span class="ar-tag">${AI.pesak}u obradi</span>`:""}</span>${hit.length?`<span class="ar-hit">${hit.map(arEsc).join(", ")}</span>`:""}</span></a></li>`});
 box.innerHTML=html+"</ol>";apply(box)}
$("#arQ").addEventListener("input",arList);
$("#arQx").onclick=()=>{$("#arQ").value="";arList();$("#arQ").focus()};
$("#arDays").addEventListener("click",e=>{const a=e.target.closest("[data-ard]");if(!a)return;e.preventDefault();const d=arDays.find(x=>x.video===a.dataset.ard);
 if(apiLive&&d===arDays[0]&&d.date===bgDay(Date.now())){setTab("live");return}arOpen(d)});

/* views: list / day / play; the back button of the phone walks back through them */
function arView(v,push){const ch=AR.dataset.v!==v;AR.dataset.v=v;if(v!=="play")arPause();if(push)history.pushState({ar:v},"");if(ch)scrollTo(0,0)}
/* a hash link elsewhere on the site also fires popstate (state null): only act when the view really changes */
addEventListener("popstate",e=>{let v=e.state&&e.state.ar||"list";if(!arDay)v="list";if(v===AR.dataset.v)return;arView(v);if(v==="day")arRenderDay()});

async function arOpen(d){arDay=d;arSegs=null;arAll=false;arFilt=null;arView("day",true);arRenderDay();
 try{const r=await fetch("/api/arhiva/day?v="+encodeURIComponent(d.video));arSegs=(await r.json()).segs||[]}catch(e){arSegs=[]}
 if(arDay===d)arRenderDay()}
function arTotals(){const by=new Map();(arSegs||[]).forEach(([a,b,mp,t])=>{const m=arMp(mp);if(!m)return;const o=by.get(m)||{t:0,n:0};o.t+=t||Math.max(0,b-a);o.n++;by.set(m,o)});return by}
function arRenderDay(){const d=arDay;if(!d)return;const dt=arDate(d.date);
 arBy=arSegs?arTotals():null;const list=arBy?[...arBy.entries()].sort((a,b)=>b[1].t-a[1].t):[];
 const rows=(arAll?list:list.slice(0,5)).map(([m,o],k)=>`<li><button type="button" data-arm="${m.id}"><span class="rk">${k+1}</span><span class="sph" style="--gc:${SH[m.g]}${m.ph?`;background-image:url(/p/${m.id})`:""}"></span><span class="nm"><b>${arEsc(m.name)}</b><small>${arEsc(arGroup(m))} · ${o.n} ${o.n===1?"put":"puta"}</small></span><span class="tm nt">${arMss(o.t)}</span></button></li>`).join("");
 $("#arDay").innerHTML=`<div class="ar-h"><button type="button" class="ar-back" id="arDBack">‹ Arhiva</button>
<div><h2>${AR_WDL[dt.getUTCDay()]}, ${dt.getUTCDate()}. ${AR_MON[dt.getUTCMonth()]}</h2><p>${arEsc(d.ses)}${arDan(d)}</p></div>
<div class="ar-k"><div><span>Trajanje</span><b>${arDur(d.last_s-d.first_s)}</b><span>${arAt(d,d.first_s)}–${arAt(d,d.last_s)}</span></div><div><span>Govornika</span><b>${d.speakers}</b></div></div></div>
${d.status==="snimak"?`<div class="ar-wait"><span>${AI.pesak}</span><span><b>U obradi</b><small>Sažetak, opomene i glasanja stižu sa stenografskim beleškama.</small></span></div>`:""}
<section class="ar-sec">${arBy?seatMap(arBy):""}<h3>Najviše govorili</h3>${arBy?`<ol class="xlist">${rows}</ol>${list.length>5?`<button type="button" class="ar-more" id="arMore">${arAll?"Prikaži manje":`Vidi sve · ${list.length} ›`}</button>`:""}`:'<p class="m">Učitava se…</p>'}</section>
${arBy?`<button type="button" class="ar-go" id="arGo">${AI.play}Gledaj snimak</button>`:""}`;
 apply($("#arDay"));
 $("#arDBack").onclick=()=>history.state&&history.state.ar?history.back():arView("list");
 const mo=$("#arMore");if(mo)mo.onclick=()=>{arAll=!arAll;arRenderDay()};
 const go=$("#arGo");if(go)go.onclick=()=>arPlay(null)}
$("#arDay").addEventListener("click",e=>{const b=e.target.closest("[data-arm]");if(b)arPlay(Number(b.dataset.arm))});

/* recording: one YouTube player of our own (the live one keeps the live stream), our controls, the day as one strip */
let arP=null,arReady=false,arVidId=null,arFilt=null,arCurI=-1,arScrollAt=0,arRate=1,arMap=null;
const AR_GAP=20*60,AR_PW=2;/* silences longer than 20 min shrink to 2 % of the strip */
function arBuildMap(){const s=arSegs||[];if(!s.length){arMap=null;return}
 const lo=Math.max(0,s[0][0]-60),hi=s[s.length-1][1]+60,gaps=[];
 for(let i=1;i<s.length;i++){const a=s[i-1][1],b=s[i][0];if(b-a>AR_GAP)gaps.push([a+30,b-30])}
 const N=hi-lo-gaps.reduce((x,[a,b])=>x+b-a,0),sc=(100-AR_PW*gaps.length)/N;
 const f=t=>{let x=0,last=lo;for(const [a,b] of gaps){if(t<=a)return x+(Math.max(t,last)-last)*sc;x+=(a-last)*sc;if(t<=b)return x+AR_PW*(t-a)/(b-a);x+=AR_PW;last=b}return Math.min(100,x+(t-last)*sc)};
 const g=p=>{let x=0,last=lo;for(const [a,b] of gaps){const w=(a-last)*sc;if(p<=x+w)return last+(p-x)/sc;x+=w;if(p<=x+AR_PW)return a+(p-x)/AR_PW*(b-a);x+=AR_PW;last=b}return Math.min(hi,last+(p-x)/sc)};
 arMap={lo,hi,gaps,f,g}}
const arPct=v=>v.toFixed(3)+"%";
function arShown(i){return arFilt==null||arSegs[i][2]===arFilt}
function arRenderStrip(){const M=arMap,d=arDay;if(!M){$("#arBar").innerHTML="";$("#arHours").innerHTML="";return}
 $("#arBar").innerHTML=arSegs.map(([a,b,mp],i)=>{const m=arMp(mp);return `<i class="${arShown(i)?"":"off"}" style="left:${arPct(M.f(a))};width:${arPct(Math.max(.3,M.f(b)-M.f(a)))};background:${m?SH[m.g]:"var(--mute2)"}"></i>`}).join("")+M.gaps.map(([a,b])=>`<b style="left:${arPct(M.f(a))};width:${AR_PW}%"></b>`).join("");
 /* full hours, every second one, not inside a shrunk silence */
 const hrs=[];if(d.start_ms){const t0=d.start_ms+M.lo*1000,t1=d.start_ms+M.hi*1000;let h=Math.ceil(t0/36e5)*36e5;
 for(;h<=t1;h+=36e5){const s=(h-d.start_ms)/1000;if(M.gaps.some(([a,b])=>s>a-600&&s<b+600))continue;const p=M.f(s);if(p<4||p>96||hrs.some(x=>Math.abs(x.p-p)<9))continue;hrs.push({p,l:arClk(h).split(":")[0]})}}
 $("#arHours").innerHTML=hrs.map(x=>`<span style="left:${arPct(x.p)}">${x.l}</span>`).join("")}
function arRenderTok(){const d=arDay,s=arSegs||[];let html="";
 s.forEach(([a,b,mp],i)=>{if(i&&a-s[i-1][1]>AR_GAP&&arFilt==null)html+=`<li class="gap">${arDur(a-s[i-1][1])}</li>`;
  if(!arShown(i))return;const m=arMp(mp);
  html+=`<li><button type="button" data-ari="${i}"><span class="t px">${arAt(d,a)}</span><i style="background:${m?SH[m.g]:"var(--mute2)"}"></i><span class="nm"><b>${arEsc(m?m.name:"Poslanik")}</b><small>${arEsc(arGroup(m))}</small></span><span class="d px">${arMss(b-a)}</span></button></li>`});
 $("#arTok").innerHTML=html||'<li class="gap">Nema govora.</li>';apply($("#arTok"));arCurI=-1}
function arFilter(mp){arFilt=mp;const m=mp!=null?arMp(mp):null;
 $("#arFAll").setAttribute("aria-pressed",mp==null);$("#arFPos").setAttribute("aria-pressed",mp!=null);$("#arFPosL").textContent=m?m.name:"Poslanik";$("#arPos").hidden=true;
 arRenderStrip();arRenderTok();arTick(true)}
function arPlay(mp){const d=arDay;if(!d||!arSegs)return;arView("play",true);
 $("#arPT").textContent=`${AR_WDL[arDate(d.date).getUTCDay()]}, ${arDate(d.date).getUTCDate()}. ${AR_MON[arDate(d.date).getUTCMonth()]}`;$("#arPS").textContent=d.ses+arDan(d);apply($(".ar-top"));
 arBuildMap();arFilter(mp??null);
 let t=null;if(mp!=null){const s=arSegs.find(x=>x[2]===mp);if(s)t=s[0]-2}
 if(t==null){try{const r=JSON.parse(store.get("arhiva-poz")||"null");if(r&&r.v===d.video)t=r.t}catch(e){}}
 if(t==null)t=Math.max(0,(arSegs[0]?arSegs[0][0]:d.first_s)-5);
 try{if(ytReady)yt.pauseVideo()}catch(e){}
 arEnsure(d.video,t)}
function arEnsure(v,t){
 if(arP&&arReady){if(arVidId!==v){arVidId=v;arP.loadVideoById({videoId:v,startSeconds:t})}else{arP.seekTo(t,true);arP.playVideo()}return}
 if(arP){arVidId=v;arStartAt=t;return}
 arVidId=v;arStartAt=t;
 const go=()=>{arP=new YT.Player("arYt",{host:"https://www.youtube-nocookie.com",width:"100%",height:"100%",videoId:v,
  playerVars:{start:Math.floor(t),autoplay:1,controls:0,disablekb:1,fs:0,rel:0,modestbranding:1,playsinline:1,iv_load_policy:3},
  events:{onReady:e=>{arReady=true;if(arVidId!==v)arP.loadVideoById({videoId:arVidId,startSeconds:arStartAt});else{e.target.seekTo(arStartAt,true);e.target.playVideo()}}}})};
 if(window.YT&&YT.Player)go();else{if(!document.querySelector('script[src*="youtube.com/iframe_api"]')){const sc=document.createElement("script");sc.src="https://www.youtube.com/iframe_api";document.head.appendChild(sc)}
  const w=setInterval(()=>{if(window.YT&&YT.Player){clearInterval(w);go()}},250)}}
let arStartAt=0;
function arPause(){try{if(arP&&arReady)arP.pauseVideo()}catch(e){}}
const arT=()=>{try{return arP&&arReady?arP.getCurrentTime()||0:0}catch(e){return 0}};
function arSeek(t){if(!arP||!arReady)return;try{arP.seekTo(Math.max(0,t),true);arP.playVideo()}catch(e){}setTimeout(()=>arTick(true),200)}
let arSaved=0;
function arTick(force){if(AR.dataset.v!=="play"||!arDay||!arMap)return;const t=arT(),d=arDay;let st=-1;try{st=arP&&arReady?arP.getPlayerState():-1}catch(e){}
 const on=st===1||st===3;$("#arVid").classList.toggle("on",on);$("#arPP").innerHTML=on?AI.pause:AI.play;$("#arPP").setAttribute("aria-label",on?"Pauza":"Pusti");
 $("#arClock").textContent=arAt(d,t,true);
 const x=dragX!=null?dragX:arMap.f(t);$("#arHead").style.left=arPct(x);
 let i=-1;for(let k=0;k<arSegs.length;k++){if(arSegs[k][0]<=t+1)i=k;else break}
 const s=i>=0?arSegs[i]:null,inside=s&&t<=s[1]+3,m=inside?arMp(s[2]):null;
 $("#arName").textContent=m?m.name:(i<0?"Početak sednice":"Predsedavajući");$("#arMeta").textContent=m?`${arGroup(m)} · ${arMss(s[1]-s[0])}`:"Narodna skupština";
 const ph=$("#arPh");ph.style.setProperty("--gc",m?SH[m.g]:"transparent");ph.style.backgroundImage=m&&m.ph?`url(/p/${m.id})`:"none";
 if(i!==arCurI||force){arCurI=i;$$("#arTok button.on").forEach(b=>b.classList.remove("on"));const b=$(`#arTok [data-ari="${i}"]`);
  if(b){b.classList.add("on");if(Date.now()-arScrollAt>6000){const r=b.getBoundingClientRect(),top=$(".ar-stick").getBoundingClientRect().bottom;if(r.top<top||r.bottom>innerHeight-90)scrollBy({top:r.top-top-8,behavior:reduce?"auto":"smooth"})}}}
 if(on&&Date.now()-arSaved>3000){arSaved=Date.now();store.set("arhiva-poz",JSON.stringify({v:d.video,t}))}}
setInterval(()=>arTick(false),400);
addEventListener("scroll",()=>{if(AR.dataset.v==="play")arScrollAt=Date.now()},{passive:true});
addEventListener("touchmove",()=>{if(AR.dataset.v==="play")arScrollAt=Date.now()},{passive:true});
$("#arTok").addEventListener("click",e=>{const b=e.target.closest("[data-ari]");if(!b)return;arScrollAt=Date.now();arSeek(arSegs[+b.dataset.ari][0]-2)});
const arToggle=()=>{try{const s=arP.getPlayerState();s===1||s===3?arP.pauseVideo():arP.playVideo()}catch(e){}};
$("#arShield").onclick=arToggle;$("#arPP").onclick=arToggle;$("#arBig").innerHTML=AI.play;$("#arBig").onclick=arToggle;
$("#arB15").onclick=()=>arSeek(arT()-15);$("#arF15").onclick=()=>arSeek(arT()+15);
$("#arSpd").onclick=()=>{const R=[1,1.25,1.5,2];arRate=R[(R.indexOf(arRate)+1)%R.length];try{arP.setPlaybackRate(arRate)}catch(e){}$("#arSpd").textContent=String(arRate).replace(".",",")+"×"};
/* previous / next speaker (within the chosen MP when one is picked) */
const arStep=dir=>{const t=arT(),idx=arSegs.map((s,i)=>i).filter(arShown);if(!idx.length)return;
 let k=idx.findIndex(i=>arSegs[i][0]>t+1);if(k<0)k=idx.length;const cur=k-1;
 const j=dir>0?k:(cur>=0&&t-arSegs[idx[cur]][0]>4?cur:cur-1);const i=idx[Math.max(0,Math.min(idx.length-1,j))];arScrollAt=0;arSeek(arSegs[i][0]-2)};
$("#arPrev").onclick=()=>arStep(-1);$("#arNext").onclick=()=>arStep(1);
/* strip: tap or drag to move through the day */
let dragX=null;
const arStripX=e=>{const r=$("#arBar").getBoundingClientRect();return Math.max(0,Math.min(100,(e.clientX-r.left)/r.width*100))};
$("#arStrip").addEventListener("pointerdown",e=>{if(!arMap)return;dragX=arStripX(e);$("#arStrip").setPointerCapture(e.pointerId);$("#arHead").style.left=arPct(dragX);$("#arClock").textContent=arAt(arDay,arMap.g(dragX),true)});
$("#arStrip").addEventListener("pointermove",e=>{if(dragX==null)return;dragX=arStripX(e);$("#arHead").style.left=arPct(dragX);$("#arClock").textContent=arAt(arDay,arMap.g(dragX),true)});
const arDrop=()=>{if(dragX==null)return;const t=arMap.g(dragX);dragX=null;arScrollAt=0;arSeek(t)};
$("#arStrip").addEventListener("pointerup",arDrop);$("#arStrip").addEventListener("pointercancel",()=>{dragX=null});
/* filter: Sve / one MP who spoke that day */
$("#arFAll").onclick=()=>arFilter(null);
$("#arFPos").onclick=()=>{const p=$("#arPos");p.hidden=!p.hidden;if(!p.hidden){$("#arPosQ").value="";arPosList();$("#arPosQ").focus()}};
function arPosList(){const q=sfold($("#arPosQ").value),by=arTotals();
 $("#arPosL").innerHTML=[...by.entries()].filter(([m])=>!q||sfold(m.name).includes(q)).sort((a,b)=>b[1].t-a[1].t).map(([m,o])=>`<li><button type="button" data-arp="${m.id}"><i style="background:${SH[m.g]}"></i>${arEsc(m.name)}<small class="nt">${o.n}× · ${arMss(o.t)}</small></button></li>`).join("")||'<li class="m" style="padding:10px 4px">Nema takvog govornika.</li>';apply($("#arPosL"))}
$("#arPosQ").addEventListener("input",arPosList);
$("#arPosL").addEventListener("click",e=>{const b=e.target.closest("[data-arp]");if(!b)return;const mp=Number(b.dataset.arp);arFilter(mp);const s=arSegs.find(x=>x[2]===mp);if(s){arScrollAt=0;arSeek(s[0]-2)}});
$("#arPBack").onclick=()=>history.state&&history.state.ar==="play"?history.back():(arView("day"),arRenderDay());
/* leaving the Arhiva tab stops the recording */
new MutationObserver(()=>{if(document.body.dataset.tab!=="arhiva")arPause()}).observe(document.body,{attributes:true,attributeFilter:["data-tab"]});
/* who sees it: admins while V1, everyone in the design preview */
function arGate(){const on=!V1||!!ADM;document.body.classList.toggle("arh",on);if(on)arLoad()}
{const base=admSet;admSet=function(a){base(a);arGate()}}
arGate();
