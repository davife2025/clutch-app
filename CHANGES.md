# Bug fix + audit — last day final delta

This delta does four things in one push:

## 1. The signup → "open wallet" → bounced-to-login bug — FIXED

You hit this and described it precisely. Here's what was actually happening:

You'd sign up successfully, get redirected to `/dashboard`, and the dashboard would call `getPocketSummary(pocketId)`. If that call failed for any transient reason (Render cold start, slow DB, network blip), the dashboard set `summary` to null. With `summary === null`, the page rendered:

```
No pocket found.
[Open one] → /auth/register
```

Clicking that link sent you back to `/auth/register`, where re-submitting the form created another user account. Loop.

The bug was three things in one:
- The dashboard couldn't distinguish "load failed" from "no pocket exists"
- The fallback `listPockets()` only ran when there was no cached pocketId, so a stale/failed cached pocket wasn't recovered
- The "Open one" link pointed to `/auth/register` — destructive — when it should have offered retry

**What's now fixed in `apps/web/src/app/dashboard/page.tsx`:**
- `loadSummary()` always falls back to `listPockets()` if the cached pocket lookup fails
- Stale `pocketId` cache is cleared on 404, then we retry via `listPockets()`
- The empty state never redirects. It shows two real options: "Retry" (re-runs `loadSummary`) or "Create a pocket" (calls `POST /pockets` directly)
- A new `loadError` state surfaces the actual error message instead of pretending the pocket doesn't exist

After this fix: sign up → click around → it works. No more loops. If something genuinely breaks, you'll see the real error message.

## 2. Do we need an LLM? — partial answer, partial fix

Honest audit of where the LLM is actually used:

| Endpoint | Uses LLM? | Should it? |
|---|---|---|
| `/agent/chat` | yes | yes — conversational interface |
| `/agent/analyze` | yes | optional — could be simple stats |
| `/pay/agent` (with explicit `to`/`amount`) | yes | **NO** — wallet pick is deterministic |
| `/agent-pay` (signed external requests) | **was yes** | **NO** — recipient already specified |

The platform's most security-critical endpoint, `/agent-pay`, was making an LLM call on every signed external payment request. That's expensive, slow, and a single point of failure for the load-bearing feature.

**Fixed in this delta:**
- New `agentService.executePaymentDeterministic()` method that picks a wallet by simple rules: prefer default Solana wallet with sufficient balance in the right token, fall back to any signing-capable Solana wallet that does
- `/agent-pay` now uses the deterministic path. Zero LLM calls, sub-100ms response time, no `HF_TOKEN` dependency for the platform's core security feature

The chat tab still uses Kimi for natural-language requests like "send 1 USDC to alice." That's the right place for an LLM. Everywhere else now runs without one.

**What this means for ops:** if `HF_TOKEN` is missing or rate-limited, the chat tab fails gracefully but the entire platform — registry, grants, signed payments, audit log, x402 SDK — keeps working.

## 3. Audit: what's in the backend but not surfaced in the UI

Real gap report.

**Surfaced now:**
- Pocket / Wallets / Agents / Grants / Published agents / Chat / Activity / Policy / Docs / Settings — all live as nav items

**Was hidden, surfaced in this delta:**
- **x402 receipts.** Backend writes them, the SDK records them, but the only place they showed up was inside individual agent detail pages. Just added `/dashboard/receipts` — a global table view with totals, today's count, success rate, links to Solscan. This is the audit trail the SDK pitches as a feature; now users can see it. Sidebar link added.

**Still hidden, deliberately deferred:**
- **Funds (deposit/withdraw/import-wallet).** Backend has these endpoints, no UI page. Real gap. Adding would be ~1 day of work. Deferred because deposit flows are sensitive (need careful UX so users don't lose funds) and the wallet-add flow already covers most user needs.
- **Swap UI.** Jupiter integration works through the chat agent ("quote me a swap"), but there's no dedicated swap page. Deferred because the chat path covers it.

## 4. Docs page — confirmed in menu

The `/dashboard/docs` page from the previous part of this session is in place with the sidebar link. Code icon, second-to-last item before Settings. Has Quick Start, Spending Policy reference with denial codes, Agent Platform walkthrough (registry + signed payment requests), framework integration tabs (Solana Agent Kit, GOAT, ElizaOS, LangGraph), self-host instructions, and the API reference table.

Developers can find it inside the dashboard. They don't need a separate doc site.

## What's in the archive

### Modified files
- `apps/web/src/app/dashboard/page.tsx` — the dashboard load flow + retry-able empty state
- `apps/web/src/lib/api.ts` — adds `createPocket()` and `listReceipts()`
- `apps/web/src/components/layout/Sidebar.tsx` — adds Receipts nav item
- `apps/api/src/services/agent.service.ts` — adds `executePaymentDeterministic`
- `apps/api/src/routes/agent-pay.ts` — uses the deterministic path

### New files
- `apps/web/src/app/dashboard/receipts/page.tsx` — global x402 receipts page

## Stats after this delta

- **21 pages building** (was 19, added /dashboard/receipts and /dashboard/docs from this session)
- **61 API tests passing**
- **All typechecks clean**
- **No `@anthropic-ai/sdk` references** (Kimi K2 via HF Inference)
- **`/agent-pay` no longer calls LLM** — platform-critical endpoint is now deterministic and fast

## What's still genuinely missing

If you want a complete inventory:

**Real product gaps:**
- Funds page (deposit/withdraw UI)
- Swap UI (currently only via chat)
- Email verification + password reset
- Multi-pocket UI (backend supports 4 per user, frontend shows 1)
- Token discovery (we probe 7 hardcoded tokens, not the user's full SPL holdings)
- Wallet Standard wiring on `/dashboard/wallets/add`
- Webhook delivery to builders (outbound HMAC-signed webhooks)
- Real `pk_live_...` API keys (SDK still uses JWTs)

**Operational:**
- Sentry / observability
- Redis-backed rate limits + WS fan-out (single-instance only right now)
- RPC fallback layer
- Mobile EAS builds (Expo app exists, never tested on real phones)
- Chrome extension submitted to Web Store (manifest exists, not shipped)

**Strategic:**
- Demo video recorded
- 10 DMs to Solana agent builders
- Three responses read

The first list is real engineering work. The second is operational hardening. The third is the validation question that's been the single biggest blocker since session 18.

Today's last day. Walk through your own product end-to-end on the deployed environment using `docs/verification.md` Workflow A. Time it. The bug we just fixed was almost certainly only one of the things that's broken when a real user touches it. **Use yourself as the first user. Find what else breaks. Fix the worst three things. Ship.**
