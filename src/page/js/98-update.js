/* new deploys: the page knows its version (build.mjs fills it in) and asks /api/version.
   A home-screen app stays open in the background, so: when it comes back to the screen and a new version is out, it reloads
   by itself; while it is on screen it only marks Podešavanja → Osveži aplikaciju ("novo"). That row always reloads fresh. */
{
const VER="/*@ver*/";let fresh=false,hiddenAt=0;
async function check(){try{const j=await(await fetch("/api/version",{cache:"no-store"})).json();fresh=!!j.v&&j.v!==VER}catch(e){}
 $("#pupdNew").hidden=!fresh;return fresh}
async function update(){const b=$("#pupd");if(b)b.disabled=true;
 try{if(window.caches)for(const k of await caches.keys())await caches.delete(k)}catch(e){}
 try{await fetch("/",{cache:"reload"})}catch(e){}
 location.reload()}
$("#pupd").onclick=update;
document.addEventListener("visibilitychange",async()=>{if(document.hidden){hiddenAt=Date.now();return}
 if(await check()&&hiddenAt&&Date.now()-hiddenAt>60000)update()});
addEventListener("pageshow",e=>{if(e.persisted)check().then(n=>{if(n)update()})});
setTimeout(check,5000);setInterval(()=>{if(!document.hidden)check()},10*60*1000);
}
