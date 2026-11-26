// Admins and the seat map editor (/admin/sala).
// Who is an admin: the super admin (SUPER, fixed here) and the emails in D1 `admins`, each with its menus (`perms`: sala, mod).
// The super admin adds and removes admins in the site's Podešavanja → Admin meni → Admini (/admin/api/admins).
// An admin is recognised by his site account (signed in with Google) or by the editor's own Google sign-in (cookie sk_admin).
// Env: GOOGLE_CLIENT_ID (var), ADMIN_EMAILS (var: only seeds the table once, with the Sala menu), SALT (secret, signs the cookie).
// The old ?key=ADMIN_KEY links still work for the other /admin pages.
import SALA_HTML from "./generated/sala.html";
import { currentUser } from "./auth.js";
import PAGE_HASH from "./generated/version.js"; // src/admin/sala.html + the shared seat plan, joined by build.mjs

const COOKIE = "sk_admin";
const DAYS = 30;
const enc = new TextEncoder();
const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64u = (s) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));
const json = (o, s = 200, h = {}) => new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...h } });

/** The super admin: always an admin with every menu, and the only one who manages the other admins. */
export const SUPER = "mgrahovac87@gmail.com";
/** Admin menus an admin can be given (besides Admini, which is the super admin's alone). */
export const PERMS = ["sala", "mod"];
const EMAIL = /^[^\s@|]{1,64}@[^\s@|]{1,190}\.[^\s@|]{2,}$/;

/** D1 `admins` (email, perms "sala,mod", added_by, at); created once per isolate, filled once from ADMIN_EMAILS (row "#seeded" marks that). */
let adminsReady = false;
async function ensureAdmins(env) {
  if (adminsReady) return;
  await env.DB.prepare("CREATE TABLE IF NOT EXISTS admins(email TEXT PRIMARY KEY, perms TEXT NOT NULL DEFAULT '', added_by TEXT, at TEXT)").run();
  if (!(await env.DB.prepare("SELECT 1 FROM admins WHERE email='#seeded'").first())) {
    const at = new Date().toISOString(), seed = String(env.ADMIN_EMAILS || "").toLowerCase().split(",").map((x) => x.trim()).filter((x) => EMAIL.test(x) && x !== SUPER);
    await env.DB.batch([
      ...seed.map((e) => env.DB.prepare("INSERT OR IGNORE INTO admins(email,perms,added_by,at) VALUES(?,'sala','ADMIN_EMAILS',?)").bind(e, at)),
      env.DB.prepare("INSERT OR IGNORE INTO admins(email,perms,added_by,at) VALUES('#seeded','',NULL,?)").bind(at),
    ]);
  }
  adminsReady = true;
}
const permList = (s) => String(s || "").split(",").filter((x) => PERMS.includes(x));

/** What this email may do: {email, super, perms[]}, or null if it is not an admin. */
export async function adminOf(env, email) {
  email = String(email || "").toLowerCase();
  if (!email || email.startsWith("#")) return null;
  if (email === SUPER) return { email, super: true, perms: [...PERMS] };
  await ensureAdmins(env);
  const row = await env.DB.prepare("SELECT perms FROM admins WHERE email=?").bind(email).first();
  return row ? { email, super: false, perms: permList(row.perms) } : null;
}
/** Admin rights from a site account: only an account signed in with Google and without a password, so the email is
 *  surely his (an email + password account's address is never checked). */
export const userAdmin = (env, user) => user && user.sub && !user.pw ? adminOf(env, user.email) : null;

async function hmac(env, data) {
  const key = await crypto.subtle.importKey("raw", enc.encode("admin-session:" + (env.SALT || "")), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64u(await crypto.subtle.sign("HMAC", key, enc.encode(data)));
}

/** The admin behind this request ({email, super, perms, via: "site" | "admin"}), or null:
 *  first the site account (sk_s), then the editor's own Google sign-in (sk_admin). */
export async function adminWho(req, env) {
  const site = await userAdmin(env, await currentUser(req, env).catch(() => null));
  if (site) return { ...site, via: "site" };
  const email = await cookieEmail(req, env), a = email && await adminOf(env, email);
  return a ? { ...a, via: "admin" } : null;
}
async function cookieEmail(req, env) {
  if (!env.SALT) return null;
  const c = (req.headers.get("cookie") || "").split(/;\s*/).find((x) => x.startsWith(COOKIE + "="));
  if (!c) return null;
  const [email, exp, sig] = decodeURIComponent(c.slice(COOKIE.length + 1)).split("|");
  if (!email || !exp || !sig || Date.now() > +exp) return null;
  if (sig !== (await hmac(env, email + "|" + exp))) return null;
  return email;
}

let jwks = null, jwksAt = 0;
async function googleKey(kid) {
  if (!jwks || Date.now() - jwksAt > 3600_000) {
    jwks = (await (await fetch("https://www.googleapis.com/oauth2/v3/certs")).json()).keys;
    jwksAt = Date.now();
  }
  const k = jwks.find((x) => x.kid === kid);
  return k && crypto.subtle.importKey("jwk", k, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
}

/** Checks a Google ID token (from Sign in with Google): {email, sub, name} if valid, else null. */
export async function verifyGoogleToken(token, env) {
  const parts = String(token || "").split(".");
  if (parts.length !== 3 || !env.GOOGLE_CLIENT_ID) return null;
  const head = JSON.parse(new TextDecoder().decode(unb64u(parts[0])));
  const body = JSON.parse(new TextDecoder().decode(unb64u(parts[1])));
  const key = await googleKey(head.kid);
  if (!key || head.alg !== "RS256") return null;
  const ok = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, unb64u(parts[2]), enc.encode(parts[0] + "." + parts[1]));
  if (!ok) return null;
  if (body.aud !== env.GOOGLE_CLIENT_ID) return null;
  if (body.iss !== "accounts.google.com" && body.iss !== "https://accounts.google.com") return null;
  if (!body.exp || body.exp * 1000 < Date.now() || !body.email_verified) return null;
  return { email: String(body.email).toLowerCase(), sub: String(body.sub), name: body.given_name || body.name || "" };
}

const SEAT = /^([0-6]-[0-7]-\d{1,2}|p-[0-8])$/; // hall seat row-section-index, or presidium place p-0..p-8

/** mps.seat_lock (1 = the seat editor can't move this MP); added once per isolate. */
let lockCol = false;
async function ensureLockCol(env) {
  if (lockCol) return;
  try { await env.DB.prepare("ALTER TABLE mps ADD COLUMN seat_lock INTEGER DEFAULT 0").run(); } catch (e) { } // already there
  lockCol = true;
}

/** After a seat change: drop this data centre's cached copies of the page and of /api/seats, so the change shows at once here;
 *  elsewhere the page catches up within 5 minutes, and open pages pick it up from /api/seats within a minute (30-hall.js). */
async function purgeSeats(req) {
  const o = new URL(req.url).origin, c = caches.default;
  await Promise.all([c.delete(new Request(o + "/__seats")), c.delete(new Request(o + "/__page_h" + PAGE_HASH))]).catch(() => {});
}

/** Handles /admin/sala and /admin/api/*; returns null for anything else. */
export async function adminRoute(req, env, u, p) {
  if (p === "/admin/sala") {
    return new Response(SALA_HTML.replace("__CLIENT_ID__", env.GOOGLE_CLIENT_ID || ""), {
      headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex", "referrer-policy": "no-referrer" },
    });
  }
  if (!p.startsWith("/admin/api/")) return null;
  const same = (req.headers.get("origin") || u.origin) === u.origin;
  if (req.method === "POST" && !same) return json({ ok: false }, 403);

  if (p === "/admin/api/me") {
    const a = await adminWho(req, env), sala = !!a && a.perms.includes("sala");
    return json({ email: sala ? a.email : null, via: sala ? a.via : null, clientId: env.GOOGLE_CLIENT_ID || null });
  }
  if (p === "/admin/api/login" && req.method === "POST") {
    const { credential } = await req.json().catch(() => ({}));
    const email = (await verifyGoogleToken(credential, env).catch(() => null))?.email || null;
    const a = email && await adminOf(env, email);
    if (!a || !a.perms.includes("sala")) return json({ ok: false, err: email ? "not_admin" : "bad_token", email }, 403);
    const exp = String(Date.now() + DAYS * 86400_000);
    const v = encodeURIComponent(email + "|" + exp + "|" + (await hmac(env, email + "|" + exp)));
    return json({ ok: true, email }, 200, { "set-cookie": `${COOKIE}=${v}; Path=/admin; Max-Age=${DAYS * 86400}; HttpOnly; Secure; SameSite=Strict` });
  }
  if (p === "/admin/api/logout") return json({ ok: true }, 200, { "set-cookie": `${COOKIE}=; Path=/admin; Max-Age=0; HttpOnly; Secure; SameSite=Strict` });

  const who = await adminWho(req, env);
  if (!who) return json({ ok: false, err: "login" }, 401);

  // Admini (super admin only): list, add or change (email + menus), remove
  if (p === "/admin/api/admins") {
    if (!who.super) return json({ ok: false, err: "super" }, 403);
    await ensureAdmins(env);
    if (req.method === "POST") {
      const b = await req.json().catch(() => ({}));
      const email = String(b.email || "").trim().toLowerCase();
      if (!EMAIL.test(email) || email === SUPER) return json({ ok: false, err: "email" }, 400);
      if (b.remove) await env.DB.prepare("DELETE FROM admins WHERE email=?").bind(email).run();
      else {
        const perms = PERMS.filter((x) => Array.isArray(b.perms) && b.perms.includes(x)).join(",");
        await env.DB.prepare("INSERT INTO admins(email,perms,added_by,at) VALUES(?,?,?,?) ON CONFLICT(email) DO UPDATE SET perms=excluded.perms")
          .bind(email, perms, who.email, new Date().toISOString()).run();
      }
    }
    const { results } = await env.DB.prepare("SELECT a.email,a.perms,a.at,u.name,u.avatar,u.color,(u.sub IS NOT NULL AND u.pw IS NULL) g FROM admins a LEFT JOIN users u ON u.email=a.email WHERE a.email NOT LIKE '#%' ORDER BY a.at").all();
    return json({ ok: true, super: SUPER, perms: PERMS, admins: results.map((x) => ({ email: x.email, perms: permList(x.perms), name: x.name || null, avatar: x.avatar || null, color: x.color ?? null, google: !!x.g })) });
  }

  if (!who.perms.includes("sala")) return json({ ok: false, err: "login" }, 401);

  await ensureLockCol(env);
  if (p === "/admin/api/seats" && req.method === "GET") {
    const { results } = await env.DB.prepare("SELECT m.id,m.name_lat n,m.electoral_list l,m.mp_group pg,m.assembly_role r,m.seat s,m.seat_lock lk,(SELECT 1 FROM photos p WHERE p.id=m.id) ph FROM mps m WHERE m.active=1 AND m.name_lat IS NOT NULL ORDER BY m.last_name,m.first_name").all();
    return json({ ok: true, mps: results });
  }
  if (p === "/admin/api/seats" && req.method === "POST") {
    const { set } = await req.json().catch(() => ({}));
    if (!Array.isArray(set) || !set.length || set.length > 20) return json({ ok: false, err: "bad" }, 400);
    const at = new Date().toISOString(), st = [];
    // the lock (seat_lock) is only a guard in the editor against dragging someone by accident; swaps onto a locked seat are allowed
    for (const x of set) {
      const id = parseInt(x.id), seat = x.seat == null ? null : String(x.seat);
      if (!id || (seat !== null && !SEAT.test(seat))) return json({ ok: false, err: "bad" }, 400);
      if (seat) st.push(env.DB.prepare("UPDATE mps SET seat=NULL,seat_at=? WHERE seat=? AND id<>?").bind(at, seat, id));
      st.push(env.DB.prepare("UPDATE mps SET seat=?,seat_at=? WHERE id=?").bind(seat, at, id));
    }
    await env.DB.batch(st);
    await purgeSeats(req);
    return json({ ok: true });
  }
  if (p === "/admin/api/lock" && req.method === "POST") {
    const { id, lock } = await req.json().catch(() => ({}));
    const n = parseInt(id);
    if (!n) return json({ ok: false, err: "bad" }, 400);
    const r = await env.DB.prepare("UPDATE mps SET seat_lock=? WHERE id=? AND (?=0 OR seat IS NOT NULL)").bind(lock ? 1 : 0, n, lock ? 1 : 0).run();
    return r.meta.changes ? json({ ok: true }) : json({ ok: false, err: "no_seat" }, 409);
  }
  return json({ ok: false }, 404);
}
