/* hall */
const SH=groups.map((_,i)=>`var(--p${i})`);
const order=[...mps].sort((a,b)=>a.g-b.g||a.name.localeCompare(b.name,"sr"));
const seatOf=new Map(order.map((m,i)=>[m,i]));
const maxT=Math.max(...mps.map(m=>m.t)),hall=$("#hall"),svg=$("#hallSvg"),tip=$("#tip"),board=$("#salaBoard");
let view="groups",active=live,focusMp=live.m;const geo={};
function drawMap(T=SALA){
 const hall=T.el,svg=T.svg,tip=T.tip,geo=T.geo,LIVE=T.live,V=LIVE?"live":view;
 const W=hall.clientWidth,H=hall.clientHeight;if(!W)return;
 const SPK=V1?mps.find(m=>/^Председник Народне/.test(m.role||"")):null,VPS=V1?mps.filter(m=>/^Потпредседник/.test(m.role||"")).sort((a,b)=>(a.name.split(" ").pop()).localeCompare(b.name.split(" ").pop(),"sr")):[],LEADS=new Set([SPK,...VPS].filter(Boolean)),inHall=mps.filter(m=>!LEADS.has(m)),HN=inHall.length;
 /* the hall as built: 8 sections split by aisles; the two outer ones start with 5 seats in the front row, the six inner ones with 3,
    and every row back adds one seat per section. 6 rows = 288 seats, enough for everyone in the hall; seats nobody needs stay drawn as empty outlines */
 const SEC=[5,3,3,3,3,3,3,5],rows=6,BH=Math.max(26,Math.round(H*.09)),R=Math.min(W/2-16,H-24-BH),cx=W/2,cy=12+BH,r0=R*.56,step=(R-r0)/(rows-1);
 const N0=SEC.reduce((a,b)=>a+b,0),aw=(Math.PI-.04)*r0/(N0+7*1.3)*1.3,seats=[];let arc0=0;
 for(let i=0;i<rows;i++){const r=r0+i*step,ns=SEC.map(n=>n+i),N=ns.reduce((a,b)=>a+b,0),ga=aw/r,span=Math.PI-.04,per=(span-(SEC.length-1)*ga)/N;if(!i)arc0=per*r;
  let a0=Math.PI-.02;ns.forEach((n,k)=>{for(let j=0;j<n;j++){const a=a0-(j+.5)*per;seats.push({a,i,k,z:1,x:cx-r*Math.cos(a),y:cy+r*Math.sin(a)})}a0-=n*per+ga})}
 /* drawn as the broadcast shows the hall: the presidium at the top, MPs facing it. Each group gets a wedge of the hall in proportion to its size
    and fills it from the front; group leaders take the front seats nearest the centre, everyone else follows alphabetically. */
 const gk=m=>V1&&m.g===6&&!m.pg?5.5:m.g;
 const keys=[...new Set(inHall.map(gk))].sort((a,b)=>a-b);
 const byA=[...seats].sort((p,q)=>q.a-p.a||p.i-q.i);
 const rank=m=>{const pg=m.pg||"";return /\(председник\)/.test(pg)?0:/\(заменик/.test(pg)?1:/^Потпредседник/.test(m.role||"")?2:3};
 const posOf=new Map();geo.pos=posOf;const blocks=groups.map(()=>[]),empty=[];let at=0,cum=0;
 keys.forEach((k,ki)=>{const mem=inHall.filter(m=>gk(m)===k).sort((a,b)=>rank(a)-rank(b)||a.name.localeCompare(b.name,"sr"));
  cum+=mem.length;let end=ki===keys.length-1?byA.length:Math.round(byA.length*cum/HN);end=Math.max(end,at+mem.length);
  const slice=byA.slice(at,end);at=end;
  const front=[...slice].sort((p,q)=>p.i-q.i||Math.abs(p.a-Math.PI/2)-Math.abs(q.a-Math.PI/2)),used=new Set();
  mem.filter(m=>rank(m)<3).forEach((m,j)=>{used.add(front[j]);posOf.set(m,front[j])});
  const rest=slice.filter(p=>!used.has(p)).sort((p,q)=>p.i-q.i||q.a-p.a);mem.filter(m=>rank(m)===3).forEach((m,j)=>{const p=rest.shift();posOf.set(m,p)});
  rest.forEach(p=>empty.push(p));mem.forEach(m=>blocks[m.g].push(posOf.get(m)))});
 geo.blocks=blocks;geo.empty=empty;
 const s=Math.max(3,Math.floor(Math.min(step*.72,arc0*.74)));
 /* predsednistvo: one row at the top. As seen on the broadcast: three vice-presidents, the secretary general (not an MP) on the Speaker's left, the Speaker, three vice-presidents */
 const bk=Math.max(4,Math.round(s*1.1)),gap=Math.min(bk*2.4,(W-24)/8),benW=gap*8+gap*.4,benH=Math.max(14,bk+10),benY=Math.max(4,cy-BH*.3-benH),benX=cx-benW/2,benC=benY+benH/2;
 const slotX=j=>benX+gap*.2+gap*j+gap/2,SLOTS=[VPS[3],VPS[4],VPS[5],SPK,"SG",VPS[0],VPS[1],VPS[2]],SGI=4;
 geo.bench={x:cx,y:benC,w:benW,h:benH};
 SLOTS.forEach((m,j)=>{if(m&&m!=="SG")posOf.set(m,{x:slotX(j),y:benC,z:1,a:Math.PI/2,i:-1})});
 let bench=(LIVE?`<g>`:`<g data-bench="1" style="cursor:pointer">`)+`<rect x="${Math.round(benX)}" y="${Math.round(benY)}" width="${Math.round(benW)}" height="${Math.round(benH)}" fill="var(--card)" stroke="var(--line)" rx="2"></rect>`;
 if(!SPK)SLOTS.forEach((m,j)=>{if(m!=="SG")bench+=`<rect x="${Math.round(slotX(j)-bk/2)}" y="${Math.round(benC-bk/2)}" width="${bk}" height="${bk}" fill="${j===3?"var(--ink)":"var(--seat)"}"></rect>`});
 bench+=`<rect x="${Math.round(slotX(SGI)-bk/2)+.75}" y="${Math.round(benC-bk/2)+.75}" width="${bk-1.5}" height="${bk-1.5}" fill="none" stroke="var(--mute)" stroke-width="1.5"></rect><title>Predsedništvo</title></g>`;
 const sq=(p,z,fill,op=1,g="")=>{const k=Math.max(2,Math.round(z*(p.z||1)));return `<rect ${g!==""?`data-g="${g}" `:""}x="${Math.round(p.x-k/2)}" y="${Math.round(p.y-k/2)}" width="${k}" height="${k}" fill="${fill}" opacity="${op}"></rect>`};
 /* who spoke today: hollow = not yet, filled and bigger = spoke more; neighbours spread so big ones never overlap */
 const key=W+"x"+H;if(LIVE&&geo.key!==key){geo.key=key;const R=new Map();
  mps.forEach(m=>{const p=posOf.get(m),f=m.t/maxT,sz=Math.round((m.t?s*(1+1.3*Math.sqrt(f)):s*.95)*(p.z||1));R.set(m,{x:p.x,y:p.y,ox:p.x,oy:p.y,sz,r:sz/2,fix:LEADS.has(m)})});
  const A=[...R.values()];
  for(let it=0;it<40;it++){for(let i=0;i<A.length;i++){const a=A[i];for(let j=i+1;j<A.length;j++){const b=A[j],dx=b.x-a.x,dy=b.y-a.y,lim=a.r+b.r+1.5;if(Math.abs(dx)>lim||Math.abs(dy)>lim)continue;const d=Math.hypot(dx,dy)||.01;if(d<lim){const ov=(lim-d),wa=b.r/(a.r+b.r);a.x-=dx/d*ov*wa;a.y-=dy/d*ov*wa;b.x+=dx/d*ov*(1-wa);b.y+=dy/d*ov*(1-wa)}}}
   A.forEach(p=>{if(p.fix){p.x=p.ox;p.y=p.oy;return}p.x+=(p.ox-p.x)*.04;p.y+=(p.oy-p.y)*.04;p.y=Math.max(p.y,cy+4)})}
  geo.R=R}
 const RP=geo.R;
 const seat=(m,col,op=1,g="")=>{const p=RP.get(m),k=p.sz,x=Math.round(p.x-k/2),y=Math.round(p.y-k/2),d=g!==""?`data-g="${g}" `:"";
  return m.t?`<rect ${d}x="${x}" y="${y}" width="${k}" height="${k}" fill="${col}" opacity="${op}"></rect>`:`<rect ${d}x="${x+.75}" y="${y+.75}" width="${k-1.5}" height="${k-1.5}" fill="var(--board)" stroke="${col}" stroke-width="1.5" opacity="${op}"></rect>`};
 const fm=V==="day"?active.m:V==="mps"?focusMp:live.m;let o=bench;geo.empty.forEach(p=>{const k=Math.max(2,Math.round(s*.8));o+=`<rect x="${Math.round(p.x-k/2)+.5}" y="${Math.round(p.y-k/2)+.5}" width="${k-1}" height="${k-1}" fill="none" stroke="var(--seat)" stroke-width="1"></rect>`});
 mps.forEach(m=>{const p=posOf.get(m);
  if(LIVE)o+=seat(m,SH[m.g],1);
  else if(V==="groups"){const any=selG!==null||popFor==="bench",lead=LEADS.has(m),hl=popFor==="bench"?lead:(!any||selG===m.g);o+=hl?sq(p,any?s*1.15:s,popFor==="bench"?"var(--ink)":SH[m.g],1,m.g):sq(p,s*.85,"var(--seat)",1,m.g)}
  else if(V==="mps")o+=m===fm?"":sq(p,s,SH[m.g],m.g===fm.g?.75:.25);
  else{const f=m.t/maxT;o+=m===fm?"":(m.t?sq(p,s*(.7+.8*Math.sqrt(f)),SH[m.g]):sq(p,s*.45,"var(--seat)"))}});

 const ap=LIVE?RP.get(fm):posOf.get(fm);
 if(V!=="groups"&&!LIVE)o+=sq({x:ap.x,y:ap.y},s*2,SH[fm.g]);
 const k=Math.round(LIVE?RP.get(fm).sz+8:V==="groups"?s+8:s*2+8);if(V!=="groups")o+=`<rect x="${Math.round(ap.x-k/2)}" y="${Math.round(ap.y-k/2)}" width="${k}" height="${k}" fill="none" stroke="var(--ink)" stroke-width="1.5"></rect>`;
 svg.innerHTML=o;
 if(V==="groups"){
  tip.style.visibility="hidden";placeFocus();return;
  if(selG===null){return}
  const bl=blocks[selG],c=bl[Math.floor(bl.length/2)];
  tip.innerHTML=`<span>${groups[selG][2]} ${groups[selG][2]===1?"mesto":groups[selG][2]<5?"mesta":"mesta"}</span><b>${groups[selG][0]}</b>`;apply(tip);tip.style.visibility="visible";
  const bw=tip.offsetWidth,bh=tip.offsetHeight;tip.style.left=Math.min(Math.max(c.x-bw/2,8),W-bw-8)+"px";let y=c.y-bh-12;if(y<6)y=c.y+12;tip.style.top=y+"px";return}
 tip.style.visibility="visible";
 const head=LIVE?"govori sada":V==="day"?(active.live?"govori":hm(active.t)+"  "+dur(active.d)):groups[fm.g][1];
 tip.innerHTML=`<span>${head}</span><b>${fm.name}</b>${LIVE?groups[fm.g][1]:V==="day"?active.l:(V1?"":fm.t?dur(fm.t)+" danas":"danas nije govorio")}`;apply(tip);
 const bw=tip.offsetWidth,bh=tip.offsetHeight;let x=Math.min(Math.max(ap.x-bw/2,8),W-bw-8),y=ap.y-bh-k/2-6;if(y<6)y=ap.y+k/2+6;tip.style.left=x+"px";tip.style.top=y+"px";
}
const SALA={el:hall,svg,tip,geo,live:false};
const hallRO=new ResizeObserver(()=>drawMap());hallRO.observe(hall);

/* sastav panel: a plain list; details open in a small window */
let selG=null;
const pct=x=>x<.01?"<1%":Math.round(x*100)+"%";
const pop=$("#pop");
function renderSastav(){
 const el=$("#vGroups");
 el.innerHTML=`<div class="barwrap"><div class="bar100">${groups.map((g,i)=>`<i style="width:${g[2]/2.5}%;background:${SH[i]};opacity:${selG===null||selG===i?1:.3}"></i>`).join("")}</div></div>
 <div class="plist2">${groups.map((g,i)=>`<button type="button" class="prow" data-g="${i}" aria-expanded="${selG===i}" aria-controls="pop"><i style="width:12px;height:12px;background:${SH[i]}"></i><span>${g[0]}</span><span class="num">${g[2]}</span><span class="chev" aria-hidden="true">›</span></button>`).join("")}
 <button type="button" class="prow" data-bench="1"><i style="width:12px;height:12px;background:var(--ink)"></i><span>Predsedništvo</span><span class="num"></span><span class="chev" aria-hidden="true">›</span></button></div>`;
 apply(el);
}
const roleOf=m=>((m.pg||"").match(/\(([^)]+)\)\s*$/)||[])[1]||"";
const pgName=m=>(m.pg||"").replace(/\s*\([^)]*\)\s*$/,"").replace(/^Посланичка група\s*/,"").replace(/[„“”"]/g,"");
const lat=x=>[...(x||"")].map(c=>({А:"A",Б:"B",В:"V",Г:"G",Д:"D",Ђ:"Đ",Е:"E",Ж:"Ž",З:"Z",И:"I",Ј:"J",К:"K",Л:"L",Љ:"Lj",М:"M",Н:"N",Њ:"Nj",О:"O",П:"P",Р:"R",С:"S",Т:"T",Ћ:"Ć",У:"U",Ф:"F",Х:"H",Ц:"C",Ч:"Č",Џ:"Dž",Ш:"Š"}[c]??({а:"a",б:"b",в:"v",г:"g",д:"d",ђ:"đ",е:"e",ж:"ž",з:"z",и:"i",ј:"j",к:"k",л:"l",љ:"lj",м:"m",н:"n",њ:"nj",о:"o",п:"p",р:"r",с:"s",т:"t",ћ:"ć",у:"u",ф:"f",х:"h",ц:"c",ч:"č",џ:"dž",ш:"š"}[c]??c))).join("");
function realGroup(mem){
 const by=new Map();mem.forEach(m=>{const k=pgName(m)||"";if(!by.has(k))by.set(k,[]);by.get(k).push(m)});
 return [...by.entries()].map(([k,list])=>{const pres=list.find(m=>/^председник/.test(roleOf(m))),dep=list.find(m=>/заменик/.test(roleOf(m)));
  return `<div class="sec"><span class="lab">${k?"Poslanička grupa":"Bez poslaničke grupe"}</span>${k?`<div class="r"><span>Naziv</span><span>${lat(k)}</span></div>`:""}${pres?`<div class="r"><span>Predsednik</span><span>${pres.name}</span></div>`:""}${dep?`<div class="r"><span>Zamenik</span><span>${dep.name}</span></div>`:""}${by.size>1||!k?`<div class="r"><span>Poslanika</span><span>${list.length}</span></div>`:""}</div>`}).join("");
}
function groupPop(i){
 const g=groups[i],L=V1?null:LEAD[i],mem=mps.filter(m=>m.g===i),tk=talks.filter(t=>t.m.g===i),tT=tk.reduce((a,t)=>a+t.d,0);
 const top=[...mem].filter(m=>m.t).sort((a,b)=>b.t-a.t).slice(0,3),silent=mem.filter(m=>!m.t).length;
 return `<div class="phd"><i style="width:12px;height:12px;background:${SH[i]}"></i><h3>${g[0]}</h3><button type="button" class="x" aria-label="Zatvori">×</button></div>
 ${V1?realGroup(mem):""}<div class="sec"${V1?" hidden":""}><span class="lab">Poslanička grupa</span>${L?`${L[2]?`<div class="r"><span>Naziv</span><span>${L[2]}</span></div>`:""}<div class="r"><span>Predsednik</span><span>${L[0]}</span></div><div class="r"><span>Zamenik</span><span>${L[1]}</span></div>`:`<span class="m">Još nije objavljeno</span>`}</div>
 <div class="sec"${V1?" hidden":""}><span class="lab">Danas</span><div class="big"><div><span class="px">${tk.length}</span><span class="lab">govora</span></div><div><span class="px">${tT?dur(tT).replace(" min","m").replace(" h ","h "):"0"}</span><span class="lab">za govornicom</span></div><div><span class="px">${g[2]-silent}/${g[2]}</span><span class="lab">govorilo</span></div></div>
 ${top.length?`<span class="lab" style="margin-top:6px">Najviše govorili</span>${top.map(m=>`<div class="r"><span>${m.name}</span><span class="m">${dur(m.t)}</span></div>`).join("")}`:`<span class="m">Danas niko nije govorio</span>`}</div>
 <div class="sec"><details><summary>Izbori 2026</summary><div class="r"><span>Glasova</span><span>${VOTES[i].toLocaleString("sr-RS")}</span></div><div class="r"><span>Udeo glasova</span><span>${pct(VOTES[i]/VOTERS)}</span></div><div class="r"><span>Udeo mesta</span><span>${pct(g[2]/250)}</span></div></details></div>
 <button type="button" class="b dark" data-members="${i}">Svi poslanici (${g[2]})</button>`;
}
function benchPop(){
 if(V1){const sp=REAL.filter(r=>r.role).sort((a,b)=>(/^Председник/.test(b.role)?1:0)-(/^Председник/.test(a.role)?1:0)||a.l.localeCompare(b.l,"sr"));return `<div class="phd"><i style="width:12px;height:12px;background:var(--ink)"></i><h3>Predsedništvo</h3><button type="button" class="x" aria-label="Zatvori">×</button></div>
 <div class="sec">${sp.length?sp.map(r=>`<div class="r"><span>${r.l}</span><span class="m">${lat(r.role).replace(/ Narodne skupštine.*$/,"")}</span></div>`).join(""):`<span class="m">Podaci uskoro</span>`}</div><div class="sec"><div class="r"><span>Mirjana Radaković</span><span class="m">Generalna sekretarka</span></div></div>`}
 return `<div class="phd"><i style="width:12px;height:12px;background:var(--ink)"></i><h3>Predsedništvo</h3><button type="button" class="x" aria-label="Zatvori">×</button></div>
 <div class="sec"><span class="lab">Predsednik Skupštine</span><div class="r"><span>Aleksandar Čupić</span><span class="m">kandidat Studentske liste</span></div></div>
 <div class="sec"><span class="lab">Potpredsednici</span><span class="m">Biraju se na konstitutivnoj sednici</span></div>
 <div class="sec"><span class="lab">Danas predsedava</span><span class="m">Prikazuje se tokom sednice</span></div>`;
}
let popFor=null;
const plink=$("#plink");
function placeFocus(){
 if(popFor===null||pop.hidden||view!=="groups"){svg.style.transform="";plink.hidden=true;return}
 const W=hall.clientWidth,H=hall.clientHeight,mob=innerWidth<=760;
 const pts=popFor==="bench"?[geo.bench]:mps.filter(m=>m.g===popFor).map(m=>geo.pos.get(m));if(!pts||!pts.length)return;
 let x0=1e9,x1=-1e9,y0=1e9,y1=-1e9,sx=0,sy=0;pts.forEach(p=>{x0=Math.min(x0,p.x);x1=Math.max(x1,p.x);y0=Math.min(y0,p.y);y1=Math.max(y1,p.y);sx+=p.x;sy+=p.y});
 const c={x:sx/pts.length,y:sy/pts.length};
 const pw=mob?0:Math.min(360,W-24),side=c.x<W/2?"right":"left";
 let vH=H;if(mob){const t=pop.getBoundingClientRect().top-hall.getBoundingClientRect().top;vH=Math.max(80,Math.min(H,t))}
 const f0=mob?0:side==="left"?pw+24:0,f1=mob?W:side==="left"?W:W-pw-24,fw=f1-f0,fx=(f0+f1)/2,fy=vH*.5;
 const bw=Math.max(x1-x0,popFor==="bench"?geo.bench.w:18),bh=Math.max(y1-y0,18);
 const z=Math.max(mob?.6:1,Math.min(2.6,fw*.72/bw,vH*.7/bh));
 svg.style.transform=`translate(${(fx-z*c.x).toFixed(1)}px,${(fy-z*c.y).toFixed(1)}px) scale(${z.toFixed(3)})`;
 if(mob){pop.style.left="";pop.style.top="";plink.hidden=true;return}
 pop.style.left=(side==="left"?12:W-pw-12)+"px";
 const ph=pop.offsetHeight,bH=board.clientHeight,top=Math.max(12,Math.min(fy-34,bH-ph-12));pop.style.top=top+"px";
 const ly=Math.min(Math.max(fy,top+20),top+ph-20),edge=side==="left"?12+pw:W-pw-12,tx=fx+(side==="left"?-Math.min(bw*z/2,fw*.3):Math.min(bw*z/2,fw*.3));
 plink.hidden=false;plink.classList.toggle("rev",side==="right");
 const a=Math.min(edge,tx),b=Math.max(edge,tx);plink.style.left=a+"px";plink.style.width=Math.max(0,b-a-6)+"px";plink.style.top=ly+"px";
 if(side==="right")plink.style.left=(a+6)+"px";
}
function openPop(what,anchor){popFor=what;pop.innerHTML=what==="bench"?benchPop():groupPop(what);apply(pop);pop.hidden=false;
 selG=what==="bench"?null:what;renderSastav();drawMap();pop.querySelector(".x").focus({preventScroll:true})}
function closePop(){if(pop.hidden)return;pop.hidden=true;popFor=null;selG=null;svg.style.transform="";plink.hidden=true;renderSastav();drawMap()}
pop.addEventListener("click",e=>{if(e.target.closest(".x"))closePop();const m=e.target.closest("[data-members]");if(m){gFilter=+m.dataset.members;closePop();renderMps("");setView("mps")}});
$("#vGroups").addEventListener("click",e=>{const b=e.target.closest(".prow");if(!b)return;const w=b.dataset.bench?"bench":+b.dataset.g;popFor===w?closePop():openPop(w)});
svg.addEventListener("click",e=>{if(view!=="groups")return;if(e.target.closest("[data-bench]")){popFor==="bench"?closePop():openPop("bench");return}const r=e.target.closest("rect[data-g]");if(r){const g=+r.dataset.g;popFor===g?closePop():openPop(g)}});
document.addEventListener("keydown",e=>{if(e.key==="Escape")closePop()});
document.addEventListener("click",e=>{if(!pop.hidden&&!e.target.closest("#pop,.prow,#hallSvg"))closePop()});
renderSastav();

/* lens lists: the row in the middle is the focused one */
function lens(list,onFocus){let raf=0,cur=null;
 const pad=()=>{const p=Math.max(0,list.clientHeight/2-30)+"px";list.style.paddingTop=p;list.style.paddingBottom=p};
 const run=()=>{raf=0;const r=list.getBoundingClientRect();if(!r.height)return;const mid=r.top+r.height/2;let best=null,bd=1e9;
  for(const li of list.children){const b=li.getBoundingClientRect();if(b.bottom<r.top-80||b.top>r.bottom+80){li.style.setProperty("--f",0);continue}
   const d=Math.abs(b.top+b.height/2-mid);li.style.setProperty("--f",Math.max(0,1-d/(r.height*.42)).toFixed(3));if(d<bd&&li.dataset.i){bd=d;best=li}}
  if(best&&best!==cur){cur?.classList.remove("on");best.classList.add("on");cur=best;onFocus(best.dataset.i)}};
 list.addEventListener("scroll",()=>{raf||(raf=requestAnimationFrame(run))},{passive:true});
 list.addEventListener("click",e=>{const li=e.target.closest("li[data-i]");if(li)list.scrollTo({top:li.offsetTop-list.clientHeight/2+li.offsetHeight/2,behavior:reduce?"auto":"smooth"})});
 const ro=new ResizeObserver(()=>{pad();run()});ro.observe(list);
 return {run,center:i=>{const li=list.querySelector(`li[data-i="${i}"]`);if(li){list.scrollTop=li.offsetTop-list.clientHeight/2+li.offsetHeight/2;run()}}};
}
/* poslanici list */
const fold=x=>tr(x).toLowerCase();
const mpl=$("#mplist");
let gFilter=null;
const renderMps=q=>{const f=fold(q||"");const list=order.filter(m=>(gFilter===null||m.g===gFilter)&&(!f||fold(m.name+" "+groups[m.g][1]).includes(f)));
 const fc=$("#fchip");fc.hidden=gFilter===null;if(gFilter!==null){fc.innerHTML=`<button type="button" aria-label="Ukloni filter"><i style="background:${SH[gFilter]}"></i>${groups[gFilter][0]}<span aria-hidden="true">×</span></button>`;apply(fc)}
 mpl.innerHTML=list.length?list.map(m=>`<li data-i="${m.i}"><button type="button"><span class="ph" aria-hidden="true"${m.ph?` style="background:var(--seat) url(/p/${m.id}) center 20%/cover"`:""}></span><span><span class="nm">${m.name}</span><br><span class="g">${groups[m.g][1]}</span></span><span class="d">${m.t?dur(m.t):""}${m.w?`<span class="w">${m.w}</span>`:""}</span></button></li>`).join(""):`<li class="empty">Nema rezultata</li>`;apply(mpl);mpLens.run()};
const mpLens=lens(mpl,i=>{focusMp=mps[i];if(view==="mps")drawMap()});
$("#q").addEventListener("input",e=>{renderMps(e.target.value);mpl.scrollTop=0});
$("#fchip").addEventListener("click",()=>{gFilter=null;renderMps($("#q").value);mpl.scrollTop=0});renderMps("");
