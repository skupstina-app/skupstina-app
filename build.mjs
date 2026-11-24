// Joins src/page/ back into one page: src/generated/index.html (+ a short content hash).
// Runs automatically before `wrangler deploy` / `wrangler dev` (see "build" in wrangler.jsonc).
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";

const dir = new URL("./src/page/", import.meta.url);
const read = (p) => readFileSync(new URL(p, dir), "utf8");
const all = (sub) => readdirSync(new URL(sub + "/", dir)).filter((f) => !f.startsWith(".")).sort().map((f) => read(`${sub}/${f}`)).join("");

let html = read("index.html");
html = html.replace("/*@css*/", () => all("css"));
html = html.replace(/<!--@html ([\w-]+)-->/g, (_, n) => read(`html/${n}.html`));
html = html.replace("/*@js*/", () => all("js"));
if (/\/\*@(css|js)\*\/|<!--@html /.test(html)) throw new Error("unfilled include marker");
if (!html.includes("/*MPS*/[]")) throw new Error("MP data placeholder /*MPS*/[] is missing");

const out = new URL("./src/generated/", import.meta.url);
mkdirSync(out, { recursive: true });
writeFileSync(new URL("index.html", out), html);
const hash = createHash("sha1").update(html).digest("hex").slice(0, 10);
writeFileSync(new URL("version.js", out), `export default ${JSON.stringify(hash)};\n`);
console.log(`page built: ${html.length} chars, ${hash}`);
