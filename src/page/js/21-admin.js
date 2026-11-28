/* Podešavanja → Admin meni: shown only to admins (/api/auth/me → admin {super, perms}).
   Admini: the super admin adds/removes admins and picks their menus (/admin/api/admins). Sala: opens /admin/sala.
   Poruke (super admin): suggestions from Beleške and contact messages (/admin/api/poruke), filter, delete.
   Moderator: for now only the look (the tools come later). 20-chat.js calls admSet() with what /api/auth/me says. */
var ADM=null;
function admSet(a){ADM=a||null;$("#padmRow").hidden=!ADM;if(!ADM){admClose();return}
 $("#admAdmins").hidden=!ADM.super;$("#admPoruke").hidden=!ADM.super;$("#admNov").hidden=!ADM.super;$("#admSala").hidden=!ADM.perms.includes("sala");$("#admMod").hidden=!ADM.perms.includes("mod");
}
{
const dl=$("#admDlg"),err=$("#admErr"),list=$("#admList");
const e=s=>String(s??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/"/g,"&quot;");
const PN={sala:"Sala",mod:"Moderator"};
let data=null;
const say=t=>{err.textContent=t||""};
const api=async(body)=>{try{const r=await fetch("/admin/api/admins",body?{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)}:{cache:"no-store"});return await r.json()}catch(x){return{ok:false,err:"net"}}};
const ERR={net:"Nema veze. Pokušaj ponovo.",email:"Proveri email adresu.",super:"Samo super admin menja admine.",login:"Prijavi se ponovo."};
function view(v){dl.querySelectorAll("[data-v]").forEach(x=>x.hidden=x.dataset.v!==v);say("");if(v==="admins")load();if(v==="poruke")pLoad();if(v==="novosti")nLoad();apply(dl)}
function open(){if(!ADM)return;view("home");if(dl.showModal)dl.showModal();else dl.setAttribute("open","")}
window.admClose=()=>{if(dl.open)dl.close?dl.close():dl.removeAttribute("open")};
async function load(){list.innerHTML=`<li class="m">Učitavam…</li>`;const j=await api();if(!j.ok){list.innerHTML="";say(ERR[j.err]||ERR.net);return}data=j;draw()}
function draw(){const sup=`<li><b class="em nt">${e(data.super)}</b><span></span><div class="admp"><button type="button" aria-pressed="true" disabled>Admini</button>${data.perms.map(p=>`<button type="button" aria-pressed="true" disabled>${PN[p]||p}</button>`).join("")}</div></li>`;
 list.innerHTML=sup+data.admins.map(a=>`<li data-em="${e(a.email)}"><b class="em nt">${e(a.email)}</b><button type="button" class="rm" aria-label="Ukloni">×</button><div class="admp">${data.perms.map(p=>`<button type="button" data-p="${p}" aria-pressed="${a.perms.includes(p)}">${PN[p]||p}</button>`).join("")}</div></li>`).join("");apply(list)}
async function save(body){say("");const j=await api(body);if(!j.ok){say(ERR[j.err]||ERR.net);if(data)draw();return false}data=j;draw();return true}
dl.addEventListener("click",ev=>{if(ev.target===dl){admClose();return}
 const go=ev.target.closest("[data-go]");if(go){view(go.dataset.go);return}
 if(ev.target.closest("#admX")){admClose();return}
 const li=ev.target.closest("#admList li[data-em]");if(!li)return;const em=li.dataset.em,a=data.admins.find(x=>x.email===em);
 const pb=ev.target.closest("[data-p]");if(pb){const on=pb.getAttribute("aria-pressed")!=="true";pb.setAttribute("aria-pressed",on);
  save({email:em,perms:data.perms.filter(p=>p===pb.dataset.p?on:a.perms.includes(p))});return}
 const rm=ev.target.closest(".rm");if(rm){if(!rm.classList.contains("sure")){rm.classList.add("sure");rm.textContent="Ukloni";setTimeout(()=>{if(rm.isConnected){rm.classList.remove("sure");rm.textContent="×"}},3000);return}
  save({email:em,remove:true})}});
$("#admNewP").addEventListener("click",ev=>{const b=ev.target.closest("[data-p]");if(b)b.setAttribute("aria-pressed",b.getAttribute("aria-pressed")!=="true")});
$("#admAdd").addEventListener("submit",async ev=>{ev.preventDefault();const em=$("#admEmail").value.trim().toLowerCase();if(!em)return;
 if(data&&(em===data.super||data.admins.some(x=>x.email===em))){say("Taj email je već admin.");return}
 const perms=[...$$("#admNewP [data-p]")].filter(b=>b.getAttribute("aria-pressed")==="true").map(b=>b.dataset.p);
 if(await save({email:em,perms})){$("#admEmail").value=""}});
$("#padm").onclick=open;
// Poruke
const KN={predlog:"Predlog",poruka:"Poruka",ispravka:"Ispravka podataka",greska:"Greška na sajtu"};
let pm=null,pf="";
const pList=$("#porList");
const pApi=async(body)=>{try{const r=await fetch("/admin/api/poruke",body?{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)}:{cache:"no-store"});return await r.json()}catch(x){return{ok:false,err:"net"}}};
const when=s=>{const d=new Date(s);return isNaN(d)?String(s||"").slice(0,16).replace("T"," "):d.toLocaleString("sr-Latn-RS",{day:"numeric",month:"numeric",year:"numeric",hour:"2-digit",minute:"2-digit"})};
async function pLoad(){pList.innerHTML=`<li class="m">Učitavam…</li>`;const j=await pApi();if(!j.ok){pList.innerHTML="";say(ERR[j.err]||ERR.net);return}pm=j.msgs;pDraw()}
function pDraw(){const l=pm.filter(m=>!pf||(pf==="predlog"?m.kind==="predlog":m.kind!=="predlog"));
 pList.innerHTML=l.length?l.map(m=>`<li data-id="${m.id}"><div class="ph"><span class="pk${m.kind==="predlog"?" pr":""}">${e(KN[m.kind]||m.kind)}</span><span class="m">${e(when(m.at))}</span></div><button type="button" class="rm" aria-label="Obriši">×</button><p class="pt nt">${e(m.msg)}</p>${m.mail?`<a class="pmail nt" href="mailto:${e(m.mail)}">${e(m.mail)}</a>`:""}</li>`).join(""):`<li class="m">Nema poruka.</li>`;apply(pList)}
$("#porF").addEventListener("click",ev=>{const b=ev.target.closest("[data-f]");if(!b)return;pf=b.dataset.f;$$("#porF [data-f]").forEach(x=>x.setAttribute("aria-pressed",x===b));if(pm)pDraw()});
pList.addEventListener("click",async ev=>{const rm=ev.target.closest(".rm");if(!rm)return;
 if(!rm.classList.contains("sure")){rm.classList.add("sure");rm.textContent="Obriši";setTimeout(()=>{if(rm.isConnected){rm.classList.remove("sure");rm.textContent="×"}},3000);return}
 const j=await pApi({id:+rm.closest("li").dataset.id,remove:true});if(!j.ok){say(ERR[j.err]||ERR.net);return}pm=j.msgs;pDraw()});
}

{ // Patch notes: add / delete what Podešavanja → Novosti shows (/admin/api/novosti)
const nl=$("#novList"),say=t=>{$("#admErr").textContent=t||""};let nm=[];
const nApi=async b=>{try{const r=await fetch("/admin/api/novosti",b?{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(b)}:{cache:"no-store"});return await r.json()}catch(x){return{ok:false}}};
const esc=s=>String(s??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/"/g,"&quot;");
const draw=()=>{nl.innerHTML=nm.map(i=>`<li data-id="${i.id}"><div class="ph"><span class="m">${esc(i.day)}</span></div><button type="button" class="rm" aria-label="Obriši">×</button><p class="pt nt"><b>${esc(i.title)}</b>${i.body?": "+esc(i.body):""}</p></li>`).join("")};
const got=j=>{if(!j.ok){say("Nije sačuvano.");return false}nm=j.items;draw();return true};
window.nLoad=async()=>{$("#novDay").value=new Date().toLocaleDateString("sv",{timeZone:"Europe/Belgrade"});nl.innerHTML='<li class="m">Učitavam…</li>';got(await nApi())};
$("#novAdd").addEventListener("submit",async ev=>{ev.preventDefault();say("");if(got(await nApi({day:$("#novDay").value,title:$("#novTitle").value,body:$("#novText").value}))){$("#novTitle").value="";$("#novText").value=""}});
nl.addEventListener("click",async ev=>{const rm=ev.target.closest(".rm");if(!rm)return;
 if(!rm.classList.contains("sure")){rm.classList.add("sure");rm.textContent="Obriši";setTimeout(()=>{if(rm.isConnected){rm.classList.remove("sure");rm.textContent="×"}},3000);return}
 got(await nApi({id:+rm.closest("li").dataset.id,remove:true}))});
}
