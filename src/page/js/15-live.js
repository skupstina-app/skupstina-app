/* live */
$("#nowName").textContent=live.m.name;$("#nowMeta").textContent=groups[live.m.g][1];

const tick=()=>{const s=Math.floor((Date.now()-liveStart)/1000);$("#timer").textContent=Math.floor(s/60)+":"+String(s%60).padStart(2,"0")};tick();setInterval(tick,1000);
