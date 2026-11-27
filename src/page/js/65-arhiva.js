/* arhiva: list of sitting days → one day → its recording with a timeline (html/arhiva.html, css/50-arhiva).
   Data (src/arhiva.js): GET /api/arhiva (every day) and /api/arhiva/day?d=<date> (one day's document). A document:
   parts [{v, at, dur, s0}] = YouTube videos (or stretches of one) played back to back, pauses cut out; speeches
   [at, dur, mp|null, name if not an MP, clock "10:05", summary, chair 0/1]; ev (glasanje / konstatacija / opomena,
   with at); agenda [n, at, title]. All "at" are day seconds (the parts back to back). A day only our reader has
   (obrada: 1) is one part: the whole stream.
   Open to everyone (body.arh). */
const AR=$("#arhiva");
const AR_MON=["januar","februar","mart","april","maj","jun","jul","avgust","septembar","oktobar","novembar","decembar"];
const AR_WD=["ned","pon","uto","sre","čet","pet","sub"],AR_WDL=["Nedelja","Ponedeljak","Utorak","Sreda","Četvrtak","Petak","Subota"];
const arPx=r=>`<svg class="mi" viewBox="0 0 13 13" aria-hidden="true" shape-rendering="crispEdges" fill="currentColor">${r.map(([x,y,w,h])=>`<rect x="${x}" y="${y}" width="${w}" height="${h}"/>`).join("")}</svg>`;
const AI={
 sat:arPx([[4,0,5,1],[2,1,2,1],[9,1,2,1],[1,2,1,2],[11,2,1,2],[0,4,1,5],[12,4,1,5],[1,9,1,2],[11,9,1,2],[2,11,2,1],[9,11,2,1],[4,12,5,1],[6,3,1,4],[7,6,2,1]]),
 pesak:arPx([[2,0,9,1],[2,12,9,1],[3,1,1,2],[9,1,1,2],[4,3,1,1],[8,3,1,1],[5,4,3,1],[6,5,1,3],[5,8,1,1],[7,8,1,1],[4,9,1,1],[8,9,1,1],[3,10,1,2],[9,10,1,2],[4,11,5,1]]),
 play:arPx([[3,2,2,9],[5,3,2,7],[7,4,2,5],[9,5,2,3]]),
 pause:arPx([[3,2,3,9],[8,2,3,9]]),
 x:arPx([[2,2,2,2],[9,2,2,2],[4,4,2,1],[7,4,2,1],[5,5,3,3],[4,8,2,1],[7,8,2,1],[2,9,2,2],[9,9,2,2]]),
 glas:arPx([[1,1,11,1],[1,11,11,1],[1,2,1,9],[11,2,1,9],[3,6,1,1],[4,7,1,1],[5,8,1,1],[6,7,1,1],[7,6,1,1],[8,5,1,1],[9,4,1,1]]),
 /* opomena: a warning triangle with a dark "!" (not the text colour, so it reads as a sign in both themes) */
 op:`<svg class="mi ar-al" viewBox="0 0 13 13" aria-hidden="true" shape-rendering="crispEdges"><g fill="var(--alarm)"><rect x="6" y="1" width="1" height="1"/><rect x="5" y="2" width="3" height="2"/><rect x="4" y="4" width="5" height="2"/><rect x="3" y="6" width="7" height="2"/><rect x="2" y="8" width="9" height="2"/><rect x="1" y="10" width="11" height="1"/><rect x="0" y="11" width="13" height="1"/></g><g fill="#1b1410"><rect x="6" y="4" width="1" height="4"/><rect x="6" y="9" width="1" height="1"/></g></svg>`};
const arEsc=s=>String(s??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/"/g,"&quot;");
const arDur=s=>{s=Math.max(0,Math.round(s/60));const h=Math.floor(s/60),m=s%60;return h?`${h} h${m?` ${m} min`:""}`:`${m} min`};
const arMss=s=>{s=Math.max(0,Math.round(s));const h=Math.floor(s/3600),m=Math.floor(s%3600/60),x=String(s%60).padStart(2,"0");return h?`${h}:${String(m).padStart(2,"0")}:${x}`:`${m}:${x}`};
const arDate=s=>{const [y,m,d]=s.split("-").map(Number);return new Date(Date.UTC(y,m-1,d,12))};
const arTitle=d=>{const dt=arDate(d.date);return `${AR_WDL[dt.getUTCDay()]}, ${dt.getUTCDate()}. ${AR_MON[dt.getUTCMonth()]}`};
/* "Sledeća sednica": only on the newest day, until a newer one comes */
const arNextLine=d=>{if(!arNext||!arDays||d!==arDays[0])return"";const t=new Date(arNext.at),f=o=>t.toLocaleString("sr-Latn-RS",{timeZone:"Europe/Belgrade",...o});
 const dd=new Date(t.toLocaleDateString("en-CA",{timeZone:"Europe/Belgrade"})+"T12:00:00Z");
 return `<span class="ar-next">${AI.sat}Sledeća sednica · ${AR_WD[dd.getUTCDay()]} ${dd.getUTCDate()}. ${AR_MON[dd.getUTCMonth()].slice(0,3)} u ${f({hour:"2-digit",minute:"2-digit",hour12:false}).replace(/^0/,"")}</span>`};
const arSub=d=>arEsc(d.ses)+(d.dan?` · ${d.dan}. dan`:"");
let arMpBy=null;const arMp=id=>{if(id==null)return null;if(!arMpBy)arMpBy=new Map(mps.map(m=>[Number(m.id),m]));return arMpBy.get(Number(id))||null};
const arGroup=m=>m?(m.g===6?"Srbija pobeđuje":groups[m.g][1]):"";
/* a speech's person: an MP from our list, or the name the day gave (ministers and others) */
const arWho=s=>{const m=arMp(s[2]);return m?{m,name:m.name,g:s[6]?"Predsedava":arGroup(m),c:SH[m.g]}:{m:null,name:s[3]||"Predsedavajući",g:s[3]?"":"Narodna skupština",c:"var(--mute2)"}};

let arDays=null,arNext=null,arLoading=false,arDay=null,arDoc=null,arAll=false;
async function arLoad(){if(arDays||arLoading)return;arLoading=true;
 try{const r=await fetch("/api/arhiva");const j=await r.json();arDays=j.days||[];arNext=j.next||null}catch(e){arDays=[]}arLoading=false;arList()}

/* search: Serbian letters and script folded (sfold); every word must match, its last letter dropped when it is long
   so "generalni sekretar" also finds "generalnog sekretara". The line that matched shows under the day. */
const arStem=w=>w.length>4?w.slice(0,-1):w;
function arHay(d){if(d._h==null){const dt=arDate(d.date),names=(d.mps||[]).map(arMp).filter(Boolean).map(m=>m.name);
 d._h=sfold([d.ses,`${dt.getUTCDate()}. ${AR_MON[dt.getUTCMonth()]}`,d.date,AR_WDL[dt.getUTCDay()],d.hay||"",...names].join(" | "))}return d._h}
function arMark(line,ws){const f=sfold(line);
 /* mark whole words that start with a query stem (positions only match when folding kept every letter one for one) */
 if(f.length!==line.length)return arEsc(line);const hits=[];f.replace(/[a-z0-9]+/g,(w,i)=>{if(ws.some(q=>w.startsWith(q)))hits.push([i,i+w.length]);return w});
 if(!hits.length)return arEsc(line);let r="",at=0;hits.forEach(([a,b])=>{r+=arEsc(line.slice(at,a))+"<mark>"+arEsc(line.slice(a,b))+"</mark>";at=b});return r+arEsc(line.slice(at))}
function arList(){
 const box=$("#arDays");if(!arDays){box.innerHTML="";return}
 const q=sfold($("#arQ").value),ws=q.split(" ").filter(Boolean).map(arStem);$("#arQx").hidden=!q;
 const hits=arDays.filter(d=>ws.every(w=>arHay(d).includes(w)));
 if(!arDays.length){box.innerHTML='<p class="ar-none">Arhiva je još prazna.</p>';return}
 if(!hits.length){box.innerHTML='<p class="ar-none">Nema rezultata.</p>';return}
 let html="",mon="";const months=new Map();hits.forEach(d=>{const k=d.date.slice(0,7);months.set(k,(months.get(k)||0)+1)});
 hits.forEach(d=>{const dt=arDate(d.date),k=d.date.slice(0,7);
  if(k!==mon){if(mon)html+="</ol>";mon=k;const c=months.get(k),mn=AR_MON[dt.getUTCMonth()];html+=`<div class="ar-mon"><span>${mn[0].toUpperCase()+mn.slice(1)} ${dt.getUTCFullYear()}</span><span>${c} ${c===1?"dan":"dana"}</span></div><ol class="ar-days">`}
  const live=apiLive&&d.date===bgDay(Date.now());
  let hit="";if(ws.length){const ln=(d.lines||[]).find(l=>ws.some(w=>sfold(l).includes(w)));
   const nm=(d.mps||[]).map(arMp).filter(m=>m&&ws.some(w=>sfold(m.name).includes(w))).map(m=>m.name).slice(0,3);
   hit=ln?arMark(ln,ws):nm.length?arEsc(nm.join(", ")):""}
  const span=d.first_clock?`${d.first_clock}–${d.last_clock||""}`:"";
  html+=`<li><a href="#arhiva" data-ard="${arEsc(d.date)}"><span class="ar-n"><b>${dt.getUTCDate()}</b><small>${AR_WD[dt.getUTCDay()]}</small></span><span class="ar-c"><b>${arEsc(d.ses)}</b><span class="ar-s">${[d.dan?d.dan+". dan":"",span].filter(Boolean).join(" · ")}</span><span class="ar-f"><span>${AI.sat}<span class="px">${arDur(d.total_s)}</span></span>${d.op?`<span aria-label="Opomene">${AI.op}<span class="px">${d.op}</span></span>`:""}${d.gl?`<span aria-label="Glasanja">${AI.glas}<span class="px">${d.gl}</span></span>`:""}${live?'<span class="ar-tag live"><i class="sq"></i>uživo</span>':d.obrada?`<span class="ar-tag">${AI.pesak}u obradi</span>`:""}</span>${hit?`<span class="ar-hit">${hit}</span>`:""}${ws.length?"":arNextLine(d)}</span></a></li>`});
 box.innerHTML=html+"</ol>";apply(box)}
$("#arQ").addEventListener("input",arList);
$("#arQx").onclick=()=>{$("#arQ").value="";arList();$("#arQ").focus()};
$("#arDays").addEventListener("click",e=>{const a=e.target.closest("[data-ard]");if(!a)return;e.preventDefault();const d=arDays.find(x=>x.date===a.dataset.ard);
 if(apiLive&&d.date===bgDay(Date.now())){setTab("live");return}arOpen(d)});

/* views: list / day / play; the back button of the phone walks back through them */
function arView(v,push){const ch=AR.dataset.v!==v;AR.dataset.v=v;if(v!=="play")arPause();if(push)history.pushState({ar:v},"");if(ch)scrollTo(0,0)}
/* a hash link elsewhere on the site also fires popstate (state null): only act when the view really changes */
addEventListener("popstate",e=>{let v=e.state&&e.state.ar||"list";if(!arDay)v="list";if(v===AR.dataset.v)return;arView(v);if(v==="day")arRenderDay()});

async function arOpen(d){arDay=d;arDoc=null;arTot=null;arOps=[];arGls=[];arAll=false;arFilt="sve";arPosMp=null;arView("day",true);arRenderDay();
 try{const [r]=await Promise.all([fetch("/api/arhiva/day?d="+encodeURIComponent(d.date)),arPotvrde()]);const j=await r.json();if(!j.error)arDoc=j}catch(e){}
 if(arDay===d){arPrep();arRenderDay()}}
/* clock at a day second: the last speech before it with a clock, plus the seconds since */
function arClockAt(t,sec){const S=arDoc&&arDoc.speeches||[];let b=null;for(const s of S){if(s[0]>t+.5)break;if(s[4])b=s}
 if(!b)b=S.find(s=>s[4]);/* before the first speech: count back from it */
 if(!b)return arMss(t);const [h,m]=b[4].split(":").map(Number),x=Math.max(0,Math.round(h*3600+m*60+(t-b[0])));const hh=Math.floor(x/3600)%24,mm=Math.floor(x%3600/60),ss=x%60;
 return hh+":"+String(mm).padStart(2,"0")+(sec?":"+String(ss).padStart(2,"0"):"")}
/* what the day page and the recording share: talk time per MP, the events */
let arTot=null,arOps=[],arGls=[];
/* the chair's turns are left out of "who spoke most" (they stay in the list of the recording) */
let arPv=[],arPend=[];
function arPrep(){const D=arDoc;arTot=new Map();arOps=[];arGls=[];arPend=[];if(!D)return;
 D.speeches.forEach(s=>{const m=arMp(s[2]);if(!m||s[6])return;const o=arTot.get(m)||{t:0,n:0};o.t+=s[1];o.n++;arTot.set(m,o)});
 arOps=(D.ev||[]).filter(e=>e.k==="opomena");arGls=(D.ev||[]).filter(e=>e.k==="glasanje");
 /* opomene visitors confirmed join the sure ones; open ones wait for answers */
 (D.cand||[]).forEach(c=>{const v=arPv.find(x=>Math.abs(x.at-c.at)<.2);
  if(v&&v.st==="da"){const m=arMp(v.mp);arOps.push({k:"opomena",at:c.at,mp:v.mp,name:m?m.name:"",t:c.t,potvrda:1})}
  else if(!v||!v.st)arPend.push({...c,my:v?v.my:null})});
 arOps.sort((a,b)=>a.at-b.at)}
async function arPotvrde(){if(!arDay)return;try{const r=await fetch("/api/arhiva/potvrde?d="+arDay.date,{cache:"no-store"});arPv=await r.json()}catch(e){arPv=[]}}
const arRes=r=>r?[r.za!=null?`za ${r.za}`:"",r.protiv!=null?`protiv ${r.protiv}`:"",r.uzdrzano?`uzdržano ${r.uzdrzano}`:""].filter(Boolean).join(" · "):"";
function arRenderDay(){const d=arDay;if(!d)return;const D=arDoc;
 const list=arTot?[...arTot.entries()].sort((a,b)=>b[1].t-a[1].t):[];
 const arTt=list.reduce((s,[,o])=>s+o.t,0);
 const rows=(arAll?list:list.slice(0,5)).map(([m,o],k)=>`<li><button type="button" data-arm="${m.id}"><span class="rk">${k+1}</span><span class="sph" style="--gc:${SH[m.g]}${m.ph?`;background-image:url(/p/${m.id})`:""}"></span><span class="nm"><b>${arEsc(m.name)}</b><small>${arEsc(arGroup(m))}</small></span>${xStats(o.n||1,o.t,arTt,arMss)}</button></li>`).join("");
 const span=d.first_clock?`${d.first_clock}–${d.last_clock||""}`:"";
 const ukr=D&&!D.obrada?(D.ev||[]).filter(e=>(e.k==="glasanje"||e.k==="konstatacija")&&e.p!==0&&!/^Povreda Poslovnika/i.test(e.t)).map(e=>e.h||e.o).filter(Boolean).filter((x,i,a)=>a.indexOf(x)===i).slice(0,4):[];
 const play=(at,label)=>`<button type="button" class="ar-pl" data-art="${at}" aria-label="${arEsc(label)}">${AI.play}</button>`;
 $("#arDay").innerHTML=`<div class="ar-h"><button type="button" class="ar-back" id="arDBack">‹ Arhiva</button>
<div><h2>${arTitle(d)}</h2><p>${arSub(d)}</p>${arNextLine(d)}</div>
<div class="ar-k"><div><span>Trajanje</span><b>${arDur(d.total_s)}</b>${span?`<span>${span}</span>`:""}</div><div><span>Govornika</span><b>${d.speakers}</b></div>${d.obrada?"":`<div><span>Opomene</span><b class="ar-ki">${d.op?AI.op:""}${d.op||0}</b></div><div><span>Glasanja</span><b class="ar-ki">${d.gl?AI.glas:""}${d.gl||0}</b></div>`}</div></div>
${d.obrada?`<div class="ar-wait"><span>${AI.pesak}</span><span><b>U obradi</b><small>Sažetak, opomene i glasanja stižu sa stenografskim beleškama.</small></span></div>`:""}
${ukr.length?`<section class="ar-sec"><h3>Ukratko</h3><ul class="ar-ukr">${ukr.map(x=>`<li>${arEsc(x)}</li>`).join("")}</ul></section>`:""}
${D&&D.agenda&&D.agenda.length?`<section class="ar-sec"><h3>Dnevni red</h3><ol class="ar-rows">${D.agenda.map(a=>`<li><span class="ar-an">${a[0]}.</span><span class="ar-rt">${arEsc(a[2])}</span><span class="px ar-tm">${arClockAt(a[1])}</span>${play(a[1],"Pusti od ove tačke")}</li>`).join("")}</ol></section>`:""}
<section class="ar-sec">${arTot?seatMap(arTot):""}<h3>Najviše govorili</h3>${arTot?`<ol class="xlist">${rows}</ol>${list.length>5?`<button type="button" class="ar-more" id="arMore">${arAll?"Prikaži manje":`Vidi sve · ${list.length} ›`}</button>`:""}`:'<p class="m">Učitava se…</p>'}</section>
${arOps.length?`<section class="ar-sec"><h3>Opomene</h3><ol class="ar-rows">${arOps.map(e=>{const m=arMp(e.mp);return `<li>${AI.op}<span class="ar-rt"><b>${arEsc(m?m.name:e.name||"Opomena")}</b><small>${arEsc(arGroup(m))}${e.drugu?" · druga opomena":""}</small></span><span class="px ar-tm">${arClockAt(e.at)}</span>${play(e.at,"Pusti opomenu")}</li>`}).join("")}</ol></section>`:""}
${arGls.length?`<section class="ar-sec"><h3>Glasanja</h3><ol class="ar-rows">${arGls.map(e=>`<li>${AI.glas}<span class="ar-rt"><b>${arEsc(e.h||e.t)}</b><small>${arEsc(arRes(e.r)||e.o)}</small></span><span class="ar-pass${e.p?"":" no"}">${e.p?"Usvojeno":"Odbijeno"}</span>${play(e.at,"Pusti glasanje")}</li>`).join("")}</ol></section>`:""}
${D?`<button type="button" class="ar-go" id="arGo">${AI.play}Gledaj snimak</button>`:""}`;
 apply($("#arDay"));
 $("#arDBack").onclick=()=>history.state&&history.state.ar?history.back():arView("list");
 const mo=$("#arMore");if(mo)mo.onclick=()=>{arAll=!arAll;arRenderDay()};
 const go=$("#arGo");if(go)go.onclick=()=>arPlay(null,null)}
$("#arDay").addEventListener("click",e=>{const b=e.target.closest("[data-arm]");if(b){arPlay(Number(b.dataset.arm),null);return}
 const p=e.target.closest("[data-art]");if(p)arPlay(null,Number(p.dataset.art))});

/* recording: one YouTube player of our own (the live one keeps the live stream), our controls, the day as one strip.
   The day plays its parts back to back: at a part's end the next one loads (or, inside one stream, we jump over the pause). */
let arP=null,arReady=false,arPi=0,arFilt="sve",arPosMp=null,arCurI=-1,arScrollAt=0,arRate=1,arStartAt=0,arWant=null;
const arPct=v=>Math.max(0,Math.min(100,v)).toFixed(3)+"%";
const arPos=t=>arDoc?t/arDoc.total*100:0;
/* rows of the list: speeches (short chair turns left out), agenda items, events */
let arRows=[];
function arBuildRows(){const D=arDoc,r=[];if(!D){arRows=r;return}
 (D.agenda||[]).forEach(a=>r.push({k:"t",at:a[1],a}));
 D.speeches.forEach((s,i)=>{if(s[6]&&s[1]<45)return;r.push({k:"s",at:s[0],s,i})});
 arOps.forEach(e=>r.push({k:"opomena",at:e.at,e}));arGls.forEach(e=>r.push({k:"glasanje",at:e.at,e}));
 r.sort((a,b)=>a.at-b.at||(a.k==="t"?-1:1));arRows=r}
const arShow=x=>arFilt==="sve"?true:arFilt==="op"?x.k==="opomena":arFilt==="gl"?x.k==="glasanje":x.k==="s"&&x.s[2]===arPosMp;
function arRenderStrip(){const D=arDoc;if(!D)return;
 const dim=arFilt==="op"||arFilt==="gl";
 $("#arBar").innerHTML=D.speeches.map(s=>{const w=arWho(s),off=dim||(arFilt==="pos"&&s[2]!==arPosMp);return `<i class="${off?"off":""}" style="left:${arPct(arPos(s[0]))};width:${arPct(Math.max(.25,arPos(s[1])))};background:${w.c}"></i>`}).join("")
  +D.parts.slice(1).map(p=>`<u style="left:${arPct(arPos(p.at))}"></u>`).join("");
 /* markers above the strip: one per moment, or one with a count where several fall close together (a run of votes);
    a thin tick on the strip for each of them */
 const evs=[...(arFilt==="gl"||arFilt==="pos"?[]:arOps.map(e=>({k:"opomena",at:e.at}))),...(arFilt==="op"||arFilt==="pos"?[]:arGls.map(e=>({k:"glasanje",at:e.at})))].sort((a,b)=>a.at-b.at);
 const cl=[];evs.forEach(e=>{const p=arPos(e.at),c=cl.filter(x=>x.k===e.k).pop();if(c&&p-c.p1<3.5){c.p1=p;c.at.push(e.at)}else cl.push({k:e.k,p0:p,p1:p,at:[e.at]})});
 $("#arMk").innerHTML=cl.map(c=>`<button type="button" data-art="${c.at[0]}" style="left:${arPct(Math.min(96,Math.max(2,(c.p0+c.p1)/2)))}" aria-label="${c.k==="opomena"?"Opomen"+(c.at.length>1?"e":"a"):"Glasanj"+(c.at.length>1?"a":"e")}${c.at.length>1?" ("+c.at.length+")":""} u ${arClockAt(c.at[0])}">${c.k==="opomena"?AI.op:AI.glas}${c.at.length>1?`<b class="px">${c.at.length}</b>`:""}</button>`).join("");
 $("#arBar").insertAdjacentHTML("beforeend",evs.map(e=>`<s class="${e.k==="opomena"?"op":""}" style="left:${arPct(arPos(e.at))}"></s>`).join(""));
 /* hour labels where the clock passes a full hour, not too close together */
 const hrs=[];let lastH=null;D.speeches.forEach(s=>{if(!s[4])return;const h=+s[4].split(":")[0];if(lastH!=null&&h!==lastH){const p=arPos(s[0]);if(p>4&&p<96&&!hrs.some(x=>Math.abs(x.p-p)<9))hrs.push({p,l:h})}lastH=h});
 $("#arHours").innerHTML=hrs.map(x=>`<span style="left:${arPct(x.p)}">${x.l}</span>`).join("")}
let arOpenRuns=new Set();
function arRenderTok(){let html="";const vis=[];arRows.forEach((x,j)=>{if(arShow(x)&&!(x.k==="t"&&arFilt!=="sve"))vis.push([x,j])});
 const row=(x,j)=>{
  if(x.k==="t")return `<li class="gap">Tačka ${x.a[0]} · ${arEsc(x.a[2])}</li>`;
  if(x.k==="s"){const w=arWho(x.s);return `<li><button type="button" data-arj="${j}"><span class="t px">${arClockAt(x.at)}</span><i style="background:${w.c}"></i><span class="nm"><b>${arEsc(w.name)}</b><small>${arEsc(w.g)}</small>${x.s[5]?`<span class="sum">${arEsc(x.s[5])}</span>`:""}</span><span class="d px">${arMss(x.s[1])}</span></button></li>`}
  const e=x.e,m=arMp(e.mp);
  return `<li><button type="button" data-arj="${j}" class="ev"><span class="t px">${arClockAt(x.at)}</span>${e.k==="opomena"?AI.op:AI.glas}<span class="nm"><b>${arEsc(e.k==="opomena"?(m?m.name:e.name||"Opomena"):(e.h||e.t))}</b><small>${e.k==="opomena"?"Opomena"+(e.drugu?" · druga":""):arEsc(arRes(e.r)||"Glasanje")}</small></span>${e.k==="glasanje"?`<span class="ar-pass${e.p?"":" no"}">${e.p?"Usvojeno":"Odbijeno"}</span>`:""}</button></li>`};
 /* three or more votes in a row fold into one line (open it to see them all); the Glasanja filter shows them all */
 for(let i=0;i<vis.length;i++){const [x,j]=vis[i];
  if(arFilt==="sve"&&x.k==="glasanje"){let n=i;while(n+1<vis.length&&vis[n+1][0].k==="glasanje")n++;
   if(n-i>=2&&!arOpenRuns.has(j)){const last=vis[n][0];html+=`<li><button type="button" class="ev run" data-arrun="${j}"><span class="t px">${arClockAt(x.at)}</span>${AI.glas}<span class="nm"><b>${n-i+1} glasanja</b><small>${arClockAt(x.at)}–${arClockAt(last.at)}</small></span><span class="d">›</span></button></li>`;i=n;continue}}
  html+=row(x,j)}
 $("#arTok").innerHTML=html||'<li class="gap">Nema govora.</li>';apply($("#arTok"));arCurI=-1}
function arChips(){const fo=$("#arFOp"),fg=$("#arFGl");
 fo.hidden=!arOps.length;fo.innerHTML=`${AI.op}<span class="px">${arOps.length}</span>`;fo.setAttribute("aria-label","Opomene");
 fg.hidden=!arGls.length;fg.innerHTML=`${AI.glas}<span class="px">${arGls.length}</span>`;fg.setAttribute("aria-label","Glasanja");
 [["#arFAll","sve"],["#arFOp","op"],["#arFGl","gl"],["#arFPos","pos"]].forEach(([s,f])=>$(s).setAttribute("aria-pressed",arFilt===f));
 const m=arFilt==="pos"?arMp(arPosMp):null,sel=$("#arSel");sel.hidden=!m;
 if(m){const o=arTot&&arTot.get(m);sel.innerHTML=`<i style="background:${SH[m.g]}"></i><b>${arEsc(m.name)}</b>${o?`<small class="px">${o.n}× · ${arMss(o.t)}</small>`:""}<button type="button" id="arSelX" aria-label="Poništi">${AI.x}</button>`;apply(sel);$("#arSelX").onclick=()=>arFilter("sve")}}
function arFilter(f,mp){arFilt=f;if(f==="pos")arPosMp=mp;$("#arPos").hidden=true;arChips();arRenderStrip();arRenderTok();arTick(true)}
function arPlay(mp,at){const d=arDay,D=arDoc;if(!d||!D)return;arView("play",true);
 $("#arPT").textContent=arTitle(d);$("#arPS").innerHTML=arSub(d);apply($(".ar-top"));
 arBuildRows();arFilt=mp!=null?"pos":"sve";arPosMp=mp;arChips();arRenderStrip();arRenderTok();
 let t=at;if(t==null&&mp!=null){const s=D.speeches.find(x=>x[2]===mp);if(s)t=s[0]-2}
 if(t==null){try{const r=JSON.parse(store.get("arhiva-poz")||"null");if(r&&r.d===d.date)t=r.t}catch(e){}}
 if(t==null)t=Math.max(0,(D.speeches[0]?D.speeches[0][0]:0)-3);
 try{if(ytReady)yt.pauseVideo()}catch(e){}
 arSeek(Math.max(0,t))}
/* day second → part and its video second */
const arPartAt=t=>{const P=arDoc.parts;let i=0;for(let k=0;k<P.length;k++)if(P[k].at<=t+.01)i=k;return i};
function arSeek(t){const D=arDoc;if(!D)return;t=Math.max(0,Math.min(D.total-1,t));const i=arPartAt(t),p=D.parts[i],vt=p.s0+Math.max(0,t-p.at);arPi=i;arScrollAt=0;
 if(!arP){arStartAt=vt;arWant=p.v;arMake(p.v,vt);return}
 if(!arReady){arWant=p.v;arStartAt=vt;return}
 let cur=null;try{cur=(arP.getVideoData()||{}).video_id}catch(e){}
 try{if(cur===p.v){arP.seekTo(vt,true);arP.playVideo()}else arP.loadVideoById({videoId:p.v,startSeconds:vt})}catch(e){}
 setTimeout(()=>arTick(true),250)}
function arMake(v,vt){const go=()=>{arP=new YT.Player("arYt",{host:"https://www.youtube-nocookie.com",width:"100%",height:"100%",videoId:v,
  playerVars:{start:Math.floor(vt),autoplay:1,controls:0,disablekb:1,fs:0,rel:0,modestbranding:1,playsinline:1,iv_load_policy:3},
  events:{onReady:e=>{arReady=true;try{arP.setPlaybackRate(arRate)}catch(x){}if(arWant!==v)arP.loadVideoById({videoId:arWant,startSeconds:arStartAt});else{e.target.seekTo(arStartAt,true);e.target.playVideo()}},
   onStateChange:e=>{if(e.data===0)arNextPart()}}})};
 if(window.YT&&YT.Player)go();else{if(!document.querySelector('script[src*="youtube.com/iframe_api"]')){const sc=document.createElement("script");sc.src="https://www.youtube.com/iframe_api";document.head.appendChild(sc)}
  const w=setInterval(()=>{if(window.YT&&YT.Player){clearInterval(w);go()}},250)}}
function arNextPart(){const D=arDoc;if(!D||arPi>=D.parts.length-1)return;arSeek(D.parts[arPi+1].at+.1)}
function arPause(){try{if(arP&&arReady)arP.pauseVideo()}catch(e){}}
/* where in the day we are, from the player: its video and second, inside the current part (or another part of the same video) */
function arNow(){const D=arDoc;if(!D||!arP||!arReady)return null;let ct=0,v=null;try{ct=arP.getCurrentTime()||0;v=(arP.getVideoData()||{}).video_id}catch(e){return null}
 const P=D.parts,ok=k=>P[k]&&P[k].v===v&&ct>=P[k].s0-2&&ct<=P[k].s0+P[k].dur+2;
 if(!ok(arPi)){const k=P.findIndex((p,j)=>ok(j));if(k>=0)arPi=k}
 const p=P[arPi];return{t:p.at+Math.max(0,ct-p.s0),ct,p}}
let arSaved=0,dragX=null;
function arTick(force){if(AR.dataset.v!=="play"||!arDoc)return;const D=arDoc,n=arNow();let st=-1;try{st=arP&&arReady?arP.getPlayerState():-1}catch(e){}
 const on=st===1||st===3;$("#arVid").classList.toggle("on",on);$("#arPP").innerHTML=on?AI.pause:AI.play;$("#arPP").setAttribute("aria-label",on?"Pauza":"Pusti");
 if(n&&on&&n.ct>=n.p.s0+n.p.dur-.4&&arPi<D.parts.length-1){arNextPart();return}
 const t=n?n.t:0;$("#arClock").textContent=arClockAt(dragX!=null?dragX/100*D.total:t,true);$("#arHead").style.left=arPct(dragX!=null?dragX:arPos(t));
 let si=-1;for(let k=0;k<D.speeches.length;k++){if(D.speeches[k][0]<=t+1)si=k;else break}
 const s=si>=0?D.speeches[si]:null,inside=s&&t<=s[0]+s[1]+3,w=inside?arWho(s):null;
 $("#arName").textContent=w?w.name:(si<0?"Početak sednice":"Narodna skupština");$("#arMeta").textContent=w?[w.g,arMss(s[1])].filter(Boolean).join(" · "):"";
 const ph=$("#arPh");ph.style.setProperty("--gc",w&&w.m?w.c:"transparent");ph.style.backgroundImage=w&&w.m&&w.m.ph?`url(/p/${w.m.id})`:"none";
 /* the row of now: the last visible row that has started */
 let j=-1;for(let k=0;k<arRows.length;k++){const x=arRows[k];if(x.at>t+1)break;if(arShow(x)&&x.k!=="t")j=k}
 if(j!==arCurI||force){arCurI=j;$$("#arTok button.on").forEach(b=>b.classList.remove("on"));const b=$(`#arTok [data-arj="${j}"]`);
  if(b){b.classList.add("on");if(Date.now()-arScrollAt>6000){const r=b.getBoundingClientRect(),top=$(".ar-stick").getBoundingClientRect().bottom;if(r.top<top||r.bottom>innerHeight-90)scrollBy({top:r.top-top-8,behavior:reduce?"auto":"smooth"})}}}
 arAskShow(t);
 if(on&&Date.now()-arSaved>3000){arSaved=Date.now();store.set("arhiva-poz",JSON.stringify({d:arDay.date,t}))}}
/* a moment we weren't sure of: signed-in visitors are asked, once, while it plays (from just before to 2 min after) */
let arAskC=null,arAskStep=0;
function arAskShow(t){const box=$("#arAsk");let me_=null;try{me_=me}catch(e){}
 const c=me_&&arFilt!=="pos"?arPend.find(c=>c.my==null&&t>=c.at-5&&t<=c.at+120):null;
 if(c===arAskC)return;arAskC=c;arAskStep=0;box.hidden=!c;if(c)arAskDraw()}
function arAskDraw(){const c=arAskC,box=$("#arAsk");if(!c)return;
 box.innerHTML=arAskStep===0?`${AI.op}<span>Da li je ovde izrečena opomena?</span><button type="button" data-ask="da">Da</button><button type="button" data-ask="ne">Ne</button>`
  :`<span>Kome?</span>${c.opts.map(id=>{const m=arMp(id);return m?`<button type="button" data-ask="mp" data-mp="${id}">${arEsc(m.name)}</button>`:""}).join("")}<button type="button" data-ask="nz">Ne znam</button>`;apply(box)}
$("#arAsk").addEventListener("click",async e=>{const b=e.target.closest("[data-ask]"),c=arAskC;if(!b||!c)return;const k=b.dataset.ask;
 if(k==="da"&&c.opts.length&&arAskStep===0){arAskStep=1;arAskDraw();return}
 const body={d:arDay.date,at:c.at,da:k==="ne"?0:1,mp:k==="mp"?Number(b.dataset.mp):null};c.my=body.da;
 $("#arAsk").innerHTML="<span>Hvala.</span>";setTimeout(()=>{if(arAskC===c){$("#arAsk").hidden=true}},1500);
 try{await fetch("/api/arhiva/potvrde",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});await arPotvrde();arPrep();arRenderStrip();arRenderTok();arChips()}catch(x){}});
setInterval(()=>arTick(false),400);
addEventListener("scroll",()=>{if(AR.dataset.v==="play")arScrollAt=Date.now()},{passive:true});
addEventListener("touchmove",()=>{if(AR.dataset.v==="play")arScrollAt=Date.now()},{passive:true});
$("#arTok").addEventListener("click",e=>{const g=e.target.closest("[data-arrun]");if(g){arOpenRuns.add(+g.dataset.arrun);arRenderTok();arTick(true);return}
 const b=e.target.closest("[data-arj]");if(!b)return;const x=arRows[+b.dataset.arj];arSeek(x.k==="s"?x.at-2:x.at-1)});
$("#arMk").addEventListener("click",e=>{const b=e.target.closest("[data-art]");if(b)arSeek(Number(b.dataset.art)-1)});
const arToggle=()=>{try{const s=arP.getPlayerState();s===1||s===3?arP.pauseVideo():arP.playVideo()}catch(e){}};
$("#arShield").onclick=arToggle;$("#arPP").onclick=arToggle;$("#arBig").innerHTML=AI.play;$("#arBig").onclick=arToggle;
const arCur=()=>{const n=arNow();return n?n.t:0};
$("#arB15").onclick=()=>arSeek(arCur()-15);$("#arF15").onclick=()=>arSeek(arCur()+15);
$("#arSpd").onclick=()=>{const R=[1,1.25,1.5,2];arRate=R[(R.indexOf(arRate)+1)%R.length];try{arP.setPlaybackRate(arRate)}catch(e){}$("#arSpd").textContent=String(arRate).replace(".",",")+"×"};
/* previous / next: the rows of the list as it is filtered */
const arStep=dir=>{const t=arCur(),L=arRows.filter(x=>arShow(x)&&x.k!=="t");if(!L.length)return;
 let k=L.findIndex(x=>x.at>t+1);if(k<0)k=L.length;const cur=k-1;const j=dir>0?k:(cur>=0&&t-L[cur].at>4?cur:cur-1);
 const x=L[Math.max(0,Math.min(L.length-1,j))];arSeek(x.k==="s"?x.at-2:x.at-1)};
$("#arPrev").onclick=()=>arStep(-1);$("#arNext").onclick=()=>arStep(1);
/* strip: tap or drag to move through the day */
const arStripX=e=>{const r=$("#arBar").getBoundingClientRect();return Math.max(0,Math.min(100,(e.clientX-r.left)/r.width*100))};
$("#arStrip").addEventListener("pointerdown",e=>{if(!arDoc||e.target.closest("#arMk button"))return;dragX=arStripX(e);$("#arStrip").setPointerCapture(e.pointerId);arTick(false)});
$("#arStrip").addEventListener("pointermove",e=>{if(dragX==null)return;dragX=arStripX(e);arTick(false)});
$("#arStrip").addEventListener("pointerup",()=>{if(dragX==null)return;const t=dragX/100*arDoc.total;dragX=null;arSeek(t)});
$("#arStrip").addEventListener("pointercancel",()=>{dragX=null});
/* filters */
$("#arFAll").onclick=()=>arFilter("sve");$("#arFOp").onclick=()=>arFilter("op");$("#arFGl").onclick=()=>arFilter("gl");
$("#arFPos").onclick=()=>{const p=$("#arPos");p.hidden=!p.hidden;if(!p.hidden){$("#arPosQ").value="";arPosList();$("#arPosQ").focus()}};
function arPosList(){const q=sfold($("#arPosQ").value);
 $("#arPosL").innerHTML=[...(arTot||new Map()).entries()].filter(([m])=>!q||sfold(m.name).includes(q)).sort((a,b)=>b[1].t-a[1].t).map(([m,o])=>`<li><button type="button" data-arp="${m.id}"><i style="background:${SH[m.g]}"></i>${arEsc(m.name)}<small class="nt">${o.n||1}× · ${arMss(o.t)}</small></button></li>`).join("")||'<li class="m" style="padding:10px 4px">Nema takvog govornika.</li>';apply($("#arPosL"))}
$("#arPosQ").addEventListener("input",arPosList);
$("#arPosL").addEventListener("click",e=>{const b=e.target.closest("[data-arp]");if(!b)return;const mp=Number(b.dataset.arp);arFilter("pos",mp);const s=arDoc.speeches.find(x=>x[2]===mp);if(s)arSeek(s[0]-2)});
$("#arPBack").onclick=()=>history.state&&history.state.ar==="play"?history.back():(arView("day"),arRenderDay());
/* leaving the Arhiva tab stops the recording */
new MutationObserver(()=>{if(document.body.dataset.tab!=="arhiva")arPause()}).observe(document.body,{attributes:true,attributeFilter:["data-tab"]});
/* open to everyone */
document.body.classList.add("arh");arLoad();
