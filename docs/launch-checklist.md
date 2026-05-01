# Launch checklist

Before flipping Clutch live to real users. Walk through this end-to-end. Every box matters.

## Security

- [ ] `JWT_SECRET` is at least 32 random chars (Render generates this automatically via `generateValue: true`).
- [ ] `VAULT_MASTER_KEY` is at least 32 random chars and is **never written down anywhere except Render's secret store**. Losing it makes every custodial wallet permanently unrecoverable.
- [ ] `DATABASE_URL` uses the Supabase transaction pooler (port 6543), not the direct connection.
- [ ] Supabase Row Level Security: not strictly required since the API enforces ownership via `userId`, but consider enabling RLS on the `users`, `pockets`, `wallets`, `wallet_balances`, and `transactions` tables as a defense-in-depth measure.
- [ ] `CORS_ORIGIN` is set to the exact Vercel URL — not `*`, not `localhost`.
- [ ] HTTPS is enforced everywhere. Render and Vercel give you HTTPS by default; don't override it.
- [ ] No secrets in git. `git log --all --full-history -- '**/.env*'` should return nothing.
- [ ] `ANTHROPIC_API_KEY` has a sensible monthly spend cap set in the Anthropic console.

## Solana

- [ ] `SOLANA_RPC_URL` points to a paid provider (Helius / QuickNode / Triton) — not the public mainnet endpoint. Public RPCs rate-limit aggressively and can drop transactions.
- [ ] Test the swap path: a custodial wallet can swap SOL → USDC via Jupiter end-to-end.
- [ ] Test the payment path: a custodial wallet can send USDC to a fresh address (one that needs ATA creation).
- [ ] Priority fee defaults (50,000 micro-lamports/CU) are landing transactions reliably. Bump if needed.
- [ ] WalletConnect signing works for at least Phantom and Backpack.

## Database

- [ ] Schema is pushed to production Supabase (`pnpm --filter @clutch/api db:push`).
- [ ] Connection pool size (`max: 10` in `db/client.ts`) makes sense for your Render plan. The Supabase pooler can handle hundreds of concurrent connections, but Render starter has limited memory.
- [ ] Backups are enabled. Supabase does daily automated backups on paid plans; verify yours is on.

## API

- [ ] `/health` returns 200 with `db: connected`.
- [ ] All endpoint smoke tests pass against production:
  - register → login → create pocket → add wallet → sync balance → get summary → pay via agent → see transaction in history.
- [ ] WebSocket connects: `wss://clutch-api.onrender.com/ws?token=<jwt>` returns the `connected` event.
- [ ] Rate limiting: at minimum, the `/auth/login` and `/auth/register` endpoints have brute-force protection at the platform level (Render or via a middleware — currently there's none, **add this before public launch**).
- [ ] Error responses don't leak stack traces. The error middleware handles this for caught errors; spot-check by triggering a 500.

## Web

- [ ] Production build succeeds: `pnpm --filter @clutch/web build`.
- [ ] `NEXT_PUBLIC_API_URL` is set to the Render URL on Vercel.
- [ ] Login → dashboard → sync → see balances loop works on the deployed site.
- [ ] WebSocket "Live" indicator turns moss-green within 2 seconds of dashboard load.
- [ ] Open Solscan link from a transaction row — it opens to the right transaction.
- [ ] No console errors in Chrome DevTools on first load.
- [ ] Mobile view (DevTools responsive mode at 375px) doesn't break.

## Mobile

- [ ] EAS build completes for both iOS and Android.
- [ ] Login persists across app kills (uses `expo-secure-store` keychain).
- [ ] WebSocket reconnects after backgrounding and resuming the app.
- [ ] Pull-to-refresh syncs balances with haptic feedback.

## Extension

- [ ] `pnpm --filter @clutch/extension build` produces `dist/` cleanly.
- [ ] Loaded as unpacked extension, the popup logs in successfully.
- [ ] Visit a test 402 endpoint (e.g. `https://clutch-api.onrender.com/x402/demo`) and confirm the floating prompt appears.
- [ ] Click "Pay through pocket" → completes through the agent → page refresh unlocks the content.
- [ ] Manifest `host_permissions` doesn't include domains you don't need.

## Operational

- [ ] Render deploy notifications go to a Slack channel or your email.
- [ ] Supabase alert: set up a row-count or query-time alert for unusual spikes.
- [ ] Anthropic spend dashboard: bookmarked, checked weekly.
- [ ] Status page: at minimum, a public way to know if Clutch is up. Could be just the `/health` endpoint linked from the docs.
- [ ] Support email or Discord channel where users can report issues.

## Legal / boring but important

- [ ] Privacy policy live (what user data Clutch stores: email, encrypted keys, transaction history).
- [ ] Terms of service: at minimum, "Clutch routes payments on Solana — we don't custody your external wallets."
- [ ] Clear disclosure that Clutch is non-custodial for connected wallets but holds encrypted keys for imported wallets in the vault.
- [ ] If accepting payments: comply with whatever applies in your jurisdiction. Probably nothing for crypto-native infrastructure, but check.

## What's deliberately *not* in scope yet

These are safe to ship without, but flag them as known gaps:

- No 2FA on accounts (just email + password)
- No password reset flow
- No account deletion endpoint
- No rate limiting middleware in the API itself (rely on Render/Vercel platform limits)
- No on-chain transaction verification on the webhook endpoint (any caller with the txHash can mark it confirmed — fine for testing, not for production at scale)
- No tests against a real Supabase instance — only unit tests
- No E2E browser tests

Address before scaling beyond friends-and-family.
