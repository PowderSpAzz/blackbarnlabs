# BlackBarn Labs

One-page site for [blackbarnlabs.com](https://blackbarnlabs.com). Static HTML, CSS, and a little JavaScript — plus an optional Cloudflare Function that talks to Rosie.

```
.
├── index.html
├── 404.html
├── css/styles.css
├── js/main.js
├── js/rosie.js
├── assets/barn.jpg          Hero graphic
├── assets/logo.png          Nav / widget mark
├── assets/logo-poster.jpg   Full poster (wordmark)
├── assets/og.jpg
├── functions/api/rosie.js   Talk to Rosie proxy
├── _headers
└── wrangler.toml
```

## Preview locally

```bash
python3 -m http.server 8080
```

Open [http://localhost:8080](http://localhost:8080). The Rosie widget UI works; live replies need the Function (below).

## Deploy to Cloudflare Pages

**GitHub (recommended)**

```bash
git init
git add .
git commit -m "BlackBarn Labs site"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/blackbarnlabs.git
git push -u origin main
```

Then: [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages** → import `PowderSpAzz/blackbarnlabs`.

If Cloudflare runs Wrangler (you’ll see `wrangler 4.x` in the log), that’s fine — `wrangler.toml` now points at the static files. Do **not** set the build command to `wrangler deploy` by hand unless that’s already the default.

| Setting | Value |
| --- | --- |
| Production branch | `main` |
| Framework preset | None |
| Build command | *(leave empty)* or whatever Cloudflare filled in |
| Root directory | `/` |

**Wrangler**

```bash
npx wrangler login
npx wrangler pages deploy . --project-name=blackbarnlabs
```

**Custom domain:** Pages project → **Custom domains** → `blackbarnlabs.com` (domain must be a Cloudflare zone). Repeat for `www`.

## Talk to Rosie

The floating **Talk to Rosie** button is live on the page. Live replies only work once the wall-lab API is reachable from Cloudflare.

Rosie’s HTTP API (`:8765`) is bound to `127.0.0.1` on the iMac. Do **not** put `rosie_api_token.txt` in this repo.

On the **iMac** (Rosie-Lab):

1. Keep the Rosie API running (`python3 -m brain.api_server` / your usual boot).
2. Open a [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/) to `http://127.0.0.1:8765` (for example `https://rosie.blackbarnlabs.com`).
3. In the Pages project → **Settings** → **Environment variables** (Production):

   | Name | Value |
   | --- | --- |
   | `ROSIE_API_URL` | `https://rosie.blackbarnlabs.com/v1/chat` |
   | `ROSIE_API_TOKEN` | contents of `Rosie-Lab/rosie_api_token.txt` |

4. Redeploy. The widget talks through `functions/api/rosie.js` as a stranger (`device_id: web-public`) so it cannot share the wall session.

Until that tunnel exists, Rosie greets people and points them at `chris@blackbarnlabs.com`.

Local Function preview:

```bash
cp .dev.vars.example .dev.vars   # fill in token
npx wrangler pages dev .
```
