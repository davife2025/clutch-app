import { Hono } from 'hono'
import { db } from '../db/client.js'
import { agentGrants, registeredAgents, pockets } from '../db/schema.js'
import { eq, and, desc } from 'drizzle-orm'
import { authMiddleware } from '../middleware/auth.js'

type Env = { Variables: { userId: string } }

export const grantsRoutes = new Hono<Env>()
grantsRoutes.use('*', authMiddleware)

/** Verify pocket ownership */
async function ownsPocket(userId: string, pocketId: string) {
  return db.query.pockets.findFirst({
    where: and(eq(pockets.id, pocketId), eq(pockets.ownerId, userId)),
  })
}

/** Verify a grant belongs to a pocket the user owns. Joins through pockets. */
async function ownsGrant(userId: string, grantId: string) {
  const row = await db
    .select({ grant: agentGrants, ownerId: pockets.ownerId })
    .from(agentGrants)
    .innerJoin(pockets, eq(agentGrants.pocketId, pockets.id))
    .where(eq(agentGrants.id, grantId))
    .limit(1)
  if (!row[0] || row[0].ownerId !== userId) return null
  return row[0].grant
}

// ─── GET /pockets/:id/grants — list grants for a pocket ───────────────────────

grantsRoutes.get('/:id/grants', async (c) => {
  const userId = c.get('userId')
  const pocketId = c.req.param('id')

  if (!(await ownsPocket(userId, pocketId))) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Pocket not found' } }, 404)
  }

  // Join with registered_agents so we can show agent name + tagline in the UI
  const rows = await db
    .select({
      grant: agentGrants,
      agent: {
        id: registeredAgents.id,
        name: registeredAgents.name,
        tagline: registeredAgents.tagline,
        logoUrl: registeredAgents.logoUrl,
        category: registeredAgents.category,
        publicKey: registeredAgents.publicKey,
      },
    })
    .from(agentGrants)
    .innerJoin(registeredAgents, eq(agentGrants.registeredAgentId, registeredAgents.id))
    .where(eq(agentGrants.pocketId, pocketId))
    .orderBy(desc(agentGrants.createdAt))

  return c.json({
    data: {
      grants: rows.map((r) => ({
        id: r.grant.id,
        agent: r.agent,
        maxPerTxUsd: r.grant.maxPerTxUsd !== null ? parseFloat(r.grant.maxPerTxUsd) : null,
        maxPerDayUsd: r.grant.maxPerDayUsd !== null ? parseFloat(r.grant.maxPerDayUsd) : null,
        allowedRecipients: parseList(r.grant.allowedRecipients),
        allowedTokens: parseList(r.grant.allowedTokens),
        expiresAt: r.grant.expiresAt?.toISOString() ?? null,
        status: r.grant.status,
        spentUsd: parseFloat(r.grant.spentUsd),
        lastUsedAt: r.grant.lastUsedAt?.toISOString() ?? null,
        createdAt: r.grant.createdAt.toISOString(),
      })),
    },
  })
})

// ─── POST /pockets/:id/grants — authorize an agent ────────────────────────────

grantsRoutes.post('/:id/grants', async (c) => {
  const userId = c.get('userId')
  const pocketId = c.req.param('id')

  if (!(await ownsPocket(userId, pocketId))) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Pocket not found' } }, 404)
  }

  const body = await c.req.json().catch(() => ({} as any))
  const {
    registeredAgentId,
    maxPerTxUsd,
    maxPerDayUsd,
    allowedRecipients,
    allowedTokens,
    expiresAt,
  } = body

  if (!registeredAgentId || typeof registeredAgentId !== 'string') {
    return c.json(
      { error: { code: 'VALIDATION', message: 'registeredAgentId required' } },
      400,
    )
  }

  // Verify the agent exists and is active
  const agent = await db.query.registeredAgents.findFirst({
    where: eq(registeredAgents.id, registeredAgentId),
  })
  if (!agent || agent.status === 'suspended') {
    return c.json(
      { error: { code: 'NOT_FOUND', message: 'Registered agent not found or suspended' } },
      404,
    )
  }

  // Validate numeric limits
  for (const [field, value] of [
    ['maxPerTxUsd', maxPerTxUsd],
    ['maxPerDayUsd', maxPerDayUsd],
  ] as const) {
    if (value !== undefined && value !== null) {
      if (typeof value !== 'number' || value < 0 || !isFinite(value)) {
        return c.json(
          {
            error: {
              code: 'VALIDATION',
              message: `${field} must be a non-negative number or null`,
            },
          },
          400,
        )
      }
    }
  }

  // Validate lists
  for (const [field, value] of [
    ['allowedRecipients', allowedRecipients],
    ['allowedTokens', allowedTokens],
  ] as const) {
    if (value !== undefined && value !== null) {
      if (!Array.isArray(value) || value.some((v) => typeof v !== 'string')) {
        return c.json(
          { error: { code: 'VALIDATION', message: `${field} must be an array of strings` } },
          400,
        )
      }
    }
  }

  // Validate expiration
  let expiresAtDate: Date | null = null
  if (expiresAt !== undefined && expiresAt !== null) {
    const d = new Date(expiresAt)
    if (isNaN(d.getTime()) || d.getTime() < Date.now()) {
      return c.json(
        { error: { code: 'VALIDATION', message: 'expiresAt must be a future date' } },
        400,
      )
    }
    expiresAtDate = d
  }

  // Upsert: if a grant exists for (pocket, agent), update it. Otherwise create.
  const existing = await db.query.agentGrants.findFirst({
    where: and(
      eq(agentGrants.pocketId, pocketId),
      eq(agentGrants.registeredAgentId, registeredAgentId),
    ),
  })

  const grantData = {
    pocketId,
    registeredAgentId,
    maxPerTxUsd: maxPerTxUsd != null ? String(maxPerTxUsd) : null,
    maxPerDayUsd: maxPerDayUsd != null ? String(maxPerDayUsd) : null,
    allowedRecipients: serializeList(allowedRecipients),
    allowedTokens: serializeList(allowedTokens),
    expiresAt: expiresAtDate,
    status: 'active' as const,
    updatedAt: new Date(),
  }

  if (existing) {
    const [updated] = await db
      .update(agentGrants)
      .set(grantData)
      .where(eq(agentGrants.id, existing.id))
      .returning()

    // If this was a revoked grant we're re-activating, bump the counter
    if (existing.status !== 'active') {
      await db
        .update(registeredAgents)
        .set({
          activeGrantsCount: agent.activeGrantsCount + 1,
        })
        .where(eq(registeredAgents.id, registeredAgentId))
    }

    return c.json({ data: { grant: updated } })
  }

  const [grant] = await db.insert(agentGrants).values(grantData).returning()

  // Increment the agent's active grant counter
  await db
    .update(registeredAgents)
    .set({ activeGrantsCount: agent.activeGrantsCount + 1 })
    .where(eq(registeredAgents.id, registeredAgentId))

  return c.json({ data: { grant } }, 201)
})

// ─── PATCH /grants/:id — update grant scope ───────────────────────────────────

grantsRoutes.patch('/grants/:id', async (c) => {
  const userId = c.get('userId')
  const grantId = c.req.param('id')

  const grant = await ownsGrant(userId, grantId)
  if (!grant) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Grant not found' } }, 404)
  }

  const body = await c.req.json().catch(() => ({} as any))
  const update: any = { updatedAt: new Date() }

  if ('maxPerTxUsd' in body) {
    if (body.maxPerTxUsd !== null && (typeof body.maxPerTxUsd !== 'number' || body.maxPerTxUsd < 0)) {
      return c.json({ error: { code: 'VALIDATION', message: 'invalid maxPerTxUsd' } }, 400)
    }
    update.maxPerTxUsd = body.maxPerTxUsd != null ? String(body.maxPerTxUsd) : null
  }

  if ('maxPerDayUsd' in body) {
    if (body.maxPerDayUsd !== null && (typeof body.maxPerDayUsd !== 'number' || body.maxPerDayUsd < 0)) {
      return c.json({ error: { code: 'VALIDATION', message: 'invalid maxPerDayUsd' } }, 400)
    }
    update.maxPerDayUsd = body.maxPerDayUsd != null ? String(body.maxPerDayUsd) : null
  }

  for (const field of ['allowedRecipients', 'allowedTokens'] as const) {
    if (field in body) {
      if (body[field] !== null && !Array.isArray(body[field])) {
        return c.json({ error: { code: 'VALIDATION', message: `invalid ${field}` } }, 400)
      }
      update[field] = serializeList(body[field])
    }
  }

  const [updated] = await db
    .update(agentGrants)
    .set(update)
    .where(eq(agentGrants.id, grantId))
    .returning()

  return c.json({ data: { grant: updated } })
})

// ─── DELETE /grants/:id — revoke a grant ──────────────────────────────────────

grantsRoutes.delete('/grants/:id', async (c) => {
  const userId = c.get('userId')
  const grantId = c.req.param('id')

  const grant = await ownsGrant(userId, grantId)
  if (!grant) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Grant not found' } }, 404)
  }

  // Only decrement the agent's counter if the grant was active
  if (grant.status === 'active') {
    const agent = await db.query.registeredAgents.findFirst({
      where: eq(registeredAgents.id, grant.registeredAgentId),
    })
    if (agent) {
      await db
        .update(registeredAgents)
        .set({ activeGrantsCount: Math.max(0, agent.activeGrantsCount - 1) })
        .where(eq(registeredAgents.id, agent.id))
    }
  }

  await db
    .update(agentGrants)
    .set({ status: 'revoked', updatedAt: new Date() })
    .where(eq(agentGrants.id, grantId))

  return c.json({ data: { id: grantId, revoked: true } })
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseList(value: string | null): string[] {
  if (!value) return []
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

function serializeList(arr: string[] | null | undefined): string | null {
  if (arr === undefined) return null
  if (arr === null || arr.length === 0) return null
  return arr.map((s) => String(s).trim()).filter(Boolean).join(',')
}
