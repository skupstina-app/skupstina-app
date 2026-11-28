/* hall */
const SH=groups.map((_,i)=>`var(--p${i})`);
const order=[...mps].sort((a,b)=>a.g-b.g||a.name.localeCompare(b.name,"sr"));
const seatOf=new Map(order.map((m,i)=>[m,i]));
const maxT=Math.max(...mps.map(m=>m.t)),hall=$("#hall"),svg=$("#hallSvg"),tip=$("#tip"),board=$("#salaBoard");
let view="groups",active=live,focusMp=live.m;const geo={};
/* who sits where: seatPlan() and benchSlots() in 28-seatplan.js, worked out once per seat change and shared by every map on the page */
let layoutSig="",layoutC=null;
function seatLayout(){
 const sig=mps.map(m=>m.seat||"").join(",");if(layoutC&&sig===layoutSig)return layoutC;layoutSig=sig;
 const [SPK,VPS]=V1?splitLeads(mps,m=>m.role,m=>m.name):[null,[]],LEADS=new Set([SPK,...VPS].filter(Boolean)),inHall=mps.filter(m=>!LEADS.has(m));
 const plan=seatPlan(inHall,{seat:m=>m.seat,grp:m=>V1?seatGroupKey(m.g,m.pg):m.g,rank:m=>seatRank(m.pg,m.role),name:m=>m.name,id:m=>m.id??m.i});
 return layoutC={SPK,VPS,LEADS,inHall,plan,bench:benchSlots(SPK,VPS,m=>m.seat),sig}}
function drawMap(T=SALA){
 const hall=T.el,svg=T.svg,tip=T.tip,geo=T.geo,LIVE=T.live,V=LIVE?"live":view;
 const W=hall.clientWidth,H=hall.clientHeight;if(!W)return;
 const LY=seatLayout(),SPK=LY.SPK,VPS=LY.VPS,LEADS=LY.LEADS;
 /* the hall as built (hallSeats in 28-seatplan.js): 8 sections split by aisles, 314 seats (the inner sections' front row juts out); seats nobody needs stay drawn as empty outlines.
    Drawn as the broadcast shows the hall: the presidium at the top, MPs facing it. Same seats in src/admin/sala.html and the stats panel. */
 const BH=Math.max(26,Math.round(H*.09)),R=Math.min(W/2-16,H-24-BH),cx=W/2,cy=12+BH,HS=hallSeats(R),step=HS.step,arc0=HS.arc0;
 const seatBy=new Map(HS.seats.map(p=>[p.key,{...p,z:1,x:cx-p.r*Math.cos(p.a),y:cy+p.r*Math.sin(p.a)}]));
 const posOf=new Map();geo.pos=posOf;const blocks=groups.map(()=>[]);
 LY.inHall.forEach(m=>{const p=seatBy.get(LY.plan.at.get(m));if(p){posOf.set(m,p);blocks[m.g].push(p)}});
 geo.blocks=blocks;geo.empty=LY.plan.empty.map(k=>seatBy.get(k));
 const s=Math.max(3,Math.floor(Math.min(step*.72,arc0*.74)));
 /* predsednistvo: one row at the top, 9 places (see benchSlots) */
 const bk=Math.max(4,Math.round(s*1.1)),gap=Math.min(bk*2.4,(W-24)/9.4),benW=gap*9.4,benH=Math.max(14,bk+10),benY=Math.max(4,cy-BH*.3-benH),benX=cx-benW/2,benC=benY+benH/2;
 const slotX=j=>benX+gap*.2+gap*j+gap/2,SLOTS=LY.bench;
 geo.bench={x:cx,y:benC,w:benW,h:benH};
 SLOTS.forEach((m,j)=>{if(m&&typeof m!=="string")posOf.set(m,{x:slotX(j),y:benC,z:1,a:Math.PI/2,i:-1})});
 let bench=(LIVE?`<g>`:`<g data-bench="1" style="cursor:pointer">`)+`<rect x="${Math.round(benX)}" y="${Math.round(benY)}" width="${Math.round(benW)}" height="${Math.round(benH)}" fill="var(--card)" stroke="var(--line)" rx="2"></rect>`;
 if(!SPK)SLOTS.forEach((m,j)=>{if(typeof m!=="string")bench+=`<rect x="${Math.round(slotX(j)-bk/2)}" y="${Math.round(benC-bk/2)}" width="${bk}" height="${bk}" fill="${j===4?"var(--ink)":"var(--seat)"}"></rect>`});
 for(const j in BENCH_FIX)bench+=`<rect x="${Math.round(slotX(+j)-bk/2)+.75}" y="${Math.round(benC-bk/2)+.75}" width="${bk-1.5}" height="${bk-1.5}" fill="none" stroke="var(--mute)" stroke-width="1.5"></rect>`;bench+=`<title>Predsedništvo</title></g>`;
 const sq=(p,z,fill,op=1,g="")=>{const k=Math.max(2,Math.round(z*(p.z||1)));return `<rect ${g!==""?`data-g="${g}" `:""}x="${Math.round(p.x-k/2)}" y="${Math.round(p.y-k/2)}" width="${k}" height="${k}" fill="${fill}" opacity="${op}"></rect>`};
 /* who spoke today: hollow = not yet, filled and bigger = spoke more; neighbours spread so big ones never overlap */
 const key=W+"x"+H+LY.sig;if(LIVE&&geo.key!==key){geo.key=key;const R=new Map();
  mps.forEach(m=>{const p=posOf.get(m);if(!p)return;const f=m.t/maxT,sz=Math.round((m.t?s*(1+1.3*Math.sqrt(f)):s*.95)*(p.z||1));R.set(m,{x:p.x,y:p.y,ox:p.x,oy:p.y,sz,r:sz/2,fix:LEADS.has(m)})});
  const A=[...R.values()];
  for(let it=0;it<40;it++){for(let i=0;i<A.length;i++){const a=A[i];for(let j=i+1;j<A.length;j++){const b=A[j],dx=b.x-a.x,dy=b.y-a.y,lim=a.r+b.r+1.5;if(Math.abs(dx)>lim||Math.abs(dy)>lim)continue;const d=Math.hypot(dx,dy)||.01;if(d<lim){const ov=(lim-d),wa=b.r/(a.r+b.r);a.x-=dx/d*ov*wa;a.y-=dy/d*ov*wa;b.x+=dx/d*ov*(1-wa);b.y+=dy/d*ov*(1-wa)}}}
   A.forEach(p=>{if(p.fix){p.x=p.ox;p.y=p.oy;return}p.x+=(p.ox-p.x)*.04;p.y+=(p.oy-p.y)*.04;p.y=Math.max(p.y,cy+4)})}
  geo.R=R}
 const RP=geo.R;
 const seat=(m,col,op=1,g="")=>{const p=RP.get(m),k=p.sz,x=Math.round(p.x-k/2),y=Math.round(p.y-k/2),d=g!==""?`data-g="${g}" `:"";
  return m.t?`<rect ${d}x="${x}" y="${y}" width="${k}" height="${k}" fill="${col}" opacity="${op}"></rect>`:`<rect ${d}x="${x+.75}" y="${y+.75}" width="${k-1.5}" height="${k-1.5}" fill="var(--board)" stroke="${col}" stroke-width="1.5" opacity="${op}"></rect>`};
 const fm=V==="day"?active.m:V==="mps"?focusMp:live.m;let o=bench;geo.empty.forEach(p=>{const k=Math.max(2,Math.round(s*.8));o+=`<rect x="${Math.round(p.x-k/2)+.5}" y="${Math.round(p.y-k/2)+.5}" width="${k-1}" height="${k-1}" fill="none" stroke="var(--seat)" stroke-width="1"></rect>`});
 mps.forEach(m=>{const p=posOf.get(m);if(!p)return;
  if(LIVE)o+=seat(m,SH[m.g],1);
  else if(V==="groups"){const any=selG!==null||popFor==="bench",lead=LEADS.has(m),hl=popFor==="bench"?lead:(!any||selG===m.g);o+=(hl?sq(p,any?s*1.15:s,popFor==="bench"?"var(--ink)":SH[m.g],1,m.g):sq(p,s*.85,"var(--seat)",1,m.g)).replace("<rect ",`<rect data-m="${m.i}" `)}
  else if(V==="mps"){if(m===fm)return;const r=fOn()?(fOk(m)?sq(p,s,SH[m.g],1):sq(p,s*.8,"var(--seat)",1)):sq(p,s,SH[m.g],.8);o+=r.replace("<rect ",`<rect data-m="${m.i}" `)}
  else{const f=m.t/maxT;o+=m===fm?"":(m.t?sq(p,s*(.7+.8*Math.sqrt(f)),SH[m.g]):sq(p,s*.45,"var(--seat)"))}});

 const ap=LIVE?RP.get(fm):posOf.get(fm);
 if(V!=="groups"&&!LIVE)o+=sq({x:ap.x,y:ap.y},s*2,SH[fm.g]);
 const k=Math.round(LIVE?RP.get(fm).sz+8:V==="groups"?s+8:s*2+8);if(V!=="groups")o+=LIVE?`<rect x="${Math.round(ap.x-k/2)}" y="${Math.round(ap.y-k/2)}" width="${k}" height="${k}" fill="none" stroke="var(--ink)" stroke-width="1.5"></rect>`:fcsMark(ap.x,ap.y,k);
 svg.innerHTML=o;
 if(V==="groups"){
  tip.style.visibility="hidden";placeFocus();return;
  if(selG===null){return}
  const bl=blocks[selG],c=bl[Math.floor(bl.length/2)];
  tip.innerHTML=`<span>${groups[selG][2]} ${groups[selG][2]===1?"mesto":groups[selG][2]<5?"mesta":"mesta"}</span><b>${groups[selG][0]}</b>`;apply(tip);tip.style.visibility="visible";
  const bw=tip.offsetWidth,bh=tip.offsetHeight;tip.style.left=Math.min(Math.max(c.x-bw/2,8),W-bw-8)+"px";let y=c.y-bh-12;if(y<6)y=c.y+12;tip.style.top=y+"px";return}
 if(V==="mps"&&!LIVE&&T===SALA){const z=mpZoomZ();if(z>1){const tx=W/2-z*ap.x,ty=H*.55-z*ap.y;svg.style.transform=`translate(${tx.toFixed(1)}px,${ty.toFixed(1)}px) scale(${z})`;TX={tx,ty,z}}else{svg.style.transform="";TX={tx:0,ty:0,z:1}}}
 else if(!LIVE&&T===SALA){TX={tx:0,ty:0,z:1}}
 tip.style.visibility="visible";
 const head=LIVE?"govori sada":V==="day"?(active.live?"govori":hm(active.t)+"  "+dur(active.d)):groups[fm.g][1];
 tip.innerHTML=`<span>${head}</span><b>${fm.name}</b>${LIVE?groups[fm.g][1]:V==="day"?active.l:(V1?"":fm.t?dur(fm.t)+" danas":"danas nije govorio")}`;apply(tip);
 const bw=tip.offsetWidth,bh=tip.offsetHeight,zz=LIVE||T!==SALA?{tx:0,ty:0,z:1}:TX,ax=zz.tx+zz.z*ap.x,ay=zz.ty+zz.z*ap.y,kk=k*zz.z;let x=Math.min(Math.max(ax-bw/2,8),W-bw-8),y=ay-bh-kk/2-6;if(y<6)y=ay+kk/2+6;tip.style.left=x+"px";tip.style.top=y+"px";
}
const SALA={el:hall,svg,tip,geo,live:false};
let TX={tx:0,ty:0,z:1},mpZoom=false;
const mpZoomZ=()=>mpZoom?(innerWidth<=760?2.6:1.7):1;
/* focus marker: four pixel corners around the seat that snap in (stepped, not smooth) */
function fcsMark(x,y,k){const h=Math.round(k/2)+2,l=Math.max(3,Math.round(k*.32)),t=1.5,X=Math.round(x),Y=Math.round(y);let r="";
 [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([sx,sy])=>{const cx=X+sx*h,cy=Y+sy*h;r+=`<rect x="${sx<0?cx:cx-l}" y="${sy<0?cy:cy-t}" width="${l}" height="${t}"></rect><rect x="${sx<0?cx:cx-t}" y="${sy<0?cy:cy-l}" width="${t}" height="${l}"></rect>`});
 return `<g class="fcs" fill="var(--ink)" style="transform-origin:${X}px ${Y}px">${r}</g>`}
const hallRO=new ResizeObserver(()=>drawMap());hallRO.observe(hall);

/* sastav: a plain list. A tap on a group (list or hall) or on a person turns the space under the hall into that
   group's or person's page (#sdet), × goes back one step (person opened from a group → the group) and then closes it */
let selG=null,popFor=null;
const pct=x=>x<.01?"<1%":Math.round(x*100)+"%";
const sdet=$("#sdet");
function renderSastav(){
 const el=$("#vGroups");
 el.innerHTML=`<div class="barwrap"><div class="bar100">${groups.map((g,i)=>`<i style="width:${g[2]/2.5}%;background:${SH[i]};opacity:${selG===null||selG===i?1:.3}"></i>`).join("")}</div></div>
 <div class="plist2">${groups.map((g,i)=>`<button type="button" class="prow" data-g="${i}"><i style="width:12px;height:12px;background:${SH[i]}"></i><span>${g[0]}</span><span class="num">${g[2]}</span><span class="chev" aria-hidden="true">›</span></button>`).join("")}
 <button type="button" class="prow" data-bench="1"><i style="width:12px;height:12px;background:var(--ink)"></i><span>Predsedništvo</span><span class="num"></span><span class="chev" aria-hidden="true">›</span></button></div>`;
 apply(el);
}
const lat=x=>c2l(x);
const phOf=(m,cls="dph")=>`<span class="${cls}" aria-hidden="true" style="--c:${SH[m.g]}${m.ph?`;background-image:url(/p/${m.id})`:""}"></span>`;
const cnt=(n,one,few,many)=>`${n} ${n%10===1&&n%100!==11?one:n%10>=2&&n%10<=4&&(n%100<10||n%100>=20)?few:many}`;
const kTile=(v,l)=>`<div><b class="px">${v}</b><small>${l}</small></div>`;
const top=(arr,k=6)=>{const c=new Map();arr.forEach(x=>{if(x)c.set(x,(c.get(x)||0)+1)});return [...c.entries()].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],"sr")).slice(0,k)};
const barRows=(rows,tot,col)=>rows.map(([k,n])=>`<div class="dbar"><span>${esc(k)}</span><i style="--w:${(n/tot*100).toFixed(1)}%;--c:${col}"></i><b class="px">${n}</b></div>`).join("");
const memRow=m=>`<li><button type="button" data-mp="${m.i}">${phOf(m,"mph")}<span class="nm">${esc(m.name)}</span><span class="rl">${esc(m.role?(/potpredsed/i.test(lat(m.role))?"potpredsednik":"predsednik"):groupRole(m,isF(m)).replace(/ predsednika$/,""))}</span></button></li>`;
const xBtn=()=>`<button type="button" class="pib dx" aria-label="Zatvori">${I_X}</button>`;
const rk=m=>m.role?3:/^predsedn/.test(groupRole(m))?2:groupRole(m)?1:0;
function groupDet(i){
 const g=groups[i],mem=mps.filter(m=>m.g===i),n=mem.length||g[2],f=mem.filter(isF).length,ages=mem.map(ageOf).filter(x=>x!=null);
 const avg=ages.length?Math.round(ages.reduce((a,b)=>a+b,0)/ages.length):null;
 const pgs=top(mem.map(m=>groupName(m)||"Bez poslaničke grupe"),4),pars=top(mem.map(m=>m.party?lat(m.party):"Nestranački"),6),places=top(mem.map(m=>lat((m.place||"").split(",")[0]).trim()),6);
 const lead=[...mem].sort((a,b)=>rk(b)-rk(a)||a.name.localeCompare(b.name,"sr"));
 return `<div class="dhd"><i class="dsw" style="background:${SH[i]}"></i><div class="dtt"><h3>${esc(g[0])}</h3><small>${esc(LISTS[i]||"")}</small></div>${xBtn()}</div>
 <div class="dk">${kTile(n,"poslanika")}${kTile(pct(n/250),"mesta")}${kTile(pct(VOTES[i]/VOTERS),"glasova")}</div>
 <div class="dseat"><i style="width:${n/2.5}%;background:${SH[i]}"></i><span class="maj" style="left:${MAJ/2.5}%"></span></div>
 ${mem.length?`<div class="dsec"><h4>Poslaničke grupe</h4>${pgs.map(([k,c])=>{const gm=mem.filter(m=>(groupName(m)||"Bez poslaničke grupe")===k),pr=gm.find(m=>/^predsedni/.test(groupRole(m))),zm=gm.find(m=>/^zameni/.test(groupRole(m)));
  return `<div class="dpg"><b>${esc(k)}</b><span class="px">${c}</span>${pr?`<button type="button" data-mp="${pr.i}">${phOf(pr,"mph")}<span>${esc(pr.name)}</span><small>${isF(pr)?"predsednica":"predsednik"}</small></button>`:""}${zm?`<button type="button" data-mp="${zm.i}">${phOf(zm,"mph")}<span>${esc(zm.name)}</span><small>${isF(zm)?"zamenica":"zamenik"}</small></button>`:""}</div>`}).join("")}</div>
 <div class="dsec"><h4>Sastav</h4><div class="dsex"><i style="width:${(f/n*100).toFixed(1)}%"></i></div><div class="dsl"><span>Žene <b class="px">${f}</b></span><span>Muškarci <b class="px">${n-f}</b></span></div>
  ${avg?`<div class="dk dk2">${kTile(avg,"prosek godina")}${kTile(Math.min(...ages),"najmlađi")}${kTile(Math.max(...ages),"najstariji")}</div>`:""}</div>
 ${pars.length>1||(pars[0]&&pars[0][0]!=="Nestranački")?`<div class="dsec"><h4>Stranke</h4>${barRows(pars,n,SH[i])}</div>`:""}
 ${places.length?`<div class="dsec"><h4>Odakle su</h4>${barRows(places,n,SH[i])}</div>`:""}
 <div class="dsec"><h4>Poslanici</h4><ol class="dmem">${lead.map(memRow).join("")}</ol></div>`:""}`;
}
function benchDet(){
 const sp=mps.filter(m=>m.role).sort((a,b)=>(/potpredsed/i.test(lat(a.role))?1:0)-(/potpredsed/i.test(lat(b.role))?1:0)||a.name.localeCompare(b.name,"sr"));
 return `<div class="dhd"><i class="dsw" style="background:var(--ink)"></i><div class="dtt"><h3>Predsedništvo</h3></div>${xBtn()}</div>
 <div class="dsec"><ol class="dmem">${sp.map(memRow).join("")}<li><button type="button" disabled><span class="mph"></span><span class="nm">Mirjana Radaković</span><span class="rl">generalna sekretarka</span></button></li></ol></div>`;
}
function mpDet(m){
 const f=isF(m),a=ageOf(m),party=m.party?lat(m.party):(f?"Nestranačka":"Nestranački"),gn=groupName(m),gr=groupRole(m,f),on=typeof muted!=="undefined"&&muted.has(m);
 const fact=(k,v,c)=>v?`<div class="fact${c?" "+c:""}"><small>${k}</small><span>${esc(v)}</span></div>`:"";
 const days=(typeof arDays!=="undefined"&&arDays?arDays:[]).filter(d=>(d.mps||[]).some(x=>Number(x)===Number(m.id)));
 return `<div class="dhd dhm">${phOf(m,"dph")}<div class="dtt"><h3>${esc(m.name)}</h3><small><i class="dsw" style="background:${SH[m.g]}"></i>${esc(groups[m.g][0])}</small></div>
 <span class="dact"><button type="button" class="pib" data-mute aria-pressed="${on}" aria-label="${on?"Uključi zvuk za":"Utišaj kad god govori:"} ${esc(m.name)}">${on?I_POFF:I_PON}</button>${xBtn()}</span></div>
 <div class="facts">${m.role?fact("Funkcija",(/potpredsed/i.test(lat(m.role))?(f?"Potpredsednica":"Potpredsednik"):(f?"Predsednica":"Predsednik"))+" Skupštine","w3"):""}${fact("Stranka",party,"w2")}${fact("Godište",m.by?`${m.by}. (${a})`:"")}${fact("Mesto",lat(m.place),"w2")}${fact(f?"Poslanica od":"Poslanik od",(m.md||"").replace(/\.(\d)/g,". $1"))}${fact("Zanimanje",lat(m.prof),"w3")}${fact("Poslanička grupa",gn?gn+(gr?" · "+gr:""):"","w3")}</div>
 ${m.t?`<div class="dk dk2">${kTile(dur(m.t),"danas")}${m.w?kTile(m.w,"opomene"):""}</div>`:""}
 ${days.length?`<div class="dsec"><h4>${f?"Govorila":"Govorio"} na sednicama</h4><ol class="ddays">${days.map(d=>{const dt=arDate(d.date);return `<li><button type="button" data-ard="${d.date}"><b class="px">${dt.getUTCDate()}</b><span>${AR_WD[dt.getUTCDay()]} · ${AR_MON[dt.getUTCMonth()]}</span><small>${esc(d.ses)}</small><span class="chev">›</span></button></li>`}).join("")}</ol></div>`:""}`;
}
/* the hall follows: a group (or the bench) is framed, a person is zoomed in on */
function placeFocus(){
 if(popFor===null||view!=="groups"){if(view==="groups")svg.style.transform="";return}
 const W=hall.clientWidth,H=hall.clientHeight;
 const pts=popFor==="bench"?[geo.bench]:mps.filter(m=>m.g===popFor).map(m=>geo.pos.get(m)).filter(Boolean);if(!pts.length)return;
 let x0=1e9,x1=-1e9,y0=1e9,y1=-1e9;pts.forEach(p=>{x0=Math.min(x0,p.x);x1=Math.max(x1,p.x);y0=Math.min(y0,p.y);y1=Math.max(y1,p.y)});
 const c={x:(x0+x1)/2,y:(y0+y1)/2},bw=Math.max(x1-x0,popFor==="bench"?geo.bench.w:18),bh=Math.max(y1-y0,18);
 const z=Math.max(1,Math.min(2.6,W*.8/bw,H*.75/bh));
 svg.style.transform=`translate(${(W/2-z*c.x).toFixed(1)}px,${(H/2-z*c.y).toFixed(1)}px) scale(${z.toFixed(3)})`;
}
let det=null;
function showDet(d){
 det=d;
 if(d.k==="mp"){if(view!=="mps"){view="mps";board.dataset.view="mps";$$("#salaSeg button").forEach(b=>b.setAttribute("aria-pressed",b.dataset.v==="mps"))}
  popFor=null;selG=null;focusMp=d.m;mpZoom=true;sdet.innerHTML=mpDet(d.m);
  if(typeof arDays!=="undefined"&&!arDays&&typeof arLoad==="function")arLoad().then(()=>{if(det===d){sdet.innerHTML=mpDet(d.m);apply(sdet)}})}
 else{if(view!=="groups"){view="groups";board.dataset.view="groups";$$("#salaSeg button").forEach(b=>b.setAttribute("aria-pressed",b.dataset.v==="groups"))}
  mpZoom=false;popFor=d.k==="bench"?"bench":d.i;selG=d.k==="bench"?null:d.i;sdet.innerHTML=d.k==="bench"?benchDet():groupDet(d.i)}
 apply(sdet);sdet.hidden=false;sdet.scrollTop=0;board.classList.add("hasdet");sdet.classList.remove("in");void sdet.offsetWidth;sdet.classList.add("in");
 renderSastav();drawMap()}
function closeDet(all){
 if(!det)return;const d=det;if(!all&&d.back){const b=d.back;showDet(b);return}
 det=null;sdet.hidden=true;sdet.innerHTML="";board.classList.remove("hasdet");
 if(d.k==="mp"){mpZoom=false;if(d.view&&d.view!==view)setView(d.view)}
 popFor=null;selG=null;svg.style.transform="";renderSastav();drawMap()}
const openMp=(m,from)=>showDet({k:"mp",m,back:from||null,view:from?"groups":view});
const openPop=w=>showDet(w==="bench"?{k:"bench"}:{k:"g",i:w}),closePop=()=>closeDet(true);
sdet.addEventListener("click",e=>{
 if(e.target.closest(".dx")){closeDet();return}
 if(e.target.closest("[data-mute]")&&det&&det.m){toggleMute(det.m);showDet(det);return}
 const mp=e.target.closest("[data-mp]");if(mp){const from=det&&det.k!=="mp"?det:det&&det.back;openMp(mps[+mp.dataset.mp],from);return}
 const ad=e.target.closest("[data-ard]");if(ad&&typeof arDays!=="undefined"){const d=arDays.find(x=>x.date===ad.dataset.ard);if(d){setTab("arhiva");arOpen(d)}}});
$("#vGroups").addEventListener("click",e=>{const b=e.target.closest(".prow");if(!b)return;openPop(b.dataset.bench?"bench":+b.dataset.g)});
svg.addEventListener("click",e=>{if(view!=="groups")return;if(e.target.closest("[data-bench]")){openPop("bench");return}
 const r=e.target.closest("rect[data-m]");if(!r){if(det)closeDet(true);return}const m=mps[+r.dataset.m];
 if(det&&det.k==="g"&&det.i===m.g)openMp(m,det);else openPop(m.g)});
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&det&&fmenu.hidden)closeDet()});
renderSastav();

/* lens lists: the row in the middle is the focused one */
function lens(list,onFocus){let raf=0,cur=null;
 const pad=()=>{const p=Math.max(0,list.clientHeight/2-30)+"px";list.style.paddingTop=p;list.style.paddingBottom=p};
 const run=()=>{raf=0;const r=list.getBoundingClientRect();if(!r.height)return;const mid=r.top+r.height/2;let best=null,bd=1e9;
  for(const li of list.children){const b=li.getBoundingClientRect();if(b.bottom<r.top-80||b.top>r.bottom+80){li.style.setProperty("--f",0);continue}
   const d=Math.abs(b.top+b.height/2-mid);li.style.setProperty("--f",Math.round(Math.max(0,1-d/(r.height*.42))*4)/4);if(d<bd&&li.dataset.i){bd=d;best=li}}
  if(best&&best!==cur){cur?.classList.remove("on");best.classList.add("on");cur=best;onFocus(best.dataset.i)}};
 list.addEventListener("scroll",()=>{raf||(raf=requestAnimationFrame(run))},{passive:true});
 list.addEventListener("click",e=>{const li=e.target.closest("li[data-i]");if(li)list.scrollTo({top:li.offsetTop-list.clientHeight/2+li.offsetHeight/2,behavior:reduce?"auto":"smooth"})});
 const ro=new ResizeObserver(()=>{pad();run()});ro.observe(list);
 return {run,center:i=>{const li=list.querySelector(`li[data-i="${i}"]`);if(li){list.scrollTop=li.offsetTop-list.clientHeight/2+li.offsetHeight/2;run()}}};
}
/* poslanici list: search + one filter button (stranka, pol, godine); a tap on a row (or on a seat in the hall) zooms the hall to
   that MP and the camera follows the list while it scrolls; a tap on the same MP (or on the empty hall) zooms back out */
const fold=sfold;
const mpl=$("#mplist");
let gFilter=null,sFilter="",aFilter=-1;
const sexOf=m=>isF(m)?"z":"m"; /* isF: 79-panels.js */
const AGES=[["do 35",0,35],["35–50",35,50],["50–65",50,65],["65+",65,200]],YR=new Date().getFullYear();
const ageOf=m=>m.by?YR-m.by:null;
const fOn=()=>gFilter!==null||!!sFilter||aFilter>=0;
const fOk=m=>(gFilter===null||m.g===gFilter)&&(!sFilter||sexOf(m)===sFilter)&&(aFilter<0||(ageOf(m)!=null&&ageOf(m)>=AGES[aFilter][1]&&ageOf(m)<AGES[aFilter][2]));
const fmenu=$("#fmenu"),fbtn=$("#fbtn");
const fopt=(k,v,cur,txt,c)=>`<button type="button" data-k="${k}" data-v="${v}" aria-pressed="${String(v)===String(cur)}">${c?`<i style="background:${c}"></i>`:""}${txt}</button>`;
function drawFilters(){const n=(gFilter!==null)+(!!sFilter)+(aFilter>=0),b=fbtn.querySelector(".n");b.hidden=!n;b.textContent=n;fbtn.classList.toggle("on",!!n);
 const hasAge=mps.some(m=>m.by);
 fmenu.innerHTML=`<div><div class="fh"><span>Stranka</span>${n?`<button type="button" data-k="reset">Poništi</button>`:""}</div><div class="fopts">${fopt("g","",gFilter??"","Sve")}${groups.map((g,i)=>g[2]?fopt("g",i,gFilter??"",g[1],SH[i]):"").join("")}</div></div>
 <div><div class="fh"><span>Pol</span></div><div class="fopts">${fopt("s","",sFilter,"Svi")}${fopt("s","m",sFilter,"Muški")}${fopt("s","z",sFilter,"Ženski")}</div></div>
 ${hasAge?`<div><div class="fh"><span>Godine</span></div><div class="fopts">${fopt("a",-1,aFilter,"Sve")}${AGES.map((x,i)=>fopt("a",i,aFilter,x[0])).join("")}</div></div>`:""}`;apply(fmenu)}
const openF=on=>{fmenu.hidden=!on;fbtn.setAttribute("aria-expanded",on);if(on)drawFilters()};
fbtn.onclick=e=>{e.stopPropagation();openF(fmenu.hidden)};
fmenu.onclick=e=>{e.stopPropagation();const b=e.target.closest("[data-k]");if(!b)return;const k=b.dataset.k,v=b.dataset.v;
 if(k==="reset"){gFilter=null;sFilter="";aFilter=-1}else if(k==="g")gFilter=v===""?null:+v;else if(k==="s")sFilter=v;else aFilter=+v;
 drawFilters();renderMps($("#q").value);mpl.scrollTop=0;mpLens.run();drawMap()};
document.addEventListener("pointerdown",e=>{if(!fmenu.hidden&&!e.target.closest("#fmenu,#fbtn"))openF(false)});
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!fmenu.hidden)openF(false)});
const lastName=n=>String(n).trim().split(/\s+/).pop(),alpha=[...mps].sort((a,b)=>lastName(a.name).localeCompare(lastName(b.name),"sr")||a.name.localeCompare(b.name,"sr"));
const renderMps=q=>{const f=fold(q||"");const list=alpha.filter(m=>fOk(m)&&(!f||fold(m.name+" "+groups[m.g][1]).includes(f)));drawFilters();
 mpl.innerHTML=list.length?list.map(m=>`<li data-i="${m.i}" style="--c:${SH[m.g]}"><button type="button">${phm(m,`<span class="ph" aria-hidden="true"${m.ph?` style="background:var(--seat) url(/p/${m.id}) center 20%/cover"`:""}></span>`)}<span><span class="nm">${m.name}</span><br><span class="g">${groups[m.g][1]}</span></span><span class="d">${m.t?dur(m.t):""}${m.w?`<span class="w">${m.w}</span>`:""}</span></button></li>`).join(""):`<li class="empty">Nema rezultata</li>`;apply(mpl);mpLens.run()};
const mpLens=lens(mpl,i=>{if(det)return;focusMp=mps[i];if(view==="mps")drawMap()});
$("#q").addEventListener("input",e=>{renderMps(e.target.value);mpl.scrollTop=0});
mpl.addEventListener("click",e=>{const li=e.target.closest("li[data-i]");if(!li)return;openMp(mps[li.dataset.i])});
svg.addEventListener("click",e=>{if(view!=="mps")return;const r=e.target.closest("rect[data-m]");
 if(!r){if(det)closeDet(true);else if(mpZoom){mpZoom=false;drawMap()}return}
 const m=mps[+r.dataset.m];if(!mpl.querySelector(`li[data-i="${m.i}"]`)){gFilter=null;sFilter="";aFilter=-1;$("#q").value="";renderMps("")}
 const li=mpl.querySelector(`li[data-i="${m.i}"]`);if(li)mpl.scrollTop=li.offsetTop-mpl.clientHeight/2+li.offsetHeight/2;openMp(m)});
renderMps("");
/* seats saved in the admin reach open pages without a reload: /api/seats (saved seats only, cached 15 s) is checked a few seconds after
   load (the page itself can be up to 5 minutes old) and then every minute while the page is visible; every map redraws from seatLayout() */
async function pullSeats(){if(!V1||document.hidden)return;
 try{const r=await fetch("/api/seats");if(!r.ok)return;const s=(await r.json()).s||{};let ch=false;
  mps.forEach(m=>{const k=s[m.id]||null;if((m.seat||null)!==k){m.seat=k;ch=true}});
  if(ch){drawMap();renderPanels(true)}}catch(e){}}
setTimeout(pullSeats,4000);setInterval(pullSeats,60000);
document.addEventListener("visibilitychange",()=>{if(!document.hidden)pullSeats()});
