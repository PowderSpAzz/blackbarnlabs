/**
 * Talk to Rosie — Cloudflare Pages Function.
 *
 * Proxies public chat to the wall-lab Rosie API without exposing the token.
 * Set these in the Pages project → Settings → Environment variables:
 *   ROSIE_API_URL    e.g. https://rosie.blackbarnlabs.com/v1/chat
 *   ROSIE_API_TOKEN  contents of Rosie-Lab/rosie_api_token.txt
 *
 * Always sends clearance-1 (stranger) via an unregistered device_id so
 * the public widget cannot inherit the wall inner-circle session.
 */

const BLOCKED = /\b(arm\s|nudge|peek|open book|housekeeping|hemi |welfare|relay|lab write|sudo|password|token)\b/i;

const OFFLINE = {
  ok: false,
  offline: true,
  reply:
    "I'm Rosie — I live in the wall at BlackBarn Labs. The public wire isn't connected to the barn yet. Email chris@blackbarnlabs.com, or try again from the lab.",
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

export async function onRequestPost(context) {
  let payload = {};
  try {
    payload = await context.request.json();
  } catch {
    return json({ ok: false, reply: "I didn't catch that." }, 400);
  }

  const url = (context.env.ROSIE_API_URL || "").replace(/\/$/, "");
  const token = context.env.ROSIE_API_TOKEN || "";

  if (payload.ping) {
    if (!url || !token) return json({ ok: false, offline: true }, 503);
    try {
      const health = await fetch(url.replace(/\/v1\/chat$/, "") + "/health", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (health.ok) return json({ ok: true });
    } catch {
      /* fall through */
    }
    return json({ ok: false, offline: true }, 503);
  }

  const message = String(payload.message || "").trim().slice(0, 800);
  if (!message) return json({ ok: false, reply: "Say something." }, 400);

  if (BLOCKED.test(message)) {
    return json({
      ok: true,
      reply:
        "That's lab-only. I'm on the public porch — ask Chris at chris@blackbarnlabs.com.",
    });
  }

  if (!url || !token) return json(OFFLINE, 503);

  const sessionId = String(payload.session_id || "web-guest").slice(0, 80);
  const safeSession = sessionId.startsWith("web-") ? sessionId : `web-${sessionId}`;

  try {
    const res = await fetch(url.endsWith("/v1/chat") ? url : `${url}/v1/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        message,
        session_id: safeSession,
        device_id: "web-public",
        channel: "api",
        mode: "vibin",
        open_book: false,
      }),
    });

    if (!res.ok) return json(OFFLINE, 503);
    const data = await res.json();
    return json({
      ok: true,
      reply: data.reply || "…",
      session_id: data.session_id || safeSession,
    });
  } catch {
    return json(OFFLINE, 503);
  }
}
