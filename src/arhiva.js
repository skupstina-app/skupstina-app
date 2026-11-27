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
  if (!m) return "Sednica";
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

export async function arhivaRoute(req, env, u, p) {
  await ensure(env);
  if (p === "/api/arhiva") {
    const { results } = await env.DB.prepare("SELECT video,date,title,start_ms,len_s,dan,first_s,last_s,talk_s,n,speakers,mps,status FROM arhiva_dani WHERE date IS NOT NULL ORDER BY date DESC").all();
    results.forEach((r) => {
      r.ses = sessionName(r.title);
      r.mps = String(r.mps || "").split(",").filter(Boolean).map(Number);
      delete r.title;
    });
    return J({ days: results }, 60);
  }
  if (p === "/api/arhiva/day") {
    const v = u.searchParams.get("v") || "";
    if (!/^[\w-]{6,20}$/.test(v)) return J({ error: "video" }, 0);
    const { results } = await env.DB.prepare("SELECT start_s a, end_s b, mp, talk_s t FROM speech_segments WHERE video=? ORDER BY start_s").bind(v).all();
    return J({ video: v, segs: results.map((s) => [s.a, s.b ?? s.a, s.mp, Math.round(s.t ?? (s.b ?? s.a) - s.a)]) }, 60);
  }
  return null;
}
