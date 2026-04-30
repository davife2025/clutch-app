import { Hono } from 'hono'
import { db } from '../db/client.js'
import { pockets, transactions } from '../db/schema.js'
import { eq, and } from 'drizzle-orm'
import { authMiddleware } from '../middleware/auth.js'
import { agentService } from '../services/agent.service.js'
import { humanToRaw } from '@clutch/core'
import type { ChainId } from '@clutch/core'
import { pushTxPending, pushTxConfirmed, pushBalanceUpdate } from '../realtime/manager.js'

type Env = { Variables: { userId: string } }

export const payRoutes = new Hono<Env>()
payRoutes.use('*', authMiddleware)

/**
 * POST /pockets/:id/pay/agent
 *
 * One-shot AI-routed payment:
 *   "Send 10 USDC to alice.sol" →
 *     agent checks all wallets →
 *     picks cheapest route →
 *     executes →
 *     returns tx hash
 *
 * This is the signature Clutch endpoint.
 */
payRoutes.post('/:id/pay/agent', async (c) => {
  const userId = c.get('userId')
  const pocketId = c.req.param('id')

  // Verify pocket ownership
  const pocket = await db.query.pockets.findFirst({
    where: and(eq(pockets.id, pocketId), eq(pockets.ownerId, userId)),
  })
  if (!pocket) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Pocket not found' } }, 404)
  }

  const body = await c.req.json().catch(() => ({} as any))
  const { to, amount, token, chain, memo } = body

  if (!to || !amount || !token) {
    return c.json(
      { error: { code: 'VALIDATION', message: 'to, amount, token required' } },
      400,
    )
  }

  // Hard guard: Solana only
  if (chain && chain !== 'solana') {
    return c.json(
      {
        error: {
          code: 'CHAIN_NOT_SUPPORTED',
          message: 'Clutch executes payments on Solana only. EVM wallets are read-only.',
          hint: 'Drop the `chain` field to let the agent route through Solana automatically.',
        },
      },
      400,
    )
  }

  try {
    const result = await agentService.executePayment(pocketId, {
      to,
      amount: String(amount),
      token,
      chain: 'solana',
      memo,
    })

    // Record the transaction
    const decimals = token === 'SOL' ? 9 : 6
    await db.insert(transactions).values({
      pocketId,
      walletId: result.decision.walletId,
      type: 'payment',
      status: result.status === 'confirmed' ? 'confirmed' : 'pending',
      fromAddress: result.fromAddress,
      toAddress: to,
      amount: humanToRaw(String(amount), decimals),
      token,
      chain: (result.chain ?? 'solana') as any,
      txHash: result.txHash || undefined,
      memo,
      confirmedAt: result.status === 'confirmed' ? new Date() : undefined,
    })

    // Push real-time events to all sockets owned by this user
    if (result.txHash) {
      if (result.status === 'confirmed') {
        pushTxConfirmed(userId, { txHash: result.txHash, pocketId, status: 'confirmed' })
      } else {
        pushTxPending(userId, { txHash: result.txHash, pocketId })
      }
    }
    // Re-sync balances in the background
    pushBalanceUpdate(userId, pocketId).catch(() => {})

    return c.json({
      data: {
        txHash: result.txHash,
        chain: result.chain,
        fromAddress: result.fromAddress,
        toAddress: to,
        amount,
        token,
        status: result.status,
        reasoning: result.decision.reasoning,
        walletUsed: result.decision.walletId,
      },
    })
  } catch (err: any) {
    if (err.message?.includes('ANTHROPIC_API_KEY')) {
      return c.json(
        { error: { code: 'CONFIG_ERROR', message: 'AI agent not configured' } },
        503,
      )
    }
    return c.json({ error: { code: 'PAYMENT_ERROR', message: err.message } }, 500)
  }
})
