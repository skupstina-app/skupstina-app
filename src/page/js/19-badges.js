/* watching badges: a small pixel building in front of a name in the chat, grown by the hours of live stream watched.
   The hour thresholds come from src/badges.mjs (build.mjs fills BADGE_H); the Worker puts the level on each chat message (m.b).
   Each level is a 15×15 picture drawn once as an SVG <symbol> (#bdg-1…); a badge is <svg><use href="#bdg-N"></svg>, so 200
   messages don't mean 200 copies of the pixels. Colours are fixed (it is a picture), picked to read on light and dark. */
const BADGE_H=/*@badgeh*/[];
/* the levels have no names on screen (only the picture); for whoever edits the art: 1-5 houses, 6-11 the town hall,
   12-15 the Assembly, 16-18 the big parliament, 19 the all-gold parliament on a stand, like a trophy (150 h) */
/** level 0…18 for watched seconds (0 = under the first threshold, no badge) */
const badgeLvl=s=>{const h=(+s||0)/3600;let n=0;while(n<BADGE_H.length&&h>=BADGE_H[n])n++;return n};
const BADGE_MAX=19;
const badgeOk=n=>Number.isInteger(n)&&n>=1&&n<=BADGE_MAX&&n<=BADGE_H.length;
/** the badge as markup ("" for no badge); decorative, the name next to it is what is read out */
const badgeSvg=(n,cls)=>badgeOk(n)?`<svg class="bdg${cls?" "+cls:""}" viewBox="0 0 15 15" aria-hidden="true" focusable="false" shape-rendering="crispEdges"><use href="#bdg-${n}"/></svg>`:"";
{
 const C={n:"#b07a43",N:"#7a4c24",M:"#6e4320",B:"#b5603a",j:"#8a4527",R:"#c24e36",Q:"#963f2c",w:"#ece3cd",x:"#6fa8d6",d:"#7d6a4a",e:"#5f9a41",P:"#e86a9a",g:"#9aa0a8",G:"#737a83",k:"#3fa483",K:"#2e8266",y:"#f2b632",Y:"#cc8d14",L:"#ffe7a3",Z:"#a8700c",p:"#7a7a7a",r:"#d03a40",b:"#2f63c0",W:"#f6f6f6"};
 const E=".............";
 const sub=(g,a,b)=>g.map(r=>r.split(a).join(b));
 const put=(g,pts,ch)=>{const m=g.map(r=>r.split(""));pts.forEach(([r,c])=>m[r][c]=ch);return m.map(r=>r.join(""))};
 const gold=g=>sub(sub(g,"k","y"),"K","Y");
 const l1=[E,E,E,E,E,".......NN....",".....NNNNN...","...NNNNNNNN..","...nnNnnNnn..","...nnNnxNnn..","...ndNnnNnn..","...ndNnnNnn..","eeeeeeeeeeeee"];
 const l2=[E,E,E,"........g....","......M.g....",".....MMMg....","....MMMMM....","...MMMMMMM...","..MMMMMMMMM..","..nNnNnNnNn..","..nxxNnNddn..","..nxxNnNddn..","eeeeeeeeeeeee"];
 const l3=[E,E,E,E,"......R..g...",".....RRR.g...","....RRRRRg...","...RRRRRRR...","..RRRRRRRRR..","..BjBBjBBjB..","..BxxjBBddB..","..jxxBBjddB..","eeeeeeeeeeeee"];
 const l4=[E,E,E,E,"......R..g...",".....RRR.g...","....RRRRRg...","...RRRRRRR...","..QQQQQQQQQ..","..wwwwwwwww..","..wxxwwwddw..","..wxxwwwddw..","eeeeeeeeeeeee"];
 let l5=put(l4,[[10,2],[11,2],[10,5],[11,5]],"k");l5=put(l5,[[11,0],[11,1]],"P");l5=put(l5,[[11,11],[11,12],[10,12]],"W");l5=put(put(l5,[[5,2],[5,3]],"W"),[[6,3]],"G");
 const mz=[".QQQQQQQQQQQ.",".wwwwwwwwwww.",".wwwbbbbbwww.",".wwwwwwwwwww.",".wxxwwdwwxxw.",".wxxwwdwwxxw.","ggggggggggggg"];
 const l6=[E,E,E,E,E,E,...mz];
 const l7=[E,E,".prr.........",".pbb.........",".pWW.........",".p...........",...mz];
 const l8=[".prr.........",".pbb.........",".pWW.........",".p...........",".QQQQQQQQQQQ.",".wwwwwwwwwww.",".wxwxwxwxwxw.",".wwwwwwwwwww.",".wwwbbbbbwww.",".wwwwwwwwwww.",".wxwxwdwxwxw.",".wxwxwdwxwxw.","ggggggggggggg"];
 const l9=[".p....y......",".prr.QQQ.....",".pbb.dWd.....",".pWW.www.....",".QQQQQQQQQQQ.",".wwwwwwwwwww.",".wxwxwxwxwxw.",".wwwwwwwwwww.",".wwwbbbbbwww.",".wwwwwwwwwww.",".wxwxwdwxwxw.",".wxwxwdwxwxw.","gggggrrrggggg"];
 const sk=["......prr....","......pbb....","......pWW....",".....kkk.....","....kkkkK....","...kkkkkkK...","..wwwwwwwww..",".wwwwwwwwwww.",".wdwdwdwdwdw.",".wdwdwdwdwdw.",".wdwdwdwdwdw.","ggggggggggggg","GGGGGGGGGGGGG"];
 const noFlag=g=>g.map((r,i)=>i<3?E:r),carpet=g=>put(g,[[11,5],[11,6],[11,7],[12,5],[12,6],[12,7]],"r");
 const big=["...............",".......y.......","......kkk......",".....kkkkK.....","....kkkkkkK....",".....wxwxw.....",".k...wwwww...k.","kkk.wwwwwww.kkk","www.wwwwwww.www","wwwwwwwwwwwwwww","wxwxwdwdwdwxwxw","wxwxwdwdwdwxwxw","wxwxwdwdwdwxwxw","ggggggggggggggg","GGGGGGGGGGGGGGG"];
 let l18=gold(big);
 l18=put(l18,[...Array(15).keys()].map(c=>[9,c]),"Y");
 l18=put(l18,[[3,1],[4,1],[5,1],[3,13],[4,13],[5,13]],"p");
 l18=put(l18,[[3,2],[3,3],[3,11],[3,12]],"r");l18=put(l18,[[4,2],[4,3],[4,11],[4,12]],"b");l18=put(l18,[[5,2],[5,3],[5,11],[5,12]],"W");
 l18=put(l18,[[13,6],[13,7],[13,8],[14,6],[14,7],[14,8]],"r");
 /* 19: the trophy: the whole big parliament in gold, darker gold windows, columns and cornice for depth, a light
    shine down the left of the domes (polished metal), no flags, standing on a dark wooden stand with a gold plate */
 let l19=sub(sub(sub(gold(big),"w","y"),"x","Z"),"d","Z");
 l19=put(l19,[...Array(15).keys()].map(c=>[9,c]),"Y");
 l19=put(l19,[[1,7],[2,6],[3,5],[4,4],[5,5],[6,1],[7,0],[7,12],[8,4]],"L");
 l19=put(l19,[...Array(15).keys()].map(c=>[13,c]),".");
 l19=put(l19,[...Array(13).keys()].map(c=>[13,c+1]),"N");
 l19=put(l19,[...Array(15).keys()].map(c=>[14,c]),"M");
 l19=put(l19,[[14,5],[14,6],[14,7],[14,8],[14,9]],"y");
 const ART=[l1,l2,l3,l4,l5,l6,l7,l8,l9,sub(l9,"Q","k"),sub(l9,"Q","y"),noFlag(sk),carpet(sk),gold(noFlag(sk)),carpet(gold(sk)),big,gold(big),l18,l19];
 /* one <symbol> per level; runs of the same colour in a row become one <rect>; small pictures sit centred on the ground line */
 const sym=(g,i)=>{const ox=Math.floor((15-g[0].length)/2),oy=15-g.length;let r="";
  g.forEach((row,y)=>{for(let x=0;x<row.length;){const c=row[x];let w=1;while(row[x+w]===c)w++;if(C[c])r+=`<rect x="${x+ox}" y="${y+oy}" width="${w}" height="1" fill="${C[c]}"/>`;x+=w}});
  return `<symbol id="bdg-${i+1}" viewBox="0 0 15 15">${r}</symbol>`};
 const sp=document.createElementNS("http://www.w3.org/2000/svg","svg");
 sp.setAttribute("aria-hidden","true");sp.setAttribute("width","0");sp.setAttribute("height","0");sp.style.cssText="position:absolute;width:0;height:0;overflow:hidden";
 sp.innerHTML=ART.map(sym).join("");document.body.prepend(sp);
}
