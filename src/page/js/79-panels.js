/* speaker panels: under the player, in place of the chat.
   - podium button (far right of the speaker bar): who spoke how much today, seat map + list; the same spot becomes ×
   - speaker photo: that MP's profile; the photo becomes × while it is open
   Talk times come from the live speaker timeline (TL), counted up to the viewer's own playback position. */
const C2L={"а":"a","б":"b","в":"v","г":"g","д":"d","ђ":"đ","е":"e","ж":"ž","з":"z","и":"i","ј":"j","к":"k","л":"l","љ":"lj","м":"m","н":"n","њ":"nj","о":"o","п":"p","р":"r","с":"s","т":"t","ћ":"ć","у":"u","ф":"f","х":"h","ц":"c","ч":"č","џ":"dž","ш":"š"};
const c2l=s=>String(s||"").replace(/[Ѐ-џ]/g,c=>{const l=c.toLowerCase(),r=C2L[l];if(r==null)return c;return c===l?r:r[0].toUpperCase()+r.slice(1)});
const esc=s=>String(s??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/"/g,"&quot;");
const LISTS=["Studentska lista – Studenti pobeđuju","Savez vojvođanskih Mađara – dr Balint Pastor","Albanska koalicija","Rasim Ljajić – Ljudski (SDP – CDP)","SDA Sandžaka – Čuvari Sandžaka","Usame Zukorlić (SPP) Pokret za ujedinjenje","Aleksandar Vučić – Ujedinjena Srbija"];
/* grammar needs gender; the official data has none, so: first names ending in -a are women's, minus common men's names */
const MALE_A=new Set(["nikola","luka","saša","ilija","andrija","kosta","toma","sava","jovica","mića","pera","đura","joca","zoka","mirča","vanja","miša","braca","boža","raša","staša","lazica","ljuba","maša","aleksa","feđa","mikica","milija","mirza","nebojša","nemanja","uglješa","đoka","perica","siniša","ljubiša","dragiša","radiša","vojkica","miodrag","miodraga","mića"]),
 FEM_X=new Set(["sarah","ines","agnes","edit","katalin","ruth","ivon","nives","dolores","beatrix","erzsébet","ildikó","anikó","mirjam","ester","miriam"]);
const isF=m=>{const f=(m.name||"").split(" ")[0].toLowerCase();return FEM_X.has(f)||(/a$/.test(f)&&!MALE_A.has(f))};
const MON=["januara","februara","marta","aprila","maja","juna","jula","avgusta","septembra","oktobra","novembra","decembra"];
const longDate=d=>{const x=/^(\d{1,2})\.(\d{1,2})\.(\d{4})/.exec(d||"");return x?`${+x[1]}. ${MON[+x[2]-1]} ${x[3]}.`:""};
const mss=s=>{s=Math.max(0,Math.round(s));const h=Math.floor(s/3600),m=Math.floor(s%3600/60),x=String(s%60).padStart(2,"0");return h?`${h}:${String(m).padStart(2,"0")}:${x}`:`${m}:${x}`};
const groupName=m=>{const g=c2l(m.pg||"").replace(/^Poslanička grupa\s*/i,"").replace(/\s*\([^)]*\)\s*$/,"").replace(/^[„"“]|[“”"]$/g,"").trim();return g||null};
const groupRole=(m,f)=>{const r=/\(([^)]*)\)\s*$/.exec(c2l(m.pg||""));if(!r)return"";return /zamenik/i.test(r[1])?(f?"zamenica predsednika":"zamenik predsednika"):/predsednik/i.test(r[1])?(f?"predsednica":"predsednik"):""};

/* talk time today per MP, up to the viewer's position (or to the end of the timeline if not playing) */
function talkTotals(){
 let t=null;try{t=ytReady?yt.getCurrentTime():null}catch(e){}
 /* only count up to the viewer's position while they are actually on today's stream; otherwise the whole day */
 if(!(apiLive||plLive)||!TL.length||t==null||t<TL[0].from)t=null;
 const by=new Map();
 TL.forEach(x=>{const end=x.to==null?(t==null?x.from:Math.max(x.from,t)):(t==null?x.to:Math.min(x.to,Math.max(x.from,t)));if(t!=null&&x.from>t)return;
  const o=by.get(x.mp)||{t:0,n:0};o.t+=Math.max(0,end-x.from);o.n++;by.set(x.mp,o)});
 return by;
}

let xv="",profMp=null,profFrom="";
function xView(v,m){
 if(v==="prof"&&xv!=="prof")profFrom=xv==="stats"?"stats":"";
 xv=v;if(v==="prof")profMp=m||profMp;
 document.body.dataset.xv=v;
 $("#p-stats").hidden=v!=="stats";$("#p-prof").hidden=v!=="prof";
 $("#phw").classList.toggle("open",v==="prof");$("#phBtn").setAttribute("aria-expanded",v==="prof");
 $("#phBtn").setAttribute("aria-label",v==="prof"?"Zatvori profil":"Profil govornika");
 $("#podBtn").classList.toggle("open",v==="stats");$("#podBtn").setAttribute("aria-expanded",v==="stats");
 $("#podBtn").setAttribute("aria-label",v==="stats"?"Zatvori statistiku":dayAsk(tlDay()));
 renderPanels(true);
}
/* the podium button's label follows the day of the stats */
setInterval(()=>{if(xv!=="stats")$("#podBtn").setAttribute("aria-label",dayAsk(tlDay()))},5000);
$("#podBtn").onclick=()=>xView(xv==="stats"?"":"stats");
$("#phBtn").onclick=()=>{if(xv==="prof")xView("");else if(curSp)xView("prof",curSp)};

/* circles that would overlap push each other apart, while a spring pulls each one back to its seat: they end up as close to
   their seats as they can without covering each other. The smaller circle moves more. Runs once per render (few dozen circles). */
function spread(ns,W=300,H=168){
 const pad=.8,n=ns.length;if(n<2)return;
 for(let it=0;it<200;it++){const k=it<160?.06*(1-it/160):0;
  for(const a of ns){a.x+=(a.hx-a.x)*k;a.y+=(a.hy-a.y)*k}
  for(let i=0;i<n;i++)for(let j=i+1;j<n;j++){const a=ns[i],b=ns[j];let dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy);const min=a.r+b.r+pad;
   if(d>=min)continue;if(d<1e-3){dx=Math.cos(i*2.4+j);dy=Math.sin(i*2.4+j);d=1}
   const ov=min-d,wa=b.r*b.r/(a.r*a.r+b.r*b.r),ux=dx/d,uy=dy/d;
   a.x-=ux*ov*wa;a.y-=uy*ov*wa;b.x+=ux*ov*(1-wa);b.y+=uy*ov*(1-wa)}
  for(const a of ns){a.x=Math.min(W-a.r,Math.max(a.r,a.x));a.y=Math.min(H-a.r,Math.max(a.r,a.y))}
 }
}
/* seat map: the hall as on the Sala tab, the same seats (seatLayout() in 30-hall.js): the presidium bench at the top, the 8 sections
   below it with a slight aisle between them; whoever spoke is coloured and bigger, the longer the bigger */
function seatMap(by){
 const LY=seatLayout(),R=136,cx=150,cy=22,HS=hallSeats(R),at=new Map(HS.seats.map(p=>[p.key,{x:cx-p.r*Math.cos(p.a),y:cy+p.r*Math.sin(p.a)}])),mx=Math.max(1,...[...by.values()].map(o=>o.t));
 const gap=12,bx=j=>cx+(j-4)*gap,by0=7,pos=new Map();
 LY.inHall.forEach(m=>{const p=at.get(LY.plan.at.get(m));if(p)pos.set(m,p)});
 LY.bench.forEach((m,j)=>{if(m&&typeof m!=="string")pos.set(m,{x:bx(j),y:by0})});
 let base=`<rect x="${bx(0)-gap/2-2}" y="${by0-5}" width="${gap*9+4}" height="10" rx="2" fill="none" stroke="var(--line)"/>`;
 for(const j in BENCH_FIX)base+=`<circle cx="${bx(+j)}" cy="${by0}" r="1.8" fill="none" stroke="var(--seat)" stroke-width="1"/>`;
 LY.plan.empty.forEach(k=>{const p=at.get(k);base+=`<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="1.7" fill="none" stroke="var(--seat)" stroke-width=".8"/>`});
 const top=[];
 mps.forEach(m=>{const p=pos.get(m);if(!p)return;const o=by.get(m);
  if(o&&o.t>0)top.push({m,t:o.t,hx:p.x,hy:p.y,x:p.x,y:p.y,r:3+6.5*Math.sqrt(o.t/mx)});
  else base+=`<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="2.2" fill="var(--seat)"/>`});
 spread(top);
 /* a circle pushed off its seat keeps a thin line back to it */
 const f=v=>v.toFixed(1),tie=top.filter(n=>Math.hypot(n.x-n.hx,n.y-n.hy)>n.r*.6).map(n=>`<line x1="${f(n.hx)}" y1="${f(n.hy)}" x2="${f(n.x)}" y2="${f(n.y)}" stroke="${SH[n.m.g]}" stroke-width=".8" opacity=".5"/><circle cx="${f(n.hx)}" cy="${f(n.hy)}" r="1.4" fill="${SH[n.m.g]}" opacity=".6"/>`).join("");
 /* bigger circles first, so a small one next to a big one stays visible on top */
 return `<svg class="smap" viewBox="0 0 300 168" role="img" aria-label="Sala: veći krug, duže govorio">${base}${tie}${top.sort((a,b)=>b.t-a.t).map(n=>`<circle cx="${f(n.x)}" cy="${f(n.y)}" r="${f(n.r)}" fill="${SH[n.m.g]}" stroke="var(--bg)" stroke-width="1"><title>${esc(n.m.name)} · ${mss(n.t)}</title></circle>`).join("")}</svg>`;
}
/* which day the speaker timeline is about: "danas", "juče", the date, or "" when not known. The stats keep showing the last sitting until
   the next one starts, so they must say which day it was. tlAt is `sitting` from /api/live/speakers: the last moment the stream was
   live (not `updated`, which the reader refreshes all day). A sitting that runs past midnight still counts as the day it started (4 h back). */
const bgDay=ms=>new Date(ms).toLocaleDateString("en-CA",{timeZone:"Europe/Belgrade"});
function tlDay(){
 if(apiLive)return "danas";
 if(!tlAt)return "";
 const d=bgDay(tlAt-4*3600e3),now=Date.now();
 if(d===bgDay(now))return "danas";if(d===bgDay(now-864e5))return "juče";
 const [y,mo,da]=d.split("-").map(Number);return `${da}. ${MON[mo-1]}${y!==new Date(now).getFullYear()?" "+y+".":""}`;
}
const dayWhen=w=>w||"na poslednjoj sednici";
const dayAsk=w=>w==="danas"||w==="juče"?`Ko je ${w} najviše govorio`:`Ko je najviše govorio ${dayWhen(w)}`;
/* the three numbers of a "Najviše govorili" row (also Arhiva): how many times, then time over share of all the time */
function xStats(n,t,tot,fmt){const p=tot>0?t/tot*100:0;return `<span class="xs"><span class="xn nt">${n}×</span><span class="xt"><b class="nt">${fmt(t)}</b><small class="nt">${p>0&&p<1?"<1":Math.round(p)}%</small></span></span>`}
function renderStats(by){
 const list=[...by.entries()].filter(([,o])=>o.t>0).sort((a,b)=>b[1].t-a[1].t),tot=list.reduce((s,[,o])=>s+o.t,0);
 const rows=list.map(([m,o],k)=>`<li><button type="button" data-pm="${m.i}"><span class="rk">${k+1}</span><span class="sph" style="--gc:${SH[m.g]}${m.ph?`;background-image:url(/p/${m.id})`:""}"></span><span class="nm"><b>${esc(m.name)}</b><small>${esc(m.g===6?"Srbija pobeđuje":groups[m.g][1])}</small></span>${xStats(o.n,o.t,tot,mss)}</button></li>`).join("");
 const w=tlDay();
 $("#p-stats").innerHTML=`<div class="xin">${seatMap(by)}<h3>Najviše govorili ${dayWhen(w)}</h3>${list.length?`<ol class="xlist">${rows}</ol>`:`<p class="m">${w==="danas"?"Još niko nije govorio danas.":"Nema zabeleženih govora."}</p>`}</div>`;
 apply($("#p-stats"));
}
$("#p-stats").addEventListener("click",e=>{const b=e.target.closest("[data-pm]");if(b)xView("prof",mps[b.dataset.pm])});

function bio(m){
 const f=isF(m),gn=groupName(m),gr=groupRole(m,f),d=longDate(m.md),parts=[];
 if(m.role){const r=/potpredsed/i.test(c2l(m.role))?(f?"Potpredsednica":"Potpredsednik"):(f?"Predsednica":"Predsednik");parts.push(`${r} Narodne skupštine.`)}
 parts.push(`${f?"Narodna poslanica":"Narodni poslanik"}${d?` od ${d}`:"."}`.replace(/\.?$/,"."));
 parts.push(`${f?"Izabrana":"Izabran"} sa liste „${LISTS[m.g]||groups[m.g][0]}”.`);
 if(gn)parts.push(`${gr?(gr[0].toUpperCase()+gr.slice(1))+" poslaničke grupe":(f?"Članica poslaničke grupe":"Član poslaničke grupe")} „${gn}”.`);
 return parts.join(" ");
}
const I_X=`<svg class="mi" viewBox="0 0 13 13" aria-hidden="true" shape-rendering="crispEdges" fill="currentColor"><rect x="1" y="1" width="2" height="1"/><rect x="11" y="1" width="2" height="1"/><rect x="1" y="2" width="3" height="1"/><rect x="10" y="2" width="3" height="1"/><rect x="2" y="3" width="3" height="1"/><rect x="9" y="3" width="3" height="1"/><rect x="3" y="4" width="3" height="1"/><rect x="8" y="4" width="3" height="1"/><rect x="4" y="5" width="6" height="1"/><rect x="5" y="6" width="4" height="1"/><rect x="5" y="7" width="4" height="1"/><rect x="4" y="8" width="6" height="1"/><rect x="3" y="9" width="3" height="1"/><rect x="8" y="9" width="3" height="1"/><rect x="2" y="10" width="3" height="1"/><rect x="9" y="10" width="3" height="1"/><rect x="1" y="11" width="3" height="1"/><rect x="10" y="11" width="3" height="1"/><rect x="1" y="12" width="2" height="1"/><rect x="11" y="12" width="2" height="1"/></svg>`;
/* profile: name (and, only if he spoke, the day and talk time under it) with mute and × on the right; the party is the first fact */
function renderProf(by){
 const m=profMp;if(!m){$("#p-prof").innerHTML="";return}
 const f=isF(m),o=by.get(m),on=muted.has(m),w=tlDay(),party=m.party?c2l(m.party):(f?"Nestranačka":"Nestranački"),g=f?"govorila":"govorio";
 const fact=(k,v,c)=>v?`<div class="fact${c?" "+c:""}"><small>${k}</small><span>${esc(v)}</span></div>`:"";
 const spoke=o&&o.t>0?`<small class="pspoke">${w==="danas"?"Danas "+g:w==="juče"?"Juče "+g:(f?"Govorila ":"Govorio ")+dayWhen(w)} · ${o.n} ${o.n===1?"put":"puta"} · <span class="nt">${mss(o.t)}</span></small>`:"";
 $("#p-prof").innerHTML=`<div class="xin">
<div class="phead">${m!==curSp?phm(m,`<span class="pph"${m.ph?` style="background:var(--seat) url(/p/${m.id}) center 20%/cover"`:""}></span>`):""}<div class="pname"><h3>${esc(m.name)}</h3>${spoke}</div><span class="pact"><button type="button" class="pib" id="profMute" aria-pressed="${on}" aria-label="${on?"Uključi zvuk za":"Utišaj kad god govori:"} ${esc(m.name)}" title="${on?"Utišan kad god govori. Klikni da ga ponovo čuješ.":"Utišaj kad god govori"}">${on?I_POFF:I_PON}</button><button type="button" class="pib" id="profX" aria-label="${profFrom==="stats"?"Nazad na statistiku":"Zatvori profil"}">${I_X}</button></span></div>
<div class="facts">${fact("Stranka",party,"w2")}${fact("Godište",m.by?m.by+".":"")}${fact("Mesto",c2l(m.place))}${fact("Zanimanje",c2l(m.prof),"w2")}</div>
<p class="bio">${esc(bio(m))}</p>
<button type="button" class="b light pfull" disabled>Vidi ceo profil <small>uskoro</small></button>
<p class="src">Izvor: Narodna skupština · vreme govora: skupština.app</p></div>`;
 $("#profMute").onclick=()=>{toggleMute(m);renderPanels(true)};
 $("#profX").onclick=()=>xView(profFrom);
 apply($("#p-prof"));
}

/* the time badge on the speaker's photo: how long they have spoken today */
let lastSig="";
function renderPanels(force){
 const by=talkTotals(),o=curSp&&by.get(curSp),b=$("#talkT");
 b.hidden=!(o&&o.t>0);if(o)b.textContent=mss(o.t);
 if(!xv)return;
 const sig=tlDay()+"|"+layoutSig+"|"+xv+"|"+(profMp&&profMp.i)+"|"+[...by.entries()].map(([m,x])=>m.i+":"+Math.floor(x.t)).join(",")+"|"+muted.size+"|"+(curSp&&curSp.i);
 if(!force&&sig===lastSig)return;lastSig=sig;
 xv==="stats"?renderStats(by):renderProf(by);
}
setInterval(renderPanels,1000);
