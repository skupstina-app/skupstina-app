/* "add to home screen" card. Phones only; never in the installed app or in in-app browsers (Instagram, Facebook...).
   Shown from the 2nd day of visits after 40 s on the page (first day: only after 3 min). "Ne sada" snoozes 7, then 14
   days; the third time it stops. After reading the iPhone steps: 30 days. Preview any time with ?a2hs */
{
const ua=navigator.userAgent,ios=/iP(hone|ad|od)/.test(ua)||(navigator.platform==="MacIntel"&&navigator.maxTouchPoints>1),
 android=/Android/.test(ua),inapp=/FBAN|FBAV|FB_IAB|Instagram|Line\/|Twitter|LinkedInApp|TikTok|musical_ly|Snapchat|; wv\)/.test(ua),
 standalone=navigator.standalone===true||matchMedia("(display-mode: standalone)").matches,
 iosv=parseInt((ua.match(/OS (\d+)_\d/)||[])[1]||"0",10),safari=ios&&!/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua),
 force=/[?&]a2hs\b/.test(location.search),K="a2hs";
let st={};try{st=JSON.parse(store.get(K)||"{}")||{}}catch(e){}
const save=()=>store.set(K,JSON.stringify(st)),day=new Date().toISOString().slice(0,10);
st.days=Array.isArray(st.days)?st.days:[];if(!st.days.includes(day)){st.days.push(day);st.days=st.days.slice(-8);save()}
let bip=null;addEventListener("beforeinstallprompt",e=>{e.preventDefault();bip=e;if(card)render()});
addEventListener("appinstalled",()=>{st.done=1;save();close()});
const ok=()=>force||(!standalone&&!inapp&&(ios||android)&&!st.done&&(st.n||0)<3&&Date.now()>(st.until||0));
let card=null,open=false;
const steps=()=>ios?(safari&&iosv>=26
  ?[['<svg class="si" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.5v11"/><path d="M8.2 7.2 12 3.4l3.8 3.8"/><path d="M8.5 10H7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2h-1.5"/></svg>','Dodirni <b>Podeli</b><span class="en">Share</span> u donjoj traci (ako ga nema, prvo <b>⋯</b>)'],['<svg class="si" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6.5 9.5 12 15l5.5-5.5"/></svg>','Dodirni <b>Prikaži više</b><span class="en">View More</span>'],['<svg class="si" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="3.5" width="17" height="17" rx="4.5"/><path d="M12 8v8M8 12h8"/></svg>','Izaberi <b>Dodaj na početni ekran</b><span class="en">Add to Home Screen</span>, pa <b>Dodaj</b>']]
  :[['<svg class="si" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.5v11"/><path d="M8.2 7.2 12 3.4l3.8 3.8"/><path d="M8.5 10H7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2h-1.5"/></svg>',safari?'Dodirni <b>Podeli</b><span class="en">Share</span> (dole, na iPadu gore desno)':'Dodirni <b>Podeli</b><span class="en">Share</span> u traci sa adresom'],['<svg class="si" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="3.5" width="17" height="17" rx="4.5"/><path d="M12 8v8M8 12h8"/></svg>','Izaberi <b>Dodaj na početni ekran</b><span class="en">Add to Home Screen</span>'],['<svg class="si" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="3.5" width="17" height="17" rx="4.5"/><path d="M12 8v8M8 12h8"/></svg>','Dodirni <b>Dodaj</b><span class="en">Add</span>']])
 :/SamsungBrowser/.test(ua)
  ?[['<svg class="si" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M5 7h14M5 12h14M5 17h14"/></svg>','Otvori meni <b>≡</b> dole desno'],['<svg class="si" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="3.5" width="17" height="17" rx="4.5"/><path d="M12 8v8M8 12h8"/></svg>','Izaberi <b>Dodaj stranicu na</b><span class="en">Add page to</span>'],['<svg class="si" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 11 12 4l8 7"/><path d="M6.5 9.5V20h11V9.5"/></svg>','Izaberi <b>Početni ekran</b><span class="en">Home screen</span>']]
  :[['<svg class="si" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><circle cx="12" cy="5.5" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="12" cy="18.5" r="1.8"/></svg>','Otvori meni <b>⋮</b> gore desno'],['<svg class="si" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="3.5" width="17" height="17" rx="4.5"/><path d="M12 8v8M8 12h8"/></svg>','Izaberi <b>Dodaj na početni ekran</b><span class="en">Add to Home screen</span> ili <b>Instaliraj aplikaciju</b><span class="en">Install app</span>']];
function render(){
 const one=android&&bip;
 card.innerHTML=`<div class="hd"><img src="/icons/apple-touch-icon.png" alt="" width="44" height="44"><div><b>Dodaj na početni ekran</b><p>Prenos uživo jednim dodirom, kao aplikacija. Bez preuzimanja.</p></div><button type="button" class="x" aria-label="Zatvori">×</button></div>`+
  (open?`<ol>${steps().map(([i,t],k)=>`<li><span class="n">${k+1}</span><span class="key">${i}</span><span>${t}</span></li>`).join("")}</ol>`:"")+
  `<div class="row">${open?`<button type="button" class="pri" data-a="got">Razumem</button>`:`<button type="button" class="sec" data-a="later">Ne sada</button><button type="button" class="pri" data-a="${one?"install":"how"}">${one?"Dodaj":"Kako?"}</button>`}</div>`;
 apply(card)}
function close(){if(!card)return;card.classList.remove("show");setTimeout(()=>{card&&card.remove();card=null},250)}
function show(){if(card||!ok()||document.hidden||document.body.classList.contains("theater")||document.querySelector(".sheet.show"))return;
 card=document.createElement("div");card.className="a2hs";card.setAttribute("role","dialog");card.setAttribute("aria-label","Dodaj na početni ekran");
 render();document.body.appendChild(card);requestAnimationFrame(()=>card.classList.add("show"));
 card.onclick=async e=>{const b=e.target.closest("button");if(!b)return;const a=b.dataset.a||(b.classList.contains("x")?"later":"");
  if(a==="how"){open=true;render();return}
  if(a==="install"&&bip){bip.prompt();const r=await bip.userChoice.catch(()=>({}));bip=null;if(r.outcome==="accepted"){st.done=1;save();close();return}a==="install"}
  if(a==="got"){st.until=Date.now()+30*864e5;save();close();return}
  if(a==="later"||a==="install"){st.n=(st.n||0)+1;st.until=Date.now()+(st.n===1?7:14)*864e5;save();close()}}}
if(force)setTimeout(show,800);
else if(ok())setTimeout(function again(){if(document.hidden)return setTimeout(again,5e3);show()},st.days.length>=2?40e3:180e3);
}

renderVstat();
