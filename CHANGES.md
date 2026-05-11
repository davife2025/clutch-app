# drizzle-kit BigInt fix — escalated to fallback

The polyfill at the top of schema.ts wasn't enough. drizzle-kit's diff phase is hitting BigInts that come from somewhere else — most likely Postgres's pg_catalog introspection returning bigint values for things like sequence IDs and column metadata when it pulls the existing database state.

Three changes in this delta, ordered by likelihood of fixing the issue. Try them in order, stop when one works.

## Try this first: schema + config polyfill + SQL-literal defaults

`apps/api/src/db/schema.ts` — already had the polyfill from the previous fix. Now also changes the two BigInt defaults from `default(0n)` to `default(sql\`0\`)`. This makes the default a Postgres SQL expression rather than a JavaScript BigInt — so when drizzle-kit serializes the column definition to compare it against the database, there's no BigInt in the column metadata to choke on.

`apps/api/drizzle.config.ts` — adds the same `BigInt.prototype.toJSON` polyfill at the top. drizzle.config.ts is the very first file drizzle-kit loads when you run `pnpm db:push`, so the polyfill is in place before any schema introspection or diff serialization happens.

```bash
cd apps/api
pnpm db:push
```

If this works, you'll see `[✓] Pulling schema from database... [✓] Changes applied`. Done.

## If that still crashes: use the manual SQL

I included `apps/api/drizzle/0002_manual_missing_tables.sql` as a fallback. This is the raw CREATE TABLE statements for the four missing tables (`x402_receipts`, `agents`, `registered_agents`, `agent_grants`) plus their indexes and enums. Idempotent — every CREATE uses IF NOT EXISTS, every type uses a DO block guard. Safe to re-run.

To apply manually:

1. Open Supabase Dashboard → your project → SQL Editor → New query
2. Open `apps/api/drizzle/0002_manual_missing_tables.sql` from the archive
3. Copy the entire file contents into the Supabase SQL editor
4. Click "Run"
5. Should see "Success. No rows returned"

Then verify:

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('x402_receipts', 'agents', 'registered_agents', 'agent_grants');
```

You should see all 4 rows. After that, your `/registry/my-agents` 500 stops, the dashboard's grants/receipts pages work, and you can complete the platform demo.

## Why the manual fallback is fine

The manual SQL is functionally identical to what `drizzle-kit push` would generate. It uses the same column types, same defaults (with SQL literals instead of BigInt JS literals), same constraints, same indexes. Drizzle's runtime ORM doesn't care how the tables were created — only that they exist with the right shape. Once these tables are in the database, drizzle's queries against them work exactly the same as if drizzle-kit had created them.

The only thing you lose by going manual: future schema changes via `db:push` may detect "drift" because drizzle-kit didn't track this migration. If that happens, just run `db:push` once more after the BigInt fix lands properly — it'll see the tables already exist and won't recreate them.

## What's in the archive

- `apps/api/drizzle.config.ts` — polyfill at top
- `apps/api/src/db/schema.ts` — polyfill + sql\`0\` defaults instead of BigInt
- `apps/api/drizzle/0002_manual_missing_tables.sql` — manual fallback SQL

## What I want to flag honestly

We've now spent four messages on what should have been a one-command operation. drizzle-kit's BigInt handling in 0.30.4 has known issues that newer versions fixed. If neither the polyfill+sql defaults work nor the manual SQL apply cleanly, the third option is **upgrade drizzle-kit to a newer version**: `pnpm --filter @clutch/api add -D drizzle-kit@latest`. That may itself break things (newer versions sometimes change the diff format), but it's the cleanest path if both other options fail.

For today: try the polyfill+SQL-literals fix. If that fails, run the manual SQL through Supabase. Either way you end up with the four tables in the database, which is what unblocks everything else.
