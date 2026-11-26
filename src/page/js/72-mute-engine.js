/* live player + mute engine
   - plays @ParlamentSrbija live through YouTube's IFrame Player API (YouTube's player is never covered)
   - the speaker feed is a timeline in STREAM time: [{from, to, mp}] (seconds of the live stream).
     Each viewer compares it with their OWN playback position, so muting stays exact even if they lag, pause or rewind.
   - in production the timeline comes from our Worker (/api/live/speakers, refreshed every few seconds);
     with no timeline nothing is auto-muted. */
const CH="UCghngrfQwzJ4aaPZ-UgNIZQ",PAD_IN=.8,PAD_OUT=1.2;
let yt=null,ytReady=false,userMuted=false,vol=100,TL=[],tlAt=null,autoNow=null,onceUnmuted=null;
const speakerAt=t=>{if(TL.length&&t!=null){for(let i=TL.length-1;i>=0;i--){const x=TL[i];if(t>=x.from-PAD_IN&&t<=(x.to==null?1e12:x.to)+PAD_OUT)return x.mp}return null}
 /* no playback position yet (not started): whoever is speaking live right now */
 const L=TL[TL.length-1];return t==null&&apiLive&&L&&L.to==null?L.mp:null};
function applyAudio(){
 let t=null;try{t=ytReady?yt.getCurrentTime():null}catch(e){}
 const sp=speakerAt(t);if(sp!==curSp){curSp=sp;renderVstat();renderMuteUI()}if(onceUnmuted&&sp!==onceUnmuted)onceUnmuted=null;
 const auto=sp&&muted.has(sp)&&onceUnmuted!==sp?sp:null;
 if(auto!==autoNow){autoNow=auto;renderVstat()}
 if(ytReady){try{(userMuted||auto)?yt.mute():yt.unMute();yt.setVolume(vol)}catch(e){}}
}
function renderVstat(){const m=curSp,meta=$("#nowMeta"),bar=meta.closest(".vbar"),ph=bar.querySelector(".ph");$("#nowName").textContent=m?m.name:"";
 meta.textContent=m?(m.g===6?"Srbija pobeđuje":groups[m.g][1]):"";ph.innerHTML=m?"":'<svg class="unk" viewBox="0 0 16 16" aria-hidden="true" shape-rendering="crispEdges"><g fill="currentColor" opacity=".22"><rect x="6" y="1" width="4" height="1"/><rect x="5" y="2" width="6" height="6"/><rect x="6" y="8" width="4" height="1"/><rect x="4" y="10" width="8" height="1"/><rect x="3" y="11" width="10" height="1"/><rect x="2" y="12" width="12" height="4"/></g><g fill="currentColor"><rect x="7" y="2" width="2" height="1"/><rect x="6" y="3" width="1" height="1"/><rect x="9" y="3" width="1" height="2"/><rect x="8" y="5" width="1" height="1"/><rect x="7" y="6" width="1" height="1"/><rect x="7" y="8" width="1" height="1"/></g></svg>';ph.style.background=m&&m.ph?`var(--seat) url(/p/${m.id}) center 20%/cover`:"";bar.classList.toggle("nosp",!m);bar.classList.toggle("auto",!!autoNow);apply(meta.parentElement)}
$("#vmute").onclick=()=>setMuted(!userMuted);

setInterval(applyAudio,250);
/* live state: the reader says a broadcast is on, or our own player is on a live stream */
let apiLive=false,plLive=false;const setLive=()=>document.body.classList.toggle("islive",apiLive||plLive);
async function pullTimeline(){try{const r=await fetch("/api/live/speakers",{cache:"no-store"});if(r.ok){const j=await r.json();apiLive=!!j.live;setLive();liveGate();tlAt=j.updated||null;TL=(j.segments||[]).map(x=>({from:x.from,to:x.to,mp:mps.find(m=>m.id===x.mp)||null})).filter(x=>x.mp)}}catch(e){}}
/* how often to ask: every 4 s while live (speaker data); otherwise every minute around session hours
   (9:45-20:00 Belgrade time) and every 10 minutes the rest of the day; at once when the viewer comes back */
const bgMin=()=>{try{const p=new Intl.DateTimeFormat("en-GB",{timeZone:"Europe/Belgrade",hour:"numeric",minute:"numeric",hourCycle:"h23"}).formatToParts(new Date());return +p.find(x=>x.type==="hour").value*60+ +p.find(x=>x.type==="minute").value}catch(e){return 600}};
let pullT=0;const pullLoop=async()=>{clearTimeout(pullT);await pullTimeline();const m=bgMin();pullT=setTimeout(pullLoop,apiLive?4000:(m>=585&&m<1200?60000:600000))};
pullLoop();document.addEventListener("visibilitychange",()=>{if(!document.hidden)pullLoop()});
