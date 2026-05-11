# @clutch/sdk

**The fastest way to give your Solana AI agent a wallet that won't drain.**

Drop into Solana Agent Kit, GOAT, ElizaOS, LangGraph, Mastra, or any framework. Five minutes, no rewrites.

```bash
npm install @clutch/sdk
```

```typescript
import { Clutch } from '@clutch/sdk'

const clutch = new Clutch({ apiKey: process.env.CLUTCH_API_KEY })

// Auto-pays HTTP 402 paywalls. Respects your spending policy. Records every receipt.
const res = await clutch.fetch('https://api.example.com/premium')
const data = await res.json()
```

That's it. Your agent can now pay for paywalled APIs, content, and inference — within rules you set, with audit logs you can actually read.

---

## Why this exists

AI agents on Solana run with full custody of a private key. One hallucination, one prompt injection, one bug in the tool-calling loop — and the wallet drains. The Solana docs literally say "your agent has a private key and thus can access the funds in your wallet."

In September 2024, a Telegram trading bot called Banana Gun lost users **$3M** because of a single oracle bug. The wallet had no spending limits because there was nowhere good to put them.

Clutch is the layer between your agent and the chain:

- **Spending policies** — per-transaction caps, daily limits, recipient allowlists. Enforced server-side before any chain interaction.
- **x402 payment routing** — the `clutch.fetch()` wrapper auto-pays HTTP 402 paywalls within your policy.
- **Audit-grade receipts** — every paywall payment recorded with the URL, tx hash, USD value, and post-payment HTTP status.
- **One-click revocation** — kill an agent's access without rotating any keys.

You set the rules. The agent operates inside them. The chain never sees a transaction that violates your policy.

---

## Five-minute integration

### 1. Get an API key

Sign up at [clutch.app](https://clutch.app), create a pocket, generate an API key from the developer settings.

### 2. Install

```bash
npm install @clutch/sdk
```

### 3. Wire it in

```typescript
import { Clutch } from '@clutch/sdk'

const clutch = new Clutch({ apiKey: process.env.CLUTCH_API_KEY! })

// Set your spending policy
await clutch.updatePolicy({
  enabled: true,
  maxPerTxUsd: 5,
  maxPerDayUsd: 50,
})
```

### 4. Use it

```typescript
// x402 paywall payment — auto-pays within policy, records a receipt
const res = await clutch.fetch('https://premium-api.com/data')

// Explicit payment — still goes through the policy
await clutch.pay({
  to: 'recipient.sol',
  amount: '0.50',
  token: 'USDC',
  memo: 'API access for analysis',
})

// Audit trail — every paywall the agent paid for
const receipts = await clutch.receipts({ limit: 100 })
console.log(`Spent ${receipts.length} payments today`)
```

---

## Works with any framework

### Solana Agent Kit

```typescript
import { SolanaAgentKit } from 'solana-agent-kit'
import { Clutch } from '@clutch/sdk'

const clutch = new Clutch({ apiKey: process.env.CLUTCH_API_KEY! })
const agent = new SolanaAgentKit(/* ... */)

// Replace agent.fetch with the policy-aware version
agent.fetch = (url, init) => clutch.fetch(url, init)
```

### GOAT

```typescript
import { getOnChainTools } from '@goat-sdk/core'
import { Clutch } from '@clutch/sdk'

const clutch = new Clutch({ apiKey: process.env.CLUTCH_API_KEY! })
const tools = await getOnChainTools({
  /* your wallet */
  onPaywall: (url) => clutch.fetch(url),
})
```

### ElizaOS

```typescript
import { Clutch } from '@clutch/sdk'

const clutch = new Clutch({ apiKey: process.env.CLUTCH_API_KEY! })

// In your character's actions
const fetchPaid = async (url: string) => clutch.fetch(url)
```

### LangGraph / vanilla

```typescript
import { Clutch } from '@clutch/sdk'

const clutch = new Clutch({ apiKey: process.env.CLUTCH_API_KEY! })

const tools = [
  {
    name: 'fetch_paywalled',
    description: 'Fetch a URL, auto-paying any HTTP 402 paywall within budget',
    handler: async ({ url }) => {
      const res = await clutch.fetch(url)
      return res.text()
    },
  },
]
```

---

## Spending policy reference

Every payment — `pay()` and `fetch()` alike — is evaluated against your policy server-side. Six rules in this order:

1. **Recipient blocklist** → never send here
2. **Recipient allowlist** → must be in this list (if list is set)
3. **Token blocklist** → these tokens never sent
4. **Token allowlist** → only these tokens (if list is set)
5. **Per-transaction limit** → max single-tx USD value
6. **Daily limit** → cumulative USD per day (UTC)

When a rule denies a payment, you get a `ClutchError` with the specific code:

```typescript
import { Clutch, ClutchError } from '@clutch/sdk'

try {
  await clutch.pay({ to: 'x', amount: '100', token: 'USDC' })
} catch (err) {
  if (err instanceof ClutchError) {
    if (err.code === 'TX_LIMIT_EXCEEDED') {
      // Per-transaction cap hit. Lower the amount or ask the user.
    }
    if (err.code === 'DAILY_LIMIT_EXCEEDED') {
      // Daily budget exhausted. Wait until UTC midnight or raise the limit.
    }
    if (err.code === 'RECIPIENT_BLOCKED') {
      // Recipient is on your blocklist. Refusing entirely.
    }
  }
}
```

Codes: `TX_LIMIT_EXCEEDED`, `DAILY_LIMIT_EXCEEDED`, `RECIPIENT_BLOCKED`, `RECIPIENT_NOT_ALLOWED`, `TOKEN_BLOCKED`, `TOKEN_NOT_ALLOWED`.

---

## API reference

### `new Clutch(config)`

```typescript
{
  apiKey: string                                    // pk_test_... or pk_live_...
  baseUrl?: string                                  // for self-hosted
  autoApproveUnderUsd?: number                      // default $1.00
  onPaymentRequired?: (req) => Promise<boolean>     // pre-payment hook
  onPaymentSuccess?: (proof, url) => void           // post-payment hook
  onPaymentError?: (err) => void                    // error hook
}
```

### `clutch.fetch(url, init?)` → `Promise<Response>`

Drop-in `fetch` replacement. Auto-pays HTTP 402 within policy, records a receipt, retries with proof.

### `clutch.pay(request)` → `Promise<PayResult>`

Explicit payment. Returns the tx hash and Solscan URL once confirmed.

### `clutch.receipts(opts?)` → `Promise<Receipt[]>`

List x402 receipts. Each receipt binds a tx hash to the URL it paid for, the recipient, the USD value, and the post-payment HTTP status.

### `clutch.getPolicy()` → `Promise<{ policy, spentTodayUsd }>`

Get the current spending policy + how much has been spent today (UTC).

### `clutch.updatePolicy(update)` → `Promise<SpendingPolicy>`

Partial update — only sent fields change.

---

## What Clutch is not

- **Not a wallet.** Phantom and Backpack are wallets. Clutch is the policy + payment layer above them.
- **Not key custody.** Use [Turnkey](https://turnkey.com) or [Crossmint Agent Wallets](https://crossmint.com) for TEE-backed key infrastructure. Clutch composes with both.
- **Not multisig.** Use [Squads](https://squads.so) for multisig. Clutch is for single-agent operational guardrails, not human-team approval flows.
- **Not a token launch platform.** No token. Pay-per-transaction, not for governance.

We're the smallest, sharpest layer for one specific job: **let your AI agent pay for things on Solana, within rules, with receipts.**

---

## Pricing

- Free up to **$1k/mo** of payment volume routed through Clutch
- 0.5% per transaction above that, capped at $0.10/tx
- No subscription fees, no minimums

---

## Support

- Docs: [docs.clutch.app](https://docs.clutch.app)
- Discord: [discord.gg/clutch](https://discord.gg/clutch)
- Twitter: [@clutchapp](https://twitter.com/clutchapp)

Found a bug or have a feature request? Open an issue at [github.com/clutch-app/clutch](https://github.com/clutch-app/clutch).
