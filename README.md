# BlackBarn Labs

Site for [blackbarnlabs.com](https://blackbarnlabs.com). Static HTML, CSS, and a little JavaScript, served by a Cloudflare Worker that also runs the Rosie chat at `/api/rosie`.

```
.
├── index.html                 Homepage
├── 404.html
├── privacy/index.html         Site privacy notice
├── privacy/<app>/index.html   App privacy policies (Rosette Lab, Arrr You Hungry)
├── support/<app>/index.html   App support pages
├── css/styles.css
├── js/main.js
├── js/rosie.js                Rosie chat widget
├── assets/                    logo.png (nav/widget mark), poster.jpg, og.jpg, favicons
├── src/worker.js              Worker: /api/rosie + static assets
├── src/porch-prompt.js        Rosie's porch system prompt
├── _headers                   Security headers, incl. Content-Security-Policy
├── _redirects
└── wrangler.toml              Worker + assets config (this is what deploys)
```

## Preview locally

```bash
npx wrangler dev
```

Open [http://localhost:8787](http://localhost:8787). This runs `src/worker.js` with the static files, `_headers` and `_redirects`, the same way production does. Rosie replies need `XAI_API_KEY` in `.dev.vars` (see `.dev.vars.example`); without it the widget shows "Porch dark".

## How it deploys (read this before touching anything)

The site is **one Cloudflare Worker with static assets**, not a Cloudflare Pages project.

- `wrangler.toml` sets `main = "src/worker.js"` (serves `/api/rosie` and adds security headers) and `[assets] directory = "."` (the HTML, CSS, JS and images in this repo).
- **It deploys automatically from `main`.** Cloudflare's Git integration builds every push to `main` and runs `wrangler deploy` with this `wrangler.toml`. To change the live site, merge to `main` and you're done.
- `functions/api/rosie.js` is a leftover from the old Pages setup. The Worker doesn't use it. The live Rosie code is in `src/worker.js`.

> **Warning: never run `wrangler pages deploy`.** It targets Cloudflare Pages, not this Worker, so it can't update the site. It would also create or overwrite a separate Pages project without the `/api/rosie` Worker.
>
> **Warning: don't deploy anything else under the Worker name `blackbarnlabs`.** That includes a hand-run `wrangler deploy` from another folder or branch, another project's `wrangler.toml` with `name = "blackbarnlabs"`, or a dashboard "Quick edit". Any of these replaces the Worker that serves the whole site and Rosie (`/api/rosie`). If you need a test copy, deploy it under a different name.

**Custom domain:** `blackbarnlabs.com` is attached to the Worker. `www.blackbarnlabs.com` is redirected to the apex by a Redirect Rule in the Cloudflare dashboard (Rules → Redirect Rules), not by this repo.

**Content-Security-Policy:** `_headers` allows the inline `<style>` blocks on the legal pages and the one `style=""` on `404.html` by their SHA-256 hash. If you edit either, recompute the hash and update `_headers`, or those styles will be blocked.

## Talk to Rosie (porch)

The public widget is the **porch** — Grok via xAI, not the iMac wall brain. Key never goes in the repo or the browser.

1. Create a key at [console.x.ai](https://console.x.ai).
2. Cloudflare project → **Settings** → **Variables and secrets** (Production):

   | Name | Value |
   | --- | --- |
   | `XAI_API_KEY` | your xAI key |
   | `XAI_MODEL` | `grok-4.5` (optional) |

3. Redeploy. **Talk to Rosie** should show status **Porch**.

The wall Rosie on the iMac stays local. Do not put `rosie_api_token.txt` here.

### Bench slips (messages for Chris)

Porch Rosie can leave a note (“tell Chris hi”, technical pointers). Those do **not** write into the wall brain.

Until KV is bound, slips show in **Workers → Logs** as `[BENCH]`. Optional later: Cloudflare KV binding `BENCH` + secret `BENCH_READ_TOKEN`, then `GET /api/bench?token=...`. Before binding `BENCH`, update `/privacy/` (notes would then be kept up to 90 days).
