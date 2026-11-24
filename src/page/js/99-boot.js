/* boot */
setMode(store.get("tema")||(root.dataset.theme==="dark"||(!root.dataset.theme&&matchMedia("(prefers-color-scheme: dark)").matches)?"dark":"light"));
if(store.get("pismo")==="cyr")setScript("cyr");

}
