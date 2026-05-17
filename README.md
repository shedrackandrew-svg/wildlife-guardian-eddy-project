# WildGuard — Local dev and deployment

This repo now contains an Express backend that serves the frontend from `app/` and provides a simple REST API (`/api/*`).

Quick start (node 18+):

```powershell
cd server
npm install
npm start
# open http://localhost:3000/
```

What I added:
- `server/` — Express API and static file serving
- `data/wildguard.db` — created at runtime, contains users, species, sightings, favorites, comments
- `.github/workflows/deploy.yml` — CI that deploys `app/` to `gh-pages` branch on push (configured in repo)

Next steps I can do when you confirm:
- Add JWT secret to repo secrets and enable Actions to deploy automatically.
- Configure Render/Cloud Run deployment for the backend (requires provider credentials).

Full stack start (server serves the frontend):

```powershell
# From repository root
cd server
npm install
set -Path .env (copy .env.example to .env and set JWT_SECRET)
npm start
# Visit http://localhost:3000/
```

API endpoints (examples):
- `GET /api/health` — health check
- `GET /api/species` — list species
- `GET /api/species/:id` — get species detail
- `POST /api/users/signup` — create user
- `POST /api/users/login` — login -> returns JWT

To publish frontend to GitHub Pages using the workflow, push to `master` branch; the workflow will deploy `app/` to `gh-pages` branch. The custom domain file is now `app/CNAME`, and DNS should point `shedrack-andrew.wldg` to GitHub Pages.

Backend deploy (Render)

- This repository contains a GitHub Actions workflow to trigger a Render deploy on push to `master`:
	`.github/workflows/deploy-backend-render.yml`.
- What you need to do on Render:
	- Create a new Web Service on Render for this repository (choose "Docker" or "Node") and connect it to this GitHub repo.
	- Note the Service ID (it looks like `srv-xxxxxxxx`).
	- Create an API key in Render (Account or Service API key).
- Add repository secrets on GitHub (Repository Settings → Secrets):
	- `RENDER_API_KEY` — the API key value from Render.
	- `RENDER_SERVICE_ID` — the Render service id (without the `srv-` prefix is fine; the workflow prefixes it).
- Once those secrets are added, pushing to `master` will call the Render deploy API and start a deploy for your service.

If you prefer another host (Cloud Run, Railway, Heroku, Vercel), tell me which one and I will add an equivalent Actions workflow and setup steps.

Seeding and admin user
- I added a seed script at `server/seed_catalog.js` and ran it locally to import the bundled `wildlife-catalog.json` into the server store.
- The admin account is created or rotated from `server/seed_catalog.js` using `ADMIN_PASS`. I have rotated it locally to a stronger password; set your own secret in production and re-run the seed if needed.

# WildGuard (AI + IoT + Web)

This project detects animals from images/sensors and serves a live dashboard.

## New core features

- Server-side authentication with JWT and hashed passwords
- Phone-as-camera onboarding flow with QR pairing
- Admin species image manager for curated per-animal galleries

## Fast reset run (Windows)

1. Activate venv:

```powershell
& .\.venv\Scripts\Activate.ps1
```

2. Install dependencies:

```powershell
pip install -r requirements.txt
```

3. Create env file:

```powershell
Copy-Item .env.example .env
```

4. Start local app:

```powershell
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Open:

- http://127.0.0.1:8000/
- http://127.0.0.1:8000/dashboard
- http://127.0.0.1:8000/live
- http://127.0.0.1:8000/library
- http://127.0.0.1:8000/history
- http://127.0.0.1:8000/map
- http://127.0.0.1:8000/onboarding

## One command temporary public URL

Run:

```powershell
python start_live.py
```

Tunnel order:

1. Cloudflare quick tunnel (`trycloudflare.com`) if `cloudflared` is installed
2. ngrok if `NGROK_AUTHTOKEN` is set
3. localhost.run fallback
4. pinggy fallback

The script prints share links for home, dashboard, and live page.

## Optional Cloudflare install (recommended)

Install `cloudflared` and make sure `cloudflared` works in PowerShell (`cloudflared --version`).
Then `python start_live.py` will use Cloudflare automatically.

## Stable single URL mode (Cloudflare)

For a fixed URL instead of a random quick tunnel URL:

1. Create a Cloudflare named tunnel and token.
2. Set in `.env`:

```env
CLOUDFLARE_TUNNEL_TOKEN=your_token_here
CLOUDFLARE_PUBLIC_URL=https://your-fixed-domain.example
```

3. Run `python start_live.py`.

The launcher will use token mode and print your fixed URL.

## Cloudflare-only mode (no fallback)

If you want to disable all non-Cloudflare providers:

1. In `.env`, set:

```env
CLOUDFLARE_ONLY=true
```

2. Run `python start_live.py`.

Behavior:

- If Cloudflare works, launcher prints Cloudflare URL.
- If Cloudflare fails, launcher exits with an error (no fallback links).

## Environment options

- `LIVE_PORT` (default `8000`)
- `LIVE_HOST` (default `0.0.0.0`)
- `NGROK_AUTHTOKEN` (optional)
- `NGROK_REGION` (default `us`)
- `CLOUDFLARE_TUNNEL_TOKEN` (optional, stable URL mode)
- `CLOUDFLARE_PUBLIC_URL` (optional, shown in terminal for stable mode)
- `CLOUDFLARE_ONLY` (default `false`; set `true` to disable fallback providers)
- `JWT_SECRET_KEY` (change this in production)
- `JWT_ACCESS_TOKEN_EXPIRE_MINUTES` (default `60`)
- `SPECIES_IMAGES_DIR` (default `./data/species_images`)

## Notes

- The app uses a local SQLite DB at `data/wildlife.db`.
- Animal profiles are stored in `data/animal_profiles/`.

## 24h+ public URL without domain (GitHub + Render)

If you do not have a custom domain or Cloudflare token, use Render connected to this GitHub repo.

1. Push your latest code to GitHub.
2. Open this one-click deploy URL:

	https://render.com/deploy?repo=https://github.com/shedrackandrew-svg/wildguard

3. Approve the `wildguard-live` web service from `render.yaml`.
4. Keep plan as `starter` (or higher) for always-on behavior.
5. Render gives a stable URL like `https://wildguard-live.onrender.com`.

This URL is the closest to a permanent 24-hour link without buying a domain.

## Permanent free GitHub Pages frontend

This repo now includes `.github/workflows/pages.yml` to deploy a permanent free frontend on GitHub Pages.

- Pages URL format: `https://shedrackandrew-svg.github.io/wildguard/`
- GitHub Pages is static-only: Python/FastAPI does not run there.

How it works:

1. Push to `master`/`main`.
2. GitHub Actions builds and publishes static files.
3. Frontend works permanently even without backend (camera + local browser detection keep running).
4. For backend-powered features (inventory, history, alerts), set one stable API URL in `pages_api_base.txt`.

You can later change backend endpoint in browser console:

```js
localStorage.setItem("wg_api_base", "https://wildguard-live.onrender.com")
location.reload()
```

## Permanent no-expiring mode (recommended)

Use this combination for a stable long-term setup:

1. Deploy backend once on Render using `render.yaml` (gives a fixed `onrender.com` URL).
2. Commit your fixed backend URL into `pages_api_base.txt`.
3. Keep GitHub Pages enabled for the frontend URL.

Result:

- Frontend URL does not expire.
- Backend URL does not rotate like tunnel links.
- Dashboard/camera remains usable even if backend is temporarily unavailable.
