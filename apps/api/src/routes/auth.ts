import { Hono } from 'hono'
import { sign } from 'hono/jwt'
import { hash, compare } from 'bcryptjs'
import { db } from '../db/client.js'
import { users, pockets } from '../db/schema.js'
import { eq } from 'drizzle-orm'
import { registerSchema, loginSchema, validate } from '../lib/validation.js'
import { authMiddleware } from '../middleware/auth.js'

type Env = { Variables: { userId: string } }

export const authRoutes = new Hono<Env>()

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function issueToken(userId: string, email: string | null): Promise<string> {
  return sign(
    { sub: userId, email: email ?? null, iat: Math.floor(Date.now() / 1000) },
    process.env.JWT_SECRET!,
    'HS256',
  )
}

async function createDefaultPocket(userId: string): Promise<{ id: string }> {
  const [pocket] = await db
    .insert(pockets)
    .values({ ownerId: userId, name: 'My Pocket' })
    .returning({ id: pockets.id })
  return pocket
}

// ─── POST /auth/anonymous ─────────────────────────────────────────────────────
//
// Try-before-signup. Creates a real account with no email/password.
// Real pocket, real wallets, real transactions — fully usable.
// User can later POST /auth/upgrade to attach an email + password.

authRoutes.post('/anonymous', async (c) => {
  const [user] = await db
    .insert(users)
    .values({ email: null, passwordHash: null, isAnonymous: true })
    .returning()

  const pocket = await createDefaultPocket(user.id)
  const token = await issueToken(user.id, null)

  return c.json(
    {
      data: {
        token,
        userId: user.id,
        pocketId: pocket.id,
        isAnonymous: true,
      },
    },
    201,
  )
})

// ─── POST /auth/upgrade ───────────────────────────────────────────────────────
//
// Convert an anonymous account to a permanent one with email + password.
// Preserves the userId, pockets, wallets, transaction history.
// Requires the anonymous JWT in Authorization header.

authRoutes.post('/upgrade', authMiddleware, async (c) => {
  const userId = c.get('userId')
  const body = await c.req.json().catch(() => ({}))
  const parsed = validate(body, registerSchema)
  if (!parsed.ok) {
    return c.json({ error: { code: 'VALIDATION', message: parsed.error } }, 400)
  }

  const user = await db.query.users.findFirst({ where: eq(users.id, userId) })
  if (!user) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'User not found' } }, 404)
  }

  if (!user.isAnonymous) {
    return c.json(
      { error: { code: 'ALREADY_UPGRADED', message: 'Account already has credentials' } },
      400,
    )
  }

  // Email must be unique across the table
  const existing = await db.query.users.findFirst({
    where: eq(users.email, parsed.data.email),
  })
  if (existing) {
    return c.json({ error: { code: 'CONFLICT', message: 'Email already registered' } }, 409)
  }

  const passwordHash = await hash(parsed.data.password, 12)
  const [updated] = await db
    .update(users)
    .set({
      email: parsed.data.email,
      passwordHash,
      isAnonymous: false,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId))
    .returning()

  const token = await issueToken(updated.id, updated.email)

  return c.json({
    data: { token, userId: updated.id, isAnonymous: false },
  })
})

// ─── POST /auth/register ──────────────────────────────────────────────────────

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
    .values({
      email: parsed.data.email,
      passwordHash,
      isAnonymous: false,
    })
    .returning()

  const pocket = await createDefaultPocket(user.id)
  const token = await issueToken(user.id, user.email)

  return c.json(
    { data: { token, userId: user.id, pocketId: pocket.id, isAnonymous: false } },
    201,
  )
})

// ─── POST /auth/login ─────────────────────────────────────────────────────────

authRoutes.post('/login', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const parsed = validate(body, loginSchema)
  if (!parsed.ok) {
    return c.json({ error: { code: 'VALIDATION', message: parsed.error } }, 400)
  }

  const user = await db.query.users.findFirst({
    where: eq(users.email, parsed.data.email),
  })

  // Generic error for both "no such user" and "wrong password" — don't leak which
  if (!user || !user.passwordHash) {
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

  const token = await issueToken(user.id, user.email)
  return c.json({ data: { token, userId: user.id, isAnonymous: false } })
})
