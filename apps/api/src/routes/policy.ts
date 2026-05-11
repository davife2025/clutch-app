import { Hono } from 'hono'
import { db } from '../db/client.js'
import { pockets } from '../db/schema.js'
import { eq, and } from 'drizzle-orm'
import { authMiddleware } from '../middleware/auth.js'
import { policyService } from '../services/policy.service.js'

type Env = { Variables: { userId: string } }

export const policyRoutes = new Hono<Env>()
policyRoutes.use('*', authMiddleware)

/** Verify the user owns the pocket. Returns the pocket or null. */
async function ownsPocket(userId: string, pocketId: string) {
  return db.query.pockets.findFirst({
    where: and(eq(pockets.id, pocketId), eq(pockets.ownerId, userId)),
  })
}

// ─── GET /pockets/:id/policy ──────────────────────────────────────────────────

policyRoutes.get('/:id/policy', async (c) => {
  const userId = c.get('userId')
  const pocketId = c.req.param('id')

  const pocket = await ownsPocket(userId, pocketId)
  if (!pocket) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Pocket not found' } }, 404)
  }

  const policy = (await policyService.getPolicy(pocketId)) ?? {
    enabled: false,
    maxPerTxUsd: null,
    maxPerDayUsd: null,
    allowedRecipients: [],
    blockedRecipients: [],
    allowedTokens: [],
    blockedTokens: [],
  }

  const spentToday = await policyService.spentTodayUsd(pocketId)

  return c.json({ data: { policy, spentTodayUsd: Math.round(spentToday * 100) / 100 } })
})

// ─── PUT /pockets/:id/policy ──────────────────────────────────────────────────

policyRoutes.put('/:id/policy', async (c) => {
  const userId = c.get('userId')
  const pocketId = c.req.param('id')

  const pocket = await ownsPocket(userId, pocketId)
  if (!pocket) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Pocket not found' } }, 404)
  }

  const body = await c.req.json().catch(() => ({} as any))

  // Light validation — we accept partial updates
  const update: Parameters<typeof policyService.upsertPolicy>[1] = {}

  if ('enabled' in body) {
    if (typeof body.enabled !== 'boolean') {
      return c.json({ error: { code: 'VALIDATION', message: 'enabled must be boolean' } }, 400)
    }
    update.enabled = body.enabled
  }

  if ('maxPerTxUsd' in body) {
    if (body.maxPerTxUsd !== null && (typeof body.maxPerTxUsd !== 'number' || body.maxPerTxUsd < 0)) {
      return c.json(
        { error: { code: 'VALIDATION', message: 'maxPerTxUsd must be a non-negative number or null' } },
        400,
      )
    }
    update.maxPerTxUsd = body.maxPerTxUsd
  }

  if ('maxPerDayUsd' in body) {
    if (
      body.maxPerDayUsd !== null &&
      (typeof body.maxPerDayUsd !== 'number' || body.maxPerDayUsd < 0)
    ) {
      return c.json(
        { error: { code: 'VALIDATION', message: 'maxPerDayUsd must be a non-negative number or null' } },
        400,
      )
    }
    update.maxPerDayUsd = body.maxPerDayUsd
  }

  for (const field of [
    'allowedRecipients',
    'blockedRecipients',
    'allowedTokens',
    'blockedTokens',
  ] as const) {
    if (field in body) {
      if (!Array.isArray(body[field])) {
        return c.json(
          { error: { code: 'VALIDATION', message: `${field} must be an array of strings` } },
          400,
        )
      }
      if (body[field].some((v: unknown) => typeof v !== 'string')) {
        return c.json(
          { error: { code: 'VALIDATION', message: `${field} must contain only strings` } },
          400,
        )
      }
      update[field] = body[field]
    }
  }

  const policy = await policyService.upsertPolicy(pocketId, update)
  return c.json({ data: { policy } })
})
