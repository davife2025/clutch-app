import { Hono } from 'hono'
import { db } from '../db/client.js'
import { transactions } from '../db/schema.js'
import { eq } from 'drizzle-orm'

export const webhookRoutes = new Hono()

/**
 * POST /webhook/tx-confirm
 * Called by an external watcher or Helius/QuickNode webhook
 * when a pending transaction is confirmed on-chain.
 */
webhookRoutes.post('/tx-confirm', async (c) => {
  const { txHash, status } = await c.req.json().catch(() => ({} as any))

  if (!txHash) {
    return c.json({ error: { code: 'VALIDATION', message: 'txHash required' } }, 400)
  }

  const confirmedStatus = status === 'failed' ? 'failed' : 'confirmed'

  const [updated] = await db
    .update(transactions)
    .set({
      status: confirmedStatus as any,
      confirmedAt: new Date(),
    })
    .where(eq(transactions.txHash, txHash))
    .returning()

  if (!updated) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Transaction not found' } }, 404)
  }

  return c.json({ data: { txId: updated.id, status: confirmedStatus } })
})
