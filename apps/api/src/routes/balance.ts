import { Hono } from 'hono'
import { db } from '../db/client.js'
import { pockets, walletBalances } from '../db/schema.js'
import { eq, and } from 'drizzle-orm'
import { authMiddleware } from '../middleware/auth.js'
import { balanceService } from '../services/balance.service.js'
import { lamportsToSol } from '@clutch/core'

type Env = { Variables: { userId: string } }

export const balanceRoutes = new Hono<Env>()
balanceRoutes.use('*', authMiddleware)

/**
 * POST /balances/:pocketId/sync
 * Triggers a live on-chain balance refresh for all wallets in the pocket.
 */
balanceRoutes.post('/:pocketId/sync', async (c) => {
  const userId = c.get('userId')
  const pocketId = c.req.param('pocketId')

  const pocket = await db.query.pockets.findFirst({
    where: and(eq(pockets.id, pocketId), eq(pockets.ownerId, userId)),
  })
  if (!pocket) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Pocket not found' } }, 404)
  }

  // Fire-and-forget — client gets an immediate response
  balanceService.syncPocketBalances(pocketId).catch((err) => {
    console.error('[balance] sync error:', err)
  })

  return c.json({ data: { message: 'Balance sync started', pocketId } })
})

/**
 * GET /balances/:pocketId
 * Returns cached balances for all wallets + pocket total USD.
 */
balanceRoutes.get('/:pocketId', async (c) => {
  const userId = c.get('userId')
  const pocketId = c.req.param('pocketId')

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

  const totalUsd = await balanceService.getPocketTotalUsd(pocketId)

  return c.json({
    data: {
      pocketId,
      totalUsd,
      wallets: pocket.wallets.map((w) => ({
        walletId: w.id,
        address: w.address,
        chain: w.chain,
        label: w.label,
        balances: w.balances,
      })),
    },
  })
})

/**
 * GET /balances/:pocketId/summary
 * The unified pocket view — total USD, native SOL balance, per-wallet breakdown.
 * This is the core "pocket" endpoint.
 */
balanceRoutes.get('/:pocketId/summary', async (c) => {
  const userId = c.get('userId')
  const pocketId = c.req.param('pocketId')

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

  // Compute per-wallet USD totals
  const walletSummaries = pocket.wallets.map((w) => {
    const walletUsd = w.balances.reduce((sum, b) => sum + parseFloat(b.usdValue ?? '0'), 0)
    return {
      walletId: w.id,
      label: w.label ?? w.address.slice(0, 8),
      address: w.address,
      chain: w.chain,
      connectionType: w.connectionType,
      isDefault: w.isDefault,
      usdValue: Math.round(walletUsd * 100) / 100,
      tokens: w.balances.map((b) => ({
        token: b.token,
        amount: b.amount.toString(),
        decimals: b.decimals,
        usdValue: b.usdValue,
      })),
    }
  })

  const totalUsd = walletSummaries.reduce((sum, w) => sum + w.usdValue, 0)

  return c.json({
    data: {
      pocketId,
      name: pocket.name,
      totalUsd: Math.round(totalUsd * 100) / 100,
      nativeBalanceSol: lamportsToSol(pocket.nativeBalance),
      walletCount: pocket.wallets.length,
      wallets: walletSummaries,
    },
  })
})

/**
 * GET /balances/:pocketId/wallet/:walletId
 * Returns balances for a single wallet.
 */
balanceRoutes.get('/:pocketId/wallet/:walletId', async (c) => {
  const userId = c.get('userId')
  const pocketId = c.req.param('pocketId')
  const walletId = c.req.param('walletId')

  const pocket = await db.query.pockets.findFirst({
    where: and(eq(pockets.id, pocketId), eq(pockets.ownerId, userId)),
  })
  if (!pocket) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Pocket not found' } }, 404)
  }

  const bals = await db.query.walletBalances.findMany({
    where: eq(walletBalances.walletId, walletId),
  })

  return c.json({ data: { walletId, balances: bals } })
})
