/* seat plan: who sits where, the same on every map: Sala, the "Najviše govorili" panel and the admin editor (/admin/sala).
   build.mjs pastes this file into src/admin/sala.html at its seat-plan marker, so it must not use anything else from the page.
   The hall as built: 8 sections split by aisles; the two outer ones have 5..10 seats per row, the six inner ones 3,4,5,5,6,6; 6 rows = 264 seats.
   Seat keys are "row-section-index": row 0 nearest the presidium; section 0 and index 0 on the right as seen on the broadcast.
   Seats saved in the admin always win. Everyone else gets an automatic seat:
   1. a default layout: every group gets a wedge of the hall in proportion to its size (its leaders in front, nearest the centre, then
      alphabetically). The groups go round the hall in the order the saved seats show (the average angle of each group's saved seats),
      so a group's automatic members sit on the same side as its saved ones, never in the middle of another group;
   2. whoever's default seat is free keeps it. Someone whose default seat was taken by a saved seat moves to the nearest free seat in his own
      group's wedge (for example the one freed by a member of his group who was saved somewhere else), so one change in the admin moves one
      person on the site, not the whole hall. */
const HALL_SEC=[5,3,3,3,3,3,3,5],HALL_INNER=[3,4,5,5,6,6],HALL_ROWS=6;
/* the seats of a hall with outer radius R: a = angle (π = the right end as seen on the broadcast), r = radius of the row.
   aisle = width of the gap between sections, in seats. Everything scales with R, so every map gets the same seats. */
function hallSeats(R,aisle=1.3){
 const r0=R*.56,step=(R-r0)/(HALL_ROWS-1),N0=HALL_SEC.reduce((a,b)=>a+b,0),span=Math.PI-.04,aw=span*r0/(N0+(HALL_SEC.length-1)*aisle)*aisle,seats=[];let arc0=0,minArc=1e9;
 for(let i=0;i<HALL_ROWS;i++){const r=r0+i*step,ns=HALL_SEC.map(n=>n===3?HALL_INNER[i]:n+i),N=ns.reduce((a,b)=>a+b,0),ga=aw/r,per=(span-(HALL_SEC.length-1)*ga)/N;if(!i)arc0=per*r;minArc=Math.min(minArc,per*r);
  let a0=Math.PI-.02;ns.forEach((n,k)=>{for(let j=0;j<n;j++)seats.push({key:i+"-"+k+"-"+j,i,k,j,a:a0-(j+.5)*per,r});a0-=n*per+ga})}
 return {seats,r0,step,arc0,minArc}}
/* group key for the plan: Srbija pobeđuje MPs without a parliamentary group sit at the edge of their group */
const seatGroupKey=(g,pg)=>g===6&&!pg?5.5:g;
/* 0 group president, 1 deputy, 2 vice-president of the Assembly, 3 everyone else */
const seatRank=(pg,role)=>/\(председник\)/.test(pg||"")?0:/\(заменик/.test(pg||"")?1:/^Потпредседник/.test(role||"")?2:3;
/* the Speaker and the vice-presidents (by surname): they sit on the presidium bench, not in the hall */
function splitLeads(list,role,name){
 const spk=list.find(m=>/^Председник Народне/.test(role(m)||""))||null,vps=list.filter(m=>/^Потпредседник/.test(role(m)||"")).sort((a,b)=>name(a).split(" ").pop().localeCompare(name(b).split(" ").pop(),"sr"));
 return [spk,vps]}
/* the presidium bench: 9 places, left to right as seen on the broadcast:
   4 vice-presidents · the Speaker (index 4) · secretary general ("SG", index 5) · deputy secretary general ("GSD", index 6) · 2 vice-presidents
   (as in the hall: GS and ZGS on the Speaker's own left, which is the right on the broadcast).
   SG and GSD are not MPs: their places are fixed. Saved places ("p-0".."p-8") win; anyone else takes their default place
   or the free place nearest the middle. */
const BENCH_FIX={5:"SG",6:"GSD"},BENCH_NEAR=[3,7,2,8,1,0];
function benchSlots(spk,vps,seatOf){
 const S=Array(9).fill(null),all=[spk,...vps].filter(Boolean);for(const j in BENCH_FIX)S[j]=BENCH_FIX[j];
 all.forEach(m=>{const x=/^p-([0-8])$/.exec(seatOf(m)||"");if(x&&!S[+x[1]])S[+x[1]]=m});
 const def=[[spk,4],[vps[0],3],[vps[1],2],[vps[2],1],[vps[3],0],[vps[4],7],[vps[5],8]].filter(d=>d[0]&&!S.includes(d[0]));
 const late=[];def.forEach(([m,j])=>{if(!S[j])S[j]=m;else late.push(m)});vps.slice(6).forEach(m=>{if(!S.includes(m))late.push(m)});
 late.forEach(m=>{const k=BENCH_NEAR.find(i=>!S[i]);if(k!=null)S[k]=m});
 return S}
/* list: the MPs in the hall (not the bench). o: {seat(m) saved key or null, grp(m) group key (number), rank(m) 0-3, name(m), id(m)}.
   Returns {at: Map MP -> seat key, saved: Set of MPs on a saved seat, zone: Map seat key -> group key of its wedge, empty: [free seat keys]}. */
function seatPlan(list,o){
 const {seats}=hallSeats(1),byKey=new Map(seats.map(p=>[p.key,p]));seats.forEach(p=>{p.x=-p.r*Math.cos(p.a);p.y=p.r*Math.sin(p.a)});
 const L=[...list].sort((a,b)=>o.id(a)-o.id(b)),G=new Map(L.map(m=>[m,o.grp(m)]));
 const cmp=(a,b)=>o.rank(a)-o.rank(b)||o.name(a).localeCompare(o.name(b),"sr")||o.id(a)-o.id(b);
 /* saved seats (a seat saved twice, which the database doesn't allow, goes to the lower id) */
 const saved=new Map(),occ=new Set();
 L.forEach(m=>{const k=o.seat(m);if(k&&byKey.has(k)&&!occ.has(k)){occ.add(k);saved.set(m,k)}});
 /* wedges: the seats swept from the right end round to the left (front row first at each angle), cut in proportion to group size */
 const byA=[...seats].sort((p,q)=>q.a-p.a||p.i-q.i),keys=[...new Set(G.values())].sort((a,b)=>a-b),cnt=new Map(keys.map(g=>[g,0]));
 G.forEach(g=>cnt.set(g,cnt.get(g)+1));
 const wedges=order=>{const W=new Map();let at=0,cum=0;order.forEach((g,gi)=>{cum+=cnt.get(g);let end=gi===order.length-1?byA.length:Math.round(byA.length*cum/Math.max(1,L.length));end=Math.max(end,at+cnt.get(g));W.set(g,byA.slice(at,end));at=end});return W};
 const mean=a=>a.reduce((x,y)=>x+y,0)/a.length,def=wedges(keys);
 const theta=new Map(keys.map(g=>{const s=L.filter(m=>G.get(m)===g&&saved.has(m)).map(m=>byKey.get(saved.get(m)).a),d=def.get(g);return [g,s.length?mean(s):d.length?mean(d.map(p=>p.a)):0]}));
 const order=[...keys].sort((a,b)=>theta.get(b)-theta.get(a)||a-b),W=wedges(order);
 /* 1. the default layout, everyone included */
 const L0=new Map(),zone=new Map();
 order.forEach(g=>{const slice=W.get(g),mem=L.filter(m=>G.get(m)===g).sort(cmp);slice.forEach(p=>zone.set(p.key,g));
  const front=[...slice].sort((p,q)=>p.i-q.i||Math.abs(p.a-Math.PI/2)-Math.abs(q.a-Math.PI/2)),used=new Set();
  mem.filter(m=>o.rank(m)<3).forEach((m,j)=>{const p=front.find(x=>!used.has(x));if(p){used.add(p);L0.set(m,p.key)}});
  const rest=slice.filter(p=>!used.has(p)).sort((p,q)=>p.i-q.i||q.a-p.a);
  mem.filter(m=>o.rank(m)>=3).forEach(m=>{const p=rest.shift();if(p)L0.set(m,p.key)})});
 /* 2. saved seats first, then everyone who keeps his default seat, then the ones pushed out, each to the nearest free seat of his group */
 const at=new Map(saved),moved=[],seq=k=>{const p=byKey.get(k);return p?p.i*10+(Math.PI-p.a):1e9};
 L.filter(m=>!saved.has(m)).sort((a,b)=>seq(L0.get(a))-seq(L0.get(b))||cmp(a,b)).forEach(m=>{const k=L0.get(m);if(k&&!occ.has(k)){occ.add(k);at.set(m,k)}else moved.push(m)});
 /* the closest move of all goes first, so nobody is pushed further than he has to be */
 const home=new Map(moved.map(m=>[m,byKey.get(L0.get(m))])),cost=(m,p)=>{const h=home.get(m);return (h?Math.hypot(p.x-h.x,p.y-h.y):p.i*.01)+(zone.get(p.key)===G.get(m)?0:3)};
 const free=seats.filter(p=>!occ.has(p.key)),cand=moved.map(m=>({m,q:free.map(p=>({p,c:cost(m,p)})).sort((x,y)=>x.c-y.c),n:0}));
 while(cand.length){let bx=-1,bc=1e9;
  cand.forEach((x,i)=>{while(x.n<x.q.length&&occ.has(x.q[x.n].p.key))x.n++;const h=x.q[x.n];if(h&&h.c<bc-1e-9){bc=h.c;bx=i}});
  if(bx<0)break;const x=cand[bx],p=x.q[x.n].p;occ.add(p.key);at.set(x.m,p.key);cand.splice(bx,1)}
 return {at,saved:new Set(saved.keys()),zone,empty:seats.filter(p=>!occ.has(p.key)).map(p=>p.key)}}
