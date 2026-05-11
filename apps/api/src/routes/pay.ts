import { Hono } from 'hono'
import { db } from '../db/client.js'
import { pockets, transactions } from '../db/schema.js'
import { eq, and } from 'drizzle-orm'
import { authMiddleware } from '../middleware/auth.js'
import { agentService } from '../services/agent.service.js'
import { policyService } from '../services/policy.service.js'
import { priceService } from '../services/price.service.js'
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
 *     check spending policy →
 *     agent picks cheapest Solana route →
 *     execute →
 *     return tx hash
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

  // ─── Policy enforcement ────────────────────────────────────────────────────
  // Check the spending policy BEFORE the agent gets involved. This is the
  // critical safety guarantee — even a hallucinating agent can't bypass it.

  const tokenUpper = String(token).toUpperCase()
  const STABLES = new Set(['USDC', 'USDT', 'DAI'])
  let amountUsd: number

  if (STABLES.has(tokenUpper)) {
    amountUsd = Number(amount)
  } else {
    const price = await priceService.getUsdPrice(tokenUpper)
    amountUsd = price ? Number(amount) * price : 0
  }

  const decision = await policyService.evaluatePayment({
    pocketId,
    toAddress: String(to),
    token: tokenUpper,
    amountUsd,
  })

  if (!decision.allowed) {
    // Record the denial so the user has an audit trail in /activity.
    // Even denied attempts are valuable signal — "my agent tried this 3 times,
    // my policy caught it" is exactly the visibility we want to give users.
    try {
      const decimals = STABLES.has(tokenUpper) ? 6 : tokenUpper === 'SOL' ? 9 : 6
      await db.insert(transactions).values({
        pocketId,
        type: 'payment',
        status: 'policy_denied',
        fromAddress: pocket.id, // we didn't pick a wallet — use pocket id as placeholder
        toAddress: String(to),
        amount: humanToRaw(String(amount), decimals),
        token: String(token),
        chain: 'solana',
        memo: decision.reason ?? 'Policy denied',
      })
    } catch {
      // Audit log failure shouldn't block the response
    }

    return c.json(
      {
        error: {
          code: decision.code ?? 'POLICY_DENIED',
          message: decision.reason ?? 'Policy denied this payment',
          context: decision.context,
        },
      },
      403,
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
    if (err.message?.includes('HF_TOKEN') || err.status === 401) {
      return c.json(
        { error: { code: 'CONFIG_ERROR', message: 'AI agent not configured — set HF_TOKEN' } },
        503,
      )
    }
    return c.json({ error: { code: 'PAYMENT_ERROR', message: err.message } }, 500)
  }
})
