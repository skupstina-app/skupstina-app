/* player: YouTube with its own controls off, a shield over it so YouTube's own UI never pops up, our controls on top */
const P_PLAY=`<svg class="mi" viewBox="0 0 13 13" aria-hidden="true" shape-rendering="crispEdges" fill="currentColor"><rect x="3" y="2" width="2" height="9"/><rect x="5" y="3" width="2" height="7"/><rect x="7" y="4" width="2" height="5"/><rect x="9" y="5" width="2" height="3"/></svg>`;
const P_PAUSE=`<svg class="mi" viewBox="0 0 13 13" aria-hidden="true" shape-rendering="crispEdges" fill="currentColor"><rect x="3" y="2" width="3" height="9"/><rect x="8" y="2" width="3" height="9"/></svg>`;
const PV=$("#video"),PC={pp:$("#vpp"),mu:$("#vmu"),vr:$("#vvolr"),sk:$("#vseek"),tm:$("#vtime"),lb:$("#vlive"),snd:$("#vsound"),off:$("#voff")};
let pStarted=false,pSeek=null,pState=-1,pEdge=null,pLiveD=0,pDelay=0,pDelayAt=0;
/* resume where the viewer left: position saved every 2 s (or "at live"), restored once per load on the same broadcast */
let pVid=null,pResumed=false,pSavedAt=0,pHid=null,pRes=null;try{pRes=JSON.parse(store.get("pozicija")||"null")}catch(e){}
function pSave(t,edge,force){if(!pVid||!pResumed)return;const now=Date.now();if(!force&&now-pSavedAt<2000)return;pSavedAt=now;store.set("pozicija",JSON.stringify({v:pVid,t,edge:edge?1:0,at:now}))}
document.addEventListener("visibilitychange",()=>{if(!ytReady)return;let t=0,s=-1;try{t=yt.getCurrentTime();s=yt.getPlayerState()}catch(e){return}
 if(document.hidden){pHid={t,seen:t,at:Date.now()};pSave(t,PC.lb.classList.contains("on"),true);return}
 const h=pHid;pHid=null;if(!h)return;
 /* back on the page: continue from where playback really got to while away (phones pause it, desktop may keep
    playing); if YouTube jumped ahead to live meanwhile, put it back there */
 setTimeout(()=>{try{const now=yt.getCurrentTime();if(now>h.seen+15){yt.seekTo(h.seen,true);pDelay=null;pDelayAt=Date.now()}}catch(e){}},800)});
vol=(()=>{const s=store.get("jacina"),x=Number(s);return s!==null&&Number.isFinite(x)?Math.max(0,Math.min(100,x)):100})();
userMuted=true;/* browsers only allow autoplay without sound */
const pFmt=s=>{s=Math.max(0,Math.floor(s));const h=Math.floor(s/3600),m=Math.floor(s%3600/60),x=String(s%60).padStart(2,"0");return h?h+":"+String(m).padStart(2,"0")+":"+x:m+":"+x};
function syncCtl(){const m=userMuted;[$("#vmute"),PC.mu].forEach(b=>{b.setAttribute("aria-pressed",m);b.innerHTML=m?I_SOFF:I_SON;b.setAttribute("aria-label",m?"Uključi zvuk prenosa":"Isključi zvuk prenosa")});
 const v=m?0:vol;PC.vr.value=v;PC.vr.style.setProperty("--dok",v+"%");PC.snd.hidden=!(m&&pStarted)}
function setMuted(m){userMuted=m;store.set("zvuk",m?"0":"1");if(!m&&vol===0){vol=60;store.set("jacina",vol)}if(!m)try{yt&&yt.playVideo()}catch(e){}syncCtl();applyAudio()}
setInterval(()=>{if(!ytReady)return;let t=0,d=0,s=-1;try{t=yt.getCurrentTime()||0;d=yt.getDuration()||0;s=yt.getPlayerState()}catch(e){return}
 let isLive=false;try{isLive=!!(yt.getVideoData()||{}).isLive}catch(e){}
 plLive=isLive&&s!==0&&s!==-1&&PC.off.hidden;setLive();
 /* on a live stream YouTube's duration is unreliable: estimate the live edge from where playback was plus the time since */
 if(isLive){const now=Date.now();if(!pEdge){if(s===1&&t>0)pEdge={t,w:now};d=t}else{const n=pEdge.t+(now-pEdge.w)/1000;if(t>n)pEdge={t,w:now};d=Math.max(t,n)}pLiveD=d}
 pState=s;const playing=s===1||s===3;if(s===1){pStarted=true;PC.off.hidden=true}PV.classList.toggle("ready",pStarted||s===2||s===5);
 if(pHid&&s===1&&t>pHid.seen&&t-pHid.seen<30)pHid.seen=t;/* what really played while the page was hidden; a jump to live is not playback */
 try{pVid=(yt.getVideoData()||{}).video_id||pVid}catch(e){}
 if(!pResumed&&s===1&&pVid){pResumed=true;const r=pRes;if(r&&r.v===pVid&&r.t>0&&Date.now()-r.at<(r.edge?3:12)*3600e3&&r.t<t-10){try{yt.seekTo(r.t,true);t=r.t}catch(e){}pDelay=null;pDelayAt=Date.now()}}
 PC.pp.innerHTML=playing?P_PAUSE:P_PLAY;PC.pp.setAttribute("aria-label",playing?"Pauza":"Pusti");PV.classList.toggle("paused",!playing);
 /* Uživo button = delay switch: live, +10 s, +30 s, live. A manual seek leaves the cycle (pDelay=null) and shows the time behind */
 const behind=d>0?Math.max(0,d-t):0;
 if(Date.now()-pDelayAt>5000&&playing){if(pDelay!==null&&Math.abs(behind-pDelay)>8)pDelay=null;else if(pDelay===null&&behind<8)pDelay=0}
 if(!playing&&pDelay===0&&behind>8)pDelay=null;/* paused at live: show how far behind it is now */
 const edge=pDelay===0||(pDelay===null&&behind<20);if(pRate!==1&&playing&&edge&&typeof pSetRate==="function")pSetRate(1);/* caught up with live */if(pSeek==null&&(playing||s===2))pSave(t,edge);PC.lb.classList.toggle("on",edge);PC.lb.setAttribute("aria-pressed",edge);
 const lt=$("#vlivet");lt.textContent=pDelay?"+"+pDelay+" s":(cyr?"Уживо":"Uživo");lt.classList.toggle("dl",!!pDelay);
 PC.lb.setAttribute("aria-label",pDelay?"Kašnjenje "+pDelay+" sekundi, klik za sledeće":"Uživo, klik za kašnjenje 10 sekundi");
 if(pSeek==null){PC.sk.max=Math.max(1,Math.floor(d));PC.sk.value=Math.floor(t);PC.sk.style.setProperty("--dok",(d>0?Math.min(100,t/d*100):0)+"%")}
 PC.sk.disabled=d<=0;PC.tm.textContent=pDelay!==null||d<=0||edge?"":"−"+pFmt(behind);syncCtl()},500);
const pToggle=()=>{try{pState===1||pState===3?yt.pauseVideo():yt.playVideo()}catch(e){}};
/* 15 s jumps: buttons, and double tap on the left or right side like YouTube; keep tapping to jump further */
let pJumpT=0,pJumpAt=0,pJumpSum=0,pTapT=0,pTapAt=0;
function pJump(sec){if(!ytReady)return;try{const t=yt.getCurrentTime(),edge=pLiveD||yt.getDuration()||t;let n=t+sec;if(n>edge-1)n=edge+60;yt.seekTo(Math.max(0,n),true)}catch(e){}
 pDelay=null;pDelayAt=Date.now();const now=Date.now();pJumpSum=now-pJumpAt<900&&Math.sign(pJumpSum)===Math.sign(sec)?pJumpSum+sec:sec;pJumpAt=now;
 const j=$("#vjump");j.textContent=(pJumpSum>0?"+":"−")+Math.abs(pJumpSum)+" s";j.className="vjump "+(sec>0?"r":"l");j.hidden=false;clearTimeout(pJumpT);pJumpT=setTimeout(()=>{j.hidden=true;pJumpSum=0},800)}
let pSwallow=false,pRate=1;
/* phones: controls fade 3 s after the last tap while playing; a side tap toggles them */
const pTouch=matchMedia("(hover:none)").matches;let pCtlT=0;
function pCtl(show){clearTimeout(pCtlT);PV.classList.toggle("ctlhide",!show);if(show)pCtlT=setTimeout(()=>{if(pState===1||pState===3)PV.classList.add("ctlhide")},3000)}
if(pTouch)setTimeout(()=>pCtl(true),0);
$("#vshield").onclick=e=>{if(pSwallow)return;const now=Date.now(),r=PV.getBoundingClientRect(),x=(e.clientX-r.left)/r.width,side=x<.4?-15:x>.6?15:0;
 if(side&&now-pJumpAt<900){pJump(side);return}
 if(now-pTapAt<300){clearTimeout(pTapT);pTapAt=0;side?pJump(side):$("#vfs").click();return}
 pTapAt=now;pTapT=setTimeout(()=>{if(!pTouch){pToggle();return}
  if(x<.3||x>.7)pCtl(PV.classList.contains("ctlhide"));else{pToggle();pCtl(true)}},300)};
PC.pp.onclick=pToggle;$("#vbig").innerHTML=P_PLAY;$("#vbig").onclick=e=>{e.stopPropagation();try{yt.playVideo()}catch(x){}};$("#vback").onclick=()=>pJump(-15);$("#vfwd").onclick=()=>pJump(15);
document.addEventListener("keydown",e=>{if((e.key!=="ArrowLeft"&&e.key!=="ArrowRight")||e.altKey||e.ctrlKey||e.metaKey||!ytReady)return;
 const el=document.activeElement;if(el&&(el.isContentEditable||(/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)&&el.type!=="range")))return;
 if(document.body.dataset.tab&&document.body.dataset.tab!=="live"&&innerWidth<=760)return;
 e.preventDefault();pJump(e.key==="ArrowLeft"?-5:5)});
{const sh=$("#vshield"),badge=document.createElement("div");badge.className="vrate";badge.hidden=true;badge.innerHTML='<svg class="mi" viewBox="0 0 13 13" aria-hidden="true" shape-rendering="crispEdges" fill="currentColor"><rect x="1" y="3" width="2" height="7"/><rect x="3" y="4" width="2" height="5"/><rect x="5" y="5" width="2" height="3"/><rect x="6" y="3" width="2" height="7"/><rect x="8" y="4" width="2" height="5"/><rect x="10" y="5" width="2" height="3"/></svg>2×';PV.appendChild(badge);
 let hT=0,held=false,downAt=0,locked=false,y0=0;badge.insertAdjacentHTML("afterbegin",'<svg class="mi lk" viewBox="0 0 13 13" aria-hidden="true" shape-rendering="crispEdges" fill="currentColor"><rect x="4" y="1" width="5" height="1"/><rect x="3" y="2" width="1" height="4"/><rect x="9" y="2" width="1" height="4"/><rect x="2" y="6" width="9" height="6"/></svg>');
 const swallow=()=>{pSwallow=true;setTimeout(()=>{pSwallow=false},450)};
 const normal=()=>{held=locked=false;try{yt.setPlaybackRate(pRate)}catch(e){}badge.hidden=true;badge.classList.remove("locked")};
 const stop=()=>{clearTimeout(hT);const long=downAt&&Date.now()-downAt>=450;downAt=0;if(long)swallow();if(!held||locked)return;normal()};
 const lock=y=>{if(held&&!locked&&y-y0>40){locked=true;badge.classList.add("locked")}};
 sh.addEventListener("pointermove",e=>{if(e.pointerType!=="touch")lock(e.clientY)});
 sh.addEventListener("touchmove",e=>{const y=e.touches[0]?.clientY??y0;if(held){e.preventDefault();lock(y)}else if(Math.abs(y-y0)>10)clearTimeout(hT)},{passive:false});
 sh.addEventListener("touchend",stop);
 sh.addEventListener("pointerdown",e=>{if(!ytReady||e.button>0)return;clearTimeout(hT);
  if(locked){normal();swallow();return}/* locked fast-forward: any tap goes back to normal speed */
  downAt=Date.now();y0=e.clientY;
  hT=setTimeout(()=>{if(!(pState===1||pState===3))return;
   if(PC.lb.classList.contains("on")){badge.lastChild.textContent=cyr?"Уживо":"Uživo";badge.hidden=false;setTimeout(()=>{if(!held)badge.hidden=true},900);return}/* at the live edge there is nothing ahead to speed through */
   let r=[1,2];try{r=yt.getAvailablePlaybackRates()}catch(x){}const rate=r.includes(2)?2:Math.max(...r);if(rate<=1)return;
   try{yt.setPlaybackRate(rate)}catch(x){return}held=true;badge.lastChild.textContent=rate+"×";badge.hidden=false},450)});
 ["pointerup","pointerleave"].forEach(n=>sh.addEventListener(n,e=>{if(e.pointerType!=="touch")stop()}));
 sh.addEventListener("pointercancel",e=>{if(e.pointerType!=="touch")stop()});
 sh.addEventListener("contextmenu",e=>e.preventDefault());}
/* playback speed, like YouTube's setting: 1x, 1.25x, 1.5x, 2x; back to 1x when caught up with live */
const SPB=$("#vspd"),SPM=$("#vspdm");
const fmtRate=r=>String(r).replace(".",",")+"×";
function pSetRate(r){pRate=r;try{yt.setPlaybackRate(r)}catch(e){}SPB.firstChild.textContent=fmtRate(r);SPB.classList.toggle("on",r!==1);SPB.setAttribute("aria-label","Brzina reprodukcije "+fmtRate(r))}
SPB.onclick=e=>{e.stopPropagation();if(!SPM.hidden){SPM.hidden=true;return}
 let rs=[1,1.25,1.5,2];try{const a=yt.getAvailablePlaybackRates();if(a&&a.length>1)rs=rs.filter(x=>a.includes(x))}catch(x){}
 SPM.innerHTML=rs.map(r=>`<button type="button" role="menuitemradio" aria-checked="${r===pRate}" data-r="${r}">${fmtRate(r)}</button>`).join("");SPM.hidden=false;if(pTouch)pCtl(true)};
SPM.onclick=e=>{e.stopPropagation();const b=e.target.closest("[data-r]");if(!b)return;pSetRate(Number(b.dataset.r));SPM.hidden=true};
document.addEventListener("click",e=>{if(!SPM.hidden&&!e.target.closest("#vspd,#vspdm"))SPM.hidden=true});
PC.mu.onclick=()=>setMuted(!userMuted);
PC.snd.innerHTML=I_SOFF+'<span class="vst">Uključi zvuk</span>';PC.snd.setAttribute("aria-label","Uključi zvuk");apply(PC.snd);
PC.snd.onclick=()=>setMuted(false);
PC.lb.onclick=()=>{pDelay=pDelay===0?10:pDelay===10?30:0;pDelayAt=Date.now();try{const d=pLiveD||yt.getDuration();yt.seekTo(pDelay?Math.max(0,d-pDelay):d+60,true);yt.playVideo()}catch(e){}const lt=$("#vlivet");lt.textContent=pDelay?"+"+pDelay+" s":(cyr?"Уживо":"Uživo");lt.classList.toggle("dl",!!pDelay);PC.lb.classList.toggle("on",pDelay===0)};
PC.vr.oninput=e=>{vol=Number(e.target.value);store.set("jacina",vol);if(vol===0){userMuted=true;store.set("zvuk","0")}else if(userMuted){userMuted=false;store.set("zvuk","1");try{yt&&yt.playVideo()}catch(x){}}syncCtl();applyAudio()};
PC.sk.oninput=e=>{pSeek=Number(e.target.value);const d=Number(PC.sk.max)||1;PC.sk.style.setProperty("--dok",pSeek/d*100+"%");PC.tm.textContent="−"+pFmt(d-pSeek)};
PC.sk.onchange=()=>{if(pSeek!=null){try{yt.seekTo(pSeek,true)}catch(e){}pDelay=null;pDelayAt=Date.now()}pSeek=null};
/* sound on load: wait until the stream really plays, then check YouTube kept the sound; a single early timeout used to mute it every time */
function pWatchSound(){const t0=Date.now();let ok=0,mu=0;
 const chk=setInterval(()=>{if(userMuted||!yt){clearInterval(chk);return}
  let s=-1,m=false;try{s=yt.getPlayerState();m=yt.isMuted()}catch(e){}
  const dt=Date.now()-t0;
  if(s===1&&!m){mu=0;if(++ok>=4)clearInterval(chk);return}
  ok=0;if(s===1&&m)mu++;
  if(mu>=4||(s===2&&dt<15000)||dt>15000){clearInterval(chk);pSoundBlocked()}},300)}
function pSoundBlocked(){userMuted=true;applyAudio();try{yt.playVideo()}catch(e){}syncCtl();
 const evs=["click","keydown"],off=()=>evs.forEach(n=>removeEventListener(n,on,true));
 function on(e){if(e.type==="keydown"&&(e.key==="Escape"||e.key==="Tab"))return;off();
  const el=e.target&&e.target.closest?e.target:null;
  if(el&&el.closest("#vmu,#vsound,#vmute,#vvolr"))return;
  if(store.get("zvuk")==="0"||!userMuted||vol===0)return;
  if(el&&el.closest("#vshield"))e.stopPropagation();
  setMuted(false)}
 evs.forEach(n=>addEventListener(n,on,true))}
