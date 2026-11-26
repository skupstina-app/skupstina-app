// Joins src/page/ back into one page: src/generated/index.html (+ a short content hash),
// and the admin seat editor with the shared seat plan: src/generated/sala.html.
// Runs automatically before `wrangler deploy` / `wrangler dev` (see "build" in wrangler.jsonc).
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { BADGE_H } from "./src/badges.mjs";
import { COLORS } from "./src/colors.mjs";

const dir = new URL("./src/page/", import.meta.url);
const read = (p) => readFileSync(new URL(p, dir), "utf8");
const all = (sub) => readdirSync(new URL(sub + "/", dir)).filter((f) => !f.startsWith(".")).sort().map((f) => read(`${sub}/${f}`)).join("");

// avatars: every 64 px PNG in assets/avatars/64 is one a user can pick (its file name is its id);
// assets/avatars/uskoro holds the "coming soon" tiles and the empty avatar. All are served by the Worker at /a/<id>.png.
const av = new URL("./assets/avatars/", import.meta.url);
const pngs = (sub) => readdirSync(new URL(sub + "/", av)).filter((f) => f.endsWith(".png")).sort().map((f) => f.slice(0, -4));
const AV_IDS = pngs("64"), AV_SOON = pngs("uskoro").filter((n) => n !== "prazno");
const avFiles = Object.fromEntries([
  ...AV_IDS.map((n) => [n, readFileSync(new URL(`64/${n}.png`, av)).toString("base64")]),
  ...pngs("uskoro").map((n) => ["uskoro-" + n, readFileSync(new URL(`uskoro/${n}.png`, av)).toString("base64")]),
]);

let html = read("index.html");
html = html.replace("/*@css*/", () => all("css"));
html = html.replace(/<!--@html ([\w-]+)-->/g, (_, n) => read(`html/${n}.html`));
html = html.replace("/*@js*/", () => all("js"));
html = html.replace("/*@avatars*/[]", () => JSON.stringify(AV_IDS)).replace("/*@soon*/[]", () => JSON.stringify(AV_SOON));
// watching badges: the page gets the same hour thresholds the Worker uses (src/badges.mjs)
if (!html.includes("/*@badgeh*/[]")) throw new Error("badge marker /*@badgeh*/[] is missing (js/19-badges.js)");
html = html.replace("/*@badgeh*/[]", () => JSON.stringify(BADGE_H));
// chat name colours: the CSS rules and the unlock functions come from src/colors.mjs (the same file auth.js checks with)
if (!html.includes("/*@ucolors*/") || !html.includes("/*@colors*/")) throw new Error("colour markers /*@ucolors*/ (css/96-auth.css) or /*@colors*/ (js/20-chat.js) are missing");
html = html.replace("/*@ucolors*/", () => COLORS.map(([l], n) => `.u${n},#msgs .u${n}{color:${l}}`).join("") + "\n" + COLORS.map(([, d], n) => `:root[data-mode=dark] .u${n},:root[data-mode=dark] #msgs .u${n}{color:${d}}`).join("") + "\n");
html = html.replace("/*@colors*/", () => readFileSync(new URL("./src/colors.mjs", import.meta.url), "utf8").replace(/^\/\/.*\n/gm, "").replace(/\s*\/\/ .*$/gm, "").replace(/^export /gm, ""));
if (/\/\*@(css|js|avatars|soon|badgeh|ucolors|colors)\*\/|<!--@html /.test(html)) throw new Error("unfilled include marker");
if (!html.includes("/*MPS*/[]")) throw new Error("MP data placeholder /*MPS*/[] is missing");

const out = new URL("./src/generated/", import.meta.url);
mkdirSync(out, { recursive: true });
// the page knows its own version (98-update.js compares it with /api/version to pick up a new deploy)
if (!html.includes('"/*@ver*/"')) throw new Error("version marker \"/*@ver*/\" is missing");
const hash = createHash("sha1").update(html).digest("hex").slice(0, 10);
html = html.replace('"/*@ver*/"', JSON.stringify(hash));
writeFileSync(new URL("index.html", out), html);
writeFileSync(new URL("version.js", out), `export default ${JSON.stringify(hash)};\n`);
writeFileSync(new URL("avatars.js", out), `// built from assets/avatars by build.mjs\nexport const AVATAR_IDS = ${JSON.stringify(AV_IDS)};\nexport const AVATAR_FILES = ${JSON.stringify(avFiles)};\n`);
// the admin seat editor shares the seat plan with the page (src/page/js/28-seatplan.js), so both show the same seats
let sala = readFileSync(new URL("./src/admin/sala.html", import.meta.url), "utf8");
if (!sala.includes("/*@seatplan*/")) throw new Error("seat plan marker /*@seatplan*/ is missing in src/admin/sala.html");
sala = sala.replace("/*@seatplan*/", () => read("js/28-seatplan.js"));
writeFileSync(new URL("sala.html", out), sala);
console.log(`page built: ${html.length} chars, ${hash}`);
