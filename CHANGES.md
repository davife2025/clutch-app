# "Click Grants → bounce to landing → log in again" — the real diagnosis

## Why this kept happening

This is the third auth-related bug today. I want to be honest about what was actually wrong because the previous fixes patched symptoms, not the cause.

The real bug: **our own API client was wiping the user's token whenever ANY single request returned 401.** The 401 handler was added as a "fix" for expired tokens, but it was too aggressive — if one broken endpoint returned 401, the entire session was destroyed.

So when you clicked Grants:

1. The page mounted, called `GET /pockets/:id/grants`
2. That endpoint returned 401 for some reason (likely the `agent_grants` table doesn't exist yet in your database, OR `JWT_SECRET` on Render is different from the one that signed your token — both produce 401s)
3. Our 401 handler ran `clearToken()` — **wiped your localStorage token**
4. On the next render, `useAuthGuard` checked `isAuthenticated()` — false because token was gone — redirected you to `/auth/login`
5. From your perspective: "I clicked Grants and got bounced to login"

The token was structurally fine the whole time. Our own client destroyed it.

## What the fix does

Two files, two changes.

**`apps/web/src/lib/api.ts`** — removed the `clearToken()` call from the 401 handler. A 401 from one endpoint no longer wipes your session. The 401 is logged to the console with the path that triggered it, so you can see in DevTools which endpoint is unhappy without losing your session.

**`apps/web/src/app/dashboard/grants/page.tsx`** — now surfaces errors instead of silently showing an empty list. When the grants API call fails, you'll see a rust-colored card explaining what happened, with a "Retry" button and guidance: "If this says Unauthorized, the API server may have been redeployed with a different JWT secret. Sign out and back in to refresh your session."

This pattern is what other tabs already do (the Pocket page from earlier). The Grants page just never had the same defensive handling.

## What this does NOT fix

If the underlying 401 is real — the JWT_SECRET on Render really did change, or the `agent_grants` table really doesn't exist — the Grants page will still show the error card. The bug we just fixed is "the error card destroys your session." Now you get a useful error message, can hit Retry, or can sign back in cleanly. But the underlying cause of the 401 still needs handling.

## How to figure out what's actually causing the 401

After deploying this fix, open Grants and check your browser DevTools console. You'll see something like:

```
[api] 401 from GET /pockets/abc123/grants — token may be stale, but not clearing yet
```

Then open the Network tab in DevTools, click that request, look at the Response. The error body tells you the cause:

- `{"error":{"code":"UNAUTHORIZED","message":"Missing token"}}` — your token wasn't sent (browser problem, retry)
- `{"error":{"code":"INVALID_TOKEN","message":"Invalid or expired token"}}` — JWT_SECRET mismatch on Render. Sign out, sign back in to get a fresh token signed with the current secret.
- `{"error":{"code":"NOT_FOUND",...}}` — pocketId is wrong
- 500 (not 401) — the `agent_grants` table doesn't exist. Run the database migration.

## How to apply

Drop both files in, push, redeploy. Two-minute fix.

## Why I want to flag this

You've been hitting auth bugs all day. Some were real (the original dashboard signup → register loop, fixed). Some were caused by my own fixes being too eager. This was one of the latter — I added the 401 handler thinking it would fix expired tokens, but I made it too aggressive and it created a worse bug.

If after applying this fix you STILL see "click Grants → bounce to landing," that means the auth guard itself is the problem, not just the 401 handler. In that case send me a fresh DevTools console + network log when you click Grants and I'll trace it from there. But based on the pattern, the over-aggressive 401 handler accounts for everything you described.

Sorry for the looping. Auth state in client-side React apps is genuinely tricky — every fix opens a different edge case. This one I'm confident about because the cause is fully reproducible from reading the code, not guessing.
