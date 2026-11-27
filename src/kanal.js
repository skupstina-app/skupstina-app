// Kanal: the @ParlamentSrbija YouTube channel, read with the YouTube Data API (secret YT_API_KEY), every 10 min by the cron.
// - New uploads: the newest page of the uploads playlist (1 unit), then videos.list for the new ones (1 unit per 50).
// - Backfill: older pages of the uploads playlist, a few per run, until uploads before KANAL_FROM.
// - Recheck: once an hour the plenary videos of the last 21 days are asked again: duration, live state, and whether
//   they still exist (the channel deletes a day's live stream some days after it uploads the parts; gone = 1).
// Every video is classified by its title (kind/key/date/part, see classify()) into D1 yt_video. That gives, without
// anyone's help: which uploads are sittings, which parts make a day and in what order, which day of the sitting it is,
// when a live stream really started (actual_start), and the next scheduled sitting.
const CHANNEL = "UCghngrfQwzJ4aaPZ-UgNIZQ", UPLOADS = "UU" + CHANNEL.slice(2), API = "https://www.googleapis.com/youtube/v3/";
const KANAL_FROM = "2026-04-01";

// ---- title rule ----
// Titles are Cyrillic, sometimes with Latin look-alike letters inside words ("НCPC", "седницa", "скупштинacе"):
// those are turned into Cyrillic first, then everything into plain Latin without diacritics.
const HG = { a: "а", c: "с", e: "е", o: "о", p: "р", x: "х", y: "у", A: "А", C: "С", E: "Е", O: "О", P: "Р", X: "Х", H: "Н", K: "К", M: "М", T: "Т", B: "В" };
const CY = "абвгдђежзијклљмнњопрстћуфхцчџш", LA = ["a", "b", "v", "g", "d", "dj", "e", "z", "z", "i", "j", "k", "l", "lj", "m", "n", "nj", "o", "p", "r", "s", "t", "c", "u", "f", "h", "c", "c", "dz", "s"];
export const plain = (s) => String(s || "").split(/(\s+)/).map((w) => (/[Ѐ-ӿ]/.test(w) ? w.replace(/[acepxyACEOPXHKMTB]/g, (c) => HG[c]) : w)).join("")
  .toLowerCase().split("").map((c) => { const i = CY.indexOf(c); return i < 0 ? c : LA[i]; }).join("")
  .normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "dj");
const NOT = /odbor|konferencij|\bkzn\b|sastan|konsultacij|zaklet|slusanj|izjav|obracanj|forum|potpisuje|delegacij|prijem|poseta|cestitk/;
const ROM = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9, x: 10 };

// kind: 'sednica' (a plenary sitting), 'glasanje' (Dan za glasanje), 'pitanja' (poslanička pitanja) or null.
// key: one sitting across its days ("prv|sednic|petnae", "des|vanred|zasedanj|cetrna"): ordinal stem + what + convocation,
// so "Prva sednica ..." (day 1) and "nastavak Prve sednice ..." (later days) are the same key.
export function classify(title) {
  const s = plain(title);
  if (NOT.test(s)) return null;
  let kind = null;
  if (/(sednic|zasedanj)/.test(s) && /(narodne skupstin|\bnsrs\b|\bns\b)/.test(s)) kind = "sednica";
  else if (/dan za glasanje/.test(s)) kind = "glasanje";
  else if (/poslanickih pitanja/.test(s)) kind = "pitanja";
  if (!kind) return null;
  const d = /(\d{1,2})\.\s?(\d{1,2})\.\s?(\d{4})/.exec(s);
  const p = /\(\s*([ivx]+)\s*\)\s*$/.exec(s);
  let key = kind;
  if (kind === "sednica") {
    const sz = /u\s+(\S+)\s+sazivu/.exec(s);
    const ses = /(\S+)\s+(sednic|zasedanj)\S*(?:\s+(\S+)\s+(redovn|vanredn)\S*\s+zasedanj)?/.exec(s);
    const zas = /(\S+)\s+(vanredn|redovn)\S*\s+zasedanj/.exec(s);
    if (ses && ses[2] === "sednic") key = [ses[1].slice(0, 3), "sednic", ses[3] ? ses[3].slice(0, 3) + ses[4] : "", sz ? sz[1].slice(0, 6) : ""].join("|");
    else if (zas) key = [zas[1].slice(0, 3), zas[2], "zasedanj", sz ? sz[1].slice(0, 6) : ""].join("|");
  }
  return { kind, key, date: d ? `${d[3]}-${d[2].padStart(2, "0")}-${d[1].padStart(2, "0")}` : null, part: p ? ROM[p[1]] || null : null };
}

// ---- storage ----
let ready = false;
async function ensure(env) {
  if (ready) return;
  await env.DB.prepare("CREATE TABLE IF NOT EXISTS yt_video(id TEXT PRIMARY KEY, title TEXT, published_at TEXT, kind TEXT, skey TEXT, date TEXT, part INTEGER, dur_s INTEGER, live TEXT, sched_start TEXT, actual_start TEXT, actual_end TEXT, gone INTEGER DEFAULT 0, checked_at INTEGER, updated_at INTEGER)").run();
  await env.DB.prepare("CREATE INDEX IF NOT EXISTS yt_video_date ON yt_video(date, kind)").run();
  ready = true;
}
const st = async (env, k) => (await env.DB.prepare("SELECT v FROM import_state WHERE k=?").bind(k).first())?.v ?? null;
const setSt = (env, k, v) => env.DB.prepare("INSERT OR REPLACE INTO import_state(k,v) VALUES(?,?)").bind(k, String(v)).run();
const dur = (iso) => { const m = /P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(iso || ""); return m ? ((+m[1] || 0) * 86400 + (+m[2] || 0) * 3600 + (+m[3] || 0) * 60 + (+m[4] || 0)) : null; };

async function yt(env, path, params) {
  const u = new URL(API + path);
  Object.entries({ ...params, key: env.YT_API_KEY }).forEach(([k, v]) => u.searchParams.set(k, v));
  const r = await fetch(u);
  if (!r.ok) throw new Error("youtube " + path + " " + r.status + " " + (await r.text()).slice(0, 200));
  return r.json();
}

// videos.list for up to 50 ids; ids YouTube no longer returns are gone
async function details(env, ids, titles) {
  if (!ids.length) return 0;
  const j = await yt(env, "videos", { part: "snippet,contentDetails,liveStreamingDetails", id: ids.join(","), maxResults: 50 });
  const got = new Set(), now = Date.now(), stmts = [];
  for (const v of j.items || []) {
    got.add(v.id);
    const t = v.snippet.title, c = classify(t), l = v.liveStreamingDetails || {};
    stmts.push(env.DB.prepare("INSERT INTO yt_video(id,title,published_at,kind,skey,date,part,dur_s,live,sched_start,actual_start,actual_end,gone,checked_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,0,?,?) " +
      "ON CONFLICT(id) DO UPDATE SET title=excluded.title, kind=excluded.kind, skey=excluded.skey, date=excluded.date, part=excluded.part, dur_s=excluded.dur_s, live=excluded.live, " +
      "sched_start=excluded.sched_start, actual_start=excluded.actual_start, actual_end=excluded.actual_end, gone=0, checked_at=excluded.checked_at, updated_at=excluded.updated_at")
      .bind(v.id, t, v.snippet.publishedAt, c ? c.kind : null, c ? c.key : null, c ? c.date : null, c ? c.part : null, dur(v.contentDetails.duration),
        v.snippet.liveBroadcastContent || "none", l.scheduledStartTime || null, l.actualStartTime || null, l.actualEndTime || null, now, now));
  }
  for (const id of ids) if (!got.has(id)) stmts.push(env.DB.prepare("UPDATE yt_video SET gone=1, checked_at=? WHERE id=?").bind(now, id));
  if (stmts.length) await env.DB.batch(stmts);
  return got.size;
}

async function page(env, token) {
  const j = await yt(env, "playlistItems", { part: "contentDetails", playlistId: UPLOADS, maxResults: 50, ...(token ? { pageToken: token } : {}) });
  return { ids: (j.items || []).map((x) => x.contentDetails.videoId), dates: (j.items || []).map((x) => x.contentDetails.videoPublishedAt || ""), next: j.nextPageToken || null };
}

export async function kanalCron(env) {
  if (!env.YT_API_KEY) return "no key";
  await ensure(env);
  const out = [];
  // 1. newest uploads (scheduled live streams are in this list too, as 'upcoming')
  const first = await page(env, null);
  const have = new Set((await env.DB.prepare(`SELECT id FROM yt_video WHERE id IN (${first.ids.map(() => "?").join(",")})`).bind(...first.ids).all()).results.map((r) => r.id));
  const fresh = first.ids.filter((id) => !have.has(id));
  if (fresh.length) out.push("new " + await details(env, fresh));
  // 2. backfill older pages, 3 per run, until uploads before KANAL_FROM
  if ((await st(env, "kanal_back_done")) !== "1") {
    let tok = (await st(env, "kanal_back_tok")) || first.next;
    for (let i = 0; i < 3 && tok; i++) {
      const p = await page(env, tok);
      await details(env, p.ids);
      tok = p.next;
      if (!tok || p.dates.some((d) => d && d < KANAL_FROM)) { tok = null; break; }
    }
    if (tok) await setSt(env, "kanal_back_tok", tok);
    else await setSt(env, "kanal_back_done", "1");
    out.push(tok ? "backfill…" : "backfill done");
  }
  // 3. hourly: recent plenary videos and anything live or upcoming, asked again
  const last = +(await st(env, "kanal_recheck")) || 0;
  if (Date.now() - last > 36e5) {
    const since = new Date(Date.now() - 21 * 864e5).toISOString().slice(0, 10);
    const ids = (await env.DB.prepare("SELECT id FROM yt_video WHERE gone=0 AND (live IN ('live','upcoming') OR (kind IS NOT NULL AND (date>=? OR published_at>=?))) LIMIT 50").bind(since, since).all()).results.map((r) => r.id);
    await details(env, ids);
    await setSt(env, "kanal_recheck", Date.now());
    out.push("recheck " + ids.length);
  }
  await fillArhiva(env);
  return out.join(", ");
}

// What the archive takes from the channel: when a live stream really started (start_ms of our own days), and N. dan
// (the rank of the day among the dates of the same sitting).
async function fillArhiva(env) {
  try {
    const { results } = await env.DB.prepare("SELECT a.video, v.actual_start, v.dur_s FROM arhiva_dani a JOIN yt_video v ON v.id=a.video WHERE a.start_ms IS NULL AND v.actual_start IS NOT NULL").all();
    for (const r of results) await env.DB.prepare("UPDATE arhiva_dani SET start_ms=?, len_s=COALESCE(len_s,?) WHERE video=?").bind(Date.parse(r.actual_start), r.dur_s, r.video).run();
    const days = await dayNumbers(env);
    const own = (await env.DB.prepare("SELECT video, date FROM arhiva_dani WHERE dan IS NULL AND date IS NOT NULL").all()).results;
    for (const r of own) if (days.has(r.date)) await env.DB.prepare("UPDATE arhiva_dani SET dan=? WHERE video=?").bind(days.get(r.date).dan, r.video).run();
  } catch (e) { /* arhiva_dani may not exist yet */ }
}

// date → {key, dan}: for each sitting, its dates in order
export async function dayNumbers(env) {
  await ensure(env);
  const { results } = await env.DB.prepare("SELECT DISTINCT skey, date FROM yt_video WHERE kind='sednica' AND date IS NOT NULL ORDER BY date").all();
  const n = new Map(), out = new Map();
  for (const r of results) { const k = (n.get(r.skey) || 0) + 1; n.set(r.skey, k); if (!out.has(r.date)) out.set(r.date, { key: r.skey, dan: k }); }
  return out;
}

// GET /api/kanal: the sittings the channel has, by day, with their parts in order; live and upcoming sittings.
export async function kanalRoute(req, env, u) {
  await ensure(env);
  const days = await dayNumbers(env);
  const { results } = await env.DB.prepare("SELECT id,title,kind,skey,date,part,dur_s,live,sched_start,actual_start,actual_end,gone,published_at FROM yt_video WHERE kind IS NOT NULL ORDER BY date DESC, published_at").all();
  const by = new Map();
  for (const v of results) {
    const k = v.date || "?";
    if (!by.has(k)) by.set(k, { date: v.date, kind: v.kind, key: v.skey, dan: (days.get(v.date) || {}).dan || null, stream: null, parts: [] });
    const d = by.get(k);
    if (v.actual_start) d.stream = { id: v.id, start: v.actual_start, end: v.actual_end, dur: v.dur_s, gone: v.gone, live: v.live };
    else if (v.live === "upcoming") d.next = { id: v.id, at: v.sched_start, title: v.title };
    else d.parts.push({ id: v.id, n: v.part, dur: v.dur_s, gone: v.gone });
  }
  for (const d of by.values()) d.parts.sort((a, b) => (a.n || 99) - (b.n || 99));
  const live = results.find((v) => v.live === "live") || null;
  const next = results.filter((v) => v.live === "upcoming").sort((a, b) => (a.sched_start < b.sched_start ? -1 : 1))[0] || null;
  return new Response(JSON.stringify({ live: live && { id: live.id, title: live.title, date: live.date }, next: next && { id: next.id, title: next.title, at: next.sched_start }, days: [...by.values()] }),
    { headers: { "content-type": "application/json; charset=utf-8", "cache-control": "public, max-age=60" } });
}
