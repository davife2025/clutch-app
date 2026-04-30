# Clutch v2 🫙

> **Your wallets. Always there.**

Clutch is a **Solana-native wallet pocket**. Connect your Phantom, Backpack, Solflare, or any Solana wallet — Clutch becomes the AI-powered layer above them with a unified balance, smart payment routing, and x402 autonomous payments.

**The anti-wallet:** Clutch doesn't replace your wallets. It holds them.

EVM wallets (Ethereum, Base, Polygon, Arbitrum, Optimism) are supported as **read-only external balances** for portfolio completeness — but Clutch transacts on Solana only. Why Solana? ~$0.0003 fees, sub-second finality, and a thriving stablecoin ecosystem make it the only chain where x402 micropayments actually work economically.

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
  api/          Hono + Drizzle + Supabase
  web/          Next.js 14 (session 8)
  mobile/       Expo SDK 51 (session 9)
  extension/    Chrome MV3 (session 10)

packages/
  core/         Types, constants, utils
  connectors/   Solana (signing) + EVM (read-only) + WalletConnect + Wallet Standard
  agent/        Claude tool-use loop, Solana-only payment execution
  x402/         HTTP 402 payment protocol over Solana/USDC
  vault/        Encrypted private key storage
```

**The Solana-native architecture:**
- `SolanaConnector` — versioned transactions, priority fees, ATA creation, message signing
- `EVMConnector` — read-only, balance display only
- Wallet Standard adapter — first-class browser support for Phantom/Backpack/Solflare
- WalletConnect — fallback for mobile and external wallets
- Agent's `execute_payment` — hard-guarded to route only through Solana wallets

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
| 7 | x402 payment protocol | ✅ |
| 7.5 | **Solana hardening — versioned tx, priority fees, ATA, Wallet Standard** | ✅ |
| 8 | Web dashboard | ✅ |
| 9 | Mobile app — Expo | ✅ |
| 10 | Chrome extension | ✅ |
| 11 | WebSocket real-time updates | ✅ |
| 12 | Solana swap routing (Jupiter) for agent | ✅ |
| 13 | Testing + CI/CD | 🔜 Next |
| 14 | Production deployment | |

---

## DB schema (Supabase PostgreSQL)

Five tables. That's it.

- **users** — email + password auth
- **pockets** — the container that holds wallets + native SOL balance
- **wallets** — addresses connected to a pocket (manual, WalletConnect, or custodial)
- **wallet_balances** — cached token balances per wallet
- **transactions** — deposit, withdraw, payment, transfer history

---

## Tech stack

Hono · Supabase PostgreSQL · Drizzle ORM · @solana/web3.js (versioned tx) · @solana/spl-token · viem (read-only) · Wallet Standard · WalletConnect v2 · Claude AI · x402 · Next.js 14 · Expo SDK 51 · Chrome MV3 · Turborepo · pnpm
