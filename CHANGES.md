# React error #438 fix — Next.js 14 params handling

Three files. I wrote them for Next.js 15's `use(params)` pattern, but you're on Next.js 14 which doesn't support that. In Next 14, `params` is just an object you destructure directly.

## Files fixed
- `apps/web/src/app/dashboard/agents/[id]/page.tsx`
- `apps/web/src/app/dashboard/authorize/[id]/page.tsx`
- `apps/web/src/app/registry/[id]/page.tsx`

## Apply
Drop in. Push. Vercel rebuilds in ~30 sec. Hard-refresh browser. Click any agent — should load.

That's it. Go record.
