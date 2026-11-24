/* chat: open names for now, login + full moderation later */
{
const box=$("#msgs"),pane=$("#p-chat"),side=$(".side"),gate=$("#gate"),gname=$("#gname"),gerr=$("#gerr"),cin=$("#cin"),cst=$("#cst"),pnin=$("#pnin"),pnst=$("#pnst");
let ws=null,name=store.get("chatName")||"",key=store.get("chatKey"),joined=false,backoff=1000,from="gate",last="",ids=new Set(),ping=0;
if(!key||!/^[a-f0-9]{32}$/.test(key)){const a=new Uint8Array(16);crypto.getRandomValues(a);key=[...a].map(x=>x.toString(16).padStart(2,"0")).join("");store.set("chatKey",key)}
const ERR={name_len:"Ime mora imati od 2 do 20 znakova.",name_chars:"Ime može imati slova, brojeve, razmak, tačku i crtice.",name_bad:"To ime nije dozvoljeno.",name_taken:"To ime je zauzeto. Izaberi drugo.",name_many:"Previše novih imena. Pokušaj kasnije.",key:"Greška. Osveži stranicu.",nojoin:"Prvo izaberi ime.",banned:"Privremeno ne možeš da pišeš.",long:"Poruka je duža od 300 znakova.",fast:"Polako, sačekaj par sekundi.",dup:"Ista poruka je već poslata.",bad:"Poruka ima uvredljive reči i nije poslata.",link:"Linkovi i imejlovi nisu dozvoljeni.",phone:"Brojevi telefona nisu dozvoljeni.",off:"Veza je prekinuta, povezujem ponovo…",wait:"Povezujem…",saved:"Sačuvano.",rules:"Čuvanjem prihvataš pravila razgovora."};
const say=(el,k)=>{el.textContent=k?(ERR[k]||k):"";apply(el)};
const ucol=n=>{let h=5381;for(const c of n.toLocaleLowerCase("sr"))h=(h*33+c.codePointAt(0))>>>0;return h%8};
const hhmm=t=>{const d=new Date(t);return d.getHours()+":"+String(d.getMinutes()).padStart(2,"0")};
const ui=()=>{side.classList.toggle("locked",!name||gate.dataset.open==="1");$("#cname").textContent=name;pnin.value=name;$("#gcancel").hidden=!name};
const empty=()=>{if(!box.children.length){box.innerHTML='<p class="m empty">Još nema poruka. Napiši prvu.</p>';apply(box)}};
const add=m=>{if(ids.has(m.id))return;ids.add(m.id);box.querySelector(".empty")?.remove();
 const stick=pane.scrollHeight-pane.scrollTop-pane.clientHeight<90;
 const d=document.createElement("div");d.className="msg"+(m.n===name?" me":"");d.dataset.id=m.id;
 d.innerHTML='<span class="tm nt"></span> <b class="nt u'+ucol(m.n)+'"></b><span class="nt">: </span><span class="x nt"></span>'+(m.n===name?"":'<button class="flag" type="button" aria-pressed="false">Prijavi</button>');
 const t=d.querySelectorAll(".nt");t[0].textContent=hhmm(m.at);t[1].textContent=m.n;t[3].textContent=m.x;apply(d);box.append(d);
 while(box.children.length>200)box.firstElementChild.remove();
 if(stick)pane.scrollTop=pane.scrollHeight};
const viewers=n=>{const c=$("#viewers");$("#vn").textContent=Number(n).toLocaleString("sr-RS");c.style.visibility="visible"};
const send=o=>{if(ws&&ws.readyState===1){ws.send(JSON.stringify(o));return true}return false};
const join=(n,src)=>{from=src;if(!send({t:"join",name:n,key}))say(src==="gate"?gerr:pnst,"wait")};
const connect=()=>{
 ws=new WebSocket((location.protocol==="https:"?"wss://":"ws://")+location.host+"/api/chat");
 ws.onopen=()=>{backoff=1000;say(cst,"");if(name)send({t:"join",name,key});clearInterval(ping);ping=setInterval(()=>{try{ws.send("ping")}catch(e){}},45000)};
 ws.onmessage=e=>{if(e.data==="pong")return;let d;try{d=JSON.parse(e.data)}catch(x){return}
  if(d.t==="init"){box.innerHTML="";ids.clear();d.msgs.forEach(add);empty();pane.scrollTop=pane.scrollHeight;viewers(d.v)}
  else if(d.t==="m")add(d.m);
  else if(d.t==="v")viewers(d.n);
  else if(d.t==="del")d.ids.forEach(i=>{box.querySelector('[data-id="'+i+'"]')?.remove();ids.delete(i)});
  else if(d.t==="ok"){joined=true;const was=name;name=d.name;store.set("chatName",name);if(was!==name){box.querySelectorAll(".msg").forEach(m=>{const me=m.querySelector("b").textContent===name;m.classList.toggle("me",me);if(me)m.querySelector(".flag")?.remove()})}if(from==="gate"&&gate.dataset.open==="1"){gate.dataset.open="";say(gerr,"")}if(from==="profile")say(pnst,"saved");from="";ui()}
  else if(d.t==="err"){const k=d.code;if(/^name_|^key$/.test(k)){say(from==="profile"?pnst:gerr,k);if(!name){side.classList.add("locked")}}else{say(cst,k);if(last&&!cin.value){cin.value=last}}}};
 ws.onclose=()=>{joined=false;clearInterval(ping);say(cst,"off");setTimeout(connect,backoff);backoff=Math.min(backoff*2,30000)}};
gate.addEventListener("submit",e=>{e.preventDefault();const n=gname.value.trim();if(n.length<2){say(gerr,"name_len");return}store.set("chatRules","1");join(n,"gate")});
$("#gcancel").onclick=()=>{gate.dataset.open="";say(gerr,"");ui()};
$("#crename").onclick=()=>{gate.dataset.open="1";gname.value=name;ui();gname.focus()};
$("#pname").addEventListener("submit",e=>{e.preventDefault();const n=pnin.value.trim();if(n===name&&joined){say(pnst,"saved");return}if(n.length<2){say(pnst,"name_len");return}store.set("chatRules","1");join(n,"profile")});
$("#cbox").addEventListener("submit",e=>{e.preventDefault();const x=cin.value.trim();if(!x)return;if(!joined){say(cst,"wait");return}last=x;if(send({t:"msg",x})){cin.value="";say(cst,"")}});
pane.addEventListener("click",e=>{const f=e.target.closest(".flag");if(!f||f.disabled)return;const id=+f.closest(".msg").dataset.id;if(send({t:"report",id})){f.setAttribute("aria-pressed","true");f.disabled=true;f.textContent="Prijavljeno";apply(f)}});
const dlg=$("#rulesDlg");$$('a[href="#pravila"]').forEach(a=>a.addEventListener("click",e=>{e.preventDefault();if(dlg.showModal)dlg.showModal();else dlg.setAttribute("open","")}));
$("#rulesClose").onclick=()=>dlg.close?dlg.close():dlg.removeAttribute("open");
say(pnst,"rules");ui();connect();
}
