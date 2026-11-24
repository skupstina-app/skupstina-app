// Admin: Google sign-in for the admin emails, and the seat map editor (/admin/sala).
// Env: GOOGLE_CLIENT_ID (var), ADMIN_EMAILS (var, comma separated), SALT (secret, signs the session cookie).
// The old ?key=ADMIN_KEY links still work for the other /admin pages.
import SALA_HTML from "./admin/sala.html";

const COOKIE = "sk_admin";
const DAYS = 30;
const enc = new TextEncoder();
const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64u = (s) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));
const json = (o, s = 200, h = {}) => new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...h } });
const admins = (env) => String(env.ADMIN_EMAILS || "").toLowerCase().split(",").map((s) => s.trim()).filter(Boolean);

async function hmac(env, data) {
  const key = await crypto.subtle.importKey("raw", enc.encode("admin-session:" + (env.SALT || "")), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64u(await crypto.subtle.sign("HMAC", key, enc.encode(data)));
}

/** The signed-in admin's email, or null. */
export async function adminEmail(req, env) {
  if (!env.SALT) return null;
  const c = (req.headers.get("cookie") || "").split(/;\s*/).find((x) => x.startsWith(COOKIE + "="));
  if (!c) return null;
  const [email, exp, sig] = decodeURIComponent(c.slice(COOKIE.length + 1)).split("|");
  if (!email || !exp || !sig || Date.now() > +exp) return null;
  if (sig !== (await hmac(env, email + "|" + exp))) return null;
  return admins(env).includes(email) ? email : null;
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

/** Checks a Google ID token (from Sign in with Google) and returns its verified email, or null. */
async function verifyGoogle(token, env) {
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
  return String(body.email).toLowerCase();
}

const SEAT = /^[0-5]-[0-7]-\d{1,2}$/;

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

  if (p === "/admin/api/me") return json({ email: await adminEmail(req, env), clientId: env.GOOGLE_CLIENT_ID || null });
  if (p === "/admin/api/login" && req.method === "POST") {
    const { credential } = await req.json().catch(() => ({}));
    const email = await verifyGoogle(credential, env).catch(() => null);
    if (!email || !admins(env).includes(email)) return json({ ok: false, err: email ? "not_admin" : "bad_token", email }, 403);
    const exp = String(Date.now() + DAYS * 86400_000);
    const v = encodeURIComponent(email + "|" + exp + "|" + (await hmac(env, email + "|" + exp)));
    return json({ ok: true, email }, 200, { "set-cookie": `${COOKIE}=${v}; Path=/admin; Max-Age=${DAYS * 86400}; HttpOnly; Secure; SameSite=Strict` });
  }
  if (p === "/admin/api/logout") return json({ ok: true }, 200, { "set-cookie": `${COOKIE}=; Path=/admin; Max-Age=0; HttpOnly; Secure; SameSite=Strict` });

  const who = await adminEmail(req, env);
  if (!who) return json({ ok: false, err: "login" }, 401);

  if (p === "/admin/api/seats" && req.method === "GET") {
    const { results } = await env.DB.prepare("SELECT m.id,m.name_lat n,m.electoral_list l,m.mp_group pg,m.assembly_role r,m.seat s,(SELECT 1 FROM photos p WHERE p.id=m.id) ph FROM mps m WHERE m.active=1 AND m.name_lat IS NOT NULL ORDER BY m.last_name,m.first_name").all();
    return json({ ok: true, mps: results });
  }
  if (p === "/admin/api/seats" && req.method === "POST") {
    const { set } = await req.json().catch(() => ({}));
    if (!Array.isArray(set) || !set.length || set.length > 20) return json({ ok: false, err: "bad" }, 400);
    const at = new Date().toISOString(), st = [];
    for (const x of set) {
      const id = parseInt(x.id), seat = x.seat == null ? null : String(x.seat);
      if (!id || (seat !== null && !SEAT.test(seat))) return json({ ok: false, err: "bad" }, 400);
      if (seat) st.push(env.DB.prepare("UPDATE mps SET seat=NULL,seat_at=? WHERE seat=? AND id<>?").bind(at, seat, id));
      st.push(env.DB.prepare("UPDATE mps SET seat=?,seat_at=? WHERE id=?").bind(seat, at, id));
    }
    await env.DB.batch(st);
    return json({ ok: true });
  }
  return json({ ok: false }, 404);
}
