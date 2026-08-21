/**
 * BlackBarn Labs worker.
 * POST /api/rosie — public PORCH (xAI Grok). Wall brain stays on the iMac.
 * Everything else — static assets.
 */

import { PORCH_SYSTEM } from "./porch-prompt.js";

const BLOCKED =
  /\b(arm\s|nudge|peek|open book|housekeeping|hemi |welfare|relay|lab write|sudo|password|token|192\.168)\b/i;

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function cleanHistory(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((m) => m && (m.role === "user" || m.role === "assistant"))
    .slice(-8)
    .map((m) => ({
      role: m.role,
      content: String(m.content || "").slice(0, 800),
    }))
    .filter((m) => m.content);
}

async function grokChat(env, history, message) {
  const key = env.XAI_API_KEY;
  if (!key) return null;

  const model = env.XAI_MODEL || "grok-4.5";
  const res = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.7,
      max_tokens: 400,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: PORCH_SYSTEM },
        ...history,
        { role: "user", content: message },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`xAI ${res.status}: ${err.slice(0, 200)}`);
  }
  const data = await res.json();
  return (data.choices?.[0]?.message?.content || "").trim();
}

function parsePorch(raw) {
  const fallback = {
    say: raw || "Got nothing useful. Try Chris: chris@blackbarnlabs.com.",
    bench: null,
  };
  if (!raw) return fallback;
  const trimmed = raw.trim().replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
  try {
    const obj = JSON.parse(trimmed);
    const say = String(obj.say || obj.reply || "").trim();
    let bench = null;
    if (obj.bench && typeof obj.bench === "object") {
      const text = String(obj.bench.text || "").trim().slice(0, 600);
      const kind = ["hello", "idea", "other"].includes(obj.bench.kind)
        ? obj.bench.kind
        : "other";
      const who = String(obj.bench.who || "unknown").trim().slice(0, 80);
      if (text && !BLOCKED.test(text)) {
        bench = { who: who || "unknown", kind, text };
      }
    }
    return { say: say || fallback.say, bench };
  } catch {
    return fallback;
  }
}

async function saveBench(env, bench, sourceMessage) {
  const note = {
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    who: bench.who,
    kind: bench.kind,
    text: bench.text,
    source: String(sourceMessage || "").slice(0, 400),
  };
  console.log("[BENCH]", JSON.stringify(note));
  if (env.BENCH && typeof env.BENCH.put === "function") {
    await env.BENCH.put(`note:${note.at}:${note.id}`, JSON.stringify(note), {
      expirationTtl: 60 * 60 * 24 * 90,
    });
  }
  return note;
}

async function listBench(env) {
  if (!env.BENCH || typeof env.BENCH.list !== "function") {
    return { ok: false, error: "bench storage not bound yet" };
  }
  const listed = await env.BENCH.list({ prefix: "note:", limit: 50 });
  const notes = [];
  for (const key of listed.keys || []) {
    const raw = await env.BENCH.get(key.name);
    if (raw) {
      try {
        notes.push(JSON.parse(raw));
      } catch {
        /* skip */
      }
    }
  }
  notes.sort((a, b) => String(b.at).localeCompare(String(a.at)));
  return { ok: true, notes };
}

async function handleRosie(request, env) {
  let payload = {};
  try {
    payload = await request.json();
  } catch {
    return json({ ok: false, reply: "I didn't catch that." }, 400);
  }

  if (payload.ping) {
    if (env.XAI_API_KEY) return json({ ok: true, porch: true });
    return json({ ok: false, offline: true, porch: false }, 503);
  }

  const message = String(payload.message || "").trim().slice(0, 800);
  if (!message) return json({ ok: false, reply: "Say something." }, 400);

  if (BLOCKED.test(message)) {
    return json({
      ok: true,
      porch: true,
      reply: "That's barn-side. I'm on the porch — email chris@blackbarnlabs.com.",
    });
  }

  if (!env.XAI_API_KEY) {
    return json(
      {
        ok: false,
        offline: true,
        reply:
          "Porch is dark. Chris hasn't plugged the xAI key in yet. Email chris@blackbarnlabs.com.",
      },
      503
    );
  }

  try {
    const raw = await grokChat(env, cleanHistory(payload.history), message);
    const parsed = parsePorch(raw);
    if (parsed.bench) {
      await saveBench(env, parsed.bench, message);
    }
    return json({
      ok: true,
      porch: true,
      reply: parsed.say,
      left_on_bench: Boolean(parsed.bench),
    });
  } catch {
    return json(
      {
        ok: false,
        reply:
          "Porch hiccup. Email chris@blackbarnlabs.com if it keeps happening.",
      },
      502
    );
  }
}

function scheme(request) {
  const visitor = request.headers.get("cf-visitor");
  if (visitor) {
    try {
      return JSON.parse(visitor).scheme || "https";
    } catch {
      /* fall through */
    }
  }
  return new URL(request.url).protocol.replace(":", "") || "https";
}

function withSecurity(response) {
  const headers = new Headers(response.headers);
  headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (scheme(request) === "http") {
      url.protocol = "https:";
      return Response.redirect(url.toString(), 301);
    }

    let response;
    if (url.pathname === "/api/bench") {
      const token = url.searchParams.get("token") || "";
      if (!env.BENCH_READ_TOKEN || token !== env.BENCH_READ_TOKEN) {
        response = json({ ok: false, error: "nope" }, 401);
      } else {
        response = json(await listBench(env));
      }
    } else if (url.pathname === "/api/rosie" && request.method === "POST") {
      response = await handleRosie(request, env);
    } else if (url.pathname === "/api/rosie") {
      response = json({ ok: true, service: "rosie-porch", porch: Boolean(env.XAI_API_KEY) });
    } else {
      response = await env.ASSETS.fetch(request);
    }
    return withSecurity(response);
  },
};
