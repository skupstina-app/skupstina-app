/* mutes: one shared set (live bar, Govornici tab, Profil) */
const muted=new Set();
var curSp=null;/* MP speaking now at the viewer's own playback position, from /api/live/speakers; null = not known */
function renderMuteUI(){
 $$("[data-mph]").forEach(e=>e.classList.toggle("is-mt",muted.has(mps[e.dataset.mph])));$("#phw").classList.toggle("is-mt",!!curSp&&muted.has(curSp));
 const b=$("#mute"),m=curSp,on=!!m&&muted.has(m);b.disabled=!m;b.setAttribute("aria-pressed",on);b.hidden=!m;b.innerHTML=on?I_SOFF:I_SON;b.title=!m?"":on?"Utišan kad god govori. Klikni da ga ponovo čuješ.":"Utišaj ovog poslanika kad god govori";b.setAttribute("aria-label",!m?"Nema prepoznatog govornika":(on?"Ponovo čuj ":"Utišaj kad god govori: ")+m.name);apply(b);

 renderSpeakers();
}
const toggleMute=m=>{muted.has(m)?muted.delete(m):muted.add(m);try{localStorage.setItem("utisani",JSON.stringify([...muted].map(x=>x.name)))}catch(e){}renderMuteUI();if(typeof applyAudio==="function"){autoNow=undefined;applyAudio()}};
$("#phMb").innerHTML=I_POFF;
$("#mute").onclick=()=>{if(curSp)toggleMute(curSp)};
try{(JSON.parse(localStorage.getItem("utisani")||"[]")).forEach(n=>{const m=mps.find(x=>x.name===n);if(m)muted.add(m)})}catch(e){}
