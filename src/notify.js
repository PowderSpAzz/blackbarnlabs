/**
 * POST /api/notify — "notify me" signups for products in development.
 *
 * Storage: Cloudflare D1, binding NOTIFY_DB (see migrations/0001_notify_signups.sql).
 * Each row is exactly { email, product, ts }. No IP, no user agent, no cookies.
 * No emails are sent from here.
 *
 * Without the NOTIFY_DB binding this answers 503 (same idea as Rosie's "porch dark").
 *
 * Answers JSON when the client asks for it (Accept: application/json, as js/notify.js
 * does). A plain no-JS form post gets a 303 to /notify/thanks/ on success, or the
 * /notify/sorry/ page with the real error status.
 */

export const NOTIFY_PRODUCTS = new Set(["sentry-turret", "greenhouse-buddy", "cat-deterrent"]);

const MAX_BODY = 2048;
const EMAIL_RE = /^[^\s@<>()[\]\\,;:"]{1,64}@(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,63}$/;

// Best-effort, per-isolate limit: 5 attempts per IP per 10 minutes. Nothing is stored.
// If a Workers Rate Limiting binding NOTIFY_LIMITER is added, it is used as well.
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 5;
const hits = new Map();

function allowLocal(ip, now = Date.now()) {
  if (hits.size > 5000) hits.clear();
  const recent = (hits.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length <= MAX_PER_WINDOW;
}

async function allowed(request, env) {
  const ip = request.headers.get("cf-connecting-ip") || "local";
  if (!allowLocal(ip)) return false;
  if (env.NOTIFY_LIMITER && typeof env.NOTIFY_LIMITER.limit === "function") {
    const { success } = await env.NOTIFY_LIMITER.limit({ key: ip });
    return success;
  }
  return true;
}

function wantsJson(request) {
  const accept = request.headers.get("accept") || "";
  const type = request.headers.get("content-type") || "";
  return accept.includes("application/json") || type.includes("application/json");
}

async function readFields(request) {
  const len = Number(request.headers.get("content-length") || 0);
  if (len > MAX_BODY) return null;
  const text = await request.text();
  if (text.length > MAX_BODY) return null;
  const type = request.headers.get("content-type") || "";
  if (type.includes("application/json")) {
    try {
      const obj = JSON.parse(text);
      return obj && typeof obj === "object" ? obj : null;
    } catch {
      return null;
    }
  }
  if (type.includes("application/x-www-form-urlencoded")) {
    return Object.fromEntries(new URLSearchParams(text));
  }
  return null;
}

const REPLIES = {
  ok: "Thanks. You're on the list.",
  invalid: "That email address or product doesn't look right.",
  rate_limited: "Too many tries. Wait a few minutes and try again.",
  offline:
    "Signups aren't switched on yet. Chris hasn't connected the signup list. Email chris@blackbarnlabs.com and ask to be told.",
  forbidden: "Signups only work from blackbarnlabs.com.",
  error: "That didn't go through. Email chris@blackbarnlabs.com if it keeps happening.",
};

export async function handleNotify(request, env, json) {
  const asJson = wantsJson(request);

  const reply = async (status, code) => {
    const ok = code === "ok";
    if (asJson) {
      const body = { ok, reply: REPLIES[code] };
      if (!ok) body.error = code;
      if (code === "offline") body.offline = true;
      const res = json(body, status);
      if (code === "rate_limited") res.headers.set("Retry-After", "600");
      return res;
    }
    const origin = new URL(request.url).origin;
    if (ok) {
      return new Response(null, {
        status: 303,
        headers: { Location: `${origin}/notify/thanks/`, "Cache-Control": "no-store" },
      });
    }
    const page = await env.ASSETS.fetch(new Request(`${origin}/notify/sorry/`));
    const headers = new Headers(page.headers);
    headers.set("Cache-Control", "no-store");
    return new Response(page.body, { status, headers });
  };

  if (request.method !== "POST") {
    const res = json({ ok: false, error: "method", reply: "POST only." }, 405);
    res.headers.set("Allow", "POST");
    return res;
  }

  // Same-origin only. Browsers send Origin on form and fetch POSTs.
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return reply(403, "forbidden");

  if (!env.NOTIFY_DB || typeof env.NOTIFY_DB.prepare !== "function") {
    return reply(503, "offline");
  }

  if (!(await allowed(request, env))) return reply(429, "rate_limited");

  const fields = await readFields(request);
  if (!fields) return reply(400, "invalid");

  // Honeypot: real people never see this field. Pretend it worked, store nothing.
  if (String(fields.website || "").trim()) return reply(200, "ok");

  const email = String(fields.email || "").trim().toLowerCase();
  const product = String(fields.product || "").trim();
  if (email.length > 254 || !EMAIL_RE.test(email) || !NOTIFY_PRODUCTS.has(product)) {
    return reply(400, "invalid");
  }

  try {
    // Same answer whether or not the address was already on the list.
    await env.NOTIFY_DB.prepare(
      "INSERT INTO notify_signups (email, product, ts) VALUES (?1, ?2, ?3) ON CONFLICT (email, product) DO NOTHING"
    )
      .bind(email, product, new Date().toISOString())
      .run();
  } catch (err) {
    console.log("[NOTIFY] store failed", String(err && err.message).slice(0, 200));
    return reply(500, "error");
  }
  return reply(200, "ok");
}
