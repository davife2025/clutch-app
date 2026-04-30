import { Hono } from 'hono'
import { sign } from 'hono/jwt'
import { hash, compare } from 'bcryptjs'
import { db } from '../db/client.js'
import { users, pockets } from '../db/schema.js'
import { eq } from 'drizzle-orm'
import { registerSchema, loginSchema, validate } from '../lib/validation.js'

export const authRoutes = new Hono()

// ─── Register ─────────────────────────────────────────────────────────────────

authRoutes.post('/register', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const parsed = validate(body, registerSchema)
  if (!parsed.ok) {
    return c.json({ error: { code: 'VALIDATION', message: parsed.error } }, 400)
  }

  const existing = await db.query.users.findFirst({
    where: eq(users.email, parsed.data.email),
  })
  if (existing) {
    return c.json({ error: { code: 'CONFLICT', message: 'Email already registered' } }, 409)
  }

  const passwordHash = await hash(parsed.data.password, 12)
  const [user] = await db
    .insert(users)
    .values({ email: parsed.data.email, passwordHash })
    .returning()

  // Auto-create a default pocket
  const [pocket] = await db
    .insert(pockets)
    .values({ ownerId: user.id, name: 'My Pocket' })
    .returning()

  const token = await sign(
    { sub: user.id, email: user.email, iat: Math.floor(Date.now() / 1000) },
    process.env.JWT_SECRET!,
    'HS256',
  )

  return c.json({ data: { token, userId: user.id, pocketId: pocket.id } }, 201)
})

// ─── Login ────────────────────────────────────────────────────────────────────

authRoutes.post('/login', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const parsed = validate(body, loginSchema)
  if (!parsed.ok) {
    return c.json({ error: { code: 'VALIDATION', message: parsed.error } }, 400)
  }

  const user = await db.query.users.findFirst({
    where: eq(users.email, parsed.data.email),
  })
  if (!user) {
    return c.json(
      { error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } },
      401,
    )
  }

  const valid = await compare(parsed.data.password, user.passwordHash)
  if (!valid) {
    return c.json(
      { error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } },
      401,
    )
  }

  const token = await sign(
    { sub: user.id, email: user.email, iat: Math.floor(Date.now() / 1000) },
    process.env.JWT_SECRET!,
    'HS256',
  )

  return c.json({ data: { token, userId: user.id } })
})
