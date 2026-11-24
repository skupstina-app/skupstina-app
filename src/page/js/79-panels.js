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
 $("#podBtn").setAttribute("aria-label",v==="stats"?"Zatvori statistiku":"Ko je danas najviše govorio");
 renderPanels(true);
}
$("#podBtn").onclick=()=>xView(xv==="stats"?"":"stats");
$("#phBtn").onclick=()=>{if(xv==="prof")xView("");else if(curSp)xView("prof",curSp)};

/* seat map: 250 seats in a half circle, groups side by side; whoever spoke today is coloured and bigger */
const SEATS=(()=>{const rows=9,R0=46,R1=128,cx=150,cy=140,rad=[...Array(rows)].map((_,i)=>R0+(R1-R0)*i/(rows-1)),tot=rad.reduce((a,b)=>a+b,0);
 const cnt=rad.map(r=>Math.round(250*r/tot));cnt[rows-1]+=250-cnt.reduce((a,b)=>a+b,0);
 const s=[];rad.forEach((r,i)=>{for(let k=0;k<cnt[i];k++){const a=Math.PI*(1-(k+.5)/cnt[i]);s.push({a,x:cx+r*Math.cos(a),y:cy-r*Math.sin(a)})}});
 return s.sort((p,q)=>q.a-p.a);})();
function seatMap(by){
 const order=[...mps].sort((a,b)=>a.g-b.g||a.i-b.i),mx=Math.max(1,...[...by.values()].map(o=>o.t));
 const dots=order.map((m,i)=>{const p=SEATS[i];if(!p)return"";const o=by.get(m);
  return o&&o.t>0?{z:1,s:`<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${(3+6.5*Math.sqrt(o.t/mx)).toFixed(1)}" fill="${SH[m.g]}" stroke="var(--bg)" stroke-width="1"><title>${esc(m.name)} · ${mss(o.t)}</title></circle>`}
  :{z:0,s:`<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="2.3" fill="var(--seat)"/>`}});
 return `<svg class="smap" viewBox="0 0 300 146" role="img" aria-label="Sala: veći krug, duže govorio danas">${dots.filter(d=>!d.z).map(d=>d.s).join("")}${dots.filter(d=>d.z).map(d=>d.s).join("")}</svg>`;
}
function renderStats(by){
 const list=[...by.entries()].filter(([,o])=>o.t>0).sort((a,b)=>b[1].t-a[1].t);
 const rows=list.map(([m,o],k)=>`<li><button type="button" data-pm="${m.i}"><span class="rk">${k+1}</span><i style="background:${SH[m.g]}"></i><span class="nm"><b>${esc(m.name)}</b><small>${esc(m.g===6?"Srbija pobeđuje":groups[m.g][1])} · ${o.n} ${o.n===1?"put":"puta"}</small></span><span class="tm nt">${mss(o.t)}</span></button></li>`).join("");
 $("#p-stats").innerHTML=`<div class="xin">${seatMap(by)}<h3>Najviše govorili danas</h3>${list.length?`<ol class="xlist">${rows}</ol>`:`<p class="m">Još niko nije govorio danas.</p>`}</div>`;
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
 const f=isF(m),o=by.get(m),on=muted.has(m),party=m.party?c2l(m.party):(f?"Nestranačka":"Nestranački");
 const fact=(k,v)=>v?`<div class="fact"><small>${k}</small><span>${esc(v)}</span></div>`:"";
 $("#p-prof").innerHTML=`<div class="xin">
<div class="phead">${m!==curSp?`<span class="pph"${m.ph?` style="background:var(--seat) url(/p/${m.id}) center 20%/cover"`:""}></span>`:""}<h3>${esc(m.name)}</h3></div>
<div class="chips"><span class="gchip"><i style="background:${SH[m.g]}"></i>${esc(m.g===6?"Srbija pobeđuje":groups[m.g][0])}</span><span class="pchip">${esc(party)}</span></div>
<p class="bio">${esc(bio(m))}</p>
<div class="facts">${fact("Godište",m.by?m.by+".":"")}${fact("Mesto",c2l(m.place))}${fact("Zanimanje",c2l(m.prof))}${fact(f?"Danas govorila":"Danas govorio",o&&o.t>0?`${o.n} ${o.n===1?"put":"puta"} · ${mss(o.t)}`:"ne još")}</div>
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
 const sig=xv+"|"+(profMp&&profMp.i)+"|"+[...by.entries()].map(([m,x])=>m.i+":"+Math.floor(x.t)).join(",")+"|"+muted.size+"|"+(curSp&&curSp.i);
 if(!force&&sig===lastSig)return;lastSig=sig;
 xv==="stats"?renderStats(by):renderProf(by);
}
setInterval(renderPanels,1000);
