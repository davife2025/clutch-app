# Clutch

**The payment layer between AI agents and Solana.**

Spending policies, audit trails, x402 paywall handling, and one-click revocation for any agent built on or for Solana.

[clutch.app](https://clutch-app-web.vercel.app)  ·  [Registry]()  ·  [Docs](https://clutch-app-web.vercel.app/dashboard/docs)

---

## The problem

AI agents on Solana run with full custody of a private key. One hallucination, one prompt injection, one bug in the tool-calling loop and the wallet drains.

In September 2024, the Banana Gun trading bot lost users **$3M** because of a single oracle bug. Helius the most-used Solana RPC provider  published a March 2026 article that opens with "private keys stored in code create massive vulnerabilities." The Solana developer documentation says it plainly: *your agent has a private key and thus can access the funds in your wallet. If someone can chat with your agent and it has a transfer action, users can probably get it to transfer them your funds.*

The solutions that exist today Turnkey for key custody, Crossmint for smart contract wallets, Squads for multisig, Phala for TEEs — all secure the *key*. They don't sit between the agent and the chain enforcing what the agent is allowed to do, with audit logs the user can read, and one-click revocation that works without rotating keys.

That's the gap Clutch fills.

## What Clutch does

**Spending policies.** Per-transaction caps, daily limits, recipient allowlists and blocklists, token allowlists and blocklists. Six rules, evaluated server-side before any chain interaction. Even if the agent hallucinates, even if the prompt gets injected, the chain never sees a transaction that violates the rules.

**The x402 client.** Wraps `fetch()` so when an agent hits an HTTP 402 paywall, Clutch auto-pays it within policy, records a receipt, and retries with proof. Drop into Solana Agent Kit, GOAT, ElizaOS, LangGraph, or any framework in five lines of code.

**OAuth-shape platform.** Agents register their Ed25519 identity in a public registry. Users browse the registry and authorize agents with scoped grants per-tx caps, daily caps, allowed tokens, expiration. Agents make signed payment requests through Clutch. Clutch verifies the signature, evaluates the grant scope and the pocket policy, then either executes on Solana or denies with a structured error. **The agent never sees the user's wallet keys. The user can revoke authorization any time without rotating any keys.**

**Audit-grade receipts.** Every paywall payment is recorded with the URL, tx hash, USD value, post-payment HTTP status, and the original 402 challenge JSON. For cost dashboards. For dispute resolution. For agents you want to trust but verify.

## How it works

```
┌─────────────┐    signed payment      ┌────────────┐     SPL transfer    ┌─────────┐
│   Agent     │ ───────────────────▶  │   Clutch   │ ──────────────────▶  │ Solana  │
│  (3rd-party │   (Ed25519 over       │            │                       │         │
│  framework) │    canonical payload) │  Policy +  │  ◀── confirms tx ───  │         │
└─────────────┘                       │  Grant     │                       └─────────┘
                                      │  enforce   │
                  ┌──────────────────▶│            │
                  │   user sets       │  Receipts  │
              ┌───┴───┐               │  ledger    │
              │ User  │               └────────────┘
              └───────┘
```

The flow is the same shape as OAuth: identity → consent → scoped access → revocation. Different domain.

## Built on this stack

- **Backend:** TypeScript on Hono, Drizzle ORM on Postgres (Supabase), Solana Web3.js, tweetnacl for Ed25519 verification, Jupiter for swap routing, deployed on Render
- **Frontend:** Next.js 14 App Router, Tailwind, Recharts, WalletConnect v2, deployed on Vercel
- **Mobile:** Expo SDK 51 with biometric secure-store (TestFlight build pending)
- **Extension:** Manifest V3 Chrome extension with x402 page detection (Web Store submission pending)
- **AI agent:** Kimi K2 via Hugging Face Inference Providers (OpenAI-compatible API), used only for the conversational chat surface every other endpoint runs without an LLM call
- **Vault:** AES-256-GCM with scrypt key derivation for custodial signing keys
- **x402 SDK:** Standalone npm package (`@clutch/x402`) with framework integration examples

## What we shipped

In approximately 12 weeks of focused development:

- ~110 TypeScript files, ~14,000 lines of source code
- 61 passing API tests covering policy evaluation, rate limiting, Ed25519 signature verification, replay protection, and registry input validation
- 21 frontend pages (landing, registry, dashboard, docs)
- Full CI/CD via GitHub Actions to Render + Vercel + Supabase
- A working reference agent at `examples/demo-agent/` that demonstrates the full register-authorize-pay flow

## What's deliberately not here

- No token. We don't need one. Pay-per-transaction fee model when monetized.
- No on-chain contracts (yet). The policy engine is off-chain by design faster, cheaper, and lets us evolve policy logic without redeployments. A trustless on-chain version is a real upgrade path once usage validates demand.
- No multi-chain support. Solana-only is the wedge. EVM wallets show in read-only mode for portfolio completeness.

## Comparison with adjacent products

| Product        | What they do                            | What Clutch adds                     |
|----------------|-----------------------------------------|--------------------------------------|
| Turnkey        | TEE-backed key custody for agents       | Policy enforcement + x402 + receipts |
| Crossmint      | Smart-contract agent wallets            | Off-chain policy + registry + grants |
| Squads         | Multisig for teams                      | Single-user agent guardrails         |
| SAID Protocol  | On-chain agent identity + reputation    | Payment routing + spending limits    |
| Helius         | RPC + indexing infrastructure           | The agent-facing payment layer       |

Clutch composes with all of these. Use Turnkey for keys *and* Clutch for policy. Use Crossmint for smart wallets *and* Clutch for the x402 SDK. The wedge isn't competing with these products — it's filling the gap between them and the agent.

## Open infrastructure

The full codebase is open source. Self-host with one command: `pnpm install && pnpm db:push && pnpm start`. Only external dependencies are Postgres and a Solana RPC endpoint.

## License

MIT.
