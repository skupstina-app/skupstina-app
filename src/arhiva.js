import { currentUser, trusted } from "./auth.js";
import { userAdmin } from "./admin.js";
import { applySten, stFor } from "./beleske.js";
// Arhiva: one row per sitting day (one YouTube stream of @ParlamentSrbija), made from the speech timeline the reader keeps
// in D1 speech_segments(video, start_s, end_s, mp, talk_s). The cron (every 10 min) fills arhiva_dani for every stream:
// - from the stream's YouTube page: title ("наставак Прве седнице ... 24.11.2026."), start_ms (liveBroadcastDetails
//   startTimestamp: stream second 0 on the clock) and len_s; oEmbed gives the title if the page can't be read,
//   and the page is tried again once an hour until the start is known (the page then shows stream time, not clock),
// - date from the title (else the day it started), first_s/last_s (first and last speech, stream seconds), talk_s,
//   n (speeches), speakers, mps (who spoke). updated_at of the segments can't date them: rescans rewrite it.
// - dan (N. dan of the sitting) stays empty until the stenographic notes say it.
// The page asks GET /api/arhiva (all days) and GET /api/arhiva/day?v=<video> (that day's speeches).
// Opomene, glasanja and the summary come later from the stenographic notes (status 'snimak' until then).

const C2L = {};
"абвгдђежзијклљмнњопрстћуфхцчџш".split("").forEach((c, i) => {
  C2L[c] = ["a", "b", "v", "g", "d", "đ", "e", "ž", "z", "i", "j", "k", "l", "lj", "m", "n", "nj", "o", "p", "r", "s", "t", "ć", "u", "f", "h", "c", "č", "dž", "š"][i];
});
const lat = (s) => [...String(s || "")].map((c) => {
  const l = c.toLowerCase(), r = C2L[l];
  if (r == null) return c;
  return c === l ? r : r[0].toUpperCase() + r.slice(1);
}).join("");

// "наставак Прве седнице Народне скупштине Републике Србије у Петнаестом сазиву 24.11.2026." → "Prva (konstitutivna) sednica"
// The first sitting of a convocation (no "zasedanje" in the title) is the constitutive one.
export function sessionName(title) {
  const t = lat(title);
  const m = /(\S+)\s+sednic[ae]/i.exec(t);
  if (!m) {
    const z = /(\S+)\s+(vanredn|redovn)\S*\s+zasedanj/i.exec(t);
    if (!z) return "Sednica";
    const o = z[1].replace(/og$/i, "o");
    return o[0].toUpperCase() + o.slice(1).toLowerCase() + " " + z[2].toLowerCase() + "o zasedanje";
  }
  let ord = m[1].replace(/e$/, "a");
  ord = ord[0].toUpperCase() + ord.slice(1).toLowerCase();
  const z = /(\S+\s+(?:redovnog|vanrednog)\s+zasedanja)/i.exec(t);
  if (!z && /sazivu/i.test(t) && /^prv/i.test(ord)) return ord + " (konstitutivna) sednica";
  return ord + " sednica" + (z ? " " + z[1].toLowerCase() : "");
}

const bgDate = (ms) => new Date(ms).toLocaleDateString("en-CA", { timeZone: "Europe/Belgrade" });

let ready = false;
async function ensure(env) {
  if (ready) return;
  await env.DB.prepare("CREATE TABLE IF NOT EXISTS arhiva_dani(video TEXT PRIMARY KEY, date TEXT, title TEXT, start_ms INTEGER, len_s INTEGER, dan INTEGER, tried_at INTEGER, first_s REAL, last_s REAL, talk_s REAL, n INTEGER, speakers INTEGER, mps TEXT, status TEXT DEFAULT 'snimak', seg_at INTEGER, updated_at INTEGER)").run();
  ready = true;
}

async function oembedTitle(video) {
  try {
    const r = await fetch("https://www.youtube.com/oembed?format=json&url=" + encodeURIComponent("https://www.youtube.com/watch?v=" + video), { headers: { "user-agent": "Mozilla/5.0 (compatible; skupstina-app)" } });
    if (!r.ok) return null;
    return (await r.json()).title || null;
  } catch (e) {
    return null;
  }
}

const unesc = (x) => x.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
async function ytInfo(video) {
  try {
    const r = await fetch("https://www.youtube.com/watch?v=" + video + "&hl=sr", { headers: {
      "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36",
      "accept-language": "sr,en;q=0.8", cookie: "SOCS=CAI; CONSENT=YES+1" } });
    if (!r.ok) return {};
    const h = await r.text();
    const st = /"startTimestamp":"([^"]+)"/.exec(h), len = /"lengthSeconds":"(\d+)"/.exec(h), t = /<meta name="title" content="([^"]*)"/.exec(h);
    return { start: st ? Date.parse(st[1]) || null : null, len: len ? +len[1] : null, title: t ? unesc(t[1]) : null };
  } catch (e) {
    return {};
  }
}

export async function arhivaCron(env) {
  await ensure(env);
  const { results } = await env.DB.prepare(
    "SELECT video, MIN(start_s) a, MAX(COALESCE(end_s,start_s)) b, SUM(COALESCE(talk_s, end_s-start_s, 0)) t, COUNT(*) n, COUNT(DISTINCT mp) sp, " +
    "GROUP_CONCAT(DISTINCT mp) mps, MAX(updated_at) up FROM speech_segments GROUP BY video"
  ).all();
  const have = new Map((await env.DB.prepare("SELECT video, title, seg_at, start_ms, len_s, tried_at FROM arhiva_dani").all()).results.map((r) => [r.video, r]));
  for (const v of results) {
    const old = have.get(v.video) || {};
    const retry = !old.start_ms && Date.now() - (old.tried_at || 0) > 36e5;
    if (old.title && old.seg_at === v.up && !retry) continue;
    const info = !old.start_ms || !old.title ? await ytInfo(v.video) : {};
    const title = old.title || info.title || await oembedTitle(v.video);
    const start = old.start_ms || info.start || null;
    const d = /(\d{1,2})\.\s?(\d{1,2})\.\s?(\d{4})/.exec(title || "");
    const date = d ? `${d[3]}-${d[2].padStart(2, "0")}-${d[1].padStart(2, "0")}` : start ? bgDate(start) : null;
    await env.DB.prepare(
      "INSERT INTO arhiva_dani(video,date,title,start_ms,len_s,tried_at,first_s,last_s,talk_s,n,speakers,mps,seg_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?) " +
      "ON CONFLICT(video) DO UPDATE SET date=COALESCE(arhiva_dani.date,excluded.date), title=COALESCE(arhiva_dani.title,excluded.title), " +
      "start_ms=COALESCE(arhiva_dani.start_ms,excluded.start_ms), len_s=COALESCE(excluded.len_s,arhiva_dani.len_s), tried_at=excluded.tried_at, " +
      "first_s=excluded.first_s, last_s=excluded.last_s, talk_s=excluded.talk_s, n=excluded.n, speakers=excluded.speakers, mps=excluded.mps, seg_at=excluded.seg_at, updated_at=excluded.updated_at"
    ).bind(v.video, date, title, start, info.len || old.len_s || null, Date.now(), v.a, v.b, Math.round(v.t), v.n, v.sp, v.mps, v.up, Date.now()).run();
  }
}

const J = (o, age) => new Response(JSON.stringify(o), { headers: { "content-type": "application/json; charset=utf-8", "cache-control": `public, max-age=${age}` } });

const bgClock = (ms) => new Date(ms).toLocaleTimeString("en-GB", { timeZone: "Europe/Belgrade", hour: "2-digit", minute: "2-digit", hour12: false }).replace(/^0(\d)/, "$1");

export async function arhivaRoute(req, env, u, p) {
  await ensure(env);
  await ensureDan(env);
  if (p === "/api/arhiva") {
    // imported days (ar_dan) first; a day only our reader has (arhiva_dani) shows until the import brings it
    const full = (await env.DB.prepare("SELECT date,sid,ses,dan,total_s,first_clock,last_clock,n,speakers,op,gl,hay,lines,(SELECT group_concat(m) FROM (SELECT DISTINCT json_extract(value,'$[2]') m FROM json_each(ar_dan.doc,'$.speeches'))) AS mps FROM ar_dan").all()).results;
    const got = new Set(full.map((r) => r.date));
    const own = (await env.DB.prepare("SELECT video,date,title,start_ms,dan,first_s,last_s,n,speakers,mps FROM arhiva_dani WHERE date IS NOT NULL").all()).results
      .filter((r) => !got.has(r.date)).map((r) => ({
        date: r.date, video: r.video, ses: sessionName(r.title), dan: r.dan, total_s: r.last_s - r.first_s,
        first_clock: r.start_ms ? bgClock(r.start_ms + r.first_s * 1000) : null, last_clock: r.start_ms ? bgClock(r.start_ms + r.last_s * 1000) : null,
        n: r.n, speakers: r.speakers, op: null, gl: null, hay: "", mps: String(r.mps || "").split(",").filter(Boolean).map(Number), obrada: 1
      }));
    full.forEach((r) => { r.lines = JSON.parse(r.lines || "[]"); r.mps = String(r.mps || "").split(",").filter(Boolean).map(Number); });
    const days = [...full, ...own].sort((a, b) => (a.date < b.date ? 1 : -1));
    // the next scheduled sitting (YouTube's upcoming live stream), shown on the newest day until a newer day comes
    let next = null;
    try {
      const n = await env.DB.prepare("SELECT sched_start, title FROM yt_video WHERE live='upcoming' AND kind='sednica' AND sched_start>? AND gone=0 ORDER BY sched_start LIMIT 1").bind(new Date().toISOString()).first();
      if (n && (!days[0] || n.sched_start.slice(0, 10) > days[0].date)) next = { at: n.sched_start };
    } catch (e) {}
    return J({ days, next }, 60);
  }
  if (p === "/api/arhiva/day") {
    const d = u.searchParams.get("d") || "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) {
      const row = await env.DB.prepare("SELECT doc FROM ar_dan WHERE date=?").bind(d).first();
      if (row) return new Response(row.doc, { headers: { "content-type": "application/json; charset=utf-8", "cache-control": "public, max-age=300" } });
      const r = await env.DB.prepare("SELECT video,date,title,start_ms,len_s,dan FROM arhiva_dani WHERE date=?").bind(d).first();
      if (!r) return J({ error: "day" }, 0);
      const { results } = await env.DB.prepare("SELECT start_s a, end_s b, mp FROM speech_segments WHERE video=? ORDER BY start_s").bind(r.video).all();
      const end = results.length ? results[results.length - 1].b || results[results.length - 1].a : 0;
      return J({
        date: r.date, ses: sessionName(r.title), dan: r.dan, total: r.len_s || end + 60, obrada: 1,
        parts: [{ v: r.video, at: 0, dur: r.len_s || end + 60, s0: 0 }],
        speeches: results.map((s) => [s.a, Math.round((s.b ?? s.a) - s.a), s.mp, "", r.start_ms ? bgClock(r.start_ms + s.a * 1000) : "", "", 0]),
        ev: [], agenda: [], inter: [], src: "skupstina.app"
      }, 60);
    }
    return J({ error: "day" }, 0);
  }
  if (p === "/api/arhiva/potvrde") return potvrde(req, env, u);
  return null;
}

// ---- visitors confirm what we weren't sure of (for now: opomene without a sure name, doc.cand) ----
// One answer per account and moment: da (with whom, if they know) or ne. It is settled when an admin answers, or when
// at least 3 answered and one side has at least 3 times the other (3:0, 4:1, 6:2…). Settled 'da' = an opomena (to the
// most named MP, if any). GET ?d=<date> → [{at, da, ne, mp, st: 'da'|'ne'|null, my}], POST {d, at, da: 1|0, mp?}.
async function potvrde(req, env, u) {
  await env.DB.prepare("CREATE TABLE IF NOT EXISTS ar_potvrda(date TEXT, at REAL, uid INTEGER, da INTEGER, mp INTEGER, adm INTEGER, ts INTEGER, PRIMARY KEY(date, at, uid))").run();
  const user = await currentUser(req, env).catch(() => null);
  let d = u.searchParams.get("d");
  if (req.method === "POST") {
    const o = req.headers.get("origin") || "";
    if (o && !/^https:\/\/(www\.)?skupstina\.app$|^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(o)) return J({ error: "origin" }, 0);
    if (!user) return J({ error: "login" }, 0);
    const b = await req.json().catch(() => ({}));
    d = b.d;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(b.d || "") || !Number.isFinite(+b.at)) return J({ error: "bad" }, 0);
    const adm = (await userAdmin(env, user).catch(() => null)) ? 1 : 0;
    // only admins and trusted accounts (auth.js trusted()) are counted, so a few fresh accounts can't settle an opomena
    if (adm || trusted(user)) await env.DB.prepare("INSERT OR REPLACE INTO ar_potvrda(date,at,uid,da,mp,adm,ts) VALUES(?,?,?,?,?,?,?)").bind(b.d, +b.at, user.id, b.da ? 1 : 0, b.mp ? +b.mp : null, adm, Date.now()).run();
  }
  const { results } = await env.DB.prepare("SELECT at, uid, da, mp, adm FROM ar_potvrda WHERE date=?").bind(d || "").all();
  const by = new Map();
  for (const r of results) {
    const o = by.get(r.at) || { at: r.at, da: 0, ne: 0, adm: null, mps: {}, my: null };
    r.da ? o.da++ : o.ne++;
    if (r.da && r.mp) o.mps[r.mp] = (o.mps[r.mp] || 0) + 1;
    if (r.adm) o.adm = r.da;
    if (user && r.uid === user.id) o.my = r.da;
    by.set(r.at, o);
  }
  const out = [...by.values()].map((o) => {
    const st = o.adm != null ? (o.adm ? "da" : "ne") : o.da + o.ne >= 3 && o.da >= 3 * o.ne ? "da" : o.da + o.ne >= 3 && o.ne >= 3 * o.da ? "ne" : null;
    const mp = Object.entries(o.mps).sort((a, b) => b[1] - a[1])[0];
    return { at: o.at, da: o.da, ne: o.ne, mp: mp ? +mp[0] : null, st, my: o.my };
  });
  return new Response(JSON.stringify(out), { headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
}

// ---- import from skupstina.live (public JSON, made from the Assembly's own recordings and stenographic notes) ----
// Every 10 min the cron reads https://skupstina.live/data/sessions.json; a day that is new or was updated there is read
// whole (traka-<id>.json) and stored as one document in ar_dan (doc: what the archive shows; tekst: the transcript, one
// line per speech, kept for search). Our own day rows (arhiva_dani, from the reader) stay as a fallback for days the
// import doesn't have yet. Times in a doc are "day seconds": the day's parts played back to back, pauses cut out.
const LIVE = "https://skupstina.live";
const PARSER = "#v4"; // bump when buildDoc changes: every day is read again
const fold = (s) => lat(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/dj/g, "d");

async function ensureDan(env) {
  await env.DB.prepare("CREATE TABLE IF NOT EXISTS ar_dan(date TEXT PRIMARY KEY, sid TEXT, ses TEXT, dan INTEGER, total_s REAL, first_clock TEXT, last_clock TEXT, n INTEGER, speakers INTEGER, op INTEGER, gl INTEGER, hay TEXT, lines TEXT, doc TEXT, tekst TEXT, source TEXT, src_updated TEXT, updated_at INTEGER)").run();
}

// Opomene, from the chair's words. A sentence counts when the chair gives one now ("izričem vam opomenu", "moram da vam
// izreknem opomenu", "vama izričem opomenu"), not when he talks about them ("deliću opomene", "da mi se ne izriče").
// Whom: a name in that sentence or in the next two sentences of the same turn ("… Gospodine Mirkoviću, …"), or the MP
// whose speech the chair cut into (same MP right before and after). A sure one goes to ev; one without a sure name goes
// to cand (people who spoke around it as the choices), for visitors to confirm. "izrekao sam opomenu X … povlačim"
// takes X's opomena of that day back.
const OP_NOW = /\b(izricem|izreknem|izreci cu|izrecicu)\b[^.!?]{0,40}\bopomen|\bopomen\w*[^.!?]{0,6}\bizricem\b/;
export function opomene(sp, people, allMps = []) {
  const out = [], cand = [], names = Object.values(people).filter((p) => p.mp && p.role !== "Predsedavajući").map((p) => {
    const last = fold(p.name).split(" ").pop();
    return { p, stem: last.slice(0, Math.max(4, last.length - 1)) };
  });
  const isChair = (s) => (people[s.who] || {}).role === "Predsedavajući";
  const named = (txt) => { const ws = fold(txt).split(/[^a-z]+/); return names.find((n) => ws.some((w) => w.length >= 4 && w.startsWith(n.stem))); };
  // an MP who didn't speak that day can still get one ("Vama izričem opomenu. Gospodine Mirkoviću, …"): any MP, but only
  // when a form of address stands right before the name
  const others = allMps.map((m) => { const last = fold(m.name).split(" ").pop(); return { p: { mp: m.id, name: m.name }, stem: last.slice(0, Math.max(4, last.length - 1)) }; });
  const addressed = (txt) => { const m = /\b(gospodine|gospodjo|gospodo|poslanice|kolega|kolegice|koleginice)\s+([a-z]+)/g; let x; const f = fold(txt);
    while ((x = m.exec(f))) { const w = x[2]; const hit = others.filter((n) => w.length >= 4 && w.startsWith(n.stem)); if (hit.length === 1) return hit[0]; } return null; };
  sp.forEach((s, i) => {
    if (!isChair(s)) return;
    const sents = (s.lines || []).map((l) => l.w.join(" ")).join(" ").split(/(?<=[.!?…])\s+/);
    sents.forEach((sent, k) => {
      const f = fold(sent);
      if (/izrekao sam opomenu/.test(f) && /povlac/.test(fold(sents.slice(k, k + 2).join(" ")))) {
        const w = named(sent);
        if (w) { const j = out.findIndex((o) => o.mp === +w.p.mp); if (j >= 0) out.splice(j, 1); }
        return;
      }
      if (!OP_NOW.test(f) || /\b(ne|nisam|necu|nije|nisu)\b[^.!?]{0,25}\b(izricem|izreknem|izreci)/.test(f)) return;
      let who = named(sent) || named(sents.slice(k + 1, k + 3).join(" ")) || addressed(sents.slice(k, k + 3).join(" "));
      if (!who) {
        const prev = sp.slice(0, i).reverse().find((x) => !isChair(x)), next = sp.slice(i + 1).find((x) => !isChair(x));
        if (prev && next && prev.who === next.who && people[prev.who] && people[prev.who].mp) who = { p: people[prev.who] };
      }
      const at = Math.round((s.at + (s.dur || 0) * k / Math.max(1, sents.length)) * 10) / 10;
      if (who) out.push({ k: "opomena", at, mp: +who.p.mp, name: who.p.name, t: sent.trim().slice(0, 200), drugu: /drug|ponovo/.test(f) ? 1 : 0 });
      else {
        const near = [...sp.slice(Math.max(0, i - 4), i).reverse(), ...sp.slice(i + 1, i + 3)].filter((x) => !isChair(x) && people[x.who] && people[x.who].mp).map((x) => +people[x.who].mp);
        cand.push({ at, t: sent.trim().slice(0, 200), opts: [...new Set(near)].slice(0, 4) });
      }
    });
  });
  return { out, cand };
}

export function buildDoc(t, sid, dan, allMps = []) {
  const people = t.people || {}, sp = t.speeches || [];
  const who = (s) => people[s.who] || { name: lat(s.who) };
  const speeches = sp.map((s) => {
    const p = who(s);
    return [Math.round(s.at * 10) / 10, Math.round(s.dur), p.mp ? +p.mp : null, p.mp ? "" : p.name, s.clock || "", s.summary || "", p.role === "Predsedavajući" ? 1 : 0];
  });
  const votes = (t.votes || []).filter((v) => v.kind !== "kvorum").map((v) => ({
    k: v.kind === "konstatacija" ? "konstatacija" : "glasanje", at: v.at, t: v.title || "", h: v.headline || "", o: v.outcome || "",
    p: v.passed === false ? 0 : 1, r: v.result || null, opt: (v.options || []).map((o) => [o.label, o.n])
  }));
  const op = opomene(sp, people, allMps);
  const ev = [...votes, ...op.out].sort((a, b) => a.at - b.at);
  const parts = (t.parts || []).map((p) => ({ v: p.v, at: p.at, dur: p.dur, s0: p.from || 0 }));
  const agenda = (t.agenda || []).map((a) => [a.n, a.at, a.title]);
  const inter = (t.inter || []).map((x) => [x.at, x.who, x.text]);
  const mps = new Set(speeches.filter((s) => s[2]).map((s) => s[2]));
  const ses = sessionName(t.title) === "Sednica" ? t.title.replace(/\s*·.*$/, "") : sessionName(t.title);
  // who was who that day (roles and lists change over time: a temporary chair at the first sittings, new groups…)
  const roles = {};
  Object.values(people).forEach((p) => { if (p.mp) roles[+p.mp] = [p.role || "", p.list || ""]; });
  const chairs = [...new Set(sp.filter((s) => (people[s.who] || {}).role === "Predsedavajući" && (people[s.who] || {}).mp).map((s) => +people[s.who].mp))];
  const doc = { date: t.date, sid, ses: /konstitutivn/i.test(t.title) ? "Prva (konstitutivna) sednica" : ses, dan, total: t.total, parts, speeches, ev, cand: op.cand, agenda, inter, who: roles, chairs, src: "skupstina.live" };
  const last = sp[sp.length - 1];
  const gl = votes.filter((v) => v.k === "glasanje").length, opn = ev.filter((e) => e.k === "opomena").length;
  const names = [...mps].map((id) => { const p = Object.values(people).find((x) => +x.mp === id); return p ? p.name : ""; });
  const hay = fold([doc.ses, ...agenda.map((a) => a[2]), ...votes.map((v) => [v.t, v.h, v.o].join(" ")), ...names].join(" | "));
  const lines = [...agenda.map((a) => a[2]), ...votes.map((v) => v.h || v.o || v.t)].filter(Boolean);
  const tekst = sp.map((s) => (s.lines || []).map((l) => l.w.join(" ")).join(" ")).join("\n");
  let end = null;
  if (last && /^\d{1,2}:\d{2}$/.test(last.clock)) {
    const [h, m] = last.clock.split(":").map(Number), x = h * 60 + m + Math.round(last.dur / 60);
    end = Math.floor(x / 60) % 24 + ":" + String(x % 60).padStart(2, "0");
  }
  return { doc, row: { first_clock: sp[0] ? sp[0].clock : null, last_clock: end, n: sp.length, speakers: mps.size, op: opn, gl, hay, lines: JSON.stringify(lines), tekst } };
}

export async function arhivaImport(env) {
  await ensureDan(env);
  const r = await fetch(LIVE + "/data/sessions.json", { headers: { "user-agent": "skupstina.app arhiva (+https://skupstina.app)" } });
  if (!r.ok) throw new Error("sessions.json " + r.status);
  const list = await r.json();
  const have = new Map((await env.DB.prepare("SELECT date, src_updated FROM ar_dan").all()).results.map((x) => [x.date, x.src_updated]));
  let done = 0, allMps = null;
  const errs = [];
  for (const s of list) {
    if (s.status !== "ready" || have.get(s.date) === s.updated + PARSER) continue;
    if (done >= 3) break; // a few days per run keeps the cron short; the rest come on the next runs
    // one broken day must not stop the days after it: note it and go on (it is tried again next run)
    try {
    const tr = await fetch(LIVE + "/data/traka-" + s.id + ".json", { headers: { "user-agent": "skupstina.app arhiva (+https://skupstina.app)" } });
    if (!tr.ok) throw new Error(s.id + " " + tr.status);
    const t = await tr.json();
    const dm = /-d(\d+)$/.exec(s.id);
    if (!allMps) allMps = (await env.DB.prepare("SELECT id, name_lat name FROM mps WHERE active=1").all()).results;
    const built = buildDoc(t, s.id, dm ? +dm[1] : null, allMps), row = built.row;
    // the stenographic notes, when we have them, decide the opomene (see beleske.js)
    const bel = await stFor(env, s.date);
    const doc = bel ? applySten(built.doc, bel.st, bel.url).doc : built.doc;
    if (bel) row.op = doc.ev.filter((e) => e.k === "opomena").length;
    await env.DB.prepare("INSERT OR REPLACE INTO ar_dan(date,sid,ses,dan,total_s,first_clock,last_clock,n,speakers,op,gl,hay,lines,doc,tekst,source,src_updated,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
      .bind(s.date, s.id, doc.ses, doc.dan, doc.total, row.first_clock, row.last_clock, row.n, row.speakers, row.op, row.gl, row.hay, row.lines, JSON.stringify(doc), row.tekst, "skupstina.live", s.updated + PARSER, Date.now()).run();
    done++;
    } catch (e) { errs.push(s.id + ": " + e.message); }
  }
  if (errs.length) throw new Error(errs.join(" | ") + " (imported " + done + ")");
  return done;
}
