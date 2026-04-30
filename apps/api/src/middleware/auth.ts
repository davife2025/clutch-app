import type { Context, Next } from 'hono'
import { verify } from 'hono/jwt'

export async function authMiddleware(c: Context, next: Next) {
  const auth = c.req.header('Authorization')
  if (!auth?.startsWith('Bearer ')) {
    return c.json({ error: { code: 'UNAUTHORIZED', message: 'Missing token' } }, 401)
  }

  const token = auth.slice(7)
  try {
    const payload = await verify(token, process.env.JWT_SECRET!, 'HS256')
    c.set('userId', payload.sub as string)
    await next()
  } catch {
    return c.json({ error: { code: 'INVALID_TOKEN', message: 'Invalid or expired token' } }, 401)
  }
}
