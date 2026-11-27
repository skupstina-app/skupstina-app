/* chat: everyone can read (from the moment they open the page, no history); writing needs an account.
   Accounts: Sign in with Google, or email + password; a new account picks a chat name and a name colour. */
{
const box=$("#msgs"),pane=$("#p-chat"),cin=$("#cin"),cst=$("#cst"),dlg=$("#authDlg"),aErr=$("#aErr");
let ws=null,me=null,blocks=[],blocked=new Set(),backoff=1000,last="",ids=new Set(),ping=0,ticket=null,pendPw=null,color=0,clientId=null,gsiReady=false;
const ERR={login:"Prijavi se da pišeš.",name_len:"Ime mora imati od 2 do 20 znakova.",name_chars:"Ime može imati slova, brojeve, razmak, tačku i crtice.",name_bad:"To ime nije dozvoljeno.",name_taken:"To ime je zauzeto. Izaberi drugo.",name_wait:"Ime možeš da menjaš jednom u 30 dana.",banned:"Privremeno ne možeš da pišeš.",long:"Poruka je duža od 300 znakova.",fast:"Polako, sačekaj par sekundi.",dup:"Ista poruka je već poslata.",bad:"Poruka ima uvredljive reči i nije poslata.",link:"Linkovi i imejlovi nisu dozvoljeni.",phone:"Brojevi telefona nisu dozvoljeni.",off:"Veza je prekinuta, povezujem ponovo…",wait:"Povezujem…",saved:"Sačuvano.",
 email:"Proveri email adresu.",password:"Lozinka mora imati bar 8 znakova.",wrong:"Pogrešan email ili lozinka.",use_google:"Ovaj nalog koristi prijavu preko Google-a.",email_taken:"Nalog sa tim emailom već postoji. Prijavi se.",slow:"Previše pokušaja. Probaj ponovo kasnije.",ticket:"Isteklo je vreme. Prijavi se ponovo.",google:"Google prijava nije uspela.",popup:"Pregledač je blokirao Google prozor. Dozvoli iskačuće prozore za skupstina.app i probaj ponovo.",net:"Nema veze. Pokušaj ponovo."};
const say=(el,k)=>{el.textContent=k?(ERR[k]||k):"";apply(el)};
const ucol=n=>{let h=5381;for(const c of n.toLocaleLowerCase("sr"))h=(h*33+c.codePointAt(0))>>>0;return h%8};
const dmy=t=>{const d=new Date(t);return d.getDate()+". "+(d.getMonth()+1)+". "+d.getFullYear()+"."};
const hhmm=t=>{const d=new Date(t);return d.getHours()+":"+String(d.getMinutes()).padStart(2,"0")};
const esc=s=>String(s??"").replace(/&/g,"&amp;").replace(/</g,"&lt;");
const I_EDIT=`<svg class="mi" viewBox="0 0 13 13" aria-hidden="true" shape-rendering="crispEdges" fill="currentColor"><rect x="10" y="1" width="2" height="1"/><rect x="9" y="2" width="4" height="1"/><rect x="8" y="3" width="4" height="1"/><rect x="7" y="4" width="4" height="1"/><rect x="6" y="5" width="4" height="1"/><rect x="5" y="6" width="4" height="1"/><rect x="4" y="7" width="4" height="1"/><rect x="3" y="8" width="4" height="1"/><rect x="2" y="9" width="4" height="1"/><rect x="2" y="10" width="3" height="1"/><rect x="2" y="11" width="2" height="1"/></svg>`;
/* avatars: ids come from the files in assets/avatars/64 (build.mjs fills these in); no avatar = the empty tile */
const AVS=/*@avatars*/[],AV_SOON=/*@soon*/[];
const AVN={cupic:"Bradonja s naočarima",konj:"Konj",poslanik_brkovi:"Poslanik s brkovima",poslanik_mahanje:"Poslanik maše"};
const I_CLOCK=`<svg class="mi" viewBox="0 0 13 13" aria-hidden="true" shape-rendering="crispEdges" fill="currentColor"><rect x="4" y="1" width="5" height="1"/><rect x="3" y="2" width="1" height="1"/><rect x="9" y="2" width="1" height="1"/><rect x="2" y="3" width="1" height="1"/><rect x="6" y="3" width="1" height="1"/><rect x="10" y="3" width="1" height="1"/><rect x="1" y="4" width="1" height="1"/><rect x="6" y="4" width="1" height="1"/><rect x="11" y="4" width="1" height="1"/><rect x="1" y="5" width="1" height="1"/><rect x="6" y="5" width="1" height="1"/><rect x="11" y="5" width="1" height="1"/><rect x="1" y="6" width="1" height="1"/><rect x="6" y="6" width="4" height="1"/><rect x="11" y="6" width="1" height="1"/><rect x="1" y="7" width="1" height="1"/><rect x="11" y="7" width="1" height="1"/><rect x="1" y="8" width="1" height="1"/><rect x="11" y="8" width="1" height="1"/><rect x="2" y="9" width="1" height="1"/><rect x="10" y="9" width="1" height="1"/><rect x="3" y="10" width="1" height="1"/><rect x="9" y="10" width="1" height="1"/><rect x="4" y="11" width="5" height="1"/></svg>`,I_BLOCK=`<svg class="mi" viewBox="0 0 13 13" aria-hidden="true" shape-rendering="crispEdges" fill="currentColor"><rect x="4" y="1" width="5" height="1"/><rect x="3" y="2" width="1" height="1"/><rect x="9" y="2" width="1" height="1"/><rect x="2" y="3" width="1" height="1"/><rect x="9" y="3" width="2" height="1"/><rect x="1" y="4" width="1" height="1"/><rect x="8" y="4" width="2" height="1"/><rect x="11" y="4" width="1" height="1"/><rect x="1" y="5" width="1" height="1"/><rect x="7" y="5" width="2" height="1"/><rect x="11" y="5" width="1" height="1"/><rect x="1" y="6" width="1" height="1"/><rect x="6" y="6" width="2" height="1"/><rect x="11" y="6" width="1" height="1"/><rect x="1" y="7" width="1" height="1"/><rect x="5" y="7" width="2" height="1"/><rect x="11" y="7" width="1" height="1"/><rect x="1" y="8" width="1" height="1"/><rect x="4" y="8" width="2" height="1"/><rect x="11" y="8" width="1" height="1"/><rect x="2" y="9" width="3" height="1"/><rect x="10" y="9" width="1" height="1"/><rect x="3" y="10" width="1" height="1"/><rect x="9" y="10" width="1" height="1"/><rect x="4" y="11" width="5" height="1"/></svg>`;
/* name colours and which ones this account has opened: from src/colors.mjs (build.mjs pastes it here) */
/*@colors*/
const avSrc=a=>"/a/"+(a&&AVS.includes(a)?a:"uskoro-prazno")+".png";
const post=async(url,body)=>{try{const r=await fetch(url,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body||{})});return await r.json()}catch(e){return{ok:false,err:"net"}}};

/* the account line under the message box, and the Profil section */
function ui(){
 $("#pacctBody").innerHTML=me
  ?`<div class="acard"><button type="button" class="avbtn" id="pav" aria-label="Promeni avatar" title="Promeni avatar"><img class="av" src="${avSrc(me.avatar)}" alt="" width="64" height="64"><span class="avpen">${I_EDIT}</span></button><div class="aname"><span class="anrow"><button type="button" class="lvb" id="pLvl" aria-label="Sati gledanja" aria-expanded="false">${lvlIcon()}</button><button type="button" class="nbtn nt u${me.color}" id="pcol" aria-label="Boja imena: ${esc(me.name)}" aria-haspopup="dialog">${esc(me.name)}</button><span class="lvbub px" id="pLvlB" role="status" hidden></span></span><span class="m nt">${esc(me.email||"")}</span></div><button type="button" class="b light aedit" id="pedit">${I_EDIT}<span>Izmeni</span></button></div>`
  :`<div class="acard"><img class="av" src="${avSrc()}" alt="" width="64" height="64"><div class="aname"><b>Gost</b><span class="m">Prijavi se da pišeš u razgovoru.</span></div></div><button type="button" class="b dark" id="plogin">Napravi nalog ili se prijavi</button>`;
 $("#poutRow").hidden=!me;$("#pblkRow").hidden=!me;$("#pblkN").textContent=blocks.length||"";
 $("#cjoin").hidden=!!me;$("#cbox").hidden=!me;$(".cme").hidden=!me;
 if(!me)preloadGsi();
 apply($("#pacctBody"));
 box.querySelectorAll(".msg").forEach(m=>{const mine=!!me&&+m.dataset.u===me.id;m.classList.toggle("me",mine);if(mine)m.querySelector(".flag")?.remove()});
}
document.addEventListener("click",e=>{const id=e.target.closest("button")?.id;
 if(id==="cjoin"||id==="plogin")openAuth("in");else if(id==="aEmailT"){$("#authPw").hidden=false;e.target.hidden=true;$("#aEmail").focus()}else if(id==="pedit")openProfile();else if(id==="pav")openAvatars();else if(id==="pcol")openColors();else if(id==="pblk")openBlocks();else if(id==="pdel")openDel();
 else if(id==="pout"){wSend();post("/api/auth/logout").then(()=>{me=null;setBlocks([]);admSet(null);ui();reconnect()})}});

const empty=()=>{};
const add=m=>{if(ids.has(m.id))return;ids.add(m.id);if(m.u!=null&&blocked.has(m.u))return;box.querySelector(".empty")?.remove();
 const stick=pane.scrollHeight-pane.scrollTop-pane.clientHeight<90,mine=!!me&&m.u!=null&&m.u===me.id;
 const d=document.createElement("div");d.className="msg"+(mine?" me":"");d.dataset.id=m.id;if(m.u!=null)d.dataset.u=m.u;
 d.innerHTML='<span class="tm nt"></span> '+badgeSvg(m.b)+(m.cr?crownSvg():m.md?modSvg():"")+'<b class="nt u'+(m.c!=null?m.c:ucol(m.n))+(m.u!=null?' un" role="button" tabindex="0" aria-haspopup="dialog':'')+'"></b><span class="nt">: </span><span class="x nt"></span>'+(mine?"":'<button class="flag" type="button" aria-pressed="false">Prijavi</button>');
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
function signedIn(u){me=u;close();ui();reconnect();fetch("/api/auth/me",{cache:"no-store"}).then(r=>r.json()).then(j=>{if(j.user)setBlocks(j.blocks||[]);admSet(j.admin)}).catch(()=>{})}
let amode="in";
function setMode(m){amode=m;dlg.querySelectorAll(".aseg [data-am]").forEach(b=>b.setAttribute("aria-pressed",b.dataset.am===m));$("#aPwGo").textContent=m==="in"?"Uloguj se":"Dalje";$("#aPw").autocomplete=m==="in"?"current-password":"new-password";say(aErr,"");apply(dlg)}
dlg.querySelector(".aseg").addEventListener("click",e=>{const b=e.target.closest("[data-am]");if(b)setMode(b.dataset.am)});
function openAuth(mode){if(me)return;setMode(mode||"in");step("start");$("#authPw").hidden=true;$("#aEmailT").hidden=false;show();loadGsi()}
/* the Google button should be ready the moment someone taps "Napravi nalog": load Google's script once the chat is on screen */
let pre=false;function preloadGsi(){if(pre)return;pre=true;new IntersectionObserver((e,o)=>{if(e[0].isIntersecting){o.disconnect();loadGsi()}}).observe($("#compose"))}
/* Google: our own button opens Google's sign-in popup; the server checks the token with Google */
let gClient=null;
/* the popup can fail without a word (popups blocked, in-app browsers, home-screen app): error_callback says so;
   a script that doesn't load (no network, a blocker) can be tried again with the next tap */
let gWant=false;
function loadGsi(){if(gsiReady||!clientId)return;gsiReady=true;const s=document.createElement("script");s.src="https://accounts.google.com/gsi/client";s.async=true;
 s.onerror=()=>{gsiReady=false;s.remove();if(gWant){gWant=false;say(aErr,"net")}};
 s.onload=()=>{if(gWant){gWant=false;say(aErr,"")}gClient=google.accounts.oauth2.initTokenClient({client_id:clientId,scope:"openid email profile",
  error_callback:e=>{const t=e&&e.type;if(t==="popup_closed")return;say(aErr,t==="popup_failed_to_open"?"popup":"google")},
  callback:async r=>{
   if(!r||!r.access_token){say(aErr,"google");return}const j=await post("/api/auth/google",{access_token:r.access_token});
   if(!j.ok){say(aErr,j.err||"google");return}if(j.user){signedIn(j.user);return}ticket=j.ticket;pendPw=null;openProfile(j.suggest||"")}})};
 document.head.appendChild(s)}
$("#aGoogle").onclick=()=>{say(aErr,"");if(gClient){gClient.requestAccessToken({prompt:"select_account"});return}if(!clientId){say(aErr,"google");return}gWant=true;loadGsi();say(aErr,"wait")};
function setColor(c){color=c;$("#aPrev").className="nt u"+c}
function openProfile(suggest){const edit=!!me&&!ticket&&!pendPw;
 $("#aName").value=edit?me.name:(suggest||"");
 const lock=edit&&!!me.nameNext;$("#aName").disabled=lock;$("#aNameNote").hidden=edit&&!lock;$("#aNameNote").textContent=lock?`Ime možeš ponovo da promeniš ${dmy(me.nameNext)}`:"Prva 24 sata ime možeš slobodno da menjaš, posle toga jednom u 30 dana.";setColor(edit?me.color:COLOR_FREE[Math.floor(Math.random()*COLOR_FREE.length)]);$("#aPrev").textContent=$("#aName").value||"Ime";
 $("#authT2").textContent=edit?"Ime":"Tvoje ime u razgovoru";$("#aSave").textContent=edit?"Sačuvaj":"Napravi nalog";
 step("profile");show();$("#aName").focus()}
$("#aName").addEventListener("input",()=>{$("#aPrev").textContent=$("#aName").value||"Ime"});
$("#authPw").addEventListener("submit",async e=>{e.preventDefault();const act=amode==="up"?"signup":"login",email=$("#aEmail").value.trim(),password=$("#aPw").value;
 if(act==="signup"){if(password.length<8){say(aErr,"password");return}pendPw={email,password};ticket=null;openProfile(email.split("@")[0].slice(0,20));return}
 const j=await post("/api/auth/login",{email,password});if(j.ok)signedIn(j.user);else say(aErr,j.err)});
/* a new name asks first: the next change is 30 days away */
async function saveProfile(){const name=$("#aName").value.trim();
 const j=ticket?await post("/api/auth/register",{ticket,name,color}):pendPw?await post("/api/auth/register",{...pendPw,name,color}):await post("/api/auth/profile",{name});
 if(!j.ok){step(j.err==="email_taken"?"start":"profile");say(aErr,j.err);return}signedIn(j.user)}
$("#authProf").addEventListener("submit",e=>{e.preventDefault();const name=$("#aName").value.trim();
 if(me&&!ticket&&!pendPw&&name!==me.name){$("#cNew").textContent=name;$("#cNew").className="nt u"+color;const free=me.nameFree>Date.now();$("#cNote").textContent=free?`Još ${Math.max(1,Math.ceil((me.nameFree-Date.now())/3600000))} h ime možeš slobodno da menjaš, posle toga jednom u 30 dana.`:`Sledeća promena biće moguća za 30 dana, tek ${dmy(Date.now()+30*86400000)}`;step("confirm");apply(dlg);$("#cOk").focus();return}
 saveProfile()});
$("#cBack").onclick=()=>{step("profile");$("#aName").focus()};
$("#cOk").onclick=saveProfile;

/* blocking: the list comes with /api/auth/me; a blocked account's messages are not shown (only for this viewer) */
function setBlocks(list){blocks=list;blocked=new Set(list.map(b=>b.id));blocked.forEach(id=>box.querySelectorAll('.msg[data-u="'+id+'"]').forEach(e=>e.remove()));$("#pblkN").textContent=blocks.length||""}
async function setBlock(id,on){const j=await post("/api/auth/block",{id,on});if(!j.ok)return false;setBlocks(j.blocks||[]);return true}

/* tap a name in the chat: a small card with the avatar, the name, how long they have watched (only a clock and the
   hours, no words) and Blokiraj / Odblokiraj; never the email */
const up=$("#upop"),ucache=new Map();let upFor=null,upEl=null;
const hrs=s=>s<3600?"<1h":Math.floor(s/3600).toLocaleString("sr-RS")+"h";
function upRender(c){const mine=!!me&&c.id===me.id,bl=blocked.has(c.id);
 up.innerHTML=`<div class="uph"><img class="av" src="${avSrc(c.avatar)}" alt="" width="64" height="64"><div class="upn"><b class="nt u${c.color}">${esc(c.name)}</b>${c.watch!=null?`<span class="uw" aria-label="Gledanje prenosa: ${hrs(c.watch)}">${I_CLOCK}<span class="px nt">${hrs(c.watch)}</span>${badgeSvg(badgeLvl(c.watch))}</span>`:`<span class="uw ld" aria-hidden="true">${I_CLOCK}<span class="px">…</span></span>`}</div></div>`
  +(mine?"":`<button type="button" class="b light ublk" id="ublk">${I_BLOCK}<span>${bl?"Odblokiraj":"Blokiraj"}</span></button>`);apply(up)}
function upPlace(){if(!upEl||!upEl.isConnected){upClose();return}const r=upEl.getBoundingClientRect(),w=up.offsetWidth,h=up.offsetHeight;
 let top=r.bottom+8;if(top+h>innerHeight-76)top=Math.max(8,r.top-h-8);up.style.top=top+"px";up.style.left=Math.round(Math.min(Math.max(8,r.left-14),innerWidth-w-8))+"px"}
function upOpen(el){const msg=el.closest(".msg"),id=+msg.dataset.u;if(!id)return;if(upFor===id&&!up.hidden){upClose();return}
 upFor=id;upEl=el;const color=+((el.className.match(/\bu(\d+)\b/)||[])[1]||0);
 upRender(ucache.get(id)||{id,name:el.textContent,color,avatar:null,watch:null});up.hidden=false;upPlace();
 if(!ucache.has(id))fetch("/api/auth/user?id="+id,{cache:"no-store"}).then(r=>r.ok?r.json():null).then(c=>{if(!c)return;ucache.set(id,c);setTimeout(()=>ucache.delete(id),60000);if(upFor===id&&!up.hidden){upRender(c);upPlace()}}).catch(()=>{})}
function upClose(){up.hidden=true;upFor=null;upEl=null}
box.addEventListener("click",e=>{const n=e.target.closest(".un");if(n)upOpen(n)});
box.addEventListener("keydown",e=>{const n=e.target.closest(".un");if(n&&(e.key==="Enter"||e.key===" ")){e.preventDefault();upOpen(n)}});
document.addEventListener("pointerdown",e=>{if(!up.hidden&&!up.contains(e.target)&&!e.target.closest(".un"))upClose()});
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!up.hidden)upClose()});
pane.addEventListener("scroll",()=>{if(!up.hidden)upClose()},{passive:true});addEventListener("resize",()=>{if(!up.hidden)upClose()});
up.addEventListener("click",async e=>{if(!e.target.closest("#ublk"))return;const id=upFor;if(!me){upClose();openAuth();return}
 const on=!blocked.has(id);if(await setBlock(id,on)){upClose();say(cst,on?"Poruke ove osobe više ne vidiš.":"Ponovo vidiš poruke ove osobe.");setTimeout(()=>say(cst,""),4000)}else say(cst,"net")});

/* Podešavanja → Blokirani */
const bdl=$("#blkDlg");
function blkRender(){$("#blkList").innerHTML=blocks.length?blocks.map(b=>`<li><img class="av" src="${avSrc(b.avatar)}" alt="" width="64" height="64"><b class="nt u${b.color}">${esc(b.name)}</b><button type="button" class="b light" data-unb="${b.id}">Odblokiraj</button></li>`).join(""):`<li class="m bempty">Nemaš blokiranih korisnika.</li>`;apply(bdl)}
function openBlocks(){if(!me)return;blkRender();say($("#blkErr"),"");if(bdl.showModal)bdl.showModal();else bdl.setAttribute("open","")}
const bClose=()=>bdl.close?bdl.close():bdl.removeAttribute("open");
$("#blkX").onclick=bClose;bdl.addEventListener("click",e=>{if(e.target===bdl)bClose()});
$("#blkList").addEventListener("click",async e=>{const b=e.target.closest("[data-unb]");if(!b)return;b.disabled=true;if(await setBlock(+b.dataset.unb,false))blkRender();else{b.disabled=false;say($("#blkErr"),"net")}});

/* Podešavanja → Obriši nalog: one clear question, then it's gone */
const ddl=$("#delDlg");
function openDel(){if(!me)return;say($("#delErr"),"");if(ddl.showModal)ddl.showModal();else ddl.setAttribute("open","");apply(ddl);$("#delNo").focus()}
const dClose=()=>ddl.close?ddl.close():ddl.removeAttribute("open");
$("#delNo").onclick=dClose;ddl.addEventListener("click",e=>{if(e.target===ddl)dClose()});
$("#delYes").onclick=async()=>{const j=await post("/api/auth/delete");if(!j.ok){say($("#delErr"),j.err==="banned"?"Nalog ne može da se obriše dok traje zabrana pisanja.":(j.err||"net"));return}
 me=null;setBlocks([]);admSet(null);dClose();ui();reconnect()};

/* watching time (it grows the badge in the chat): every 10 s counts while the Assembly is on air (apiLive from the reader,
   or YouTube says the video is a live stream) and the player really plays on screen, also when the viewer is behind live
   (a delay, a pause, back later where he left off). When there is no broadcast nothing counts, not even a replay, and a
   hidden tab never counts. Muted counts only while someone is there: the page autoplays muted,
   so a forgotten tab stops counting after 30 min without a tap, key or scroll; with sound on it always counts.
   Sent every 5 min and when the page is left; the server also caps it (time since the last report, 14 h a day). */
let wAcc=0,wAct=Date.now();
["pointerdown","keydown","wheel","touchstart"].forEach(t=>addEventListener(t,()=>{wAct=Date.now()},{passive:true,capture:true}));
setInterval(()=>{try{if(me&&(apiLive||plLive)&&pState===1&&!document.hidden&&(!userMuted||Date.now()-wAct<30*60000))wAcc+=10}catch(e){}},10000);
function wSend(beacon){if(!me||wAcc<10)return;const s=wAcc;wAcc=0;
 /* text/plain: a beacon with a JSON content type is refused by some browsers; the server reads the body as JSON anyway */
 if(beacon&&navigator.sendBeacon&&navigator.sendBeacon("/api/auth/watch",new Blob([JSON.stringify({s})],{type:"text/plain"}))){me={...me,watch:(me.watch||0)+s};return}/* no answer from a beacon: count it here */
 post("/api/auth/watch",{s}).then(j=>{if(j&&j.ok&&me&&Number.isFinite(j.watch))setWatch(j.watch)})}
/* Podešavanja: the account's badge in front of its name (faint first house before the first hour); a tap shows a small
   bubble with the hours watched and the hours the next badge needs, "137/175h" (no level names anywhere) */
const wNow=()=>(me&&me.watch||0)+wAcc;
function lvlIcon(){const n=badgeLvl(wNow());return n?badgeSvg(n):badgeSvg(1,"dim")}
function lvlText(){const w=wNow(),n=badgeLvl(w),h=Math.floor(w/3600);return n<BADGE_H.length?h+"/"+BADGE_H[n]+"h":h.toLocaleString("sr-RS")+"h"}
function setWatch(w){me={...me,watch:w};if(cdl.open)colPaint();const b=$("#pLvl");if(b)b.innerHTML=lvlIcon();const t=$("#pLvlB");if(t&&!t.hidden)t.textContent=lvlText()}
function lvlBub(show){const b=$("#pLvl"),t=$("#pLvlB");if(!b||!t)return;if(show==null)show=t.hidden;t.hidden=!show;b.setAttribute("aria-expanded",show);if(show)t.textContent=lvlText()}
document.addEventListener("click",e=>{if(e.target.closest("#pLvl"))lvlBub();else if(!e.target.closest("#pLvlB"))lvlBub(false)});
document.addEventListener("keydown",e=>{if(e.key==="Escape")lvlBub(false)});
setInterval(()=>{if(wAcc>=300)wSend()},60000);
addEventListener("pagehide",()=>wSend(true));document.addEventListener("visibilitychange",()=>{if(document.hidden)wSend(true)});

/* name colour picker (tap the name in Podešavanja): light blue, light green and light orange are open for everyone, every
   2 h of watching the live stream opens one more, in an order of its own for each account (src/colors.mjs); a locked one
   is a "?" until then. The pastel set comes first, then the darker one. The colour the account has now is always open. */
const cdl=$("#colDlg"),colErr=$("#colErr"),colGrid=$("#colGrid");
const colOpen=()=>me?new Set([...colorsOpen(me.id,me.watch||0),me.color]):new Set(COLOR_FREE);
function colPaint(){if(!me)return;const open=colOpen();
 colGrid.innerHTML=COLOR_SHOW.map((c,i)=>open.has(c)
  ?`<button type="button" class="cl u${c}" role="radio" data-c="${c}" aria-checked="${c===me.color}" aria-label="Boja ${i+1}"></button>`
  :`<button type="button" class="cl lk" aria-disabled="true" aria-label="Zaključana boja"><span class="px">?</span></button>`).join("");
 const left=COLOR_SHOW.length-open.size;$("#colNext").hidden=left<=0;
 $("#colNext").textContent="Gledaj skupštinu da otključaš još boja";
 apply(cdl)}
function openColors(){if(!me)return;wSend();say(colErr,"");colPaint();if(cdl.showModal)cdl.showModal();else cdl.setAttribute("open","");apply(cdl)}
const colClose=()=>cdl.close?cdl.close():cdl.removeAttribute("open");
$("#colX").onclick=colClose;
cdl.addEventListener("click",e=>{if(e.target===cdl)colClose()});
colGrid.addEventListener("click",async e=>{const b=e.target.closest(".cl");if(!b||!me)return;
 if(b.classList.contains("lk"))return;
 const c=+b.dataset.c,prev=me.color;if(c===prev)return;
 me={...me,color:c};colPaint();say(colErr,"");
 const j=await post("/api/auth/color",{color:c});
 if(j.ok&&j.user){me=j.user;ui();colPaint()}else{me={...me,color:prev};colPaint();say(colErr,j.err==="login"?"login":j.err==="color_locked"?"Ta boja još nije otključana.":"Nije sačuvano. Pokušaj ponovo.")}});

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
fetch("/api/auth/me",{cache:"no-store"}).then(r=>r.json()).then(j=>{me=j.user;clientId=j.clientId;setBlocks(j.blocks||[]);admSet(j.admin)}).catch(()=>{}).finally(()=>{ui();connect()});
}
