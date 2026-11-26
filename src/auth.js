// Visitor accounts: sign in with Google, or with email + password. Needed to write in the chat; reading needs none.
// A new account picks a chat name and a name colour (0-7, the chat's palette).
// Session: cookie sk_s = "<user id>|<expiry ms>|<HMAC>" signed with the SALT secret, 180 days, HttpOnly.
import { verifyGoogleToken } from "./admin.js";
import { AVATAR_IDS } from "./generated/avatars.js";

const NAME_DAYS = 30; // a chat name can be changed once every 30 days (colour and avatar any time)
const COOKIE = "sk_s", DAYS = 180, TICKET_MIN = 15, PBKDF2_ITER = 100_000;
const enc = new TextEncoder();
const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64u = (s) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));
const json = (o, s = 200, h = {}) => new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...h } });
const now = () => new Date().toISOString();
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;

async function hmac(env, data) {
  const key = await crypto.subtle.importKey("raw", enc.encode("user-session:" + (env.SALT || "")), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64u(await crypto.subtle.sign("HMAC", key, enc.encode(data)));
}
async function sign(env, s) { return s + "|" + (await hmac(env, s)); }
async function unsign(env, v) {
  const i = v.lastIndexOf("|");
  if (i < 0) return null;
  const s = v.slice(0, i);
  return (await hmac(env, s)) === v.slice(i + 1) ? s : null;
}

async function hashPw(pw, saltB64) {
  const salt = saltB64 ? unb64u(saltB64) : crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", enc.encode(pw), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: PBKDF2_ITER }, key, 256);
  return `pbkdf2$${PBKDF2_ITER}$${b64u(salt)}$${b64u(bits)}`;
}
async function checkPw(pw, stored) {
  const [, , salt] = String(stored || "").split("$");
  return !!salt && (await hashPw(pw, salt)) === stored;
}

/** Google popup sign-in gives an access token: check with Google that it was issued to our app, then read the account. */
async function verifyAccessToken(token, env) {
  const t = String(token || "");
  if (!t || t.length > 4096 || !env.GOOGLE_CLIENT_ID) return null;
  const info = await (await fetch("https://oauth2.googleapis.com/tokeninfo?access_token=" + encodeURIComponent(t))).json();
  if (info.aud !== env.GOOGLE_CLIENT_ID || !info.sub || !info.email || String(info.email_verified) !== "true") return null;
  const me = await (await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { authorization: "Bearer " + t } })).json().catch(() => ({}));
  if (me.sub && me.sub !== info.sub) return null;
  return { email: String(info.email).toLowerCase(), sub: String(info.sub), name: me.given_name || me.name || "" };
}

/** When the name can next be changed (ms), or 0 if it can be changed now. */
const nameNext = (u) => { const t = Date.parse(u?.name_changed_at || "") + NAME_DAYS * 86400_000; return t > Date.now() ? t : 0; };
const pub = (u) => u && { id: u.id, name: u.name, color: u.color, avatar: AVATAR_IDS.includes(u.avatar) ? u.avatar : null, email: u.email, google: !!u.sub, nameNext: nameNext(u) };

/** The signed-in user (row from users), or null. */
export async function currentUser(req, env) {
  if (!env.SALT) return null;
  const c = (req.headers.get("cookie") || "").split(/;\s*/).find((x) => x.startsWith(COOKIE + "="));
  if (!c) return null;
  const s = await unsign(env, decodeURIComponent(c.slice(COOKIE.length + 1)));
  if (!s) return null;
  const [id, exp] = s.split("|");
  if (Date.now() > +exp) return null;
  return env.DB.prepare("SELECT * FROM users WHERE id=?").bind(+id).first();
}
async function sessionCookie(env, id) {
  const v = encodeURIComponent(await sign(env, id + "|" + (Date.now() + DAYS * 86400_000)));
  return `${COOKIE}=${v}; Path=/; Max-Age=${DAYS * 86400}; HttpOnly; Secure; SameSite=Lax`;
}

async function ipKey(req, env) {
  const ip = req.headers.get("cf-connecting-ip") || "local";
  const d = await crypto.subtle.digest("SHA-256", enc.encode(ip + "|auth|" + (env.SALT || "")));
  return b64u(d).slice(0, 22);
}
async function tooManyFails(env, ip) {
  const r = await env.DB.prepare("SELECT COUNT(*) n FROM auth_fail WHERE ip=? AND at>?").bind(ip, Date.now() - 15 * 60_000).first();
  return r.n >= 10;
}
const fail = (env, ip) => env.DB.batch([
  env.DB.prepare("INSERT INTO auth_fail(ip,at) VALUES(?,?)").bind(ip, Date.now()),
  env.DB.prepare("DELETE FROM auth_fail WHERE at<?").bind(Date.now() - 86400_000),
]);

/** One account per email, per chat name and per Google account: enforced by unique indexes (once per isolate). */
let indexed = false;
async function ensureIndexes(env) {
  if (indexed) return;
  for (const [n, c] of [["users_email", "email"], ["users_nk", "nk"], ["users_sub", "sub"]]) {
    try { await env.DB.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS ${n} ON users(${c})`).run(); } catch (e) { console.log("index " + n + ": " + e.message); }
  }
  try { await env.DB.prepare("ALTER TABLE users ADD COLUMN name_changed_at TEXT").run(); } catch (e) { } // already there
  try { await env.DB.prepare("ALTER TABLE users ADD COLUMN avatar TEXT").run(); } catch (e) { } // already there
  indexed = true;
}
/** A unique-index error from D1 → our error code. */
const clash = (e) => /UNIQUE/i.test(String(e?.message)) ? (/email/.test(e.message) ? "email_taken" : "name_taken") : null;

/** Name and colour from a request body; returns [error code, name, name key, colour]. */
function profileOf(body, checkName) {
  const [err, name, nk] = checkName(body.name);
  if (err) return ["name_" + err];
  const color = Number.isInteger(body.color) && body.color >= 0 && body.color <= 7 ? body.color : 0;
  return [null, name, nk, color];
}

/** /api/auth/*; returns null for other paths. `checkName` is the chat's name rule. */
export async function authRoute(req, env, u, p, checkName) {
  if (!p.startsWith("/api/auth/")) return null;
  if (req.method === "POST" && (req.headers.get("origin") || u.origin) !== u.origin) return json({ ok: false }, 403);
  const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};

  if (p === "/api/auth/me") return json({ user: pub(await currentUser(req, env)), clientId: env.GOOGLE_CLIENT_ID || null });
  if (p === "/api/auth/logout") return json({ ok: true }, 200, { "set-cookie": `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax` });
  if (req.method !== "POST") return json({ ok: false }, 405);
  const ip = await ipKey(req, env);
  await ensureIndexes(env);

  // Google: an existing account signs in; a new one gets a short ticket and picks a name and colour next.
  if (p === "/api/auth/google") {
    const g = body.access_token ? await verifyAccessToken(body.access_token, env).catch(() => null) : await verifyGoogleToken(body.credential, env).catch(() => null);
    if (!g) return json({ ok: false, err: "google" }, 400);
    let user = await env.DB.prepare("SELECT * FROM users WHERE sub=?").bind(g.sub).first();
    if (!user) {
      user = await env.DB.prepare("SELECT * FROM users WHERE email=?").bind(g.email).first();
      if (user) await env.DB.prepare("UPDATE users SET sub=? WHERE id=?").bind(g.sub, user.id).run(); // link a password account
    }
    if (user) {
      await env.DB.prepare("UPDATE users SET seen_at=? WHERE id=?").bind(now(), user.id).run();
      return json({ ok: true, user: pub(user) }, 200, { "set-cookie": await sessionCookie(env, user.id) });
    }
    const ticket = await sign(env, ["g", g.sub, g.email, Date.now() + TICKET_MIN * 60_000].join("|"));
    return json({ ok: true, need: "profile", ticket, suggest: g.name.slice(0, 20) });
  }

  if (p === "/api/auth/login") {
    if (await tooManyFails(env, ip)) return json({ ok: false, err: "slow" }, 429);
    const email = String(body.email || "").trim().toLowerCase();
    const user = email && await env.DB.prepare("SELECT * FROM users WHERE email=?").bind(email).first();
    if (!user || !user.pw || !(await checkPw(String(body.password || ""), user.pw))) {
      await fail(env, ip);
      return json({ ok: false, err: user && !user.pw ? "use_google" : "wrong" }, 400);
    }
    await env.DB.prepare("UPDATE users SET seen_at=? WHERE id=?").bind(now(), user.id).run();
    return json({ ok: true, user: pub(user) }, 200, { "set-cookie": await sessionCookie(env, user.id) });
  }

  // New account: with a Google ticket, or with email + password.
  if (p === "/api/auth/register") {
    const recent = await env.DB.prepare("SELECT COUNT(*) n FROM users WHERE created_ip=? AND created_at>?").bind(ip, new Date(Date.now() - 3600_000).toISOString()).first();
    if (recent.n >= 5) return json({ ok: false, err: "slow" }, 429);
    const [err, name, nk, color] = profileOf(body, checkName);
    if (err) return json({ ok: false, err }, 400);
    let sub = null, email, pw = null;
    if (body.ticket) {
      const t = await unsign(env, String(body.ticket));
      const [kind, s, e, exp] = (t || "").split("|");
      if (kind !== "g" || Date.now() > +exp) return json({ ok: false, err: "ticket" }, 400);
      sub = s; email = e;
    } else {
      email = String(body.email || "").trim().toLowerCase();
      const password = String(body.password || "");
      if (!EMAIL.test(email)) return json({ ok: false, err: "email" }, 400);
      if (password.length < 8 || password.length > 200) return json({ ok: false, err: "password" }, 400);
      pw = await hashPw(password);
    }
    if (await env.DB.prepare("SELECT 1 FROM users WHERE nk=?").bind(nk).first()) return json({ ok: false, err: "name_taken" }, 409);
    if (await env.DB.prepare("SELECT 1 FROM users WHERE email=?").bind(email).first()) return json({ ok: false, err: "email_taken" }, 409);
    let user;
    try {
      user = await env.DB.prepare("INSERT INTO users(sub,email,pw,name,nk,color,created_at,created_ip,seen_at) VALUES(?,?,?,?,?,?,?,?,?) RETURNING *")
        .bind(sub, email, pw, name, nk, color, now(), ip, now()).first();
    } catch (e) {
      const c = clash(e); if (c) return json({ ok: false, err: c }, 409);
      throw e;
    }
    return json({ ok: true, user: pub(user) }, 200, { "set-cookie": await sessionCookie(env, user.id) });
  }

  const user = await currentUser(req, env);
  if (!user) return json({ ok: false, err: "login" }, 401);
  if (p === "/api/auth/profile") {
    const [err, name, nk, color] = profileOf(body, checkName);
    if (err) return json({ ok: false, err }, 400);
    const renamed = name !== user.name;
    if (renamed && nameNext(user)) return json({ ok: false, err: "name_wait", next: nameNext(user) }, 429);
    if (nk !== user.nk && await env.DB.prepare("SELECT 1 FROM users WHERE nk=? AND id<>?").bind(nk, user.id).first()) return json({ ok: false, err: "name_taken" }, 409);
    let row;
    try {
      row = renamed
        ? await env.DB.prepare("UPDATE users SET name=?,nk=?,color=?,name_changed_at=? WHERE id=? RETURNING *").bind(name, nk, color, now(), user.id).first()
        : await env.DB.prepare("UPDATE users SET color=? WHERE id=? RETURNING *").bind(color, user.id).first();
    }
    catch (e) { if (clash(e)) return json({ ok: false, err: "name_taken" }, 409); throw e; }
    return json({ ok: true, user: pub(row) });
  }
  // Avatar: one of the pictures in assets/avatars/64 (or none); any time.
  if (p === "/api/auth/avatar") {
    const a = body.avatar == null ? null : String(body.avatar);
    if (a !== null && !AVATAR_IDS.includes(a)) return json({ ok: false, err: "avatar" }, 400);
    const row = await env.DB.prepare("UPDATE users SET avatar=? WHERE id=? RETURNING *").bind(a, user.id).first();
    return json({ ok: true, user: pub(row) });
  }
  return json({ ok: false }, 404);
}
