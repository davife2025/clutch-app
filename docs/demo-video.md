# Clutch demo video

The 90-second video that becomes the artifact you tweet, post in Solana Discords, and DM to builders. This document tells you exactly how to produce it with QuickTime + iMovie + a free voiceover tool — no professional video editing required.

## Total time to produce

About 45 minutes if it's your first try. About 20 minutes once you've done it once.

## Equipment

- A Mac (QuickTime + iMovie, both free)
- A microphone (laptop built-in is fine, an external USB mic is better)
- Browser at 1280×720 minimum, dark mode
- Two browser tabs ready: clutch.app and a Solscan page for the success moment
- A Solana wallet with about $5 USDC for the live payment moment
- Free background music — coverr.co/music or freemusicarchive.org

## Pre-recording setup

1. Set your Mac display to 1920×1080 (System Preferences → Displays)
2. Hide your dock (System Preferences → Dock → Auto-hide)
3. Close all other apps and notifications (Do Not Disturb)
4. Open Clutch in a fresh incognito window so you start anonymous
5. Set the policy in advance: enabled, $5 per-tx, $20 daily — you'll re-enable it in the demo but having it pre-set means the success moment doesn't get blocked
6. Have one Solana address ready to paste (a wallet you own — `alice.sol` won't resolve yet)
7. QuickTime Player → File → New Screen Recording → record only a portion of the screen, sized to your browser window

## The script — 90 seconds total

### Shot 1 — The hook (8 seconds)

**On screen:** zoom into the Clutch landing hero. The "Wallets your AI won't drain" headline.

**Narration:** "AI agents on Solana run with full custody. One bad decision and the wallet drains. There's no audit trail. There's no way to revoke access without rotating the key."

### Shot 2 — The proof (10 seconds)

**On screen:** quick cut to the headline of the September 2024 Banana Gun article ("$3M drained from Telegram trading bot"). Three seconds. Then cut to the Solana docs warning ("your agent has a private key and thus can access the funds in your wallet"). Three seconds.

**Narration:** "Three million dollars lost when a bot got tricked. The Solana docs say it themselves — your agent has a private key, anyone who chats with it can probably get it to send your funds."

### Shot 3 — The pitch (5 seconds)

**On screen:** cut back to the Clutch hero, hold for two beats, then click "Try without signing up."

**Narration:** "Clutch is the payment layer between your AI agent and Solana. Spending limits, audit logs, x402 handling, one-click revocation."

### Shot 4 — Onboarding (12 seconds)

**On screen:** the brief loading state on `/auth/try`, then land on the dashboard. The cradle-bracket logo is visible. The "Spending guardrails are off" gold card sits below the balance.

**Narration:** "Sign-up is a single click. Anonymous account, real pocket, real wallets, no email needed. The first thing the dashboard shows is whether your guardrails are on."

### Shot 5 — Setting policy (15 seconds)

**On screen:** click into `/dashboard/policy`. Flip the toggle on. Enter $5 in per-tx limit. Enter $20 in daily limit. Click Save policy. See the "✓ Saved" confirmation.

**Narration:** "Spending policy. Per-transaction caps. Daily limits. Recipient allowlists if you want them. All enforced server-side before any chain interaction. Even if the agent hallucinates, even if the prompt gets injected, the chain never sees a transaction that violates your rules."

### Shot 6 — The live payment (15 seconds)

**On screen:** navigate to `/dashboard/agent`. Click Pay. Enter recipient address, enter "1" as amount, USDC. Click Pay. Watch the agent loading state for 3-5 seconds. Show the success card with the tx hash.

**Narration:** "The agent picks the right wallet, signs through the vault, and broadcasts on Solana. Real transaction, sub-second finality, fraction of a cent in fees."

### Shot 7 — The blocked attempt (12 seconds)

**On screen:** click Pay again. Enter the same recipient. Enter "10" as amount. Click Pay. Watch the moss-green Shield card appear: "Blocked by your spending policy — Transaction $10.00 exceeds the per-transaction limit of $5.00."

**Narration:** "Try to send more than the policy allows? The chain never sees it. The agent can't bypass guardrails. This is the difference between a wallet your agent has access to, and a wallet your agent operates inside."

### Shot 8 — The audit trail (8 seconds)

**On screen:** click into `/dashboard/activity`. Show both rows — the confirmed payment and the blocked attempt with the Shield icon and the rejection reason.

**Narration:** "Every payment, every denial, recorded. The audit trail is real, not a feature in the marketing."

### Shot 9 — The SDK (5 seconds)

**On screen:** show a code editor with the 5-line SDK example from the README. Or show the README scroll to the integration examples for Solana Agent Kit, GOAT, ElizaOS.

**Narration:** "Five lines to integrate. Drop into Solana Agent Kit, GOAT, ElizaOS, LangGraph, or any framework."

### Shot 10 — The close (5 seconds)

**On screen:** the Clutch logo on a clean dark background. URL: `clutch.app`. Optionally a small line: "x402 payments for Solana agents."

**Narration:** "Wallets your AI won't drain. Clutch dot app."

Hold for two beats. End.

## Recording approach

Record the screen actions and the voiceover separately. Don't try to narrate while doing the demo — your voice gets nervous and the demo gets clumsy.

1. **Record the screen first.** Run through all 10 shots silently in QuickTime. Don't worry about timing — just make sure each action is clean. If you flub something, redo just that shot. About 15 minutes.

2. **Record the voiceover next.** In QuickTime → File → New Audio Recording. Read the script straight through, in a calm voice, with a one-second pause between shots. Re-record if you stumble. About 5 minutes.

3. **Combine in iMovie.** Drop the screen recording on the timeline. Drop the voiceover above it. Slide the voiceover so it aligns with the right shots. Trim and stretch the screen-recording clips so each one matches the narration length. About 15 minutes.

4. **Add background music.** From coverr.co/music or freemusicarchive.org pick something instrumental, ambient, and quiet. Set the music track volume to about 15% so it doesn't compete with the voiceover. About 5 minutes.

5. **Export at 1080p.** iMovie → File → Share → File → 1080p. Save as `clutch-demo.mp4`. About 2 minutes.

## What good looks like

A good Clutch demo video has these properties:

- **Under 90 seconds.** Anything longer and Twitter doesn't replay it.
- **The denial moment is the hook.** Most demos show success. Ours shows a payment getting blocked, on purpose, by a system the user controls. That's the differentiated thing.
- **Real on-chain transaction.** Not a localhost demo. The Solscan link should resolve to a real tx.
- **No talking head.** This is an infrastructure product. Show the product, narrate it, end. No founder-on-camera moments.
- **Quiet.** Calm voice, soft music, no swooshes or stings. Trust the content to be interesting.

## Where to post it

Once exported:

1. Tweet it as a native video (don't link to YouTube — Twitter penalizes external embeds)
2. Post in r/solana with a brief written summary
3. Post in the SendAI Discord (#showcase channel if available, otherwise #general)
4. Post in the GOAT Discord
5. Post in the Crossmint Discord
6. DM it to 5-10 specific Solana agent builders with one line: "Built this — would you ever use it?"

The DMs are the highest-signal use of the video. They're how you get your first design partners.
