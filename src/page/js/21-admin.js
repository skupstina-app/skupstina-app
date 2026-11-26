/* Podešavanja → Admin meni: shown only to admins (/api/auth/me → admin {super, perms}).
   Admini: the super admin adds/removes admins and picks their menus (/admin/api/admins). Sala: opens /admin/sala.
   Moderator: for now only the look (the tools come later). 20-chat.js calls admSet() with what /api/auth/me says. */
var ADM=null;
function admSet(a,email){ADM=a||null;$("#padmRow").hidden=!ADM;if(!ADM){admClose();return}
 $("#admAdmins").hidden=!ADM.super;$("#admSala").hidden=!ADM.perms.includes("sala");$("#admMod").hidden=!ADM.perms.includes("mod");
 $("#admWho").textContent=(ADM.super?"Super admin":"Admin")+(email?" · "+email:"")}
{
const dl=$("#admDlg"),err=$("#admErr"),list=$("#admList");
const e=s=>String(s??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/"/g,"&quot;");
const PN={sala:"Sala",mod:"Moderator"};
let data=null;
const say=t=>{err.textContent=t||""};
const api=async(body)=>{try{const r=await fetch("/admin/api/admins",body?{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)}:{cache:"no-store"});return await r.json()}catch(x){return{ok:false,err:"net"}}};
const ERR={net:"Nema veze. Pokušaj ponovo.",email:"Proveri email adresu.",super:"Samo super admin menja admine.",login:"Prijavi se ponovo."};
function view(v){dl.querySelectorAll("[data-v]").forEach(x=>x.hidden=x.dataset.v!==v);say("");if(v==="admins")load();apply(dl)}
function open(){if(!ADM)return;view("home");if(dl.showModal)dl.showModal();else dl.setAttribute("open","")}
window.admClose=()=>{if(dl.open)dl.close?dl.close():dl.removeAttribute("open")};
async function load(){list.innerHTML=`<li class="m">Učitavam…</li>`;const j=await api();if(!j.ok){list.innerHTML="";say(ERR[j.err]||ERR.net);return}data=j;draw()}
const avs=a=>"/a/"+(a||"uskoro-prazno")+".png";
function draw(){const sup=`<li><img class="av" src="/a/uskoro-prazno.png" alt="" width="64" height="64"><span class="who"><b class="nt">${e(data.super)}</b><span class="m">super admin · sve</span></span><span></span><div class="admp"><span class="tag">Admini</span>${data.perms.map(p=>`<button type="button" aria-pressed="true" disabled>${PN[p]||p}</button>`).join("")}</div></li>`;
 list.innerHTML=sup+data.admins.map(a=>`<li data-em="${e(a.email)}"><img class="av" src="${avs(a.avatar)}" alt="" width="64" height="64"><span class="who"><b class="nt${a.color!=null?" u"+a.color:""}">${e(a.name||a.email)}</b><span class="m nt">${a.name?e(a.email)+" · ":""}${a.google?"Google nalog":"još se nije prijavio preko Google-a"}</span></span><button type="button" class="rm">Ukloni</button><div class="admp">${data.perms.map(p=>`<button type="button" data-p="${p}" aria-pressed="${a.perms.includes(p)}">${PN[p]||p}</button>`).join("")}</div></li>`).join("");apply(list)}
async function save(body){say("");const j=await api(body);if(!j.ok){say(ERR[j.err]||ERR.net);if(data)draw();return false}data=j;draw();return true}
dl.addEventListener("click",ev=>{if(ev.target===dl){admClose();return}
 const go=ev.target.closest("[data-go]");if(go){view(go.dataset.go);return}
 if(ev.target.closest("#admX")){admClose();return}
 const li=ev.target.closest("#admList li[data-em]");if(!li)return;const em=li.dataset.em,a=data.admins.find(x=>x.email===em);
 const pb=ev.target.closest("[data-p]");if(pb){const on=pb.getAttribute("aria-pressed")!=="true";pb.setAttribute("aria-pressed",on);
  save({email:em,perms:data.perms.filter(p=>p===pb.dataset.p?on:a.perms.includes(p))});return}
 const rm=ev.target.closest(".rm");if(rm){if(!rm.classList.contains("sure")){rm.classList.add("sure");rm.textContent="Sigurno?";setTimeout(()=>{if(rm.isConnected){rm.classList.remove("sure");rm.textContent="Ukloni"}},3000);return}
  save({email:em,remove:true})}});
$("#admNewP").addEventListener("click",ev=>{const b=ev.target.closest("[data-p]");if(b)b.setAttribute("aria-pressed",b.getAttribute("aria-pressed")!=="true")});
$("#admAdd").addEventListener("submit",async ev=>{ev.preventDefault();const em=$("#admEmail").value.trim().toLowerCase();if(!em)return;
 if(data&&(em===data.super||data.admins.some(x=>x.email===em))){say("Taj email je već admin.");return}
 const perms=[...$$("#admNewP [data-p]")].filter(b=>b.getAttribute("aria-pressed")==="true").map(b=>b.dataset.p);
 if(await save({email:em,perms})){$("#admEmail").value=""}});
$("#padm").onclick=open;
}
