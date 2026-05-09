# Ship plan — what's left and the order to do it in

This is the actual prioritized list, with realistic time estimates and pass criteria. Work through it top-to-bottom. Don't skip ahead to features that look fun.

---

## Phase 0 — Verify what's already there (1 day, no new code)

Before anything else, walk through `docs/verification.md` Workflow A and Workflow B against the deployed environment. Time it. Note every place it feels broken. Each broken thing is more important than any new feature.

If Workflow A doesn't pass: that's the blocker. Nothing else ships until anonymous signup → policy enabled → upgrade works in under 90 seconds.

If Workflow B doesn't pass: that's the second blocker. The product doesn't actually do what we say it does until a real on-chain payment can happen and a real policy denial can show up.

**Pass criteria for Phase 0:** both workflows complete cleanly on a real deployment (not localhost) at least once.

---

## Phase 1 — Make Clutch usable as infrastructure (3-5 days)

Right now we market the SDK but builders can't actually use it from outside the app. This phase fixes that. Until this is done, every other feature is shipping into a vacuum.

### 1A. API keys (1.5 days)

Add `developers` and `api_keys` tables. API keys are `pk_live_...` (32 chars after the prefix), stored hashed with the prefix indexed for lookup. Middleware accepts either a user JWT or an API key — same Authorization header, different validation paths. Add `/developers` dashboard pages for create/list/revoke keys. Rate-limit per key, not per IP, for `pk_*` requests.

**Pass criteria:** a developer can sign up, create a key, run `import { Clutch } from '@clutch/x402'; const c = new Clutch({ apiKey: 'pk_test_...' })` from a Node script outside the monorepo, and successfully call `c.getPolicy()`.

### 1B. Reference agent — the demo (1 day)

One specific working agent that proves the SDK is real. The "API spending agent" — autonomously pays for AI inference (or web scraping APIs, or data feeds) within a daily budget. Full TypeScript project in `examples/api-spending-agent/`. README with copy-paste setup. Uses Solana Agent Kit + Clutch SDK together. This becomes the demo video's centerpiece and the thing you point builders at.

**Pass criteria:** clone the example, set two env vars, `npm install && npm start`, watch it pay for a real x402-protected API call within the policy.

### 1C. Receipt-to-fetch binding (0.5 day)

Plumb `X402PaymentProof` back through the X402Client so the SDK records receipts deterministically, not via the >800ms heuristic.

**Pass criteria:** every successful `clutch.fetch()` that hit a 402 produces exactly one receipt with the correct URL, txHash, amount, and final HTTP status.

### 1D. Webhooks for builders (1 day)

Outbound webhooks. Registered URLs per developer, signed with HMAC, retried with exponential backoff on non-2xx, dead-lettered after 24 hours. Events: `payment.confirmed`, `payment.failed`, `policy.denied`, `receipt.recorded`. Dashboard page to register and test webhook URLs.

**Pass criteria:** a builder can register `https://their-server.com/clutch-webhook`, do a test payment in their app, receive a signed POST within 5 seconds, and see it logged in their /developers dashboard.

### 1E. Demo video (half day, no code)

Follow `docs/demo-video.md`. Record it. Edit it. Export it. Don't ship anything else until this exists.

**Pass criteria:** a 90-second `clutch-demo.mp4` exists at 1080p, posted on Twitter and in three Solana Discords.

---

## Phase 2 — Things real users will hit immediately (3-4 days)

Without these, anyone who signs up for real will hit a painful gap within their first 5 minutes.

### 2A. Token list discovery (0.5 day)

Replace the hardcoded SPL token probe with `getParsedTokenAccountsByOwner`. Show every SPL token the user actually holds, not just our 7. Same for EVM via Alchemy.

**Pass criteria:** a user adds a wallet holding RAY, ORCA, or any meme coin, and sees those balances within 5 seconds of sync.

### 2B. Wallet Standard wired into web (0.5 day)

The adapter is built — just wire it to `/dashboard/wallets`. Click "Connect wallet" → see installed wallets (Phantom, Backpack, Solflare) → pick one → sign an "I own this" message → wallet added with signing capability. Manual address paste stays as a fallback for "I don't have any wallet installed."

**Pass criteria:** a user with Phantom installed clicks "Connect Phantom," approves once, and sees their wallet added without copy-pasting an address.

### 2C. Multi-pocket UI (1 day)

Backend supports 4 pockets/user. Wire it to the UI. Pocket switcher in the sidebar header. "Create pocket" modal. Per-pocket policy isolation. Cached pocket ID in localStorage updates on switch.

**Pass criteria:** a user can create a "Personal" pocket and a "Work" pocket, switch between them, set different policies on each, and see different transaction histories.

### 2D. Account hygiene (1 day)

Email verification on registration (sent via Resend or similar — 100 free emails/month). Password reset flow with single-use token. Email change endpoint. Account deletion endpoint (required for GDPR). Two-factor authentication parked for later.

**Pass criteria:** registering sends a verification email, clicking the link verifies the address, requesting a password reset sends a working email with a token that expires in 1 hour.

---

## Phase 3 — Operational readiness (2-3 days)

Without these, when something breaks in production we won't know.

### 3A. Observability (0.5 day)

Sentry for error reporting (free tier covers up to 5k errors/month). Structured JSON logging with request IDs. Basic metrics dashboard — payment success rate, policy denial rate, p95 response time. Set up alerts: error rate above 1%, payment failure rate above 5%, p95 above 2 seconds.

**Pass criteria:** intentionally trigger a 500 error, see it in Sentry within 10 seconds with a useful stack trace and the request ID.

### 3B. RPC reliability (0.5 day)

Primary + fallback Solana RPC URLs in env. Try primary, fall back on error. Track recent landing rates. Adjust priority fees up if landing rate drops below 90%.

**Pass criteria:** during a chaos test where the primary RPC returns 500 for one minute, payments still complete (with slightly higher fees) without user-visible failures.

### 3C. Rate limit + WebSocket Redis (1 day)

Currently single-instance. Move rate limit buckets to Redis (Upstash free tier). Move WebSocket fan-out to Redis pub/sub. This unblocks horizontal scaling on Render.

**Pass criteria:** scale Render to 2 instances, confirm a payment made on instance A pushes a balance update to a WebSocket client connected to instance B.

### 3D. Real on-chain webhook verification (0.5 day)

Move from synchronous one-off check to a worker process that subscribes to Helius webhooks (or polls Solana program logs). Catch the "transaction confirmed but webhook missed" case.

**Pass criteria:** disconnect the webhook delivery for 60 seconds during a payment, reconnect, see the payment status update within 30 seconds of reconnection.

---

## Phase 4 — Mobile + extension (3-4 days)

These are the surfaces I marketed but haven't actually shipped. Real apps, not codebase items.

### 4A. Chrome extension polish + ship (1.5 days)

The Manifest V3 extension exists in `apps/extension`. Real Chrome testing. Fix the brittle 402 detection (currently only matches our specific JSON shape — should handle Coinbase's `accepts` array spec too). Build the extension. Submit to Chrome Web Store. First submission takes ~3 days for review.

**Pass criteria:** extension installed from the Chrome Web Store, visiting a 402-protected page shows the "Pay through Clutch" prompt, clicking it pays through the user's pocket, page refreshes with content unlocked.

### 4B. Mobile EAS build + ship (2 days)

Expo SDK 51 app exists in `apps/mobile`. Test on a real iPhone and Android phone. Wire the biometric unlock that was installed but unused. EAS build for both platforms. Submit to TestFlight and Play Console. First Apple review takes 1-3 days.

**Pass criteria:** install the TestFlight build on a real iPhone, log in, see balances, get a Face ID prompt on app re-open.

---

## Phase 5 — The non-builder agent flow (2-3 days)

This is the new product surface — letting users without coding skills create a payment agent for x402 resources. **Build this only after Phase 1 is complete.** Until the SDK is shippable to real builders, building a consumer agent UI is premature.

### 5A. Agent templates + creation flow (1 day)

`/dashboard/agents` page. "Create agent" button. Pick from 3 templates: "API spending agent," "Content paywall agent," "Per-call inference agent." Each template has a default policy preset, a description of what it does, and a list of x402 services it works with. User names the agent, sets/inherits a policy, clicks Create. Agent record stored in DB linked to a pocket.

**Pass criteria:** user creates a "Content paywall agent" with a $1/article cap and $10/day limit, sees it listed in `/dashboard/agents`, can pause/resume/revoke it.

### 5B. Agent instruction interface (1 day)

`/dashboard/agents/:id`. The "give your agent a job" UI. User types: "subscribe me to https://substack.com/some-newsletter and pay the next 5 articles" or "buy me 10 API calls from elevenlabs.com." The Clutch agent translates the instruction into a sequence of x402 fetches, executes them within policy, returns receipts. **This is constrained to x402-protected URLs.** If the user names a URL that isn't x402-protected, we tell them honestly: "This site doesn't accept x402 payments yet. Clutch can't pay for it for you."

**Pass criteria:** user types an instruction naming a real x402-protected service, agent attempts the fetches, blocked by policy if appropriate, receipts produced for all completed payments.

### 5C. x402 service directory (half day)

`/dashboard/agents/services` — a curated list of x402-protected services that work with Clutch. Starts with maybe 5-10 (Coinbase ecosystem, Alchemy agentic-gateway, anything we partner with). Each entry shows the service name, what it costs, what it provides, and a "test with my agent" button. This is the thin substitute for general web browsing that makes the consumer flow honest.

**Pass criteria:** the directory lists at least 5 working services. Clicking "test with my agent" runs a one-off payment through the user's policy.

### 5D. Honest copy + scope (no code, just writing)

The `/dashboard/agents` page must explicitly say what these agents can and can't do. **Cannot:** browse arbitrary websites, fill out forms, solve CAPTCHAs, create accounts, click checkout buttons, drive a real browser. **Can:** call x402-protected URLs, pay paywalls within policy, return content, log every payment as a receipt. Setting expectations correctly is the difference between "agent that sometimes works" and "agent that does one thing reliably."

**Pass criteria:** the agent creation flow tells the user what's possible and what isn't, in plain language, before they create their first agent.

---

## Phase 6 — Things to deliberately not build yet

These will tempt you. Resist.

- **Smart contract deployment.** Not until there's a specific user pain that requires it.
- **A token.** Don't.
- **Multi-chain support.** Solana-only is the wedge. Don't dilute.
- **NFT support, DeFi position tracking, portfolio analytics.** Step Finance has these. Don't compete with them.
- **A marketplace of pre-built agents.** Premature. Need 5-10 real Clutch-built agents first before a marketplace makes sense.
- **Self-hosting documentation.** Builders who would self-host are not your early customers. Hosted only.
- **A mobile-first redesign.** Web is the entry point for builders. Mobile is the surface for end-users. Both matter, neither needs a redesign right now.

---

## Realistic timeline for solo developer

Phase 0: 1 day
Phase 1 (the unblock): 5 days
Phase 2 (UX gaps): 4 days
Phase 3 (operational): 3 days
Phase 4 (mobile + extension): 4 days
Phase 5 (consumer agents): 3 days

Total: about 4 weeks of focused work to a "this is shippable to real users" state. Less if you skip Phase 4 (most early traction will come from web, not mobile or extension).

---

## How to know when to stop

The tempting thing about a feature list is that you can always add more. Here's the rule: **after Phase 1 is done, don't ship Phase 2 until you've sent 10 DMs with the demo video and gotten responses from at least 3 Solana agent builders.** Their feedback determines whether Phase 2 is the right thing to build, or whether the actual gap is somewhere we haven't seen yet.

The thing that's hardest about this stage isn't writing more code. It's resisting the urge to write more code when what you actually need is signal from the market.
