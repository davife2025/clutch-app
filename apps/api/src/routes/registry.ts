import { Hono } from 'hono'
import { db } from '../db/client.js'
import { registeredAgents, users } from '../db/schema.js'
import { eq, and, desc, sql, inArray } from 'drizzle-orm'
import { authMiddleware } from '../middleware/auth.js'

type Env = { Variables: { userId: string } }

// ─── Public registry routes (no auth required) ────────────────────────────────

export const registryPublicRoutes = new Hono()

/**
 * GET /registry/agents
 * Browse the agent directory. Returns active agents only.
 * Optional filters: ?category=trading&search=foo&sort=popular
 */
registryPublicRoutes.get('/agents', async (c) => {
  const category = c.req.query('category')
  const search = c.req.query('search')?.trim()
  const sort = c.req.query('sort') ?? 'popular'

  const conditions = [eq(registeredAgents.status, 'active')]
  if (category) conditions.push(eq(registeredAgents.category, category))

  let query = db
    .select({
      id: registeredAgents.id,
      name: registeredAgents.name,
      tagline: registeredAgents.tagline,
      logoUrl: registeredAgents.logoUrl,
      category: registeredAgents.category,
      paymentScope: registeredAgents.paymentScope,
      activeGrantsCount: registeredAgents.activeGrantsCount,
      totalVolumeUsd: registeredAgents.totalVolumeUsd,
      publicKey: registeredAgents.publicKey,
      createdAt: registeredAgents.createdAt,
    })
    .from(registeredAgents)
    .where(and(...conditions))
    .$dynamic()

  if (sort === 'newest') {
    query = query.orderBy(desc(registeredAgents.createdAt))
  } else {
    // 'popular' = active grants count desc, then volume
    query = query.orderBy(desc(registeredAgents.activeGrantsCount), desc(registeredAgents.totalVolumeUsd))
  }

  const rows = await query.limit(100)

  // Search filtering happens in JS — keeps the route simple, fine for a small registry.
  // When the registry grows beyond ~1000 entries, move to Postgres full-text search.
  const filtered = search
    ? rows.filter(
        (r) =>
          r.name.toLowerCase().includes(search.toLowerCase()) ||
          r.tagline.toLowerCase().includes(search.toLowerCase()),
      )
    : rows

  return c.json({
    data: {
      agents: filtered.map((a) => ({
        ...a,
        totalVolumeUsd: parseFloat(a.totalVolumeUsd),
        createdAt: a.createdAt.toISOString(),
      })),
    },
  })
})

/**
 * GET /registry/agents/:id
 * Public detail page for an agent.
 */
registryPublicRoutes.get('/agents/:id', async (c) => {
  const id = c.req.param('id')

  const agent = await db.query.registeredAgents.findFirst({
    where: eq(registeredAgents.id, id),
  })

  if (!agent || agent.status === 'suspended') {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Agent not found' } }, 404)
  }

  return c.json({
    data: {
      agent: {
        id: agent.id,
        name: agent.name,
        tagline: agent.tagline,
        description: agent.description,
        publicKey: agent.publicKey,
        homepage: agent.homepage,
        logoUrl: agent.logoUrl,
        category: agent.category,
        paymentScope: agent.paymentScope,
        activeGrantsCount: agent.activeGrantsCount,
        totalVolumeUsd: parseFloat(agent.totalVolumeUsd),
        createdAt: agent.createdAt.toISOString(),
      },
    },
  })
})

// ─── Authenticated registry management ────────────────────────────────────────

export const registryRoutes = new Hono<Env>()
registryRoutes.use('*', authMiddleware)

/**
 * GET /registry/my-agents
 * List the authenticated user's registered agents (the ones they've published).
 */
registryRoutes.get('/my-agents', async (c) => {
  const userId = c.get('userId')

  const rows = await db.query.registeredAgents.findMany({
    where: eq(registeredAgents.ownerId, userId),
    orderBy: [desc(registeredAgents.createdAt)],
  })

  return c.json({
    data: {
      agents: rows.map((a) => ({
        id: a.id,
        name: a.name,
        tagline: a.tagline,
        description: a.description,
        publicKey: a.publicKey,
        homepage: a.homepage,
        logoUrl: a.logoUrl,
        category: a.category,
        paymentScope: a.paymentScope,
        status: a.status,
        activeGrantsCount: a.activeGrantsCount,
        totalVolumeUsd: parseFloat(a.totalVolumeUsd),
        createdAt: a.createdAt.toISOString(),
      })),
    },
  })
})

/**
 * POST /registry/agents
 * Register a new agent in the public directory.
 */
registryRoutes.post('/agents', async (c) => {
  const userId = c.get('userId')
  const body = await c.req.json().catch(() => ({} as any))
  const { name, tagline, description, publicKey, homepage, logoUrl, category, paymentScope } = body

  // Validation
  const errs: string[] = []
  if (!name || typeof name !== 'string' || name.trim().length === 0 || name.length > 60) {
    errs.push('name required (1-60 chars)')
  }
  if (!tagline || typeof tagline !== 'string' || tagline.length > 140) {
    errs.push('tagline required (max 140 chars)')
  }
  if (!description || typeof description !== 'string' || description.length > 4000) {
    errs.push('description required (max 4000 chars)')
  }
  if (!publicKey || typeof publicKey !== 'string') {
    errs.push('publicKey required (Ed25519 base58-encoded)')
  } else if (!isValidBase58Pubkey(publicKey)) {
    errs.push('publicKey must be a valid base58-encoded 32-byte Ed25519 public key')
  }
  const validCategories = ['trading', 'content', 'inference', 'data', 'social', 'other']
  if (category && !validCategories.includes(category)) {
    errs.push(`category must be one of: ${validCategories.join(', ')}`)
  }

  if (errs.length > 0) {
    return c.json({ error: { code: 'VALIDATION', message: errs.join('; ') } }, 400)
  }

  // Uniqueness on public key — one registration per identity
  const existing = await db.query.registeredAgents.findFirst({
    where: eq(registeredAgents.publicKey, publicKey),
  })
  if (existing) {
    return c.json(
      { error: { code: 'CONFLICT', message: 'An agent with this public key already exists' } },
      409,
    )
  }

  const [agent] = await db
    .insert(registeredAgents)
    .values({
      ownerId: userId,
      name: name.trim(),
      tagline: tagline.trim(),
      description: description.trim(),
      publicKey: publicKey.trim(),
      homepage: homepage?.trim() ?? null,
      logoUrl: logoUrl?.trim() ?? null,
      category: category ?? 'other',
      paymentScope: paymentScope?.trim() ?? null,
      status: 'active',
    })
    .returning()

  return c.json({ data: { agent } }, 201)
})

/**
 * PATCH /registry/agents/:id
 * Update a registered agent. Owner only.
 */
registryRoutes.patch('/agents/:id', async (c) => {
  const userId = c.get('userId')
  const id = c.req.param('id')

  const existing = await db.query.registeredAgents.findFirst({
    where: eq(registeredAgents.id, id),
  })
  if (!existing || existing.ownerId !== userId) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Agent not found' } }, 404)
  }

  const body = await c.req.json().catch(() => ({} as any))
  const update: any = { updatedAt: new Date() }

  // Whitelist of editable fields — can NOT change publicKey or ownerId
  for (const field of ['name', 'tagline', 'description', 'homepage', 'logoUrl', 'category', 'paymentScope'] as const) {
    if (field in body) {
      const v = body[field]
      if (v !== null && typeof v !== 'string') {
        return c.json({ error: { code: 'VALIDATION', message: `${field} must be string or null` } }, 400)
      }
      update[field] = v ? v.trim() : null
    }
  }

  if ('status' in body) {
    if (!['active', 'unlisted'].includes(body.status)) {
      return c.json(
        { error: { code: 'VALIDATION', message: 'status must be active or unlisted' } },
        400,
      )
    }
    update.status = body.status
  }

  const [updated] = await db
    .update(registeredAgents)
    .set(update)
    .where(eq(registeredAgents.id, id))
    .returning()

  return c.json({ data: { agent: updated } })
})

/**
 * DELETE /registry/agents/:id
 * Remove an agent from the registry. Owner only.
 * Cascade: any grants referencing this agent are also deleted.
 */
registryRoutes.delete('/agents/:id', async (c) => {
  const userId = c.get('userId')
  const id = c.req.param('id')

  const existing = await db.query.registeredAgents.findFirst({
    where: eq(registeredAgents.id, id),
  })
  if (!existing || existing.ownerId !== userId) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Agent not found' } }, 404)
  }

  await db.delete(registeredAgents).where(eq(registeredAgents.id, id))
  return c.json({ data: { id, deleted: true } })
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Loose validation that the input could be a base58-encoded Ed25519 public key.
 * Solana addresses are 32-byte Ed25519 pubkeys encoded in base58, which renders
 * as 32-44 characters. We don't decode here — that happens during signature
 * verification in session 24. This catches the obvious garbage inputs.
 */
function isValidBase58Pubkey(s: string): boolean {
  if (s.length < 32 || s.length > 44) return false
  return /^[1-9A-HJ-NP-Za-km-z]+$/.test(s)
}
