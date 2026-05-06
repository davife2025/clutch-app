import { Hono } from 'hono'
import { db } from '../db/client.js'
import { transactions, pockets } from '../db/schema.js'
import { eq } from 'drizzle-orm'
import { pushTxConfirmed, pushBalanceUpdate } from '../realtime/manager.js'
import { balanceService } from '../services/balance.service.js'
import type { ChainId } from '@clutch/core'

export const webhookRoutes = new Hono()

/**
 * POST /webhook/tx-confirm
 *
 * Mark a pending transaction as confirmed/failed.
 *
 * SECURITY: Verifies the txHash actually exists on-chain BEFORE flipping
 * the database status. The caller cannot lie about confirmation — we ask
 * the RPC. They can only nudge us to re-check.
 *
 * For Helius/QuickNode webhooks: those services sign their callbacks; in
 * production wire up signature verification here too.
 */
webhookRoutes.post('/tx-confirm', async (c) => {
  const { txHash } = await c.req.json().catch(() => ({} as any))

  if (!txHash || typeof txHash !== 'string') {
    return c.json({ error: { code: 'VALIDATION', message: 'txHash required' } }, 400)
  }

  // Find the transaction in our DB
  const tx = await db.query.transactions.findFirst({
    where: eq(transactions.txHash, txHash),
  })

  if (!tx) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Transaction not found' } }, 404)
  }

  // If already terminal, don't re-process — idempotent
  if (tx.status === 'confirmed' || tx.status === 'failed') {
    return c.json({ data: { txId: tx.id, status: tx.status, alreadyFinalized: true } })
  }

  // Verify on-chain — DO NOT TRUST THE CALLER
  const verified = await verifyOnChain(txHash, tx.chain as ChainId)
  if (verified === 'unknown') {
    // Not yet visible on-chain — keep as pending, return 202
    return c.json(
      { data: { txId: tx.id, status: 'pending', verified: false } },
      202,
    )
  }

  const newStatus: 'confirmed' | 'failed' = verified === 'success' ? 'confirmed' : 'failed'

  const [updated] = await db
    .update(transactions)
    .set({ status: newStatus, confirmedAt: new Date() })
    .where(eq(transactions.txHash, txHash))
    .returning()

  // Push real-time event
  const pocket = await db.query.pockets.findFirst({
    where: eq(pockets.id, tx.pocketId),
  })
  if (pocket) {
    pushTxConfirmed(pocket.ownerId, {
      txHash,
      pocketId: tx.pocketId,
      status: newStatus,
    })
    pushBalanceUpdate(pocket.ownerId, tx.pocketId).catch(() => {})
  }

  return c.json({ data: { txId: updated.id, status: newStatus, verified: true } })
})

/**
 * Check the chain for the actual transaction status.
 * Returns 'success' | 'failed' | 'unknown' (not yet visible).
 */
async function verifyOnChain(txHash: string, chain: ChainId): Promise<'success' | 'failed' | 'unknown'> {
  try {
    const connector = balanceService.getRegistry().get(chain)
    if (!connector) return 'unknown'

    if (chain === 'solana') {
      // Solana: use connection.getSignatureStatus
      const { Connection } = await import('@solana/web3.js')
      const rpcUrl = process.env.SOLANA_RPC_URL ?? 'https://api.mainnet-beta.solana.com'
      const conn = new Connection(rpcUrl, 'confirmed')
      const status = await conn.getSignatureStatus(txHash, { searchTransactionHistory: true })

      if (!status?.value) return 'unknown'
      const confStatus = status.value.confirmationStatus
      if (confStatus !== 'confirmed' && confStatus !== 'finalized') return 'unknown'

      return status.value.err ? 'failed' : 'success'
    }

    // EVM chains aren't expected here — Clutch only signs on Solana —
    // but handle them gracefully if a webhook arrives anyway
    return 'unknown'
  } catch (err) {
    console.error('[webhook] on-chain verification failed:', err)
    return 'unknown'
  }
}
