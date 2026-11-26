/* script */
const MAP={"Dž":"Џ","DŽ":"Џ","dž":"џ","Lj":"Љ","LJ":"Љ","lj":"љ","Nj":"Њ","NJ":"Њ","nj":"њ"};
"abcčćdđefghijklmnoprsštuvzž".split("").forEach((c,i)=>{const y="абцчћдђефгхијклмнопрсштувзж"[i];MAP[c]=y;MAP[c.toUpperCase()]=y.toUpperCase()});
const tr=s=>s.replace(/D[žŽ]|dž|L[jJ]|lj|N[jJ]|nj|./g,c=>MAP[c]??c);
let cyr=false;const orig=new WeakMap();
const apply=el=>{const w=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);let n;while(n=w.nextNode()){const p=n.parentElement;if(!p||p.closest(".nt,script,style"))continue;if(!orig.has(n))orig.set(n,n.nodeValue);n.nodeValue=cyr?tr(orig.get(n)):orig.get(n)}};
const press=(sel,v,attr)=>$$(sel).forEach(b=>b.setAttribute("aria-pressed",b.dataset[attr]===v));
const setScript=v=>{cyr=v==="cyr";press("[data-script]",v,"script");root.lang=cyr?"sr-Cyrl":"sr-Latn";apply(document.body);store.set("pismo",v)};
/* theme: light, dark or auto (follows the phone/computer, also when it switches at night) */
const sysDark=matchMedia("(prefers-color-scheme: dark)");let modePref="auto";
const setMode=v=>{if(!["light","dark","auto"].includes(v))v="auto";modePref=v;root.dataset.mode=v==="auto"?(sysDark.matches?"dark":"light"):v;press("[data-mode]",v,"mode");store.set("tema",v)};
sysDark.addEventListener?.("change",()=>{if(modePref==="auto")setMode("auto")});
$$("[data-script]").forEach(b=>b.onclick=()=>setScript(b.dataset.script));
$$("[data-mode]").forEach(b=>b.onclick=()=>setMode(b.dataset.mode));

/* a muted MP's photo is greyed out with a small muted-speaker badge in the corner: wrap it with phm(); renderMuteUI (55-mutes) keeps
   .muted up to date. Sala (30-hall) renders before the mutes are loaded, so muted may not exist yet. */
function phm(m,inner){let on=false;try{on=muted.has(m)}catch(e){}return `<span class="phm${on?" is-mt":""}" data-mph="${m.i}">${inner}<span class="mbadge" aria-hidden="true">${I_POFF}</span></span>`}
