import { Hono } from 'hono'
import { db } from '../db/client.js'
import { pockets } from '../db/schema.js'
import { eq, and } from 'drizzle-orm'
import { authMiddleware } from '../middleware/auth.js'
import { createPocketSchema, validate } from '../lib/validation.js'
import { lamportsToSol, MAX_POCKETS_PER_USER } from '@clutch/core'

type Env = { Variables: { userId: string } }

export const pocketRoutes = new Hono<Env>()
pocketRoutes.use('*', authMiddleware)

// ─── List pockets ─────────────────────────────────────────────────────────────

pocketRoutes.get('/', async (c) => {
  const userId = c.get('userId')

  const userPockets = await db.query.pockets.findMany({
    where: eq(pockets.ownerId, userId),
    with: { wallets: true },
  })

  return c.json({
    data: {
      pockets: userPockets.map((p) => ({
        ...p,
        nativeBalanceSol: lamportsToSol(p.nativeBalance),
      })),
    },
  })
})

// ─── Get pocket with wallets + balances ───────────────────────────────────────

pocketRoutes.get('/:id', async (c) => {
  const userId = c.get('userId')
  const pocketId = c.req.param('id')

  const pocket = await db.query.pockets.findFirst({
    where: and(eq(pockets.id, pocketId), eq(pockets.ownerId, userId)),
    with: {
      wallets: {
        with: { balances: true },
      },
    },
  })

  if (!pocket) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Pocket not found' } }, 404)
  }

  return c.json({
    data: {
      pocket: {
        ...pocket,
        nativeBalanceSol: lamportsToSol(pocket.nativeBalance),
      },
    },
  })
})

// ─── Create pocket ────────────────────────────────────────────────────────────

pocketRoutes.post('/', async (c) => {
  const userId = c.get('userId')
  const body = await c.req.json().catch(() => ({}))
  const parsed = validate(body, createPocketSchema)
  if (!parsed.ok) {
    return c.json({ error: { code: 'VALIDATION', message: parsed.error } }, 400)
  }

  // Enforce per-user pocket limit
  const existing = await db.query.pockets.findMany({
    where: eq(pockets.ownerId, userId),
  })
  if (existing.length >= MAX_POCKETS_PER_USER) {
    return c.json(
      {
        error: {
          code: 'LIMIT_REACHED',
          message: `Max ${MAX_POCKETS_PER_USER} pockets per user`,
        },
      },
      400,
    )
  }

  const [pocket] = await db
    .insert(pockets)
    .values({ ownerId: userId, name: parsed.data.name })
    .returning()

  return c.json({ data: { pocket } }, 201)
})

// ─── Delete pocket ────────────────────────────────────────────────────────────

pocketRoutes.delete('/:id', async (c) => {
  const userId = c.get('userId')
  const pocketId = c.req.param('id')

  const pocket = await db.query.pockets.findFirst({
    where: and(eq(pockets.id, pocketId), eq(pockets.ownerId, userId)),
  })

  if (!pocket) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Pocket not found' } }, 404)
  }

  await db.delete(pockets).where(eq(pockets.id, pocketId))
  return c.json({ data: { deleted: true } })
})
