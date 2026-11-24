/* mini player: when the live window scrolls away on larger screens, the video keeps playing in a corner */
{const vb=$("#vbox");let closed=false;
 const io2=new IntersectionObserver(e=>{const out=!e[0].isIntersecting&&e[0].boundingClientRect.top<0;vb.classList.toggle("mini",out&&!closed&&innerWidth>760);if(!out)closed=false},{threshold:0});
 io2.observe(vb);$("#vx").onclick=()=>{closed=true;vb.classList.remove("mini")};}
/* fullscreen with chat beside the stream */
{const b=$("#vfs");
 const set=on=>{document.body.classList.toggle("theater",on);b.setAttribute("aria-pressed",on);b.innerHTML=on?I_FSX:I_FS;b.setAttribute("aria-label",on?"Izađi iz celog ekrana":"Ceo ekran sa razgovorom");$("#vbox").classList.remove("mini");
  if(on){try{const p=document.documentElement.requestFullscreen?.();p&&p.then(()=>screen.orientation?.lock?.("landscape").catch(()=>{})).catch(()=>{})}catch(e){}}
  else{try{document.fullscreenElement&&document.exitFullscreen();screen.orientation?.unlock?.()}catch(e){}}};
 b.onclick=()=>set(!document.body.classList.contains("theater"));
 document.addEventListener("fullscreenchange",()=>{if(!document.fullscreenElement&&document.body.classList.contains("theater"))set(false)});
 document.addEventListener("keydown",e=>{if(e.key==="Escape"&&document.body.classList.contains("theater"))set(false)});}
