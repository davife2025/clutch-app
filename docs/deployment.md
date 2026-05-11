# Deploying Clutch

The stack:

| Component | Where it lives |
|---|---|
| Database | **Supabase** (PostgreSQL) |
| API | **Render** (Node web service) |
| Web | **Vercel** (Next.js) |
| Mobile | **Expo EAS** (build & submit) |
| Extension | **Chrome Web Store** (manual upload) |

No Docker required. No Kubernetes. No CI server you manage. Three connected platforms doing what they're best at.

---

## 1. Database — Supabase

1. Go to [supabase.com](https://supabase.com) → **New project**.
2. Region: pick the closest one to your Render API region (Oregon → `us-west-1`).
3. Set a strong database password — save it.
4. Once provisioned, go to **Settings → Database → Connection string**.
5. You need two strings:
   - **Transaction pooler** (port `6543`) → goes in `DATABASE_URL`. This is what the API uses for normal queries.
   - **Direct connection** (port `5432`) → goes in `DATABASE_URL_DIRECT`. Only used by `drizzle-kit` for migrations.
6. Push the schema once locally:

   ```bash
   # In your local clone, with .env populated:
   pnpm --filter @clutch/api db:push
   ```

   This creates the 5 tables (users, pockets, wallets, wallet_balances, transactions) in your Supabase database. Re-run any time you change the schema.

> **Why two connection strings?** Supabase's transaction pooler is fast for app traffic but doesn't support DDL (CREATE TABLE etc.). Migrations need the direct connection.

---

## 2. API — Render

1. Push this repo to GitHub.
2. [render.com](https://render.com) → **New** → **Blueprint** → connect the repo.
3. Render reads `render.yaml` and provisions a `clutch-api` web service.
4. Fill in the secrets in the Render UI (Render won't read these from the YAML — that's intentional, no secrets in git):

   | Key | What |
   |---|---|
   | `DATABASE_URL` | Supabase transaction pooler string |
   | `DATABASE_URL_DIRECT` | Supabase direct connection (for migrations) |
   | `CORS_ORIGIN` | Your Vercel URL, e.g. `https://clutch.vercel.app` |
   | `ANTHROPIC_API_KEY` | From [console.anthropic.com](https://console.anthropic.com) |
   | `WALLETCONNECT_PROJECT_ID` | From [cloud.walletconnect.com](https://cloud.walletconnect.com) |
   | `SOLANA_RPC_URL` | Helius or QuickNode endpoint (recommended) |
   | `COINGECKO_API_KEY` | Optional, raises rate limits |

   `JWT_SECRET` and `VAULT_MASTER_KEY` are set to `generateValue: true` in `render.yaml` — Render generates and persists secure 32-char values automatically.

5. Render builds and deploys. Healthcheck hits `/health`. Zero-downtime restarts.
6. Note the public URL (e.g. `https://clutch-api.onrender.com`) — you need it for the web app.

> **Cold starts:** Render's free/starter tiers spin down after inactivity. The first request after idle takes ~30 seconds. For production, upgrade to a plan that keeps the service warm.

---

## 3. Web — Vercel

1. [vercel.com](https://vercel.com) → **Add New** → **Project** → import the repo.
2. Vercel detects the monorepo. Configure:
   - **Root Directory:** `apps/web`
   - **Framework Preset:** Next.js (auto-detected)
   - **Build & Output Settings:** leave defaults — `apps/web/vercel.json` handles the monorepo install.
3. Add the environment variable:
   - `NEXT_PUBLIC_API_URL` = the Render URL from step 2 (e.g. `https://clutch-api.onrender.com`)
4. Deploy. Vercel gives you a URL.
5. **Important:** copy that Vercel URL back into Render's `CORS_ORIGIN`. Otherwise the browser will block requests to the API.

---

## 4. Mobile — Expo EAS

The Expo app uses the same API. To ship to TestFlight / Play Store:

```bash
cd apps/mobile
npx eas-cli build --platform ios       # → TestFlight
npx eas-cli build --platform android   # → Play Console
npx eas-cli submit --platform ios
```

Set `EXPO_PUBLIC_API_URL` to the Render URL in the EAS build environment. Configure that on your EAS project page, not in `app.json` — keeps the build environment clean.

---

## 5. Extension — Chrome Web Store

```bash
cd apps/extension
pnpm build
# Zip the dist/ folder
cd dist && zip -r ../clutch-extension.zip . && cd ..
```

Upload `clutch-extension.zip` to the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole). First submission takes ~3 days for review.

The extension's API URL is configurable in the popup login screen — users with self-hosted Clutch can point at their own API. The default is `http://localhost:3001` so it works for local dev out of the box.

---

## End-to-end smoke test

After everything is deployed:

```bash
# Health check
curl https://clutch-api.onrender.com/health
# → {"status":"ok","db":"connected",...}

# Register a user
curl -X POST https://clutch-api.onrender.com/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"smoke@test.com","password":"password123"}'
# → {"data":{"token":"eyJ...","userId":"...","pocketId":"..."}}

# Open the web app, sign in, see the empty pocket dashboard
open https://clutch.vercel.app
```

---

## Rotating secrets

If `JWT_SECRET` rotates, all existing JWTs invalidate — users have to sign in again. That's fine.

If `VAULT_MASTER_KEY` rotates, **existing custodial wallets become unrecoverable** unless you re-encrypt them with the new key first. Plan a migration before rotating. For now: pick a strong key once and don't touch it.

---

## Cost back-of-envelope

- **Supabase:** Free tier covers ~50k MAUs and 500MB. Paid starts at $25/mo.
- **Render:** Starter plan is $7/mo, keeps the service warm.
- **Vercel:** Hobby is free up to ~100GB bandwidth.
- **Anthropic:** Pay-per-use. The agent is light — most calls are sub-cent.
- **Helius/QuickNode (optional):** Free tier handles low volume; paid starts at ~$50/mo.

A working production deployment for early users runs ~$10-15/mo plus model usage.
