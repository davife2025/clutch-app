# How to verify Clutch is working

Three workflows. If all three pass end-to-end, the product is functional. Walk them in order — each one tests a deeper layer.

---

## Workflow A — First-time visitor (≤90 seconds, no funds needed)

**What it tests:** the friction-free entry. If this breaks, nothing else matters because nobody gets past it.

### Steps

1. Open clutch.app in an incognito window
2. Confirm the new hero reads: **"Wallets your AI won't drain"**
3. Click **"Try without signing up"** (gold button, primary CTA)
4. Watch `/auth/try` — you should see "Setting up your pocket..." with a spinner for 1-2 seconds
5. Land on `/dashboard` automatically
6. Confirm you see:
   - The new cradle-bracket logo in the sidebar (gold square, ink bracket holding a small block)
   - A gold-tinted **"You're using a guest account"** banner at the top
   - The total balance card showing $0.00
   - A gold **"Spending guardrails are off"** card below the balance
   - The empty-pocket state telling you to connect a Solana wallet
7. Click the Shield icon in the sidebar → land on `/dashboard/policy`
8. Flip the policy toggle on (turns moss-green)
9. Set Daily limit: **$20**, Per-transaction: **$5**
10. Click **Save policy** → see "✓ Saved" confirmation
11. Click "Pocket" in the sidebar to go back to `/dashboard`
12. Confirm the policy card now shows: moss-green Shield, "Guardrails active · 2 rules", and a daily budget bar at $0 of $20
13. Click **"Save account"** in the upgrade banner
14. Type any email + password (8+ chars), submit
15. Confirm you see "Account secured" briefly
16. Refresh the page — you should still be logged in (token persists)

### Pass criteria

- Total time from clutch.app → "Guardrails active" card visible: **under 90 seconds**
- No 500 errors, no infinite spinners, no missing UI elements
- The new logo appears in: the landing page nav, the auth flow nav, the sidebar after login, and as the browser tab favicon

### What can break

- `/auth/try` returns 500 → API not deployed or DATABASE_URL wrong (run `curl https://your-api.onrender.com/health`)
- Loading spinner forever → the API is up but the response shape is wrong (check browser DevTools network tab for the actual JSON returned)
- "Spending guardrails are off" card doesn't appear → policy route not mounted (check `apps/api/src/index.ts` has `app.route('/pockets', policyRoutes)`)
- Save policy fails with 500 → schema not pushed (run `pnpm --filter @clutch/api db:push`)
- "Account secured" flashes but you get logged out on refresh → JWT_SECRET not persisted in Render env vars

---

## Workflow B — Agent payment + policy denial (needs ~$5 USDC on Solana)

**What it tests:** the actual product working — the moment that justifies Clutch existing.

### Setup

You need a Solana wallet with at least $5 USDC. Either:
- Use the in-app **Funds** page to deposit USDC into a custodial wallet
- Or connect an existing wallet via WalletConnect from `/dashboard/wallets`

Make sure the policy from Workflow A is still active ($5 per-tx, $20 daily).

### Allowed payment path

1. Go to `/dashboard/agent`
2. Type: **"Send 1 USDC to <some Solana address you own>"** (e.g. another wallet of yours)
3. The agent should:
   - Check balances across your Solana wallets
   - Pick the one with USDC
   - Either sign through the vault (if custodial) or pop a WalletConnect approval (if WC)
   - Confirm on-chain in 3-8 seconds
4. You should see a green success card with the tx hash and a Solscan link
5. Click the Solscan link → confirm the transaction landed on mainnet
6. Go to `/dashboard/activity` → see the row with status "confirmed" in moss-green
7. Go back to `/dashboard` → the daily budget bar should show $1 of $20 used

### Blocked payment path

1. Go to `/dashboard/agent` again
2. Click **"Pay"** in the page header (opens PayModal)
3. Try to send **$10 USDC** to anywhere
4. Submit
5. You should see the moss-green Shield card:
   - Title: "Blocked by your spending policy"
   - Reason: "Transaction $10.00 exceeds the per-transaction limit of $5.00."
   - Link: "Adjust policy →"
6. Go to `/dashboard/activity` → see the row with Shield icon, status "blocked", with the rejection reason as italic sub-text
7. The total dollar value spent today should NOT have moved — denials don't count toward the daily limit

### Pass criteria

- A real transaction lands on Solana mainnet
- The policy denial path produces zero on-chain activity (zero RPC calls, zero gas spent)
- Both paths produce activity-feed rows
- The denied row is visually distinct (Shield icon, moss-green not rust-red)

### What can break

- Agent can't find balances → RPC down or wrong `SOLANA_RPC_URL` (use Helius/QuickNode, not the public mainnet endpoint)
- Vault decrypt fails → `VAULT_MASTER_KEY` not set in Render env
- WC popup never appears → `WALLETCONNECT_PROJECT_ID` missing or session expired
- Policy denial returns generic error instead of moss-green Shield card → web UI was deployed before session 18 delta — redeploy
- "Blocked" row missing from activity → schema doesn't have `policy_denied` enum value yet (run `pnpm db:push`)

---

## Workflow C — Builder integrating the SDK (later, not yet)

**What it tests:** whether Clutch is consumable as infrastructure by other teams.

### Status: not yet possible end-to-end

The SDK exists (`@clutch/x402`), the README is shipped, the receipts ledger is wired. But the SDK uses **JWT bearer tokens**, not real API keys yet — that's session 20's work. So a builder can't `npm install @clutch/x402` and use it from outside the app today.

What you *can* test right now:

1. From a separate Node script in the same monorepo:
```typescript
import { Clutch } from '@clutch/x402'

const clutch = new Clutch({ apiKey: 'your-jwt-from-localStorage' })
const policy = await clutch.getPolicy()
console.log(policy)
```
2. Hit the demo paywall: `clutch.fetch('http://localhost:3001/x402/demo')` — it should pay 0.1 USDC (within your $5 cap), retry, return the premium content
3. `await clutch.receipts({ limit: 10 })` — should show the demo paywall payment

### What the next session should fix

- Real API keys: `pk_live_...` format, scoped per developer org, rate-limited per key
- Developer dashboard at `/developers` to manage keys
- A separate auth middleware that distinguishes user JWTs from API keys

---

## When to ship vs when to fix

If Workflow A passes, **ship the landing page** to friends and collect first-impression feedback. The friction story is real.

If Workflow B passes, **ship the dashboard** to 5 willing testers. Have them connect a wallet, set a policy, try to break it. Their broken attempts are the most valuable feedback you'll get.

If Workflow C is needed before any of this matters → that's the signal that we should prioritize session 20 (API keys) before any more polish work.

---

## The honest test

Forget the workflows. Ask yourself: **"if I showed this to a Solana agent builder right now, would they install it?"**

If the answer is "yes, but they'd need real API keys to integrate it" — ship session 20.
If the answer is "yes, the demo dashboard is enough to explain the value" — start the outreach.
If the answer is "no, the value isn't clear yet" — that's the thing to fix, not more features.
