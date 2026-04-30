import type { Context, Next } from 'hono'

export async function errorMiddleware(c: Context, next: Next) {
  try {
    await next()
  } catch (err) {
    console.error('[clutch] unhandled error:', err)
    const message = err instanceof Error ? err.message : 'Internal server error'
    return c.json({ error: { code: 'INTERNAL_ERROR', message } }, 500)
  }
}
