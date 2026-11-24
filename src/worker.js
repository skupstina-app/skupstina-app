var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/worker.js
import PAGE from "./b95c6a1d53d7ef6bd855114c9d7b40d9198e14cf-index.html";
import HOLD from "./d2e6d0db06ac80be516733b2f9f8eedaec392619-hold.html";
var UA = "Mozilla/5.0 (compatible; skupstina-app; independent non-commercial)";
var PG = "https://www.parlament.gov.rs";
var LIST_URL = PG + "/" + encodeURI("\u043D\u0430\u0440\u043E\u0434\u043D\u0430-\u0441\u043A\u0443\u043F\u0448\u0442\u0438\u043D\u0430/\u0441\u0430\u0441\u0442\u0430\u0432/\u043D\u0430\u0440\u043E\u0434\u043D\u0438-\u043F\u043E\u0441\u043B\u0430\u043D\u0438\u0446\u0438/\u0430\u043A\u0442\u0443\u0435\u043B\u043D\u0438-\u0441\u0430\u0437\u0438\u0432.11.html");
var FONT_CDN = "https://cdn.jsdelivr.net/npm/@fontsource/";
var now = /* @__PURE__ */ __name(() => (/* @__PURE__ */ new Date()).toISOString(), "now");
var C2L = { \u0410: "A", \u0411: "B", \u0412: "V", \u0413: "G", \u0414: "D", \u0402: "\u0110", \u0415: "E", \u0416: "\u017D", \u0417: "Z", \u0418: "I", \u0408: "J", \u041A: "K", \u041B: "L", \u0409: "Lj", \u041C: "M", \u041D: "N", \u040A: "Nj", \u041E: "O", \u041F: "P", \u0420: "R", \u0421: "S", \u0422: "T", \u040B: "\u0106", \u0423: "U", \u0424: "F", \u0425: "H", \u0426: "C", \u0427: "\u010C", \u040F: "D\u017E", \u0428: "\u0160" };
for (const [k, v] of Object.entries({ ...C2L })) C2L[k.toLowerCase()] = v.toLowerCase();
var toLat = /* @__PURE__ */ __name((s) => [...s || ""].map((c) => C2L[c] ?? c).join(""), "toLat");
var strip = /* @__PURE__ */ __name((s) => (s || "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, " ").trim(), "strip");
var TITLE = /^(проф\.?|др\.?|мр\.?|доц\.?|дипл\.?|prof\.?|dr\.?|mr\.?|doc\.?|dipl\.?)$/i;
var cap = /* @__PURE__ */ __name((w) => w.split("-").map((p) => p ? p[0].toLocaleUpperCase("sr") + p.slice(1).toLocaleLowerCase("sr") : p).join("-"), "cap");
function splitName(raw) {
  const toks = strip(raw).replace(/\s+-\s+/g, "-").split(" ").filter(Boolean), title = [], rest = [];
  for (const t of toks) (TITLE.test(t) ? title : rest).push(t.toLocaleLowerCase("sr"));
  return { first: rest.slice(0, -1).map(cap).join(" "), last: cap(rest.at(-1) || ""), title: title.join(" ") };
}
__name(splitName, "splitName");
async function sha256(buf) {
  const b = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
}
__name(sha256, "sha256");
async function get(url, opt = {}) {
  const r = await fetch(url, { headers: { "user-agent": UA, "accept-language": "sr" }, ...opt });
  if (!r.ok) throw new Error(url + " -> " + r.status);
  return r;
}
__name(get, "get");
var log = /* @__PURE__ */ __name((env, job, msg) => env.DB.prepare("INSERT INTO import_log(at,job,msg) VALUES(?,?,?)").bind(now(), job, String(msg).slice(0, 2e3)).run(), "log");
var getState = /* @__PURE__ */ __name(async (env, k) => (await env.DB.prepare("SELECT v FROM import_state WHERE k=?").bind(k).first())?.v ?? null, "getState");
var setState = /* @__PURE__ */ __name((env, k, v) => env.DB.prepare("INSERT OR REPLACE INTO import_state(k,v) VALUES(?,?)").bind(k, v).run(), "setState");
async function importList(env) {
  const html = await (await get(LIST_URL)).text();
  const rows = [...html.matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map((m) => m[1]).filter((r) => /\.\d+\.245\.html/.test(r));
  const ids = [], st = [];
  for (const r of rows) {
    const id = +r.match(/\.(\d+)\.245\.html/)[1];
    const tds = [...r.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) => strip(m[1]));
    const listName = tds[0] || "";
    const native = (listName.match(/\(([^)]+)\)/) || [])[1] || null;
    ids.push(id);
    st.push(env.DB.prepare("INSERT INTO mps(id,party_code,place,birth_year,list_row,name_native,first_seen,updated_at,active,convocation) VALUES(?,?,?,?,?,?,?,?,1,15) ON CONFLICT(id) DO UPDATE SET party_code=excluded.party_code,place=excluded.place,birth_year=excluded.birth_year,list_row=excluded.list_row,name_native=excluded.name_native,active=1,updated_at=excluded.updated_at").bind(id, tds[1] && tds[1] !== "-" ? tds[1] : null, tds[2] || null, parseInt(tds[3]) || null, listName, native, now(), now()));
  }
  if (ids.length < 200) throw new Error("list page parsed only " + ids.length + " MPs");
  st.push(env.DB.prepare("UPDATE mps SET active=0 WHERE id NOT IN (" + ids.join(",") + ")"));
  await env.DB.batch(st);
  await setState(env, "mps_queue", JSON.stringify(ids));
  await setState(env, "mps_list_at", now());
  await log(env, "mps", "list ok: " + ids.length);
  return ids.length;
}
__name(importList, "importList");
function field(html, label) {
  const re = new RegExp("<h4>\\s*" + label + "\\s*</h4>\\s*<p>([\\s\\S]*?)</p>");
  const m = html.match(re);
  return m ? strip(m[1]) : null;
}
__name(field, "field");
async function importProfile(env, id) {
  const html = await (await get(PG + "/_." + id + ".245.html")).text();
  const i0 = html.indexOf("single_member"), i1 = html.indexOf("<!-- /block -->", i0);
  const blk = html.slice(i0, i1 > 0 ? i1 : void 0);
  const h2 = (blk.match(/<h2>([\s\S]*?)<\/h2>/) || [])[1] || "";
  let heading = strip(h2), native = null, cyrName = heading;
  const par = heading.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  if (par) {
    native = par[1];
    cyrName = par[2];
  }
  const n = splitName(cyrName);
  const name_cyr = (n.first + " " + n.last).trim();
  let name_lat = toLat(name_cyr);
  if (native) {
    const nn = splitName(native);
    name_lat = (nn.first + " " + nn.last).trim();
  }
  const g = /* @__PURE__ */ __name((l) => field(blk, l), "g");
  const partyRaw = g("\u041F\u043E\u043B\u0438\u0442\u0438\u0447\u043A\u0430 \u0441\u0442\u0440\u0430\u043D\u043A\u0430 \u043D\u0430 \u0447\u0438\u0458\u0438 \u043F\u0440\u0435\u0434\u043B\u043E\u0433 \u0458\u0435 \u0438\u0437\u0430\u0431\u0440\u0430\u043D/\u0430");
  const photo = (blk.match(/image_holder[^>]*>\s*<img src="([^"]*\/poslanici\/[^"]+)"/) || [])[1] || null;
  await env.DB.prepare("UPDATE mps SET name_cyr=?,name_lat=?,first_name=?,last_name=?,title=?,electoral_list=?,mp_group=?,party=?,mandate_date=?,profession=?,assembly_role=COALESCE(?,assembly_role),place=COALESCE(?,place),photo_src=?,updated_at=? WHERE id=?").bind(
    name_cyr,
    name_lat,
    n.first,
    n.last,
    n.title || null,
    g("\u0418\u0437\u0431\u043E\u0440\u043D\u0430 \u043B\u0438\u0441\u0442\u0430"),
    g("\u041F\u043E\u0441\u043B\u0430\u043D\u0438\u0447\u043A\u0430 \u0433\u0440\u0443\u043F\u0430"),
    partyRaw && !/^-\s*\(-\)$/.test(partyRaw) ? partyRaw : null,
    g("\u0414\u0430\u0442\u0443\u043C \u043F\u043E\u0442\u0432\u0440\u0452\u0438\u0432\u0430\u045A\u0430 \u043F\u043E\u0441\u043B\u0430\u043D\u0438\u0447\u043A\u043E\u0433 \u043C\u0430\u043D\u0434\u0430\u0442\u0430"),
    g("\u0417\u0430\u043D\u0438\u043C\u0430\u045A\u0435"),
    g("\u0424\u0443\u043D\u043A\u0446\u0438\u0458\u0430 \u0443 \u041D\u0430\u0440\u043E\u0434\u043D\u043E\u0458 \u0441\u043A\u0443\u043F\u0448\u0442\u0438\u043D\u0438 \u0420\u0435\u043F\u0443\u0431\u043B\u0438\u043A\u0435 \u0421\u0440\u0431\u0438\u0458\u0435"),
    g("\u041C\u0435\u0441\u0442\u043E \u043F\u0440\u0435\u0431\u0438\u0432\u0430\u043B\u0438\u0448\u0442\u0430"),
    photo,
    now(),
    id
  ).run();
  if (photo) {
    const have = await env.DB.prepare("SELECT src FROM photos WHERE id=?").bind(id).first();
    if (!have || have.src !== photo) {
      const big = photo.replace("/upload/thumbs/images/", "/upload/images/").replace(/_150x0(\.\w+)$/, "$1");
      let r;
      try {
        r = await get(PG + big);
      } catch (e) {
        r = await get(PG + photo);
      }
      const buf = await r.arrayBuffer();
      await env.DB.prepare("INSERT OR REPLACE INTO photos(id,src,type,bytes,sha256,fetched_at) VALUES(?,?,?,?,?,?)").bind(id, photo, r.headers.get("content-type") || "image/jpeg", buf, await sha256(buf), now()).run();
    }
  }
}
__name(importProfile, "importProfile");
async function mpBatch(env, n = 12) {
  let q = JSON.parse(await getState(env, "mps_queue") || "[]");
  const take = q.splice(0, n), errs = [];
  for (const id of take) {
    try {
      await importProfile(env, id);
    } catch (e) {
      errs.push(id + ": " + e.message);
    }
  }
  await setState(env, "mps_queue", JSON.stringify(q));
  if (errs.length) await log(env, "mps", errs.join(" | "));
  if (!q.length) {
    await setState(env, "mps_done", now());
    await log(env, "mps", "profiles done");
  }
  return { done: take.length, left: q.length, errs };
}
__name(mpBatch, "mpBatch");
var ROLE_P = "\u041F\u0440\u0435\u0434\u0441\u0435\u0434\u043D\u0438\u043A \u041D\u0430\u0440\u043E\u0434\u043D\u0435 \u0441\u043A\u0443\u043F\u0448\u0442\u0438\u043D\u0435";
var ROLE_V = "\u041F\u043E\u0442\u043F\u0440\u0435\u0434\u0441\u0435\u0434\u043D\u0438\u043A \u041D\u0430\u0440\u043E\u0434\u043D\u0435 \u0441\u043A\u0443\u043F\u0448\u0442\u0438\u043D\u0435";
async function importLeadership(env) {
  const up = /* @__PURE__ */ __name((s) => (s || "").toLocaleUpperCase("sr").replace(/[ABEKMHOPCTXJ]/g, (c) => "\u0410\u0412\u0415\u041A\u041C\u041D\u041E\u0420\u0421\u0422\u0425\u0408"["ABEKMHOPCTXJ".indexOf(c)]).replace(/\s+/g, " ").trim(), "up");
  const { results: mps } = await env.DB.prepare("SELECT id,name_cyr FROM mps WHERE active=1 AND name_cyr IS NOT NULL").all();
  const byName = new Map(mps.map((m) => [up(m.name_cyr), m.id]));
  const vhtml = await (await get(PG + "/" + encodeURI("\u043D\u0430\u0440\u043E\u0434\u043D\u0430-\u0441\u043A\u0443\u043F\u0448\u0442\u0438\u043D\u0430/\u0441\u0430\u0441\u0442\u0430\u0432/\u043F\u043E\u0442\u043F\u0440\u0435\u0434\u0441\u0435\u0434\u043D\u0438\u0446\u0438/\u043F\u043E\u0442\u043F\u0440\u0435\u0434\u0441\u0435\u0434\u043D\u0438\u0446\u0438.9.html"))).text();
  const vice = [...new Set([...vhtml.matchAll(/потпредседници\/[^'"]+\.\d+\.html['"]>([^<]+)<\/a>/g)].map((m) => up(strip(m[1]))))].filter((n) => byName.has(n));
  const bhtml = await (await get(PG + "/" + encodeURI("\u043D\u0430\u0440\u043E\u0434\u043D\u0430-\u0441\u043A\u0443\u043F\u0448\u0442\u0438\u043D\u0430/\u0441\u0430\u0441\u0442\u0430\u0432/\u043F\u0440\u0435\u0434\u0441\u0435\u0434\u043D\u0438\u043A/\u0431\u0438\u043E\u0433\u0440\u0430\u0444\u0438\u0458\u0430-.2418.html"))).text();
  const i0 = bhtml.indexOf("col w538"), btext = up(strip(bhtml.slice(i0 > 0 ? i0 : 0, (i0 > 0 ? i0 : 0) + 2e4)));
  let pres = null, best = 1e9;
  for (const [n, id] of byName) {
    const k = btext.indexOf(n);
    if (k >= 0 && k < best && !vice.includes(n)) {
      best = k;
      pres = id;
    }
  }
  if (!vice.length && !pres) throw new Error("leadership pages parsed nothing");
  const st = [env.DB.prepare("UPDATE mps SET assembly_role=NULL")];
  if (pres) st.push(env.DB.prepare("UPDATE mps SET assembly_role=? WHERE id=?").bind(ROLE_P, pres));
  for (const n of vice) st.push(env.DB.prepare("UPDATE mps SET assembly_role=? WHERE id=?").bind(ROLE_V, byName.get(n)));
  await env.DB.batch(st);
  await setState(env, "lead_at", now());
  await log(env, "lead", "speaker " + (pres || "none") + ", vice " + vice.length);
  return { pres, vice: vice.length };
}
__name(importLeadership, "importLeadership");
async function mpsJson(env) {
  const { results } = await env.DB.prepare("SELECT m.id,m.name_lat,m.name_cyr,m.electoral_list,m.mp_group,m.party,m.party_code,m.place,m.birth_year,m.assembly_role,m.title,(SELECT 1 FROM photos p WHERE p.id=m.id) AS ph FROM mps m WHERE m.active=1 AND m.name_lat IS NOT NULL ORDER BY m.last_name,m.first_name").all();
  return results.map((r) => ({ id: r.id, l: r.name_lat, c: r.name_cyr, list: r.electoral_list, pg: r.mp_group, party: r.party, code: r.party_code, place: r.place, by: r.birth_year, role: r.assembly_role, ph: r.ph ? 1 : 0 }));
}
__name(mpsJson, "mpsJson");
var H = /* @__PURE__ */ __name((body, type, extra = {}) => new Response(body, { headers: { "content-type": type, "x-content-type-options": "nosniff", "referrer-policy": "strict-origin-when-cross-origin", ...extra } }), "H");
var json = /* @__PURE__ */ __name((o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } }), "json");
var esc = /* @__PURE__ */ __name((s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;"), "esc");
async function fonts(req, ctx, name) {
  const dm = name === "departure-mono.woff2";
  if (!dm && !/^wix-madefor-(display|text)-(latin|latin-ext|cyrillic)-(400|500)-normal\.woff2$/.test(name)) return new Response("not found", { status: 404 });
  const cache = caches.default, key = new Request(new URL(req.url).origin + "/fonts/" + name);
  let r = await cache.match(key);
  if (r) return r;
  const fam = name.startsWith("wix-madefor-display") ? "wix-madefor-display" : "wix-madefor-text";
  const up = await fetch(dm ? "https://cdn.jsdelivr.net/gh/rektdeckard/departure-mono@main/public/assets/DepartureMono-Regular.woff2" : FONT_CDN + fam + "@5.3.0/files/" + name);
  if (!up.ok) return new Response("font unavailable", { status: 502 });
  r = new Response(await up.arrayBuffer(), { headers: { "content-type": "font/woff2", "cache-control": "public, max-age=31536000, immutable", "access-control-allow-origin": "*" } });
  ctx.waitUntil(cache.put(key, r.clone()));
  return r;
}
__name(fonts, "fonts");
async function page(env, ctx, req) {
  const row = await env.DB.prepare("SELECT v FROM assets WHERE name='index.html'").first().catch(() => null);
  const ver = row ? "d" + row.v : "b" + (env.PAGE_V || "1");
  const cache = caches.default, key = new Request(new URL(req.url).origin + "/__page_" + ver);
  let r = await cache.match(key);
  if (r) return r;
  let html = PAGE;
  if (row) html = (await env.DB.prepare("SELECT body FROM assets WHERE name='index.html'").first()).body;
  const data = JSON.stringify(await mpsJson(env)).replace(/</g, "\\u003c");
  r = H(html.replace("/*MPS*/[]", data), "text/html; charset=utf-8", { "cache-control": "public, max-age=300" });
  ctx.waitUntil(cache.put(key, r.clone()));
  return r;
}
__name(page, "page");
async function contact(req, env) {
  let f;
  try {
    f = await req.formData();
  } catch {
    return json({ ok: false }, 400);
  }
  if ((f.get("website") || "").length) return json({ ok: true });
  const msg = String(f.get("msg") || "").trim().slice(0, 4e3), mail = String(f.get("mail") || "").trim().slice(0, 200), kind = String(f.get("kind") || "poruka").slice(0, 40);
  if (msg.length < 3) return json({ ok: false, err: "short" }, 400);
  const ip = req.headers.get("cf-connecting-ip") || "", day = now().slice(0, 10);
  const ipHash = (await sha256(new TextEncoder().encode(ip + day + (env.SALT || "")))).slice(0, 16);
  const c = await env.DB.prepare("SELECT COUNT(*) n FROM messages WHERE ip_hash=? AND at>=?").bind(ipHash, day).first();
  if (c.n >= 10) return json({ ok: false, err: "limit" }, 429);
  await env.DB.prepare("INSERT INTO messages(at,kind,msg,mail,ip_hash) VALUES(?,?,?,?,?)").bind(now(), kind, msg, mail || null, ipHash).run();
  return json({ ok: true });
}
__name(contact, "contact");
function adminPage(title, body, refresh) {
  return H("<!doctype html><meta charset=utf-8><meta name=robots content=noindex>" + (refresh ? '<meta http-equiv=refresh content="' + refresh + '">' : "") + "<title>" + title + '</title><body style="font:16px system-ui;padding:24px"><h1>' + title + "</h1>" + body, "text/html; charset=utf-8", { "cache-control": "no-store" });
}
__name(adminPage, "adminPage");
// ---- chat (v0: open names, basic filter; login + full moderation later) ----
var CHAT_KEEP = 1e3, CHAT_INIT = 80, CHAT_GAP = 3e3, CHAT_LEN = 300, REPORTS_TO_HIDE = 3;
var LOOK = { "а": "a", "е": "e", "о": "o", "р": "p", "с": "c", "х": "x", "у": "y", "к": "k", "м": "m", "т": "t", "в": "b", "н": "h", "і": "i", "ј": "j" };
var LEET = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "8": "b", "9": "g", "@": "a", "$": "s", "!": "i", "|": "i", "€": "e" };
function fold(s, look) {
  s = (s || "").toLocaleLowerCase("sr");
  s = look ? [...s].map((c) => LOOK[c] ?? C2L[c] ?? c).join("") : toLat(s);
  s = s.replace(/đ/g, "d").normalize("NFD").replace(/[̀-ͯ]/g, "");
  return [...s].map((c) => LEET[c] ?? c).join("");
}
__name(fold, "fold");
var BAD_TOK = [
  /(^|[^li])jeb/, /^pick(a|e|i|o|u|om|ama|in[aeiou]?|ic[aeiou]|etin[aeiou])$/, /^kur(ac|ca|cu|cem|ce|ci|cin[aeiou]?|cin)$/, /^kurv/, /^peder/, /^pizd/,
  /^drk(a|aj|adz|ic)/, /^sisaj(te)?$/, /^kuck(a|o|e|u|om|ice)$/, /^siptar/, /^balij/, /^mrs(ni|nu|i|ite)$/,
  /fuck/, /^fck/, /^fuk(ing|in|er|ers|ed)?$/, /^fucc/, /^phuc?k/, /^fvck/, /^fcuk/, /^cunt/, /^nigg/, /^niga$/, /^fag(s|got|gots|gy)?$/,
  /^retard/, /^trann/, /^whor/, /^slut/, /^bitch/, /^biatch/, /^dickhead/, /^asshole/, /^arsehole/, /^motherf/, /^kys$/
];
var BAD_RUN = ["jebem", "jebote", "jebac", "picka", "pickom", "kurac", "kurcu", "kurva", "peder", "pizda", "fuck", "nigger", "nigga", "faggot", "motherf", "killyourself", "ubijse", "ubicute", "ubijemte", "zakoljemte"];
function badWords(text) {
  for (const look of [false, true]) {
    const f = fold(text, look);
    const toks = f.split(/[^a-z]+/).filter(Boolean);
    for (const t of toks) {
      const c = t.replace(/(.)\1+/g, "$1");
      if (BAD_TOK.some((re) => re.test(t) || re.test(c))) return true;
    }
    const run = f.replace(/[^a-z]/g, ""), runc = run.replace(/(.)\1+/g, "$1");
    if (BAD_RUN.some((w) => run.includes(w) || runc.includes(w))) return true;
  }
  return false;
}
__name(badWords, "badWords");
var LINK_RE = /(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|org|rs|me|io|ly|gg|tv|info|xyz|ru|eu|ba|hr|co|app|live|link|to)\b|\S+@\S+\.\S+|t\.me\/)/i;
var PHONE_RE = /(\+\s*3\s*8\s*1|\b0)\s*6\d[\s\-\/.]*\d{3}[\s\-\/.]*\d{3,4}|\d{9,}/;
function checkText(x) {
  if (badWords(x)) return "bad";
  if (LINK_RE.test(x)) return "link";
  if (PHONE_RE.test(x)) return "phone";
  return null;
}
__name(checkText, "checkText");
var nameKey = /* @__PURE__ */ __name((n) => fold(n, false).replace(/[^a-z0-9]/g, ""), "nameKey");
var RESERVED = /admin|moder|skupstin|sistem|system|official|zvanic|support|podrska/;
function checkName(n) {
  n = (n || "").replace(/\s+/g, " ").trim();
  if (n.length < 2 || n.length > 20) return ["len", n];
  if (!/^[\p{L}\p{N}][\p{L}\p{N} ._-]*$/u.test(n)) return ["chars", n];
  const k = nameKey(n);
  if (k.length < 2) return ["chars", n];
  if (RESERVED.test(k) || checkText(n)) return ["bad", n];
  return [null, n, k];
}
__name(checkName, "checkName");
var ChatRoom = class {
  static {
    __name(this, "ChatRoom");
  }
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
    this.sql = ctx.storage.sql;
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair("ping", "pong"));
    this.sql.exec("CREATE TABLE IF NOT EXISTS msgs(id INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER, name TEXT, nk TEXT, text TEXT, ip TEXT, hidden INTEGER DEFAULT 0)");
    this.sql.exec("CREATE TABLE IF NOT EXISTS reports(mid INTEGER, ip TEXT, at INTEGER, PRIMARY KEY(mid, ip))");
    this.sql.exec("CREATE TABLE IF NOT EXISTS bans(ip TEXT PRIMARY KEY, until INTEGER, why TEXT)");
    this.sql.exec("CREATE TABLE IF NOT EXISTS names(nk TEXT PRIMARY KEY, name TEXT, key TEXT, ip TEXT, seen INTEGER)");
    this.sql.exec("CREATE INDEX IF NOT EXISTS names_key ON names(key)");
  }
  q(sql, ...a) {
    return [...this.sql.exec(sql, ...a)];
  }
  pub(m) {
    return { id: m.id, n: m.name, x: m.text, at: m.at };
  }
  send(ws, o) {
    try {
      ws.send(JSON.stringify(o));
    } catch (e) {
    }
  }
  all(o) {
    const s = JSON.stringify(o);
    for (const ws of this.ctx.getWebSockets()) try {
      ws.send(s);
    } catch (e) {
    }
  }
  banned(ip) {
    const b = this.q("SELECT until FROM bans WHERE ip=?", ip)[0];
    return b && b.until > Date.now();
  }
  async countSoon() {
    if (!await this.ctx.storage.getAlarm()) await this.ctx.storage.setAlarm(Date.now() + 4e3);
  }
  async alarm() {
    this.all({ t: "v", n: this.ctx.getWebSockets().length });
  }
  async fetch(req) {
    const u = new URL(req.url), ip = req.headers.get("x-ip") || "?";
    if (u.pathname === "/ws") {
      const [client, server] = Object.values(new WebSocketPair());
      this.ctx.acceptWebSocket(server);
      server.serializeAttachment({ ip, name: null, nk: null, last: 0, lastText: "" });
      const msgs = this.q("SELECT * FROM msgs WHERE hidden=0 ORDER BY id DESC LIMIT ?", CHAT_INIT).reverse().map((m) => this.pub(m));
      this.send(server, { t: "init", msgs, v: this.ctx.getWebSockets().length });
      await this.countSoon();
      return new Response(null, { status: 101, webSocket: client });
    }
    if (u.pathname === "/admin") {
      const rows = this.q("SELECT m.*, (SELECT COUNT(*) FROM reports r WHERE r.mid=m.id) rep FROM msgs m ORDER BY id DESC LIMIT 200");
      const bans = this.q("SELECT * FROM bans WHERE until>? ORDER BY until DESC", Date.now());
      return json({ rows, bans, online: this.ctx.getWebSockets().length });
    }
    if (u.pathname === "/admin/hide") {
      const id = +u.searchParams.get("id"), on = u.searchParams.get("undo") ? 0 : 1;
      this.sql.exec("UPDATE msgs SET hidden=? WHERE id=?", on ? 2 : 0, id);
      if (on) this.all({ t: "del", ids: [id] });
      return json({ ok: true });
    }
    if (u.pathname === "/admin/ban") {
      const b = u.searchParams.get("ip"), h = +(u.searchParams.get("h") || 24);
      if (h > 0) {
        this.sql.exec("INSERT OR REPLACE INTO bans(ip,until,why) VALUES(?,?,?)", b, Date.now() + h * 36e5, "admin");
        const ids = this.q("SELECT id FROM msgs WHERE ip=? AND hidden=0 AND at>?", b, Date.now() - 864e5).map((r) => r.id);
        this.sql.exec("UPDATE msgs SET hidden=2 WHERE ip=? AND at>?", b, Date.now() - 864e5);
        if (ids.length) this.all({ t: "del", ids });
      } else this.sql.exec("DELETE FROM bans WHERE ip=?", b);
      return json({ ok: true });
    }
    return new Response("not found", { status: 404 });
  }
  async webSocketMessage(ws, raw) {
    if (typeof raw !== "string" || raw.length > 2e3) return;
    let m;
    try {
      m = JSON.parse(raw);
    } catch {
      return;
    }
    const a = ws.deserializeAttachment() || {};
    if (m.t === "join") {
      const [err, name, nk] = checkName(m.name);
      if (err) return this.send(ws, { t: "err", code: "name_" + err });
      const key = typeof m.key === "string" && /^[a-f0-9]{32,64}$/.test(m.key) ? (await sha256(new TextEncoder().encode(m.key))).slice(0, 32) : null;
      if (!key) return this.send(ws, { t: "err", code: "key" });
      const now2 = Date.now();
      this.sql.exec("DELETE FROM names WHERE seen<?", now2 - 90 * 864e5);
      const own = this.q("SELECT key FROM names WHERE nk=?", nk)[0];
      if (own && own.key !== key) return this.send(ws, { t: "err", code: "name_taken" });
      if (!own) {
        const recent = this.q("SELECT COUNT(*) n FROM names WHERE ip=? AND seen>?", a.ip, now2 - 36e5)[0].n;
        if (recent >= 20) return this.send(ws, { t: "err", code: "name_many" });
      }
      this.sql.exec("DELETE FROM names WHERE key=? AND nk<>?", key, nk);
      this.sql.exec("INSERT OR REPLACE INTO names(nk,name,key,ip,seen) VALUES(?,?,?,?,?)", nk, name, key, a.ip, now2);
      a.name = name;
      a.nk = nk;
      ws.serializeAttachment(a);
      return this.send(ws, { t: "ok", name });
    }
    if (m.t === "msg") {
      if (!a.name) return this.send(ws, { t: "err", code: "nojoin" });
      if (this.banned(a.ip)) return this.send(ws, { t: "err", code: "banned" });
      const x = String(m.x || "").replace(/[\u0000-\u001f\u007f​-‏‪-‮⁠-⁤﻿]/g, " ").replace(/\s+/g, " ").trim();
      if (!x) return;
      if (x.length > CHAT_LEN) return this.send(ws, { t: "err", code: "long" });
      const now2 = Date.now();
      if (now2 - (a.last || 0) < CHAT_GAP) return this.send(ws, { t: "err", code: "fast" });
      if (x === a.lastText && now2 - a.last < 6e4) return this.send(ws, { t: "err", code: "dup" });
      const perMin = this.q("SELECT COUNT(*) n FROM msgs WHERE ip=? AND at>?", a.ip, now2 - 6e4)[0].n;
      if (perMin >= 12) return this.send(ws, { t: "err", code: "fast" });
      const bad = checkText(x);
      if (bad) return this.send(ws, { t: "err", code: bad });
      const row = this.q("INSERT INTO msgs(at,name,nk,text,ip) VALUES(?,?,?,?,?) RETURNING *", now2, a.name, a.nk, x, a.ip)[0];
      this.sql.exec("DELETE FROM msgs WHERE id<?", row.id - CHAT_KEEP);
      this.sql.exec("UPDATE names SET seen=? WHERE nk=?", now2, a.nk);
      a.last = now2;
      a.lastText = x;
      ws.serializeAttachment(a);
      this.all({ t: "m", m: this.pub(row) });
      return;
    }
    if (m.t === "report") {
      const id = +m.id, msg = this.q("SELECT ip,hidden FROM msgs WHERE id=?", id)[0];
      if (!msg || msg.hidden || msg.ip === a.ip) return;
      this.sql.exec("INSERT OR IGNORE INTO reports(mid,ip,at) VALUES(?,?,?)", id, a.ip, Date.now());
      const n = this.q("SELECT COUNT(*) n FROM reports WHERE mid=?", id)[0].n;
      if (n >= REPORTS_TO_HIDE) {
        this.sql.exec("UPDATE msgs SET hidden=1 WHERE id=?", id);
        this.all({ t: "del", ids: [id] });
        const lost = this.q("SELECT COUNT(*) n FROM msgs WHERE ip=? AND hidden=1 AND at>?", msg.ip, Date.now() - 36e5)[0].n;
        if (lost >= 3) this.sql.exec("INSERT OR REPLACE INTO bans(ip,until,why) VALUES(?,?,?)", msg.ip, Date.now() + 864e5, "reports");
      }
      this.sql.exec("DELETE FROM reports WHERE at<?", Date.now() - 7 * 864e5);
      return;
    }
    if (m.t === "ping") return this.send(ws, { t: "pong" });
  }
  async webSocketClose(ws, code) {
    try {
      ws.close(code === 1005 ? 1e3 : code, "bye");
    } catch (e) {
    }
    await this.countSoon();
  }
  async webSocketError(ws) {
    await this.countSoon();
  }
};
function chatAdminPage(d, key) {
  const k = encodeURIComponent(key), t = /* @__PURE__ */ __name((ms) => new Date(ms).toISOString().slice(5, 16).replace("T", " "), "t");
  const rows = d.rows.map((r) => "<tr" + (r.hidden ? ' style="opacity:.45"' : "") + "><td>" + t(r.at) + "</td><td><b>" + esc(r.name) + "</b></td><td>" + esc(r.text) + "</td><td>" + (r.rep || "") + "</td><td>" + (r.hidden ? '<a href="/admin/chat/hide?id=' + r.id + "&undo=1&key=" + k + '">vrati</a>' : '<a href="/admin/chat/hide?id=' + r.id + "&key=" + k + '">sakrij</a>') + ' \xB7 <a href="/admin/chat/ban?ip=' + r.ip + "&h=24&key=" + k + '">ban 24h</a> \xB7 <a href="/admin/chat/ban?ip=' + r.ip + "&h=720&key=" + k + '">30 dana</a></td></tr>').join("");
  const bans = d.bans.map((b) => "<li>" + esc(b.ip) + " do " + t(b.until) + " (" + esc(b.why) + ') <a href="/admin/chat/ban?ip=' + b.ip + "&h=0&key=" + k + '">skini</a></li>').join("");
  return adminPage("Razgovor", "<p>Na sajtu: " + d.online + "</p>" + (bans ? "<h3>Banovani</h3><ul>" + bans + "</ul>" : "") + '<table cellpadding=6 style="border-collapse:collapse;font-size:14px"><tr><th>Vreme</th><th>Ime</th><th>Poruka</th><th>Prijave</th><th></th></tr>' + rows + "</table>", 30);
}
__name(chatAdminPage, "chatAdminPage");
async function chatRoute(req, env, u) {
  const ip = req.headers.get("cf-connecting-ip") || "local";
  const ipHash = (await sha256(new TextEncoder().encode(ip + "|chat|" + (env.SALT || "")))).slice(0, 16);
  const stub = env.CHAT.get(env.CHAT.idFromName("main"));
  const h = new Headers(req.headers);
  h.set("x-ip", ipHash);
  return stub.fetch(new Request(new URL(u.pathname === "/api/chat" ? "/ws" : u.pathname.replace("/admin/chat", "/admin") + u.search, u.origin), { headers: h }));
}
__name(chatRoute, "chatRoute");
var worker_default = {
  async fetch(req, env, ctx) {
    const u = new URL(req.url), p = u.pathname;
    if (u.hostname.startsWith("www.")) return Response.redirect("https://" + u.hostname.slice(4) + p + u.search, 301);
    try {
      if (p.startsWith("/fonts/")) return fonts(req, ctx, p.slice(7));
      if (p.startsWith("/p/")) {
        const id = parseInt(p.slice(3));
        const row = await env.DB.prepare("SELECT type,bytes FROM photos WHERE id=?").bind(id).first();
        if (!row) return new Response("not found", { status: 404 });
        return new Response(new Uint8Array(row.bytes), { headers: { "content-type": row.type, "cache-control": "public, max-age=86400" } });
      }
      if (p === "/api/mps") return json(await mpsJson(env));
      if (p === "/api/live/speakers") return json({ segments: [] });
      if (p === "/api/contact" && req.method === "POST") return contact(req, env);
      if (p === "/api/chat") {
        if (req.headers.get("upgrade") !== "websocket") return new Response("websocket only", { status: 426 });
        const o = req.headers.get("origin") || "";
        if (o && !/^https:\/\/(www\.)?skupstina\.app$|^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(o)) return new Response("no", { status: 403 });
        return chatRoute(req, env, u);
      }
      if (p === "/robots.txt") return H(env.LAUNCHED === "1" ? "User-agent: *\nAllow: /\n" : "User-agent: *\nDisallow: /\n", "text/plain");
      if (p.startsWith("/admin/")) {
        if (!env.ADMIN_KEY || u.searchParams.get("key") !== env.ADMIN_KEY) return new Response("no", { status: 403 });
        if (p === "/admin/import-mps") {
          let started = "";
          const q0 = await getState(env, "mps_queue");
          if (u.searchParams.get("restart") || (!q0 || q0 === "[]") && !await getState(env, "mps_done")) started = "<p>List: " + await importList(env) + " MPs</p>";
          const r = await mpBatch(env);
          const next = r.left ? "/admin/import-mps?key=" + encodeURIComponent(env.ADMIN_KEY) : null;
          return adminPage("MP import", started + "<p>Batch: " + r.done + ", left: " + r.left + "</p><pre>" + esc(r.errs.join("\n")) + "</pre>" + (next ? "<p>continuing</p>" : "<p><b>Done.</b></p>"), next ? "1;url=" + next : 0);
        }
        if (p === "/admin/seed-page") {
          if (PAGE.length < 1e4) return json({ ok: false, err: "bundled page is a placeholder" }, 400);
          await env.DB.prepare("CREATE TABLE IF NOT EXISTS assets(name TEXT PRIMARY KEY, body TEXT, v INTEGER, updated_at TEXT)").run();
          const cur = await env.DB.prepare("SELECT v FROM assets WHERE name='index.html'").first();
          await env.DB.prepare("INSERT OR REPLACE INTO assets(name,body,v,updated_at) VALUES('index.html',?,?,?)").bind(PAGE, (cur?.v || 0) + 1, now()).run();
          return json({ ok: true, v: (cur?.v || 0) + 1, bytes: PAGE.length });
        }
        if (p === "/admin/chat") return chatAdminPage(await (await chatRoute(req, env, u)).json(), env.ADMIN_KEY);
        if (p === "/admin/chat/hide" || p === "/admin/chat/ban") {
          await chatRoute(req, env, u);
          return Response.redirect(u.origin + "/admin/chat?key=" + encodeURIComponent(env.ADMIN_KEY), 302);
        }
        if (p === "/admin/import-lead") return json(await importLeadership(env));
        if (p === "/admin/status") {
          const a = await env.DB.prepare("SELECT COUNT(*) n, SUM(name_lat IS NOT NULL) named, (SELECT COUNT(*) FROM photos) photos FROM mps WHERE active=1").first();
          const l = await env.DB.prepare("SELECT at,job,msg FROM import_log ORDER BY id DESC LIMIT 15").all();
          const m = await env.DB.prepare("SELECT COUNT(*) n FROM messages").first();
          return adminPage("Status", "<pre>" + JSON.stringify({ ...a, messages: m.n }, null, 1) + "</pre><pre>" + esc(l.results.map((x) => x.at + " " + x.job + " " + x.msg).join("\n")) + "</pre>");
        }
        if (p === "/admin/messages") {
          const l = await env.DB.prepare("SELECT at,kind,mail,msg FROM messages ORDER BY id DESC LIMIT 100").all();
          return adminPage("Poruke", l.results.map((x) => "<p><b>" + x.at + " " + esc(x.kind) + "</b> " + esc(x.mail || "") + "<br>" + esc(x.msg) + "</p>").join("") || "<p>Nema poruka</p>");
        }
      }
      if (p === "/" || p === "/index.html") {
        const preview = !!u.searchParams.get("preview") && u.searchParams.get("preview") === env.ADMIN_KEY;
        const cookie = (req.headers.get("cookie") || "").includes("pv=" + (env.ADMIN_KEY || "x"));
        if (env.LAUNCHED !== "1" && !preview && !cookie) return H(HOLD, "text/html; charset=utf-8", { "cache-control": "no-store" });
        const r = await page(env, ctx, req);
        if (preview) {
          const rr = new Response(r.body, r);
          rr.headers.set("set-cookie", "pv=" + env.ADMIN_KEY + "; Path=/; Max-Age=2592000; Secure; HttpOnly; SameSite=Lax");
          rr.headers.set("cache-control", "no-store");
          return rr;
        }
        return r;
      }
      return new Response("Nije prona\u0111eno", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
    } catch (e) {
      ctx.waitUntil(log(env, "error", p + " " + (e.stack || e)));
      return new Response("Gre\u0161ka", { status: 500 });
    }
  },
  async scheduled(ev, env, ctx) {
    const q = await getState(env, "mps_queue");
    const last = await getState(env, "mps_list_at");
    if ((!q || q === "[]") && (!last || Date.now() - Date.parse(last) > 20 * 36e5)) {
      try {
        await importList(env);
      } catch (e) {
        await log(env, "mps", "list failed: " + e.message);
      }
      return;
    }
    if (q && q !== "[]") {
      await mpBatch(env);
      return;
    }
    const la = await getState(env, "lead_at");
    if (!la || Date.now() - Date.parse(la) > 6 * 36e5) {
      try {
        await importLeadership(env);
      } catch (e) {
        await log(env, "lead", "failed: " + e.message);
      }
    }
  }
};
export {
  ChatRoom,
  worker_default as default
};
//# sourceMappingURL=worker.js.map
