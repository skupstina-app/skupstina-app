/* chat: everyone can read (from the moment they open the page, no history); writing needs an account.
   Accounts: Sign in with Google, or email + password; a new account picks a chat name and a name colour. */
{
const box=$("#msgs"),pane=$("#p-chat"),cin=$("#cin"),cst=$("#cst"),dlg=$("#authDlg"),aErr=$("#aErr");
let ws=null,me=null,backoff=1000,last="",ids=new Set(),ping=0,ticket=null,pendPw=null,color=0,clientId=null,gsiReady=false;
const ERR={login:"Prijavi se da pišeš.",name_len:"Ime mora imati od 2 do 20 znakova.",name_chars:"Ime može imati slova, brojeve, razmak, tačku i crtice.",name_bad:"To ime nije dozvoljeno.",name_taken:"To ime je zauzeto. Izaberi drugo.",name_wait:"Ime možeš da menjaš jednom u 30 dana.",banned:"Privremeno ne možeš da pišeš.",long:"Poruka je duža od 300 znakova.",fast:"Polako, sačekaj par sekundi.",dup:"Ista poruka je već poslata.",bad:"Poruka ima uvredljive reči i nije poslata.",link:"Linkovi i imejlovi nisu dozvoljeni.",phone:"Brojevi telefona nisu dozvoljeni.",off:"Veza je prekinuta, povezujem ponovo…",wait:"Povezujem…",saved:"Sačuvano.",
 email:"Proveri email adresu.",password:"Lozinka mora imati bar 8 znakova.",wrong:"Pogrešan email ili lozinka.",use_google:"Ovaj nalog koristi prijavu preko Google-a.",email_taken:"Nalog sa tim emailom već postoji. Prijavi se.",slow:"Previše pokušaja. Probaj ponovo kasnije.",ticket:"Isteklo je vreme. Prijavi se ponovo.",google:"Google prijava nije uspela.",net:"Nema veze. Pokušaj ponovo."};
const say=(el,k)=>{el.textContent=k?(ERR[k]||k):"";apply(el)};
const ucol=n=>{let h=5381;for(const c of n.toLocaleLowerCase("sr"))h=(h*33+c.codePointAt(0))>>>0;return h%8};
const dmy=t=>{const d=new Date(t);return d.getDate()+". "+(d.getMonth()+1)+". "+d.getFullYear()+"."};
const hhmm=t=>{const d=new Date(t);return d.getHours()+":"+String(d.getMinutes()).padStart(2,"0")};
const esc=s=>String(s??"").replace(/&/g,"&amp;").replace(/</g,"&lt;");
const I_EDIT=`<svg class="mi" viewBox="0 0 13 13" aria-hidden="true" shape-rendering="crispEdges" fill="currentColor"><rect x="10" y="1" width="2" height="1"/><rect x="9" y="2" width="4" height="1"/><rect x="8" y="3" width="4" height="1"/><rect x="7" y="4" width="4" height="1"/><rect x="6" y="5" width="4" height="1"/><rect x="5" y="6" width="4" height="1"/><rect x="4" y="7" width="4" height="1"/><rect x="3" y="8" width="4" height="1"/><rect x="2" y="9" width="4" height="1"/><rect x="2" y="10" width="3" height="1"/><rect x="2" y="11" width="2" height="1"/></svg>`;
/* avatars: ids come from the files in assets/avatars/64 (build.mjs fills these in); no avatar = the empty tile */
const AVS=/*@avatars*/[],AV_SOON=/*@soon*/[];
const AVN={cupic:"Bradonja s naočarima",konj:"Konj",poslanik_brkovi:"Poslanik s brkovima",poslanik_mahanje:"Poslanik maše"};
const avSrc=a=>"/a/"+(a&&AVS.includes(a)?a:"uskoro-prazno")+".png";
const post=async(url,body)=>{try{const r=await fetch(url,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body||{})});return await r.json()}catch(e){return{ok:false,err:"net"}}};

/* the account line under the message box, and the Profil section */
function ui(){
 $("#pacctBody").innerHTML=me
  ?`<div class="acard"><button type="button" class="avbtn" id="pav" aria-label="Promeni avatar" title="Promeni avatar"><img class="av" src="${avSrc(me.avatar)}" alt="" width="64" height="64"><span class="avpen">${I_EDIT}</span></button><div class="aname"><b class="nt u${me.color}">${esc(me.name)}</b><span class="m nt">${esc(me.email||"")}</span></div><button type="button" class="b light aedit" id="pedit">${I_EDIT}<span>Izmeni</span></button></div>`
  :`<div class="acard"><img class="av" src="${avSrc()}" alt="" width="64" height="64"><div class="aname"><b>Gost</b><span class="m">Prijavi se da pišeš u razgovoru.</span></div></div><button type="button" class="b dark" id="plogin">Napravi nalog ili se prijavi</button>`;
 $("#poutRow").hidden=!me;
 $("#cjoin").hidden=!!me;$("#cbox").hidden=!me;$(".cme").hidden=!me;
 if(!me)preloadGsi();
 apply($("#pacctBody"));
 box.querySelectorAll(".msg").forEach(m=>{const mine=!!me&&+m.dataset.u===me.id;m.classList.toggle("me",mine);if(mine)m.querySelector(".flag")?.remove()});
}
document.addEventListener("click",e=>{const id=e.target.closest("button")?.id;
 if(id==="cjoin"||id==="plogin")openAuth("in");else if(id==="aEmailT"){$("#authPw").hidden=false;e.target.hidden=true;$("#aEmail").focus()}else if(id==="pedit")openProfile();else if(id==="pav")openAvatars();
 else if(id==="pout")post("/api/auth/logout").then(()=>{me=null;ui();reconnect()})});

const empty=()=>{};
const add=m=>{if(ids.has(m.id))return;ids.add(m.id);box.querySelector(".empty")?.remove();
 const stick=pane.scrollHeight-pane.scrollTop-pane.clientHeight<90,mine=!!me&&m.u!=null&&m.u===me.id;
 const d=document.createElement("div");d.className="msg"+(mine?" me":"");d.dataset.id=m.id;if(m.u!=null)d.dataset.u=m.u;
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
pane.addEventListener("click",e=>{const f=e.target.closest(".flag");if(!f||f.disabled)return;const id=+f.closest(".msg").dataset.id;if(send({t:"report",id})){f.setAttribute("aria-pressed","true");f.disabled=true;f.textContent="Prijavljeno";apply(f)}});

/* sign-in dialog */
const step=s=>{dlg.querySelectorAll("[data-step]").forEach(e=>e.hidden=e.dataset.step!==s);say(aErr,"")};
const show=()=>{if(!dlg.open){if(dlg.showModal)dlg.showModal();else dlg.setAttribute("open","")}apply(dlg)};
const close=()=>{dlg.close?dlg.close():dlg.removeAttribute("open");ticket=null;pendPw=null};
$("#authX").onclick=close;
dlg.addEventListener("click",e=>{if(e.target===dlg)close()});
function signedIn(u){me=u;close();ui();reconnect()}
let amode="in";
function setMode(m){amode=m;dlg.querySelectorAll(".aseg [data-am]").forEach(b=>b.setAttribute("aria-pressed",b.dataset.am===m));$("#aPwGo").textContent=m==="in"?"Uloguj se":"Dalje";$("#aPw").autocomplete=m==="in"?"current-password":"new-password";say(aErr,"");apply(dlg)}
dlg.querySelector(".aseg").addEventListener("click",e=>{const b=e.target.closest("[data-am]");if(b)setMode(b.dataset.am)});
function openAuth(mode){if(me)return;setMode(mode||"in");step("start");$("#authPw").hidden=true;$("#aEmailT").hidden=false;show();loadGsi()}
/* the Google button should be ready the moment someone taps "Napravi nalog": load Google's script once the chat is on screen */
let pre=false;function preloadGsi(){if(pre)return;pre=true;new IntersectionObserver((e,o)=>{if(e[0].isIntersecting){o.disconnect();loadGsi()}}).observe($("#compose"))}
/* Google: our own button opens Google's sign-in popup; the server checks the token with Google */
let gClient=null;
function loadGsi(){if(gsiReady||!clientId)return;gsiReady=true;const s=document.createElement("script");s.src="https://accounts.google.com/gsi/client";s.async=true;
 s.onload=()=>{gClient=google.accounts.oauth2.initTokenClient({client_id:clientId,scope:"openid email profile",callback:async r=>{
   if(!r||!r.access_token){say(aErr,"google");return}const j=await post("/api/auth/google",{access_token:r.access_token});
   if(!j.ok){say(aErr,j.err||"google");return}if(j.user){signedIn(j.user);return}ticket=j.ticket;pendPw=null;openProfile(j.suggest||"")}})};
 document.head.appendChild(s)}
$("#aGoogle").onclick=()=>{say(aErr,"");if(gClient)gClient.requestAccessToken({prompt:"select_account"});else{loadGsi();say(aErr,"wait")}};
function setColor(c){color=c;dlg.querySelectorAll(".sw").forEach(b=>b.setAttribute("aria-pressed",+b.dataset.c===c));$("#aPrev").className="nt u"+c}
function openProfile(suggest){const edit=!!me&&!ticket&&!pendPw;
 $("#aName").value=edit?me.name:(suggest||"");
 const lock=edit&&!!me.nameNext;$("#aName").disabled=lock;$("#aNameNote").hidden=edit&&!lock;$("#aNameNote").textContent=lock?`Ime možeš ponovo da promeniš ${dmy(me.nameNext)}`:"Ime kasnije možeš da menjaš jednom u 30 dana.";setColor(edit?me.color:Math.floor(Math.random()*8));$("#aPrev").textContent=$("#aName").value||"Ime";
 $("#authT2").textContent=edit?(lock?"Boja imena":"Ime i boja"):"Tvoje ime u razgovoru";$("#aSave").textContent=edit?"Sačuvaj":"Napravi nalog";
 step("profile");show();$("#aName").focus()}
dlg.querySelector(".sws").addEventListener("click",e=>{const b=e.target.closest(".sw");if(b)setColor(+b.dataset.c)});
$("#aName").addEventListener("input",()=>{$("#aPrev").textContent=$("#aName").value||"Ime"});
$("#authPw").addEventListener("submit",async e=>{e.preventDefault();const act=amode==="up"?"signup":"login",email=$("#aEmail").value.trim(),password=$("#aPw").value;
 if(act==="signup"){if(password.length<8){say(aErr,"password");return}pendPw={email,password};ticket=null;openProfile(email.split("@")[0].slice(0,20));return}
 const j=await post("/api/auth/login",{email,password});if(j.ok)signedIn(j.user);else say(aErr,j.err)});
/* a new name asks first: the next change is 30 days away */
async function saveProfile(){const name=$("#aName").value.trim();
 const j=ticket?await post("/api/auth/register",{ticket,name,color}):pendPw?await post("/api/auth/register",{...pendPw,name,color}):await post("/api/auth/profile",{name,color});
 if(!j.ok){step(j.err==="email_taken"?"start":"profile");say(aErr,j.err);return}signedIn(j.user)}
$("#authProf").addEventListener("submit",e=>{e.preventDefault();const name=$("#aName").value.trim();
 if(me&&!ticket&&!pendPw&&name!==me.name){$("#cNew").textContent=name;$("#cNew").className="nt u"+color;$("#cDate").textContent=dmy(Date.now()+30*86400000);step("confirm");apply(dlg);$("#cOk").focus();return}
 saveProfile()});
$("#cBack").onclick=()=>{step("profile");$("#aName").focus()};
$("#cOk").onclick=saveProfile;

/* avatar picker: tap a picture and it is saved; the ones still coming are shown, but can't be picked */
const adl=$("#avDlg"),avErr=$("#avErr"),avGrid=$("#avGrid");
function avPaint(){const cur=me&&me.avatar;$("#avBig").src=avSrc(cur);
 avGrid.querySelectorAll("[data-av]").forEach(b=>b.setAttribute("aria-checked",b.dataset.av===cur))}
function openAvatars(){if(!me)return;
 avGrid.innerHTML=AVS.map(a=>`<button type="button" class="avt" role="radio" data-av="${a}" aria-checked="false" aria-label="${esc(AVN[a]||a)}"><img src="${avSrc(a)}" alt="" width="64" height="64" loading="lazy"></button>`).join("")
  +AV_SOON.map(n=>`<button type="button" class="avt soon" aria-disabled="true" aria-label="Uskoro"><img src="/a/uskoro-${n}.png" alt="" width="64" height="64" loading="lazy"><span class="px">uskoro</span></button>`).join("");
 $("#avName").textContent=me.name;$("#avName").className="nt u"+me.color;say(avErr,"");avPaint();
 if(adl.showModal)adl.showModal();else adl.setAttribute("open","");apply(adl)}
const avClose=()=>adl.close?adl.close():adl.removeAttribute("open");
$("#avX").onclick=$("#avOk").onclick=avClose;
adl.addEventListener("click",e=>{if(e.target===adl)avClose()});
avGrid.addEventListener("click",async e=>{const b=e.target.closest(".avt");if(!b||!me)return;
 if(b.classList.contains("soon")){say(avErr,"Ovaj avatar stiže uskoro.");return}
 const a=b.dataset.av,prev=me.avatar;if(a===prev)return;
 me={...me,avatar:a};avPaint();say(avErr,"");b.classList.remove("avpop");void b.offsetWidth;b.classList.add("avpop");$("#avBig").classList.remove("avpop");void $("#avBig").offsetWidth;$("#avBig").classList.add("avpop");
 const j=await post("/api/auth/avatar",{avatar:a});
 if(j.ok&&j.user){me=j.user;ui()}else{me={...me,avatar:prev};avPaint();say(avErr,j.err==="login"?"login":"Nije sačuvano. Pokušaj ponovo.")}});

const rd=$("#rulesDlg");$$('a[href="#pravila"]').forEach(a=>a.addEventListener("click",e=>{e.preventDefault();if(rd.showModal)rd.showModal();else rd.setAttribute("open","")}));
$("#rulesClose").onclick=()=>rd.close?rd.close():rd.removeAttribute("open");
fetch("/api/auth/me",{cache:"no-store"}).then(r=>r.json()).then(j=>{me=j.user;clientId=j.clientId}).catch(()=>{}).finally(()=>{ui();connect()});
}
