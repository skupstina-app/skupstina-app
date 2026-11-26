/* speaker panels: under the player, in place of the chat.
   - podium button (far right of the speaker bar): who spoke how much today, seat map + list; the same spot becomes ×
   - speaker photo: that MP's profile; the photo becomes × while it is open
   Talk times come from the live speaker timeline (TL), counted up to the viewer's own playback position. */
const C2L={"а":"a","б":"b","в":"v","г":"g","д":"d","ђ":"đ","е":"e","ж":"ž","з":"z","и":"i","ј":"j","к":"k","л":"l","љ":"lj","м":"m","н":"n","њ":"nj","о":"o","п":"p","р":"r","с":"s","т":"t","ћ":"ć","у":"u","ф":"f","х":"h","ц":"c","ч":"č","џ":"dž","ш":"š"};
const c2l=s=>String(s||"").replace(/[Ѐ-џ]/g,c=>{const l=c.toLowerCase(),r=C2L[l];if(r==null)return c;return c===l?r:r[0].toUpperCase()+r.slice(1)});
const esc=s=>String(s??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/"/g,"&quot;");
const LISTS=["Studentska lista – Studenti pobeđuju","Savez vojvođanskih Mađara – dr Balint Pastor","Albanska koalicija","Rasim Ljajić – Ljudski (SDP – CDP)","SDA Sandžaka – Čuvari Sandžaka","Usame Zukorlić (SPP) Pokret za ujedinjenje","Aleksandar Vučić – Ujedinjena Srbija"];
/* grammar needs gender; the official data has none, so: first names ending in -a are women's, minus common men's names */
const MALE_A=new Set(["nikola","luka","saša","ilija","andrija","kosta","toma","sava","jovica","mića","pera","đura","joca","zoka","mirča","vanja","miša","braca","boža","raša","staša","lazica","ljuba","maša"]);
const isF=m=>{const f=(m.name||"").split(" ")[0].toLowerCase();return /a$/.test(f)&&!MALE_A.has(f)};
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

let xv="",profMp=null;
function xView(v,m){
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
  if(o&&o.t>0)top.push([o.t,`<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${(3+6.5*Math.sqrt(o.t/mx)).toFixed(1)}" fill="${SH[m.g]}" stroke="var(--bg)" stroke-width="1"><title>${esc(m.name)} · ${mss(o.t)}</title></circle>`]);
  else base+=`<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="2.2" fill="var(--seat)"/>`});
 /* bigger circles first, so a small one next to a big one stays visible on top */
 return `<svg class="smap" viewBox="0 0 300 168" role="img" aria-label="Sala: veći krug, duže govorio">${base}${top.sort((a,b)=>b[0]-a[0]).map(x=>x[1]).join("")}</svg>`;
}
/* which day the speaker timeline is about: "danas", "juče" or the date. The stats keep showing the last sitting until the next one starts,
   so they must say which day it was. A sitting that runs past midnight still counts as the day it started (4 h back). */
const bgDay=ms=>new Date(ms).toLocaleDateString("en-CA",{timeZone:"Europe/Belgrade"});
function tlDay(){
 if(!tlAt||!TL.length)return "danas";
 const d=bgDay(tlAt-4*3600e3),now=Date.now();
 if(d===bgDay(now))return "danas";if(d===bgDay(now-864e5))return "juče";
 const [y,mo,da]=d.split("-").map(Number);return `${da}. ${MON[mo-1]}${y!==new Date(now).getFullYear()?" "+y+".":""}`;
}
const dayAsk=w=>w==="danas"||w==="juče"?`Ko je ${w} najviše govorio`:`Ko je najviše govorio ${w}`;
function renderStats(by){
 const list=[...by.entries()].filter(([,o])=>o.t>0).sort((a,b)=>b[1].t-a[1].t);
 const rows=list.map(([m,o],k)=>`<li><button type="button" data-pm="${m.i}"><span class="rk">${k+1}</span><i style="background:${SH[m.g]}"></i><span class="nm"><b>${esc(m.name)}</b><small>${esc(m.g===6?"Srbija pobeđuje":groups[m.g][1])} · ${o.n} ${o.n===1?"put":"puta"}</small></span><span class="tm nt">${mss(o.t)}</span></button></li>`).join("");
 const w=tlDay();
 $("#p-stats").innerHTML=`<div class="xin">${seatMap(by)}<h3>Najviše govorili ${w}</h3>${list.length?`<ol class="xlist">${rows}</ol>`:`<p class="m">${w==="danas"?"Još niko nije govorio danas.":"Nema zabeleženih govora."}</p>`}</div>`;
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
function renderProf(by){
 const m=profMp;if(!m){$("#p-prof").innerHTML="";return}
 const f=isF(m),o=by.get(m),on=muted.has(m),w=tlDay(),party=m.party?c2l(m.party):(f?"Nestranačka":"Nestranački");
 const fact=(k,v)=>v?`<div class="fact"><small>${k}</small><span>${esc(v)}</span></div>`:"";
 $("#p-prof").innerHTML=`<div class="xin">
<div class="phead">${m!==curSp?`<span class="pph"${m.ph?` style="background:var(--seat) url(/p/${m.id}) center 20%/cover"`:""}></span>`:""}<h3>${esc(m.name)}</h3></div>
<div class="chips"><span class="gchip"><i style="background:${SH[m.g]}"></i>${esc(m.g===6?"Srbija pobeđuje":groups[m.g][0])}</span><span class="pchip">${esc(party)}</span></div>
<p class="bio">${esc(bio(m))}</p>
<div class="facts">${fact("Godište",m.by?m.by+".":"")}${fact("Mesto",c2l(m.place))}${fact("Zanimanje",c2l(m.prof))}${fact(w==="danas"||w==="juče"?(w==="danas"?"Danas":"Juče")+(f?" govorila":" govorio"):(f?"Govorila ":"Govorio ")+w,o&&o.t>0?`${o.n} ${o.n===1?"put":"puta"} · ${mss(o.t)}`:w==="danas"?"ne još":(f?"nije govorila":"nije govorio"))}</div>
<div class="pbtns"><button type="button" class="b light" id="profMute" aria-pressed="${on}">${on?I_SOFF:I_SON}<span>${on?"Ponovo čuj":"Utišaj"}</span></button><a class="b light" href="https://www.parlament.gov.rs/_.${m.id}.245.html" target="_blank" rel="noopener">parlament.gov.rs ↗</a></div>
<p class="src">Izvor: Narodna skupština · vreme govora: skupština.app</p></div>`;
 $("#profMute").onclick=()=>{toggleMute(m);renderPanels(true)};
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
