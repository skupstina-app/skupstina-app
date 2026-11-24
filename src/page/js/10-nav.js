/* nav + menu */
const nav=$("#nav"),sheet=$("#sheet"),mb=$("#menuBtn");
const heroObs=new IntersectionObserver(e=>nav.classList.toggle("solid",!e[0].isIntersecting),{rootMargin:"-72px 0px 0px 0px"});heroObs.observe($("#heroCta"));
const menu=o=>{nav.classList.toggle("open",o);sheet.classList.toggle("show",o);mb.setAttribute("aria-expanded",o);mb.setAttribute("aria-label",o?"Zatvori meni":"Meni");document.body.classList.toggle("locked",o);if(o)setTimeout(()=>sheet.querySelector("a").focus({preventScroll:true}),200)};
mb.onclick=()=>menu(mb.getAttribute("aria-expanded")!=="true");
$$(".links a").forEach(a=>a.addEventListener("click",()=>menu(false)));
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&sheet.classList.contains("show")){menu(false);mb.focus()}});

