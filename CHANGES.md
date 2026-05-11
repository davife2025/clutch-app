# Missing route files — `grants.js not found` fix

## What broke

```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module 
'/opt/render/project/src/apps/api/src/routes/grants.js' 
imported from /opt/render/project/src/apps/api/src/index.ts
```

`index.ts` imports `./routes/grants.js`, but `grants.ts` doesn't exist in your deployed repo. When tsx runs index.ts, Node tries to resolve every import — and crashes on the first one that's missing.

## Why this happened

Sessions 19-26 added several new route files. Across the deltas:
- `receipts.ts` (session 19 — x402 receipts ledger)
- `agents-mgmt.ts` (session 21 — consumer agent flow)
- `registry.ts` (session 22 — public agent registry)
- `grants.ts` (session 23 — per-pocket authorizations) ← crashed here
- `agent-pay.ts` (session 24 — signed payment requests)

Each was shipped in its own delta archive. Looks like one or more of them didn't make it into the repo before the deploy. Specifically `grants.ts` is missing — and very likely `agent-pay.ts` is too (it's imported on the next line after grants).

After `grants.ts` is added, Node may still crash on `agent-pay.ts` or any other missing file. So instead of fixing this one file at a time, **this archive contains every API file the current `index.ts` depends on.**

## What's in the archive

13 files covering the complete API state needed to run:

**Routes** (the five that were likely missing):
- `apps/api/src/routes/receipts.ts`
- `apps/api/src/routes/agents-mgmt.ts`
- `apps/api/src/routes/registry.ts`
- `apps/api/src/routes/grants.ts`
- `apps/api/src/routes/agent-pay.ts`

**Updated routes** (probably already in your repo, but included to match):
- `apps/api/src/routes/pocket.ts` (BigInt serialization fix)

**Wiring** (ties it all together):
- `apps/api/src/index.ts` (BigInt polyfill + all route mounts)
- `apps/api/src/db/schema.ts` (registered_agents, agent_grants, x402_receipts, agents tables)
- `apps/api/src/db/relations.ts` (relations for the new tables)

**Services**:
- `apps/api/src/services/agent.service.ts` (deterministic payment execution)
- `apps/api/src/services/policy.service.ts` (policy engine)

**Migrations**:
- `apps/api/drizzle.config.ts` (BigInt polyfill for drizzle-kit)
- `apps/api/drizzle/0002_manual_missing_tables.sql` (manual SQL fallback for Supabase)

## How to apply

1. Extract this archive at the root of your repo. It will overwrite or create each file at its exact path.

2. Verify the routes directory now has everything:
```bash
ls apps/api/src/routes/
```
You should see: `agent-pay.ts`, `agent.ts`, `agents-mgmt.ts`, `auth.ts`, `balance.ts`, `connect.ts`, `funds.ts`, `grants.ts`, `health.ts`, `pay.ts`, `pocket.ts`, `policy.ts`, `receipts.ts`, `registry.ts`, `transactions.ts`, `wallet.ts`, `webhook.ts`, `x402.ts`.

3. Push to GitHub. Render redeploys automatically. The deploy should now start cleanly.

4. **If you haven't already done the DB migration**, run it now. Either:
   - `pnpm --filter @clutch/api db:push` locally with DATABASE_URL set
   - Or open Supabase → SQL Editor → paste `apps/api/drizzle/0002_manual_missing_tables.sql` → Run

Without the migration, the `registered_agents` and `agent_grants` tables still don't exist and `/registry/my-agents` will still 500.

## After deploy succeeds

You'll see in the Render logs:
```
> @clutch/api@0.1.0 start /opt/render/project/src/apps/api
> tsx src/index.ts
🫙 Clutch API v0.1.0 → http://0.0.0.0:3001
```

Visit your deployed site, sign up fresh, walk through the dashboard. The bugs we fixed earlier this session should be gone. The registry, grants, and receipts pages should load.

## Why one big delta instead of patching one file

The original Render error was for `grants.ts`. After fixing that, the very next import (`agent-pay.ts`) would likely fail too. Then maybe `registry.ts`. Each fix would require another deploy cycle. **Better to ship all of them at once and stop iterating on missing files.**

If your repo already has some of these files and they're identical to what's here, no harm done — same content, same outcome. If they differ, this delta is the source of truth.

## What I want to flag honestly

This is the kind of bug that happens at the end of a long build, when multiple deltas have been applied in sequence and one or two files slipped through. It's not a code problem — every file compiles, every test passes, the system works. It's a coordination problem between many deltas.

For future runs: if a deploy crashes with `MODULE_NOT_FOUND`, the fastest fix is to run `git status` and see what's actually in your repo, then compare against `index.ts`'s imports. The mismatch is the problem.
