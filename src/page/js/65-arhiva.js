/* arhiva: every sitting day, newest first */
if(!V1){const today={n:3,date:"Čet 19. nov",title:"Prva sednica, 3. dan",live:true};
 const spoke=new Set(talks.map(t=>t.m)),tops=[...new Map(talks.map(t=>[t.m,t.m.t])).entries()].sort((a,b)=>b[1]-a[1]).slice(0,5);
 const DAYS=[
  {...today,k:[["Trajanje",dur(elapsed)],["Govori",talks.length],["Govornici",spoke.size],["Opomene",talks.filter(t=>t.warn).length]],
   ag:[["Predlog zakona o lokalnim putevima","u raspravi"],["Predlog zakona o budžetskom sistemu","sledi"]],votes:[],
   top:tops.map(([m,t])=>[m,dur(t)]),video:"u toku",steno:"stiže sutra"},
  {n:2,date:"Sre 18. nov",title:"Prva sednica, 2. dan",k:[["Trajanje","6 h 10 min"],["Govori",58],["Govornici",41],["Opomene",2]],
   ag:[["Izbor potpredsednika Narodne skupštine","usvojeno"],["Imenovanje generalnog sekretara","usvojeno"],["Izbor članova radnih tela","odloženo"]],
   votes:[["Izbor potpredsednika",[143,98,0,9]],["Imenovanje generalnog sekretara",[141,0,97,12]]],
   top:mps.filter(m=>m.t).slice(0,5).map((m,i)=>[m,(42-i*6)+" min"]),video:"ceo dan",steno:"privremena"},
  {n:1,date:"Uto 17. nov",title:"Konstitutivna sednica",k:[["Trajanje","7 h 5 min"],["Govori",34],["Govornici",27],["Opomene",0]],
   ag:[["Potvrđivanje mandata narodnih poslanika","usvojeno"],["Izbor predsednika Narodne skupštine","usvojeno"],["Izbor potpredsednika","nastavak 18. nov"]],
   votes:[["Izbor predsednika Narodne skupštine",[142,0,0,108]]],
   top:mps.filter(m=>m.t).slice(5,10).map((m,i)=>[m,(38-i*5)+" min"]),video:"ceo dan",steno:"autorizovana"}];
 let cur=0;const dv=$("#dayview");
 const VC=["var(--ink)","var(--mute)","var(--seat)"];
 const vote=([t,[za,pr,uz,ng]])=>{const tot=za+pr+uz+ng;return `<div class="vote"><span>${t}</span><div class="vbar"><i style="width:${za/tot*100}%;background:var(--ink)"></i><i style="width:${pr/tot*100}%;background:var(--mute)"></i><i style="width:${uz/tot*100}%;background:var(--mute2)"></i></div><div class="vleg"><span>Za ${za}</span><span>Protiv ${pr}</span><span>Uzdržano ${uz}</span><span>Nije glasalo ${ng}</span><span>${za>=126?"Usvojeno":"Odbijeno"}</span></div></div>`};
 function renderDays(){$("#days").innerHTML=DAYS.map((d,i)=>`<li><button type="button" data-d="${i}" aria-current="${i===cur}"><span class="n">${d.n}.</span><span class="d">${d.date}</span><span class="s">${d.title}</span><span class="st">${d.live?'<i class="sq"></i>uživo':d.k[0][1]}</span></button></li>`).join("");apply($("#days"))}
 function renderDay(){const d=DAYS[cur];
  dv.innerHTML=`<div class="dv-h"><div><button type="button" class="b light dv-back" id="dvBack">‹ Arhiva</button><h3>${d.n}. dan  ${d.date}</h3><p>${d.title}${d.live?", u toku":""}</p></div>${d.live?'<span class="chip"><i class="sq"></i>Uživo</span>':""}</div>
  <div class="dv-k">${d.k.map(([a,b])=>`<div><span>${a}</span><b>${b}</b></div>`).join("")}</div>
  <div class="dv-g"><div class="dv-s"><h4>Dnevni red</h4><ol class="ag">${d.ag.map(([t,st])=>`<li><span>${t}</span><span class="tagx${st==="usvojeno"?" ok":""}">${st}</span></li>`).join("")}</ol></div>
  <div class="dv-s"><h4>Glasanja</h4>${d.votes.length?d.votes.map(vote).join(""):'<p class="m" style="font-size:15px">Danas još nije bilo glasanja</p>'}</div>
  <div class="dv-s"><h4>Najviše govorili</h4><ol class="tops">${d.top.map(([m,v])=>`<li><i style="background:${SH[m.g]}"></i><span>${m.name}</span><span class="v">${v}</span></li>`).join("")}</ol></div>
  <div class="dv-s"><h4>Zapis</h4><div class="vleg" style="font-size:15px;display:grid;gap:4px"><span>Snimak: ${d.video}</span><span>Stenografska beleška: ${d.steno}</span></div><div class="dv-links" style="margin-top:10px"><a class="b light" href="#sala" id="dvTok">Tok dana</a><a class="b light" href="#">Snimak</a><a class="b light" href="#">Beleška</a></div></div></div>`;
  apply(dv);const bk=$("#dvBack");if(bk)bk.onclick=()=>{dv.hidden=true};
  $("#dvTok").onclick=e=>{if(innerWidth<=760){e.preventDefault();dv.hidden=true;setTab("sala")}setView("day")}}
 $("#days").addEventListener("click",e=>{const b=e.target.closest("[data-d]");if(!b)return;cur=+b.dataset.d;renderDays();renderDay();dv.hidden=false;if(innerWidth>760)dv.scrollIntoView({block:"nearest",behavior:reduce?"auto":"smooth"})});
 renderDays();renderDay();if(innerWidth<=760)dv.hidden=true;
}
