import { Hono } from 'hono'
import { db } from '../db/client.js'
import { x402Receipts, pockets } from '../db/schema.js'
import { eq, and, desc } from 'drizzle-orm'
import { authMiddleware } from '../middleware/auth.js'

type Env = { Variables: { userId: string } }

export const receiptsRoutes = new Hono<Env>()
receiptsRoutes.use('*', authMiddleware)

/** Verify pocket ownership */
async function ownsPocket(userId: string, pocketId: string) {
  return db.query.pockets.findFirst({
    where: and(eq(pockets.id, pocketId), eq(pockets.ownerId, userId)),
  })
}

// ─── GET /pockets/:id/receipts ────────────────────────────────────────────────

receiptsRoutes.get('/:id/receipts', async (c) => {
  const userId = c.get('userId')
  const pocketId = c.req.param('id')

  const pocket = await ownsPocket(userId, pocketId)
  if (!pocket) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Pocket not found' } }, 404)
  }

  const limit = Math.min(parseInt(c.req.query('limit') ?? '50', 10), 200)

  const rows = await db.query.x402Receipts.findMany({
    where: eq(x402Receipts.pocketId, pocketId),
    orderBy: [desc(x402Receipts.paidAt)],
    limit,
  })

  return c.json({
    data: {
      receipts: rows.map((r) => ({
        id: r.id,
        resourceUrl: r.resourceUrl,
        method: r.method,
        txHash: r.txHash,
        amount: r.amount.toString(),
        token: r.token,
        amountUsd: r.amountUsd,
        payTo: r.payTo,
        finalStatus: r.finalStatus,
        succeeded: r.succeeded,
        paidAt: r.paidAt.toISOString(),
        explorerUrl: `https://solscan.io/tx/${r.txHash}`,
      })),
    },
  })
})

// ─── POST /pockets/:id/receipts ───────────────────────────────────────────────
//
// Record an x402 payment receipt. Called by the SDK after a paywalled fetch
// completes — distinct from /pay/agent because receipts are bound to a URL.

receiptsRoutes.post('/:id/receipts', async (c) => {
  const userId = c.get('userId')
  const pocketId = c.req.param('id')

  const pocket = await ownsPocket(userId, pocketId)
  if (!pocket) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Pocket not found' } }, 404)
  }

  const body = await c.req.json().catch(() => ({} as any))
  const { resourceUrl, method, txHash, amount, token, payTo, amountUsd, finalStatus, succeeded, challenge } =
    body

  if (!resourceUrl || !txHash || !amount || !token || !payTo) {
    return c.json(
      {
        error: {
          code: 'VALIDATION',
          message: 'resourceUrl, txHash, amount, token, payTo required',
        },
      },
      400,
    )
  }

  const [receipt] = await db
    .insert(x402Receipts)
    .values({
      pocketId,
      resourceUrl: String(resourceUrl),
      method: String(method ?? 'GET'),
      txHash: String(txHash),
      amount: BigInt(amount),
      token: String(token).toUpperCase(),
      payTo: String(payTo),
      amountUsd: amountUsd != null ? String(amountUsd) : null,
      finalStatus: finalStatus != null ? Number(finalStatus) : null,
      succeeded: Boolean(succeeded),
      challenge: challenge ? JSON.stringify(challenge) : null,
    })
    .returning()

  return c.json(
    {
      data: {
        receipt: {
          id: receipt.id,
          resourceUrl: receipt.resourceUrl,
          txHash: receipt.txHash,
          paidAt: receipt.paidAt.toISOString(),
        },
      },
    },
    201,
  )
})

// ─── GET /pockets/:id/receipts/:receiptId ─────────────────────────────────────

receiptsRoutes.get('/:id/receipts/:receiptId', async (c) => {
  const userId = c.get('userId')
  const pocketId = c.req.param('id')
  const receiptId = c.req.param('receiptId')

  const pocket = await ownsPocket(userId, pocketId)
  if (!pocket) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Pocket not found' } }, 404)
  }

  const receipt = await db.query.x402Receipts.findFirst({
    where: and(eq(x402Receipts.id, receiptId), eq(x402Receipts.pocketId, pocketId)),
  })

  if (!receipt) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Receipt not found' } }, 404)
  }

  return c.json({
    data: {
      receipt: {
        id: receipt.id,
        resourceUrl: receipt.resourceUrl,
        method: receipt.method,
        txHash: receipt.txHash,
        amount: receipt.amount.toString(),
        token: receipt.token,
        amountUsd: receipt.amountUsd,
        payTo: receipt.payTo,
        finalStatus: receipt.finalStatus,
        succeeded: receipt.succeeded,
        challenge: receipt.challenge ? JSON.parse(receipt.challenge) : null,
        paidAt: receipt.paidAt.toISOString(),
        explorerUrl: `https://solscan.io/tx/${receipt.txHash}`,
      },
    },
  })
})
