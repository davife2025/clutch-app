# Complete web state — every dashboard page in one drop

## What's happening

The "grants 404" is the same shape of problem as the "Published" and "Docs" links being missing, the same shape as the "registered_agents table doesn't exist" 500, the same shape as the `tweetnacl` missing dependency.

Across sessions 19-26 we added new sidebar items in different deltas. Each delta included the new page file plus an updated Sidebar.tsx. Across many deltas, some files made it to your repo and some didn't. The result: your sidebar shows nav items that point to pages your repo doesn't have.

Rather than chase one missing file at a time, this archive contains **the complete current state of every dashboard page**. Drop it in, push, done.

## What's in here

25 files. Every page the sidebar links to, plus the shared components and lib files those pages depend on.

### Dashboard pages (16 files)
- `apps/web/src/app/dashboard/layout.tsx` — guarded layout with auth check
- `apps/web/src/app/dashboard/page.tsx` — Pocket (overview)
- `apps/web/src/app/dashboard/wallets/page.tsx` — Wallets
- `apps/web/src/app/dashboard/agents/page.tsx` — My agents (personal templates) list
- `apps/web/src/app/dashboard/agents/new/page.tsx` — Create personal agent
- `apps/web/src/app/dashboard/agents/[id]/page.tsx` — Personal agent detail
- `apps/web/src/app/dashboard/grants/page.tsx` — **Grants (was 404)**
- `apps/web/src/app/dashboard/authorize/[id]/page.tsx` — Agent authorization consent
- `apps/web/src/app/dashboard/my-agents/page.tsx` — Published agents (registered to public registry)
- `apps/web/src/app/dashboard/my-agents/new/page.tsx` — Register agent form
- `apps/web/src/app/dashboard/agent/page.tsx` — Chat
- `apps/web/src/app/dashboard/activity/page.tsx` — Activity feed
- `apps/web/src/app/dashboard/receipts/page.tsx` — x402 receipts audit log
- `apps/web/src/app/dashboard/policy/page.tsx` — Spending policy
- `apps/web/src/app/dashboard/docs/page.tsx` — Developer docs
- `apps/web/src/app/dashboard/settings/page.tsx` — Settings

### Public registry pages (2 files)
- `apps/web/src/app/registry/page.tsx` — Public agent directory
- `apps/web/src/app/registry/[id]/page.tsx` — Public agent detail

### Shared layout & state (7 files)
- `apps/web/src/components/layout/Sidebar.tsx` — Full sidebar nav
- `apps/web/src/components/layout/UpgradeBanner.tsx` — Anonymous account banner
- `apps/web/src/components/brand/Logo.tsx` — Shield + coin logo
- `apps/web/src/lib/api.ts` — API client (all methods)
- `apps/web/src/lib/use-auth.ts` — Auth guard hook with SSR-safe mount
- `apps/web/src/lib/format.ts` — Number/USD formatters
- `apps/web/src/hooks/useClutchSocket.ts` — WebSocket with circuit breaker

## How to apply

```bash
# 1. Extract this archive at your repo root
# (will overwrite or create each file at its exact path)

# 2. Verify all pages now exist
ls apps/web/src/app/dashboard/grants/    # should show page.tsx
ls apps/web/src/app/dashboard/receipts/  # should show page.tsx
ls apps/web/src/app/dashboard/my-agents/ # should show page.tsx and new/

# 3. Push to GitHub, Vercel redeploys
git add . && git commit -m "fix: complete web app state" && git push
```

## After deploy

Hard-refresh your browser (`Cmd+Shift+R` / `Ctrl+F5`) to clear the cached JS bundle, then sign in and click every sidebar item. Every link should land on a real page. The flow you can now demo:

1. **Pocket** — your balances + policy status
2. **Wallets** — add/manage wallets
3. **My agents** — personal payment templates inside this pocket
4. **Grants** — agents you've authorized from this pocket to spend on your behalf
5. **Published** — agents you've registered to the public registry
6. **Chat** — talk to Kimi K2 about your pocket
7. **Activity** — transaction feed
8. **Receipts** — every x402 paywall payment
9. **Policy** — spending rules
10. **Docs** — SDK / embed instructions
11. **Settings** — account

## Important: pages that need the database tables

Some pages will still 500 if the database migration hasn't been run. Specifically:
- **Grants** queries `agent_grants` table
- **Published** queries `registered_agents` table
- **Receipts** queries `x402_receipts` table

If any of these 500 after deploying, run the migration:

```bash
# Option A
cd apps/api && pnpm db:push

# Option B (if drizzle-kit still crashes on BigInt)
# Open Supabase → SQL Editor → paste apps/api/drizzle/0002_manual_missing_tables.sql → Run
```

## Why this kept happening across the last hour

Multiple deltas. Each delta included some subset of the page files. Some files made it to your repo, some didn't. The sidebar links accumulated — every session added another nav item — but the corresponding page files didn't always travel with it.

This archive is the canonical state. After applying, your web app matches my local copy exactly. Future bugs should be product issues (UX, edge cases, real-world data), not "file is missing."

## What I want to acknowledge

This kind of "file missing across multiple deltas" issue is annoying. We've hit it three times in the last hour with different files. I should have shipped a full-codebase archive earlier instead of stitched deltas. For future builds, I'll lean toward shipping complete states more often than incremental ones — easier for you to verify in one drop than to chase down what's missing.

After this applies cleanly: the 404 is gone, the missing pages are present, and you have a complete deployable web app. Verify by clicking each sidebar item. If anything else 404s or errors, send me which one and I'll fix it specifically.
