import { Hono } from 'hono'
import { db } from '../db/client.js'
import { transactions, pockets } from '../db/schema.js'
import { eq, and, desc } from 'drizzle-orm'
import { authMiddleware } from '../middleware/auth.js'

type Env = { Variables: { userId: string } }

export const transactionRoutes = new Hono<Env>()
transactionRoutes.use('*', authMiddleware)

// ─── Get transaction history for a pocket ─────────────────────────────────────

transactionRoutes.get('/:pocketId', async (c) => {
  const userId = c.get('userId')
  const pocketId = c.req.param('pocketId')

  const pocket = await db.query.pockets.findFirst({
    where: and(eq(pockets.id, pocketId), eq(pockets.ownerId, userId)),
  })
  if (!pocket) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Pocket not found' } }, 404)
  }

  const limit = Math.min(Number(c.req.query('limit') ?? 50), 100)

  const txns = await db.query.transactions.findMany({
    where: eq(transactions.pocketId, pocketId),
    orderBy: [desc(transactions.createdAt)],
    limit,
  })

  return c.json({
    data: {
      transactions: txns.map((tx) => ({
        ...tx,
        amount: tx.amount.toString(),
      })),
    },
  })
})
