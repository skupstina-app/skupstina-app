/* govornici today */
function renderSpeakers(){
 const by=new Map();talks.forEach(t=>{const o=by.get(t.m)||{t:0,n:0};o.t+=t.d;o.n++;by.set(t.m,o)});
 const list=[...by.entries()].sort((a,b)=>b[1].t-a[1].t);
 $("#spkCount").textContent=list.length+" govornika danas";
 const ua=$("#unmuteAll");ua.hidden=!muted.size;ua.textContent="Poništi ("+muted.size+")";
 const mx=list.length?list[0][1].t:1;
 $("#spkList").innerHTML=list.map(([m,o])=>`<li class="${muted.has(m)?"is-muted":""}${m===live.m?" now":""}"><i class="bar" style="background:${SH[m.g]}"></i><div class="nm"><span>${m.name}</span><small>${groups[m.g][1]}</small></div><span class="tm"><b>${dur(o.t)}</b><small>${o.n} ${o.n===1?"govor":o.n<5?"govora":"govora"}</small></span><i class="prog" style="width:${o.t/mx*100}%;background:${SH[m.g]}"></i><button type="button" class="mbtn" data-mi="${m.i}" aria-pressed="${muted.has(m)}" aria-label="${muted.has(m)?"Uključi zvuk za":"Utišaj"} ${m.name}">${muted.has(m)?I_SOFF:I_SON}</button></li>`).join("");
 apply($("#p-tok"));
}
$("#spkList").addEventListener("click",e=>{const b=e.target.closest("[data-mi]");if(b)toggleMute(mps[b.dataset.mi])});
$("#unmuteAll").onclick=()=>{muted.clear();try{localStorage.removeItem("utisani")}catch(e){}renderMuteUI();if(typeof applyAudio==="function"){autoNow=undefined;applyAudio()}};
renderMuteUI();

