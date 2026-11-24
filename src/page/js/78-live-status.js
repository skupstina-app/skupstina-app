/* "not live" screen: only if nothing plays for a while, not when paused or buffering, and not while the reader reports a broadcast */
let pOffT=0;function pOffCheck(ms){clearTimeout(pOffT);pOffT=setTimeout(()=>{if(pState!==1&&pState!==2&&pState!==3&&!apiLive)PC.off.hidden=false},ms)}
function pCreate(){if(yt)return;const d=document.createElement("div");d.id="ytp";PV.prepend(d);
 const go=()=>{yt=new YT.Player("ytp",{host:"https://www.youtube-nocookie.com",width:"100%",height:"100%",videoId:"live_stream",
  playerVars:{channel:CH,autoplay:1,mute:1,playsinline:1,controls:0,fs:0,disablekb:1,modestbranding:1,rel:0,iv_load_policy:3,origin:location.origin},
  events:{onReady:()=>{ytReady=true;try{yt.setVolume(vol);yt.mute();yt.playVideo()}catch(e){}
   /* start with sound unless the viewer turned it off; if the browser blocks sound before a click, play muted and turn sound on at the first click, tap or key on the page */
   if(store.get("zvuk")!=="0"&&vol>0){userMuted=false;applyAudio();pWatchSound()}else applyAudio();pOffCheck(30000)},
   onStateChange:e=>{if(e.data===1){pStarted=true;PC.off.hidden=true}syncCtl()},onError:()=>pOffCheck(30000)}})};
 if(window.YT&&YT.Player)go();else{window.onYouTubeIframeAPIReady=go;const sc=document.createElement("script");sc.src="https://www.youtube.com/iframe_api";document.head.appendChild(sc)}}
new IntersectionObserver((e,o)=>{if(e[0].isIntersecting){o.disconnect();pCreate()}},{rootMargin:"300px"}).observe(PV);
setTimeout(()=>{const r=PV.getBoundingClientRect();if(r.bottom>-300&&r.top<innerHeight+300)pCreate()},1500);
PC.pp.innerHTML=P_PLAY;syncCtl();
/* v1: what's live now */
if(V1){$("#heroLead").textContent="Pratite sednice uživo i upoznajte svih 250 narodnih poslanika.";$("#heroAlt").href="#sala";$("#heroAlt").textContent="Poslanici";
 $("#salaNote").textContent="Podaci: parlament.gov.rs. Raspored je približan: sala ima 8 sektora i 6 redova; predsedništvo gore (predsednik, generalna sekretarka i šest potpredsednika), Studentska lista sa leve strane predsedništva, Srbija pobeđuje sa desne, manjinske liste u sredini.";setTab("live")}
{const f=$("#cform"),st=$("#cstat");if(f)f.addEventListener("submit",async e=>{e.preventDefault();const b=f.querySelector("button[type=submit]");b.disabled=true;st.textContent="Šaljem…";apply(st);
 try{const r=await fetch("/api/contact",{method:"POST",body:new FormData(f)});const j=await r.json();st.textContent=j.ok?"Hvala, poruka je poslata.":j.err==="limit"?"Previše poruka danas, pokušajte sutra.":"Poruka nije poslata. Proverite tekst.";if(j.ok)f.reset()}catch(err){st.textContent="Poruka nije poslata. Pokušajte ponovo."}
 apply(st);b.disabled=false})}
