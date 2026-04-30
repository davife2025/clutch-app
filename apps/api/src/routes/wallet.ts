import { Hono } from 'hono'
import { db } from '../db/client.js'
import { pockets, wallets } from '../db/schema.js'
import { eq, and } from 'drizzle-orm'
import { authMiddleware } from '../middleware/auth.js'
import { addWalletSchema, validate } from '../lib/validation.js'
import { isValidAddress, MAX_WALLETS_PER_POCKET } from '@clutch/core'
import type { ChainId } from '@clutch/core'

type Env = { Variables: { userId: string } }

export const walletRoutes = new Hono<Env>()
walletRoutes.use('*', authMiddleware)

// ─── Add wallet to pocket ─────────────────────────────────────────────────────

walletRoutes.post('/:pocketId/wallets', async (c) => {
  const userId = c.get('userId')
  const pocketId = c.req.param('pocketId')

  const body = await c.req.json().catch(() => ({}))
  const parsed = validate(body, addWalletSchema)
  if (!parsed.ok) {
    return c.json({ error: { code: 'VALIDATION', message: parsed.error } }, 400)
  }
  const data = parsed.data

  // Verify pocket ownership
  const pocket = await db.query.pockets.findFirst({
    where: and(eq(pockets.id, pocketId), eq(pockets.ownerId, userId)),
    with: { wallets: true },
  })
  if (!pocket) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Pocket not found' } }, 404)
  }

  // Wallet limit check
  if (pocket.wallets.length >= MAX_WALLETS_PER_POCKET) {
    return c.json(
      { error: { code: 'LIMIT_REACHED', message: `Max ${MAX_WALLETS_PER_POCKET} wallets per pocket` } },
      400,
    )
  }

  // Address format validation
  if (!isValidAddress(data.address, data.chain as ChainId)) {
    return c.json(
      { error: { code: 'VALIDATION', message: `Invalid address for ${data.chain}` } },
      400,
    )
  }

  // First wallet in the pocket becomes default
  const isDefault = pocket.wallets.length === 0

  const [wallet] = await db
    .insert(wallets)
    .values({
      pocketId,
      address: data.address,
      chain: data.chain as any,
      type: data.type as any,
      connectionType: data.connectionType as any,
      label: data.label,
      isDefault,
    })
    .returning()

  return c.json({ data: { wallet } }, 201)
})

// ─── Remove wallet ────────────────────────────────────────────────────────────

walletRoutes.delete('/:pocketId/wallets/:walletId', async (c) => {
  const userId = c.get('userId')
  const pocketId = c.req.param('pocketId')
  const walletId = c.req.param('walletId')

  const pocket = await db.query.pockets.findFirst({
    where: and(eq(pockets.id, pocketId), eq(pockets.ownerId, userId)),
  })
  if (!pocket) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Pocket not found' } }, 404)
  }

  const [deleted] = await db
    .delete(wallets)
    .where(and(eq(wallets.id, walletId), eq(wallets.pocketId, pocketId)))
    .returning()

  if (!deleted) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Wallet not found' } }, 404)
  }

  return c.json({ data: { deleted: true } })
})

// ─── Set wallet as default ────────────────────────────────────────────────────

walletRoutes.patch('/:pocketId/wallets/:walletId/default', async (c) => {
  const userId = c.get('userId')
  const pocketId = c.req.param('pocketId')
  const walletId = c.req.param('walletId')

  const pocket = await db.query.pockets.findFirst({
    where: and(eq(pockets.id, pocketId), eq(pockets.ownerId, userId)),
  })
  if (!pocket) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Pocket not found' } }, 404)
  }

  await db.update(wallets).set({ isDefault: false }).where(eq(wallets.pocketId, pocketId))

  const [updated] = await db
    .update(wallets)
    .set({ isDefault: true })
    .where(and(eq(wallets.id, walletId), eq(wallets.pocketId, pocketId)))
    .returning()

  if (!updated) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Wallet not found' } }, 404)
  }

  return c.json({ data: { wallet: updated } })
})

// ─── List wallets for a pocket ────────────────────────────────────────────────

walletRoutes.get('/:pocketId/wallets', async (c) => {
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

  return c.json({ data: { wallets: pocket.wallets } })
})
