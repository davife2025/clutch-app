# Session 22 — Public agent registry foundation

This archive contains **only the files changed or added** in this session. Drop into your existing clutch-v2 repo at the same paths.

## What this session is

The first of 3-4 sessions that turn Clutch from "SDK for builders" into a two-sided platform where users authorize registered agents to pay through their pocket. **OAuth-shape pattern**: agents register publicly, users authorize them with scoped permissions, Clutch is the broker.

This session lands the **registry foundation** — the public directory of agents and the schema for per-user grants. Sessions 23-25 will add the grant authorization flow, signed payment requests with identity verification, and the matchmaking surface that ties it all together.

## What's in here

### New files
- `apps/api/src/routes/registry.ts` — public directory + register/manage endpoints
- `apps/api/test/registry.test.ts` — 16 tests covering pubkey validation and registration input validation
- `apps/web/src/app/registry/page.tsx` — public agent directory at `/registry` (no auth required)
- `apps/web/src/app/registry/[id]/page.tsx` — public agent detail page with stats and authorize CTA
- `apps/web/src/app/dashboard/my-agents/page.tsx` — list of agents the user has registered
- `apps/web/src/app/dashboard/my-agents/new/page.tsx` — registration form

### Modified files
- `apps/api/src/db/schema.ts` — adds `registered_agents` and `agent_grants` tables, plus their enums
- `apps/api/src/db/relations.ts` — wires both new tables to pockets/users
- `apps/api/src/index.ts` — mounts public + authenticated registry routes
- `apps/web/src/lib/api.ts` — registry methods: listRegistry, getRegistryAgent, listMyRegisteredAgents, registerAgent, updateRegisteredAgent, deleteRegisteredAgent
- `apps/web/src/components/layout/Sidebar.tsx` — adds "Published" link for `/dashboard/my-agents`
- `apps/web/src/app/page.tsx` — Registry link added to landing nav

## After you copy these in

```bash
pnpm install --ignore-scripts
pnpm --filter @clutch/api typecheck
pnpm --filter @clutch/api test          # should be 48 tests passing
pnpm --filter @clutch/api db:push       # adds registered_agents + agent_grants
pnpm --filter @clutch/web build
```

## What you can demo

**As a developer publishing an agent:**

1. Sign in to clutch.app
2. Click "Published" in the sidebar (the new globe icon)
3. Click "Register your first agent"
4. Fill in name, tagline, description, public key (any base58 32-byte string for testing — e.g. `So11111111111111111111111111111111111111112`), pick a category
5. Submit — land on the public detail page

**As a user discovering an agent:**

1. Visit `/registry` (works without signing in)
2. Browse by category, search, sort by popular or newest
3. Click any agent → see public detail with payment scope, public key, volume stats
4. "Authorize" CTA exists but routes to login (the actual authorization flow ships in session 23)

## What this session is NOT yet

- **No grant authorization flow.** The "Sign in to authorize" button on agent detail pages routes to login — clicking it won't yet let users authorize an agent. That's session 23.
- **No signed payment requests.** Agents can't yet make payment requests with cryptographic identity verification. That's session 24.
- **No matchmaking surface.** The "your authorized agents" page that ties grants together with usage stats. That's session 25.

What ships in this session is enough that:
- Developers can publish their agents and see them listed publicly
- Users can browse the registry and see what exists
- The schema for grants is ready for session 23 to build on

## Architecture decisions worth flagging

**Why a separate `registered_agents` table from the existing `agents` table:**

The existing `agents` table holds personal payment templates a user creates inside their own pocket. They're private, tied to one pocket, not discoverable. `registered_agents` is the opposite — public, identity-verified, discoverable by anyone, owned by a developer. Different lifecycle, different access patterns, different concept. Keeping them separate avoids muddying both.

**Why Ed25519 public keys (Solana's native key format):**

Solana wallets are Ed25519. Most agents on Solana already use Ed25519 keys for their wallets. Reusing this format means an agent's "registered identity" can be the same as its on-chain identity if the developer wants — though they don't have to be. Session 24 will verify signatures over payment-request payloads.

**Why grants live on `pockets`, not `users`:**

A user might authorize different agents from different pockets — e.g. give MarketBot $5/day from their "trading" pocket but $0 from their "personal" pocket. Grants are per-pocket, scoped to that pocket's policy.

**Why the unique index on `(pocketId, registeredAgentId)`:**

A pocket can only have one active grant per agent. If you authorize MarketBot and want to change the limits, you update the existing grant — not create a duplicate. Simpler model, prevents UX confusion ("which of my 3 grants for MarketBot is active?").

## Stats

- 17 pages building cleanly (was 14)
- 48 API tests passing (was 32)
- All typechecks clean across api, web, and packages
- New schema requires `pnpm db:push` to take effect

## What's next — session 23

Grant authorization flow:
- `POST /pockets/:id/grants` — user authorizes an agent with scoped policy
- `GET /pockets/:id/grants` — list active grants for a pocket
- `PATCH /grants/:id` — update grant scope
- `DELETE /grants/:id` — revoke
- `/dashboard/grants` page — user's authorized agents with revoke + edit
- `/dashboard/authorize/[agentId]` page — the consent screen where a user grants an agent permission with scoped limits
- The actual UX flow: registry detail → "Authorize" → consent screen → grant created → user lands on `/dashboard/grants`
