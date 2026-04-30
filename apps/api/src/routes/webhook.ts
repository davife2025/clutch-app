import { Hono } from 'hono'
import { db } from '../db/client.js'
import { transactions, pockets } from '../db/schema.js'
import { eq } from 'drizzle-orm'
import { pushTxConfirmed, pushBalanceUpdate } from '../realtime/manager.js'

export const webhookRoutes = new Hono()

/**
 * POST /webhook/tx-confirm
 * Called by an external watcher or Helius/QuickNode webhook
 * when a pending transaction is confirmed on-chain.
 *
 * Pushes a tx_confirmed event over WebSocket and triggers a balance refresh.
 */
webhookRoutes.post('/tx-confirm', async (c) => {
  const { txHash, status } = await c.req.json().catch(() => ({} as any))

  if (!txHash) {
    return c.json({ error: { code: 'VALIDATION', message: 'txHash required' } }, 400)
  }

  const confirmedStatus = (status === 'failed' ? 'failed' : 'confirmed') as
    | 'confirmed'
    | 'failed'

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

  // Find the pocket owner so we can push to their sockets
  const pocket = await db.query.pockets.findFirst({
    where: eq(pockets.id, updated.pocketId),
  })

  if (pocket) {
    pushTxConfirmed(pocket.ownerId, {
      txHash,
      pocketId: updated.pocketId,
      status: confirmedStatus,
    })
    // Re-sync balance (fire and forget)
    pushBalanceUpdate(pocket.ownerId, updated.pocketId).catch(() => {})
  }

  return c.json({ data: { txId: updated.id, status: confirmedStatus } })
})
