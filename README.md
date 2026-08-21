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
