/* chat: everyone can read (from the moment they open the page, no history); writing needs an account.
   Accounts: Sign in with Google, or email + password; a new account picks a chat name and a name colour. */
{
const box=$("#msgs"),pane=$("#p-chat"),cin=$("#cin"),cst=$("#cst"),dlg=$("#authDlg"),aErr=$("#aErr");
let ws=null,me=null,backoff=1000,last="",ids=new Set(),ping=0,ticket=null,pendPw=null,color=0,clientId=null,gsiReady=false;
const ERR={login:"Prijavi se da pišeš.",name_len:"Ime mora imati od 2 do 20 znakova.",name_chars:"Ime može imati slova, brojeve, razmak, tačku i crtice.",name_bad:"To ime nije dozvoljeno.",name_taken:"To ime je zauzeto. Izaberi drugo.",banned:"Privremeno ne možeš da pišeš.",long:"Poruka je duža od 300 znakova.",fast:"Polako, sačekaj par sekundi.",dup:"Ista poruka je već poslata.",bad:"Poruka ima uvredljive reči i nije poslata.",link:"Linkovi i imejlovi nisu dozvoljeni.",phone:"Brojevi telefona nisu dozvoljeni.",off:"Veza je prekinuta, povezujem ponovo…",wait:"Povezujem…",saved:"Sačuvano.",
 email:"Proveri email adresu.",password:"Lozinka mora imati bar 8 znakova.",wrong:"Pogrešan email ili lozinka.",use_google:"Ovaj nalog koristi prijavu preko Google-a.",email_taken:"Nalog sa tim emailom već postoji. Prijavi se.",slow:"Previše pokušaja. Probaj ponovo kasnije.",ticket:"Isteklo je vreme. Prijavi se ponovo.",google:"Google prijava nije uspela.",net:"Nema veze. Pokušaj ponovo."};
const say=(el,k)=>{el.textContent=k?(ERR[k]||k):"";apply(el)};
const ucol=n=>{let h=5381;for(const c of n.toLocaleLowerCase("sr"))h=(h*33+c.codePointAt(0))>>>0;return h%8};
const hhmm=t=>{const d=new Date(t);return d.getHours()+":"+String(d.getMinutes()).padStart(2,"0")};
const esc=s=>String(s??"").replace(/&/g,"&amp;").replace(/</g,"&lt;");
const post=async(url,body)=>{try{const r=await fetch(url,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body||{})});return await r.json()}catch(e){return{ok:false,err:"net"}}};

/* the account line under the message box, and the Profil section */
function ui(){
 $("#cacct").innerHTML=me?`Pišeš kao <b class="nt u${me.color}">${esc(me.name)}</b> · <button type="button" class="lnk" id="cedit">izmeni</button>`:`<button type="button" class="lnk" id="clogin">Prijavi se da pišeš</button>`;
 $("#pacctBody").innerHTML=me?`<p><b class="nt">${esc(me.name)}</b><span class="m"> · ${esc(me.email||"")}${me.google?" · Google":""}</span></p><div class="abtns"><button type="button" class="b light" id="pedit">Izmeni ime i boju</button><button type="button" class="b light" id="pout">Odjavi se</button></div>`:`<p class="m">Nisi prijavljen. Nalog ti treba samo za pisanje u razgovoru.</p><div class="abtns"><button type="button" class="b dark" id="plogin">Prijavi se ili napravi nalog</button></div>`;
 cin.placeholder=me?"Napiši poruku":"Prijavi se da pišeš";
 apply($("#cacct"));apply($("#pacctBody"));
 box.querySelectorAll(".msg").forEach(m=>{const mine=!!me&&m.querySelector("b").textContent===me.name;m.classList.toggle("me",mine);if(mine)m.querySelector(".flag")?.remove()});
}
document.addEventListener("click",e=>{const id=e.target.closest("button")?.id;
 if(id==="clogin"||id==="plogin")openAuth();else if(id==="cedit"||id==="pedit")openProfile();
 else if(id==="pout")post("/api/auth/logout").then(()=>{me=null;ui();reconnect()})});

const empty=()=>{if(!box.children.length){box.innerHTML='<p class="m empty">Ovde se pojavljuju poruke od trenutka kad si došao.</p>';apply(box)}};
const add=m=>{if(ids.has(m.id))return;ids.add(m.id);box.querySelector(".empty")?.remove();
 const stick=pane.scrollHeight-pane.scrollTop-pane.clientHeight<90,mine=!!me&&m.n===me.name;
 const d=document.createElement("div");d.className="msg"+(mine?" me":"");d.dataset.id=m.id;
 d.innerHTML='<span class="tm nt"></span> <b class="nt u'+(m.c!=null?m.c:ucol(m.n))+'"></b><span class="nt">: </span><span class="x nt"></span>'+(mine?"":'<button class="flag" type="button" aria-pressed="false">Prijavi</button>');
 const t=d.querySelectorAll(".nt");t[0].textContent=hhmm(m.at);t[1].textContent=m.n;t[3].textContent=m.x;apply(d);box.append(d);
 while(box.children.length>200)box.firstElementChild.remove();
 if(stick)pane.scrollTop=pane.scrollHeight};
const viewers=n=>{const c=$("#viewers");$("#vn").textContent=Number(n).toLocaleString("sr-RS");c.style.visibility="visible"};
const send=o=>{if(ws&&ws.readyState===1){ws.send(JSON.stringify(o));return true}return false};
function connect(){
 ws=new WebSocket((location.protocol==="https:"?"wss://":"ws://")+location.host+"/api/chat");
 ws.onopen=()=>{backoff=1000;say(cst,"");clearInterval(ping);ping=setInterval(()=>{try{ws.send("ping")}catch(e){}},45000)};
 ws.onmessage=e=>{if(e.data==="pong")return;let d;try{d=JSON.parse(e.data)}catch(x){return}
  if(d.t==="init"){d.msgs.forEach(add);empty();viewers(d.v)}
  else if(d.t==="m")add(d.m);
  else if(d.t==="v")viewers(d.n);
  else if(d.t==="del")d.ids.forEach(i=>{box.querySelector('[data-id="'+i+'"]')?.remove();ids.delete(i)});
  else if(d.t==="err"){if(d.code==="login"){openAuth();return}say(cst,d.code);if(last&&!cin.value)cin.value=last}};
 ws.onclose=e=>{clearInterval(ping);if(ws!==e.target)return;say(cst,"off");setTimeout(connect,backoff);backoff=Math.min(backoff*2,30000)}}
/* after signing in or out the chat connection is reopened so the server knows who is writing (messages on screen stay) */
function reconnect(){const old=ws;ws=null;try{old&&old.close()}catch(e){}connect()}

$("#cbox").addEventListener("submit",e=>{e.preventDefault();if(!me){openAuth();return}const x=cin.value.trim();if(!x)return;last=x;if(send({t:"msg",x})){cin.value="";say(cst,"")}else say(cst,"wait")});
cin.addEventListener("focus",()=>{if(!me)openAuth()});
pane.addEventListener("click",e=>{const f=e.target.closest(".flag");if(!f||f.disabled)return;const id=+f.closest(".msg").dataset.id;if(send({t:"report",id})){f.setAttribute("aria-pressed","true");f.disabled=true;f.textContent="Prijavljeno";apply(f)}});

/* sign-in dialog */
const step=s=>{dlg.querySelector('[data-step="start"]').hidden=s!=="start";dlg.querySelector('[data-step="profile"]').hidden=s!=="profile";say(aErr,"")};
const show=()=>{if(!dlg.open){if(dlg.showModal)dlg.showModal();else dlg.setAttribute("open","")}apply(dlg)};
const close=()=>{dlg.close?dlg.close():dlg.removeAttribute("open");ticket=null;pendPw=null};
$("#authX").onclick=close;
dlg.addEventListener("click",e=>{if(e.target===dlg)close()});
function signedIn(u){me=u;close();ui();reconnect()}
function openAuth(){if(me)return;step("start");show();loadGsi()}
function loadGsi(){if(gsiReady||!clientId)return;gsiReady=true;const s=document.createElement("script");s.src="https://accounts.google.com/gsi/client";s.async=true;
 s.onload=()=>{google.accounts.id.initialize({client_id:clientId,callback:async r=>{const j=await post("/api/auth/google",{credential:r.credential});
   if(!j.ok){say(aErr,j.err||"google");return}if(j.user){signedIn(j.user);return}ticket=j.ticket;pendPw=null;openProfile(j.suggest||"")}});
  google.accounts.id.renderButton($("#gsi"),{theme:"outline",size:"large",shape:"pill",text:"continue_with",width:Math.min(320,$("#gsi").clientWidth||320)})};
 document.head.appendChild(s)}
function setColor(c){color=c;dlg.querySelectorAll(".sw").forEach(b=>b.setAttribute("aria-pressed",+b.dataset.c===c));$("#aPrev").className="nt u"+c}
function openProfile(suggest){const edit=!!me&&!ticket&&!pendPw;
 $("#aName").value=edit?me.name:(suggest||"");setColor(edit?me.color:Math.floor(Math.random()*8));$("#aPrev").textContent=$("#aName").value||"Ime";
 $("#authT2").textContent=edit?"Ime i boja":"Tvoje ime u razgovoru";$("#aSave").textContent=edit?"Sačuvaj":"Napravi nalog";
 step("profile");show();$("#aName").focus()}
dlg.querySelector(".sws").addEventListener("click",e=>{const b=e.target.closest(".sw");if(b)setColor(+b.dataset.c)});
$("#aName").addEventListener("input",()=>{$("#aPrev").textContent=$("#aName").value||"Ime"});
$("#authPw").addEventListener("submit",async e=>{e.preventDefault();const act=e.submitter?.dataset.act||"login",email=$("#aEmail").value.trim(),password=$("#aPw").value;
 if(act==="signup"){if(password.length<8){say(aErr,"password");return}pendPw={email,password};ticket=null;openProfile(email.split("@")[0].slice(0,20));return}
 const j=await post("/api/auth/login",{email,password});if(j.ok)signedIn(j.user);else say(aErr,j.err)});
$("#authProf").addEventListener("submit",async e=>{e.preventDefault();const name=$("#aName").value.trim();
 const j=ticket?await post("/api/auth/register",{ticket,name,color}):pendPw?await post("/api/auth/register",{...pendPw,name,color}):await post("/api/auth/profile",{name,color});
 if(!j.ok){say(aErr,j.err);if(j.err==="email_taken"){step("start")}return}signedIn(j.user)});

const rd=$("#rulesDlg");$$('a[href="#pravila"]').forEach(a=>a.addEventListener("click",e=>{e.preventDefault();if(rd.showModal)rd.showModal();else rd.setAttribute("open","")}));
$("#rulesClose").onclick=()=>rd.close?rd.close():rd.removeAttribute("open");
fetch("/api/auth/me",{cache:"no-store"}).then(r=>r.json()).then(j=>{me=j.user;clientId=j.clientId}).catch(()=>{}).finally(()=>{ui();connect()});
}
