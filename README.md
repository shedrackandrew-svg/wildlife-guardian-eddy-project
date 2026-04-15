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

	https://render.com/deploy?repo=https://github.com/shedrackandrew-svg/wildlife-guardian-eddy-project

3. Approve the `wildguard-live` web service from `render.yaml`.
4. Keep plan as `starter` (or higher) for always-on behavior.
5. Render gives a stable URL like `https://wildguard-live.onrender.com`.

This URL is the closest to a permanent 24-hour link without buying a domain.

## Permanent free GitHub Pages frontend

This repo now includes `.github/workflows/pages.yml` to deploy a permanent free frontend on GitHub Pages.

- Pages URL format: `https://shedrackandrew-svg.github.io/wildlife-guardian-eddy-project/`
- GitHub Pages is static-only: Python/FastAPI does not run there.

How it works:

1. Push to `master`/`main`.
2. GitHub Actions builds and publishes static files.
3. On first visit, it prompts for backend API URL (for dynamic features).
	- Example backend: `https://wildguard-live.onrender.com`

You can later change backend endpoint in browser console:

```js
localStorage.setItem("wg_api_base", "https://wildguard-live.onrender.com")
location.reload()
```
