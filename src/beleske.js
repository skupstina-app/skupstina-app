// Stenografske beleške: the Assembly's own transcript of every sitting day, a .docx on parlament.gov.rs. The cron finds it
// for each archived day, reads it, and corrects that day's opomene (and checks the vote counts) against it:
// - finding: the Redovna/Vanredna zasedanja pages list the sittings; a sitting's page links its notes, one .docx per day
//   (…/upload/archive/files/cir/doc/stenografske_beleske/<name>.docx, the date is in the name or the link). Looked at
//   once an hour; a file is read again when its size or date changes (the notes are "privremene" and get fixed).
// - reading: a .docx is a zip; word/document.xml is inflated with DecompressionStream and cut into paragraphs. The
//   paragraphs carry the speaker ("ПРЕДСЕДНИК:", "МИЛОШ СТОЈКОВИЋ:"), shouts from the seats in brackets ("(Ана Брнабић: …)",
//   "(Народни посланик Милимир Вујадиновић добацује с места.)") and a page line every ~10 min ("2/1 ТЂ/ИР 10.15 – 10.25").
// - opomene: the chair gives one now ("Изричем вам опомену", "Друга опомена.", "морам да вам изрекнем опомену"), not
//   "требао бих…", "нисам стигао…", not a repeat ("Изрекао сам опомену"). Whom: a name in that sentence ("Госпођо Радета,
//   изричем…"); else, when he says "и вама", the last two who shouted since his turn began; else the last one who shouted;
//   else the MP he cut off. "изрекао сам опомену X … повлачим" takes X's back.
// - glasanja: "Закључујем гласање: за – 244, против – нула, …" gives the counts.
// What the notes say wins: applySten() puts the notes' opomene on the timeline (our own find at that time, or a crowd
// question at that time, gives the second; else the chair's turn in that 10-min window), drops ours the notes don't have,
// and clears the crowd questions. Stored in ar_beleske(date, url, sig, st JSON, log); applied again after every re-import.

const BASE = "https://www.parlament.gov.rs";
const UA = { "user-agent": "skupstina.app arhiva (+https://skupstina.app)" };
const LISTS = ["/активности/народна-скупштина/заседања/редовна.34.html", "/активности/народна-скупштина/заседања/ванредна.35.html"];

const C2L = {};
"абвгдђежзијклљмнњопрстћуфхцчџш".split("").forEach((c, i) => {
  C2L[c] = ["a", "b", "v", "g", "d", "dj", "e", "z", "z", "i", "j", "k", "l", "lj", "m", "n", "nj", "o", "p", "r", "s", "t", "c", "u", "f", "h", "c", "c", "dz", "s"][i];
});
// lower case, Cyrillic → Latin, no diacritics (č ć → c, đ → dj), Latin look-alikes in Cyrillic text folded too
export const fold = (s) => String(s || "").toLowerCase().replace(/[а-џ]/g, (c) => C2L[c] ?? c).replace(/đ/g, "dj")
  .normalize("NFD").replace(/[̀-ͯ]/g, "");

// Cyrillic → Serbian Latin with diacritics, for text shown on the page
const C2LAT = {};
"абвгдђежзијклљмнњопрстћуфхцчџш".split("").forEach((c, i) => {
  C2LAT[c] = ["a", "b", "v", "g", "d", "đ", "e", "ž", "z", "i", "j", "k", "l", "lj", "m", "n", "nj", "o", "p", "r", "s", "t", "ć", "u", "f", "h", "c", "č", "dž", "š"][i];
});
export const lat = (s) => [...String(s || "")].map((c) => {
  const l = c.toLowerCase(), r = C2LAT[l];
  if (r == null) return c;
  return c === l ? r : r[0].toUpperCase() + r.slice(1);
}).join("");

// ---- docx → paragraphs ----
export async function docxParas(buf) {
  const b = new Uint8Array(buf), dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let e = b.length - 22;
  while (e > 0 && dv.getUint32(e, true) !== 0x06054b50) e--;
  if (e <= 0) throw new Error("not a zip");
  let n = dv.getUint16(e + 10, true), off = dv.getUint32(e + 16, true);
  for (let i = 0; i < n; i++) {
    const nl = dv.getUint16(off + 28, true), xl = dv.getUint16(off + 30, true), cl = dv.getUint16(off + 32, true);
    const name = new TextDecoder().decode(b.subarray(off + 46, off + 46 + nl));
    if (name === "word/document.xml") {
      const meth = dv.getUint16(off + 10, true), csz = dv.getUint32(off + 20, true), lho = dv.getUint32(off + 42, true);
      const ln = dv.getUint16(lho + 26, true), lx = dv.getUint16(lho + 28, true);
      const data = b.subarray(lho + 30 + ln + lx, lho + 30 + ln + lx + csz);
      const xml = meth === 0 ? new TextDecoder().decode(data)
        : await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"))).text();
      return xml.split(/<\/w:p>/).map((p) => p.replace(/<w:tab\/>/g, "\t").replace(/<w:br\/>/g, " ").replace(/<[^>]+>/g, "")
        .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'"))
        .map((s) => s.replace(/\s+/g, " ").trim()).filter(Boolean);
    }
    off += 46 + nl + xl + cl;
  }
  throw new Error("no word/document.xml");
}

// ---- names → MPs ----
const lev = (a, b) => {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
};
const same = (a, b) => a === b || lev(a, b) <= 1 || (a.length === b.length && [...a].sort().join() === [...b].sort().join() && a.slice(0, 2) === b.slice(0, 2));
export function people(mps) {
  const all = mps.map((m) => { const w = fold(m.name).split(/[^a-z]+/).filter(Boolean); return { id: +m.id, name: m.name, first: w[0], last: w.slice(1) }; });
  const stems = (p) => p.last.filter((w) => w.length >= 4).map((w) => w.slice(0, Math.max(4, w.length - 1)));
  return {
    // a full name as written in a bracket: "Ана Брнабић" (even "Ана Брбанић")
    full(s) {
      const w = fold(s).split(/[^a-z]+/).filter(Boolean);
      if (w.length < 2) return null;
      let hit = all.filter((p) => p.first === w[0] && p.last.length && same(p.last.join(""), w.slice(1).join("")));
      if (!hit.length) hit = all.filter((p) => p.first === w[0] && p.last.length && same(p.last[p.last.length - 1], w[w.length - 1]));
      return hit.length === 1 ? hit[0] : null;
    },
    // MPs named in a sentence ("Госпођо Радета", "господину Милимиру Вујадиновићу"); the first name decides between
    // two with the same surname
    named(s) {
      const w = fold(s).split(/[^a-z]+/).filter(Boolean), out = [];
      w.forEach((x, k) => {
        if (x.length < 4) return;
        let hit = all.filter((p) => stems(p).some((st) => x.startsWith(st) && x.length <= st.length + 3));
        if (hit.length > 1 && k > 0) hit = hit.filter((p) => w[k - 1].startsWith(p.first.slice(0, 3)));
        if (hit.length === 1 && !out.includes(hit[0])) out.push(hit[0]);
      });
      return out;
    },
  };
}

// ---- the notes → {ops, votes} ----
const NUM = { nula: 0, niko: 0, nema: 0, nijedan: 0, nije: 0, jedan: 1, jedna: 1, jednog: 1, jedno: 1, dva: 2, dve: 2, dvoje: 2, dvojica: 2,
  tri: 3, troje: 3, trojica: 3, cetiri: 4, cetvoro: 4, cetvorica: 4, pet: 5, petoro: 5, sest: 6, sestoro: 6, sedam: 7, sedmoro: 7,
  osam: 8, osmoro: 8, devet: 9, devetoro: 9, deset: 10, desetoro: 10 };
const num = (s) => (s == null ? null : /^\d+$/.test(s) ? +s : s in NUM ? NUM[s] : null);
const OP_NOW = /\b(izricem|izreknem|izreci cu)\b[^.!?]{0,40}\bopomen|\bopomen\w*[^.!?]{0,6}\bizricem\b|^(prva|druga|treca) opomena\b/;
const NOT_NOW = /\b(ne|nisam|necu|nije|nisu|nemojte)\b[^.!?]{0,25}\b(izricem|izreknem|izreci)|\b(trebao|trebala|trebalo|bih|bismo)\b|\bako\b|\?\s*$/;
const LABEL = /^([А-ЯЂЈЉЊЋЏA-ZČĆŽŠĐ][А-ЯЂЈЉЊЋЏA-ZČĆŽŠĐ .\-]{3,}?)\s*(\([^)]*\))?\s*:\s*(?:\([^)]*\)\s*:\s*)?(.*)$/;

export function parseSten(paras, mps) {
  const P = people(mps), ops = [], votes = [], gone = [];
  let clock = null, chair = false, prev = null, shouts = [], turn = 0;
  const hm = (s) => s.replace(".", ":").replace(/^0(\d):/, "$1:");
  paras.forEach((raw, i) => {
    const mk = /^\d+\/\d+\s+\S+(?:\s+(\d{1,2}[.:]\d{2})\s*[–-]\s*(\d{1,2}[.:]\d{2}))?\s*$/.exec(raw);
    if (mk) { if (mk[1]) clock = [hm(mk[1]), hm(mk[2])]; return; }
    if (raw.startsWith("(")) {
      const f = fold(raw);
      const st = /^\(\s*([^:()]{3,40}):/.exec(raw) || /narodn\S* poslani\S*\s+([a-z]+ [a-z]+(?: [a-z]+)?)\s+(dobac|ustaj|prila|vic|govor|snim)/.exec(f);
      const who = st && P.full(st[1]);
      if (who) shouts.push(who);
      const begin = /sednica je (pocela|nastavljena)/.exec(f) && /(\d{1,2})[.:](\d{2})/.exec(f);
      if (begin && !clock) clock = [hm(begin[1] + "." + begin[2]), hm(begin[1] + "." + begin[2])];
      return;
    }
    let text = raw;
    const lb = LABEL.exec(raw);
    if (lb && lb[1].trim().split(/\s+/).length <= 4) {
      const label = lb[1].trim();
      const isChair = /^(ПРЕДСЕД|PREDSED)/.test(label);
      if (!isChair) { const p = P.full(label); prev = p; }
      if (isChair !== chair || !isChair) { shouts = []; turn = i; }
      chair = isChair; text = lb[3];
    }
    const f = fold(text);
    if (chair && /zakljucujem glasanje/.test(f)) {
      const g = (re) => { const m = re.exec(f); return m ? num(m[1]) : null; };
      const v = { clock: clock && clock[0], za: g(/\bza\b\s*[–:-]?\s*(\d+|[a-z]+)/), protiv: g(/protiv\s*[–:-]?\s*(\d+|[a-z]+)/),
        uzdrzano: g(/uzdrz\w*\s*[–:-]?\s*(\d+|[a-z]+)/), nije: g(/ni(?:je|su) glasa\w*\s*[–:-]?\s*(\d+|[a-z]+)/),
        prisutno: g(/\b(?:od|ukupno)\s+(?:ukupno\s+)?(?:je\s+)?(?:prisutn\w*\s+)?[–-]?\s*(\d+)/) };
      if (v.za != null && v.protiv != null) votes.push(v);
    }
    if (!chair || !/opomen/.test(f)) return;
    const sents = text.split(/(?<=[.!?…])\s+/);
    sents.forEach((s, k) => {
      const fs = fold(s);
      if (/izrek(ao|la) sam\b[^.!?]{0,80}opomen/.test(fs)) {
        if (/povlac/.test(fold(sents.slice(k, k + 2).join(" ")))) {
          for (const p of P.named(s)) { const j = ops.map((o) => o.mp).lastIndexOf(p.id); if (j >= 0) gone.push(ops.splice(j, 1)[0]); }
        }
        return;
      }
      if (!OP_NOW.test(fs) || NOT_NOW.test(fs)) return;
      let who = P.named(s);
      if (who.length !== 1) {
        if (who.length > 1) who = [];
        else if (/\bi vama\b|\bobojici\b|\bvas dvoje\b/.test(fs)) who = [...new Set(shouts.slice().reverse())].slice(0, 2);
        else if (shouts.length) who = [shouts[shouts.length - 1]];
        else if (prev) who = [prev];
      }
      const t = lat(s.trim()).slice(0, 200);
      if (!who.length) ops.push({ mp: null, clock, t, i });
      who.forEach((p) => ops.push({ mp: p.id, name: p.name, clock, t, i }));
    });
  });
  return { ops, votes, gone };
}

// ---- notes → a day's document ----
// clock "H:MM" → minutes; a sitting never starts before 5:00, so earlier hours are after midnight
const mins = (c) => { const m = /^(\d{1,2})[:.](\d{2})$/.exec(c || ""); if (!m) return null; const v = +m[1] * 60 + +m[2]; return v < 300 ? v + 1440 : v; };
// clock → day seconds, from the speeches' clocks
function clockAt(doc, c) {
  const t = mins(c);
  if (t == null || !doc.speeches.length) return null;
  let best = null;
  for (const s of doc.speeches) { const m = mins(s[4]); if (m != null && m <= t) best = s; }
  if (!best) return doc.speeches[0][0];
  return Math.round((best[0] + Math.min((t - mins(best[4])) * 60, Math.max(best[1], 0))) * 10) / 10;
}

export function applySten(doc, st, url) {
  const log = [];
  if (!doc || !st) return { doc, log };
  const ev = (doc.ev || []).map((e) => ({ ...e })), ours = ev.filter((e) => e.k === "opomena");
  let cand = (doc.cand || []).slice();
  const used = new Set(), out = [];
  const range = (o) => {
    if (!o.clock) return [-Infinity, Infinity];
    const a = clockAt(doc, o.clock[0]), b = clockAt(doc, o.clock[1]);
    return [a == null ? -Infinity : a - 600, b == null ? Infinity : b + 900];
  };
  const words = (t) => new Set(fold(t).split(/[^a-z]+/).filter((w) => w.length > 2));
  const sim = (x, y) => { const A = words(x), B = words(y); let n = 0; A.forEach((w) => B.has(w) && n++); return n / Math.max(1, Math.min(A.size, B.size)); };
  let last = -Infinity, prevO = null, prevAt = null;
  for (const o of st.ops) {
    const [a0, a1] = range(o);
    if (o.mp == null) continue;
    let at = null, how = "";
    if (prevO && prevO.i === o.i) at = prevAt; // one sentence, two MPs ("… и вама")
    const e = at == null && ours.find((x) => !used.has(x) && x.mp === o.mp && x.at >= a0 && x.at <= a1 && x.at > last);
    if (e) { used.add(e); out.push({ ...e, ok: 1 }); last = prevAt = e.at; prevO = o; continue; }
    if (at == null) { // our find at that moment, but given to someone else
      const x = ours.find((x) => !used.has(x) && x.at >= a0 && x.at <= a1 && x.at > last && sim(x.t, o.t) >= 0.6);
      if (x) { used.add(x); at = x.at; how = "whom"; }
    }
    if (at == null) { // a crowd question at that moment
      const c = cand.find((x) => x.at >= a0 && x.at <= a1 && x.at > last && sim(x.t, o.t) >= 0.6)
        || cand.find((x) => x.at >= a0 && x.at <= a1 && x.at > last && (!x.opts || !x.opts.length || x.opts.includes(o.mp)));
      if (c) { cand = cand.filter((x) => x !== c); at = c.at; how = "cand"; }
    }
    if (at == null) { // the chair's turn right after this MP spoke, inside the window; else the window's start
      const sp = doc.speeches;
      const j = sp.findIndex((s, k) => s[0] >= a0 && s[0] <= a1 && s[0] > last && s[6] && k > 0 && sp[k - 1][2] === o.mp);
      at = j >= 0 ? sp[j][0] : Math.max(last + 1, clockAt(doc, o.clock && o.clock[0]) ?? 0);
      how = j >= 0 ? "turn" : "window";
    }
    out.push({ k: "opomena", at, mp: o.mp, name: o.name, t: o.t, drugu: 0, ok: 1 });
    log.push("+ " + o.name + " " + (o.clock ? o.clock[0] : "") + " " + how);
    last = prevAt = at; prevO = o;
  }
  ours.filter((x) => !used.has(x)).forEach((x) => log.push("- " + x.name + " @" + Math.round(x.at)));
  // what the notes leave unsure stays a question; the rest of the questions are answered by the notes
  const unsure = st.ops.filter((o) => o.mp == null).map(range);
  const left = cand.filter((x) => unsure.some(([a, b]) => x.at >= a && x.at <= b));
  if (left.length !== (doc.cand || []).length) log.push("cand " + (doc.cand || []).length + " → " + left.length);
  // second one for the same MP that day
  const seen = {};
  out.sort((a, b) => a.at - b.at).forEach((o) => { o.drugu = seen[o.mp] ? 1 : 0; seen[o.mp] = 1; });
  // vote counts: the notes' numbers, matched in order by "za" and "protiv"
  const gl = ev.filter((e) => e.k === "glasanje" && e.r);
  let k = 0, okv = 0;
  for (const v of st.votes) {
    const j = gl.findIndex((g, n) => n >= k && g.r.za === v.za && g.r.protiv === v.protiv);
    if (j >= 0) { gl[j].ok = 1; k = j + 1; okv++; }
  }
  const nev = [...ev.filter((e) => e.k !== "opomena"), ...out].sort((a, b) => a.at - b.at);
  return { doc: { ...doc, ev: nev, cand: left, bel: { url, ops: st.ops.filter((o) => o.mp).length, votes: st.votes.length, okv } }, log };
}

// ---- finding the notes ----
const MON = { januar: 1, februar: 2, mart: 3, april: 4, maj: 5, jun: 6, jul: 7, avgust: 8, septemb: 9, oktob: 10, novemb: 11, decemb: 12 };
export function dateOf(s) {
  const f = fold(s);
  let m = /(\d{1,2})\.\s*(januar|februar|mart|april|maj|jun|jul|avgust|septemb|oktob|novemb|decemb)\w*\s*(\d{4})/.exec(f);
  if (m) return m[3] + "-" + String(MON[m[2]]).padStart(2, "0") + "-" + m[1].padStart(2, "0");
  m = /(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})/.exec(f);
  return m ? m[3] + "-" + m[2].padStart(2, "0") + "-" + m[1].padStart(2, "0") : null;
}
const links = (html, base) => [...html.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)]
  .map((m) => { try { return { url: new URL(m[1].replace(/&amp;/g, "&"), base).href, text: m[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() }; } catch { return null; } })
  .filter(Boolean);
async function page(url) {
  const r = await fetch(url, { headers: UA });
  if (!r.ok) throw new Error(decodeURI(url).slice(0, 80) + " " + r.status);
  return r.text();
}
// date → [docx url]
export async function findNotes() {
  const sittings = new Set(), found = {};
  for (const l of LISTS) {
    for (const a of links(await page(new URL(l, BASE).href), BASE))
      if (/\.\d+\.43\.html$/.test(a.url) && /sednic/.test(fold(decodeURI(a.url) + " " + a.text)) && !/odbor/.test(fold(decodeURI(a.url)))) sittings.add(a.url);
  }
  for (const s of [...sittings].slice(0, 8)) {
    for (const a of links(await page(s), BASE)) {
      if (!/stenografske_beleske\/[^/]+\.docx$/i.test(a.url)) continue;
      const d = dateOf(decodeURIComponent(a.url.split("/").pop())) || dateOf(a.text);
      if (d) (found[d] = found[d] || []).includes(a.url) || found[d].push(a.url);
    }
  }
  return found;
}

async function ensure(env) {
  await env.DB.prepare("CREATE TABLE IF NOT EXISTS ar_beleske(date TEXT PRIMARY KEY, url TEXT, sig TEXT, st TEXT, log TEXT, checked_at INTEGER, updated_at INTEGER)").run();
}
export async function stFor(env, date) {
  try { const r = await env.DB.prepare("SELECT url, st FROM ar_beleske WHERE date=?").bind(date).first(); return r && r.st ? { url: r.url, st: JSON.parse(r.st) } : null; }
  catch { return null; }
}
export async function saveDay(env, date, doc) {
  const op = doc.ev.filter((e) => e.k === "opomena").length;
  await env.DB.prepare("UPDATE ar_dan SET doc=?, op=?, updated_at=? WHERE date=?").bind(JSON.stringify(doc), op, Date.now(), date).run();
}

// cron: once an hour, or sooner while an archived day has no notes yet
export async function beleskeCron(env, force = false) {
  await ensure(env);
  const days = (await env.DB.prepare("SELECT d.date, b.sig, b.checked_at FROM ar_dan d LEFT JOIN ar_beleske b ON b.date=d.date").all()).results;
  const missing = days.filter((d) => !d.sig);
  const last = Math.max(0, ...days.map((d) => d.checked_at || 0));
  if (!force && Date.now() - last < (missing.length ? 30 : 60) * 6e4) return "";
  await env.DB.prepare("INSERT INTO ar_beleske(date, checked_at) SELECT date, ? FROM ar_dan WHERE true ON CONFLICT(date) DO UPDATE SET checked_at=excluded.checked_at").bind(Date.now()).run();
  const found = await findNotes();
  const want = new Map(days.map((d) => [d.date, d]));
  let mpList = null;
  const done = [];
  for (const [date, urls] of Object.entries(found)) {
    const d = want.get(date);
    if (!d) continue;
    const sigOf = (h) => (h.headers.get("last-modified") || "") + "/" + (h.headers.get("content-length") || "");
    const heads = await Promise.all(urls.map((u) => fetch(u, { method: "HEAD", headers: UA }).catch(() => null)));
    if (heads.every((h) => h && h.ok) && heads.map(sigOf).join("|") === d.sig) continue;
    if (done.length >= 3) { await env.DB.prepare("UPDATE ar_beleske SET checked_at=0").run(); break; } // the rest on the next run
    let paras = [], sigs = [];
    for (const u of urls) {
      const r = await fetch(u, { headers: UA });
      if (!r.ok) throw new Error("docx " + r.status);
      sigs.push(sigOf(r));
      paras = paras.concat(await docxParas(await r.arrayBuffer()));
    }
    const sig = sigs.join("|");
    if (sig === d.sig) continue;
    if (!mpList) mpList = (await env.DB.prepare("SELECT id, name_lat name FROM mps").all()).results;
    const st = parseSten(paras, mpList);
    const row = await env.DB.prepare("SELECT doc FROM ar_dan WHERE date=?").bind(date).first();
    const { doc, log } = applySten(JSON.parse(row.doc), st, urls[0]);
    await saveDay(env, date, doc);
    await env.DB.prepare("UPDATE ar_beleske SET url=?, sig=?, st=?, log=?, updated_at=? WHERE date=?")
      .bind(urls[0], sig, JSON.stringify(st), log.join("; "), Date.now(), date).run();
    done.push(date + (log.length ? " (" + log.join("; ") + ")" : ""));
  }
  return done.length ? "beleške: " + done.join(", ") : "";
}
