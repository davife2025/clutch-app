# Clutch v2 🫙

> **Your wallets. Always there.**

Clutch is a **Solana-first** unified wallet pocket. Connect your Phantom, Backpack, Ledger, or any wallet — Clutch aggregates them into a single pocket with a unified balance, AI-powered payment routing, and x402 autonomous payments.

**The anti-wallet:** Clutch doesn't replace your wallets. It holds them.

---

## Quick start

```bash
pnpm install
cp .env.example .env     # fill in Supabase DATABASE_URL
bash scripts/setup.sh     # pushes schema to Supabase
pnpm dev                   # API → :3001
```

---

## Architecture

```
apps/
  api/          Hono + Drizzle + PostgreSQL
  web/          Next.js 14 (session 8)
  mobile/       Expo SDK 51 (session 9)
  extension/    Chrome MV3 (session 10)

packages/
  core/         Types, constants, utils
  connectors/   EVM + Solana + Ledger + WalletConnect v2
  agent/        Claude tool-use loop + payment execution
  x402/         HTTP 402 payment protocol
  vault/        Encrypted key storage
```

---

## Sessions

| # | What | Status |
|---|---|---|
| 1 | Repo scaffold · core types · DB schema (5 tables) | ✅ |
| 2 | Auth · pocket CRUD · wallet CRUD | ✅ |
| 3 | Connectors · balance sync · price service | ✅ |
| 4 | Encrypted vault · native SOL deposit/withdraw | ✅ |
| 5 | WalletConnect — connect external wallets | ✅ |
| 6 | AI agent with end-to-end payment execution | ✅ |
| 7 | x402 payment protocol | 🔜 Next |
| 8 | Web dashboard (8 pages, not 16) | |
| 9 | Mobile app — Expo | |
| 10 | Chrome extension | |
| 11 | WebSocket real-time updates | |
| 12 | Minimal swap routing for agent | |
| 13 | Testing + CI/CD | |
| 14 | Production deployment | |

---

## DB schema (v2 · Supabase)

Five tables. That's it. Hosted on Supabase PostgreSQL.

- **users** — email + password auth
- **pockets** — the container that holds wallets + native SOL balance
- **wallets** — addresses connected to a pocket (manual, WalletConnect, or custodial)
- **wallet_balances** — cached token balances per wallet
- **transactions** — deposit, withdraw, payment, transfer history

---

## Tech stack

Hono · Supabase PostgreSQL · Drizzle ORM · @solana/web3.js · viem · WalletConnect v2 · Claude AI · x402 · Next.js 14 · Expo SDK 51 · Chrome MV3 · Turborepo · pnpm
