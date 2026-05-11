# UI restore — sidebar with Published + Docs links

## What you should see in the sidebar after sign-in

The full nav, in order:

1. **Pocket** (Home icon) — `/dashboard`
2. **Wallets** (Wallet icon) — `/dashboard/wallets`
3. **My agents** (Bot icon) — `/dashboard/agents`
4. **Grants** (Key icon) — `/dashboard/grants`
5. **Published** (Globe icon) — `/dashboard/my-agents` ← register your AI agent here
6. **Chat** (Sparkles icon) — `/dashboard/agent`
7. **Activity** (Activity icon) — `/dashboard/activity`
8. **Receipts** (Receipt icon) — `/dashboard/receipts`
9. **Policy** (Shield icon) — `/dashboard/policy`
10. **Docs** (Code icon) — `/dashboard/docs` ← SDK/embed instructions
11. **Settings** (Settings icon) — `/dashboard/settings`

If you can't see "Published" or "Docs" in your sidebar after sign-in, the most likely cause is that your deployed Sidebar.tsx is older than what we shipped across sessions 22-26. Drop this archive in and redeploy.

## What's in the archive

Four files — the sidebar plus the three pages that the new nav links point to. Drop all four in. If any of them was already in your repo and identical, no harm done; if they were stale or missing, this restores them.

- `apps/web/src/components/layout/Sidebar.tsx` — full nav with all 11 items
- `apps/web/src/app/dashboard/my-agents/page.tsx` — "Published" page: lists agents this user has registered, with public listing links and status badges
- `apps/web/src/app/dashboard/my-agents/new/page.tsx` — registration form for publishing a new agent to the registry
- `apps/web/src/app/dashboard/docs/page.tsx` — Docs page with quick-start, framework integration tabs, API reference

## Before applying — check these in order

### 1. Does your local Sidebar.tsx already have these links?

Run this in your terminal at the repo root:

```bash
grep -E "Published|Docs|Globe|Code" apps/web/src/components/layout/Sidebar.tsx
```

You should see at least 4 matches. If fewer, your sidebar is stale and this archive is the fix.

### 2. Is Vercel serving a fresh build?

Open your Vercel dashboard → your project → Deployments. The latest deployment should match your most recent commit. If it doesn't, push a new commit (even an empty one with `git commit --allow-empty -m "trigger rebuild"`) to force redeploy.

### 3. Is your browser cached?

Hard refresh: `Cmd+Shift+R` (Mac) or `Ctrl+F5` (Windows). If the new nav appears, your browser was holding a stale JS bundle. This is the easiest fix and worth trying before anything else.

## If "Published" link is visible but the page errors

The "Published" page calls `GET /registry/my-agents` which queries the `registered_agents` table. If that table doesn't exist in your database yet, the page will 500.

The fix for that is the database migration we shipped earlier — run one of:

```bash
# Option A: drizzle-kit
cd apps/api && pnpm db:push

# Option B: manual SQL via Supabase
# Paste apps/api/drizzle/0002_manual_missing_tables.sql 
# into Supabase SQL Editor and click Run
```

The "Published" page won't work until the `registered_agents` table exists in your database.

## If "Docs" link is visible but the page is blank

The docs page is fully static (no API calls), so a blank render usually means the page file didn't make it into your repo. Verify:

```bash
ls apps/web/src/app/dashboard/docs/
```

Should show `page.tsx`. If missing, this archive will add it.

## What I want to flag

I noticed something worth being honest about. Across the last 10+ sessions, multiple small UI items were added to the sidebar in different deltas. Each delta included the sidebar update, but the sidebar is one file — every time it was updated, the new version was a SUPERSET of the old. So if you applied delta A and skipped delta B but then applied delta C, the result depends on which sidebar version you ended up with.

The version in this archive is the current canonical state with all 11 nav items. After applying, you should have everything visible and the deploy should be the same as my local copy.

If the UI still doesn't show what you expect after this archive applies and you hard-refresh the browser, send me a screenshot of what the sidebar looks like and I'll dig deeper. There's a possibility that the Sidebar.tsx is current but a CSS issue or layout error is hiding some items off-screen.
