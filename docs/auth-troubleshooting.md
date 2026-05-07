# Auth troubleshooting

If `POST /auth/login` is failing in production but works locally, work through these in order. Each one fixes the most common version of "login is broken on Render."

## 1. Check the deploy logs first

```
Render Dashboard → clutch-api → Logs
```

Look for the line `🫙  Clutch API v0.1.0  →  http://localhost:3001`. If you don't see it, the API never started — fix that before debugging auth.

If you see the startup line but auth still fails, search the logs for the exact error message coming back from `/auth/login`. It will usually tell you exactly what's wrong.

## 2. Verify the start command

The `package.json` for `apps/api` should have:

```json
"scripts": {
  "build": "echo 'using tsx — no build step'",
  "start": "tsx src/index.ts"
}
```

The `start` command is **`tsx src/index.ts`**, not `node dist/index.js`. We deliberately don't compile to `dist/` because workspace packages (`@clutch/agent`, `@clutch/connectors`, etc.) need module resolution that tsx handles cleanly.

In `render.yaml`:

```yaml
buildCommand: corepack enable && corepack prepare pnpm@9.1.0 --activate && pnpm install --frozen-lockfile --ignore-scripts
startCommand: pnpm --filter @clutch/api start
```

If your Render service was created before session 14 and has a different start command, **edit it manually** in the Render UI under Settings → Build & Deploy. Sync it with the values above.

## 3. Confirm DATABASE_URL is the pooler string

Auth hits the database to look up users. If `DATABASE_URL` is wrong, login returns 500.

- **Use the transaction pooler** (port `6543`), not the direct connection (port `5432`).
- The format is `postgresql://postgres.xxxxx:PASSWORD@aws-0-region.pooler.supabase.com:6543/postgres`.
- Get it from Supabase: Settings → Database → Connection string → **Transaction pooler** dropdown.
- Confirm it works: `curl https://your-api.onrender.com/health` should return `"db":"connected"`.

If `/health` shows `"db":"disconnected"`, the DB string is wrong. Auth will never work until this is fixed.

## 4. Verify JWT_SECRET is set

In `render.yaml` we use `generateValue: true` so Render auto-generates this. Confirm it's there:

```
Render → clutch-api → Environment → JWT_SECRET
```

If it's empty, click "Generate value" and redeploy. The login route signs a JWT with this secret — without it, the route throws.

## 5. Make sure your Supabase schema is up to date

The auth changes in session 16 added `is_anonymous` to the users table and made `email`/`password_hash` nullable. If your Supabase database is on the old schema, login still works but `register` and `anonymous` may fail.

Run from your local machine with `DATABASE_URL_DIRECT` (port 5432) set to your Supabase direct connection:

```bash
cd apps/api
pnpm db:push
```

This syncs the schema. You'll see drizzle-kit list the changes before applying them.

## 6. Double-check CORS

If the web app is making the call and you see `CORS error` in the browser console (not in Render logs), the API is rejecting the origin.

```
Render → clutch-api → Environment → CORS_ORIGIN
```

Set this to the **exact** Vercel URL — `https://clutch.vercel.app`, not `https://clutch.vercel.app/` (no trailing slash) and not `*` (Hono's CORS middleware accepts `*` but it disables credentials).

After updating, manual redeploy is required — env var changes don't auto-redeploy.

## 7. If all else fails — verify locally against production DB

```bash
cd apps/api
DATABASE_URL='your-pooler-url' \
JWT_SECRET='your-render-jwt-secret' \
pnpm dev
```

Then `curl localhost:3001/auth/login -d '{"email":"...","password":"..."}'` and watch the local logs. Whatever fails locally with production env vars will fail the same way on Render — and locally you can read the full stack trace.

## Quick "is it definitely the build commands" check

Run this against your deployed API:

```bash
curl https://your-api.onrender.com/health
```

Expected response:

```json
{"data":{"status":"ok","db":"connected","timestamp":"..."}}
```

If you get **HTML or a 502**, the API isn't running — build/start command is wrong.
If you get **`"db":"disconnected"`**, DATABASE_URL is wrong.
If you get **a clean 200 but login still fails**, it's not a deploy issue — it's a code or env-variable issue. Check items 4-6.
