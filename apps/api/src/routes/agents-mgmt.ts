import { Hono } from 'hono'
import { db } from '../db/client.js'
import { agents, pockets, x402Receipts } from '../db/schema.js'
import { eq, and, desc, sql } from 'drizzle-orm'
import { authMiddleware } from '../middleware/auth.js'

type Env = { Variables: { userId: string } }

export const agentsRoutes = new Hono<Env>()
agentsRoutes.use('*', authMiddleware)

/** Verify pocket ownership */
async function ownsPocket(userId: string, pocketId: string) {
  return db.query.pockets.findFirst({
    where: and(eq(pockets.id, pocketId), eq(pockets.ownerId, userId)),
  })
}

/** Verify pocket-bound agent ownership in one shot */
async function ownsAgent(userId: string, agentId: string) {
  const row = await db
    .select({ agent: agents, ownerId: pockets.ownerId })
    .from(agents)
    .innerJoin(pockets, eq(agents.pocketId, pockets.id))
    .where(eq(agents.id, agentId))
    .limit(1)
  if (!row[0] || row[0].ownerId !== userId) return null
  return row[0].agent
}

// ─── GET /pockets/:id/agents ──────────────────────────────────────────────────

agentsRoutes.get('/:id/agents', async (c) => {
  const userId = c.get('userId')
  const pocketId = c.req.param('id')

  if (!(await ownsPocket(userId, pocketId))) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Pocket not found' } }, 404)
  }

  const rows = await db.query.agents.findMany({
    where: eq(agents.pocketId, pocketId),
    orderBy: [desc(agents.createdAt)],
  })

  // Count receipts per agent for the listing UI — uses a separate query
  // because Drizzle's relational API doesn't aggregate counts cleanly here.
  const counts = await db
    .select({
      agentId: sql<string>`receipts_per_agent.agent_id`,
      count: sql<number>`receipts_per_agent.count`,
    })
    .from(
      sql`(SELECT pocket_id, COUNT(*)::int as count, '' as agent_id FROM x402_receipts WHERE pocket_id = ${pocketId} GROUP BY pocket_id) as receipts_per_agent`,
    )

  return c.json({
    data: {
      agents: rows.map((a) => ({
        id: a.id,
        name: a.name,
        template: a.template,
        description: a.description,
        status: a.status,
        lastInstruction: a.lastInstruction,
        totalSpentUsd: parseFloat(a.totalSpentUsd),
        createdAt: a.createdAt.toISOString(),
      })),
    },
  })
})

// ─── POST /pockets/:id/agents ─────────────────────────────────────────────────

agentsRoutes.post('/:id/agents', async (c) => {
  const userId = c.get('userId')
  const pocketId = c.req.param('id')

  if (!(await ownsPocket(userId, pocketId))) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Pocket not found' } }, 404)
  }

  const body = await c.req.json().catch(() => ({} as any))
  const { name, template, description } = body

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return c.json({ error: { code: 'VALIDATION', message: 'name is required' } }, 400)
  }
  if (name.length > 60) {
    return c.json({ error: { code: 'VALIDATION', message: 'name max 60 chars' } }, 400)
  }

  const validTemplates = ['custom', 'api-spending', 'content-paywall', 'inference']
  const tpl = validTemplates.includes(template) ? template : 'custom'

  const [agent] = await db
    .insert(agents)
    .values({
      pocketId,
      name: name.trim(),
      template: tpl,
      description: description?.trim() ?? null,
      status: 'active',
    })
    .returning()

  return c.json({ data: { agent } }, 201)
})

// ─── GET /agents/:agentId ─────────────────────────────────────────────────────

agentsRoutes.get('/agents/:agentId', async (c) => {
  const userId = c.get('userId')
  const agentId = c.req.param('agentId')

  const agent = await ownsAgent(userId, agentId)
  if (!agent) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Agent not found' } }, 404)
  }

  // Recent receipts attributed to this pocket
  const receipts = await db.query.x402Receipts.findMany({
    where: eq(x402Receipts.pocketId, agent.pocketId),
    orderBy: [desc(x402Receipts.paidAt)],
    limit: 10,
  })

  return c.json({
    data: {
      agent: {
        id: agent.id,
        pocketId: agent.pocketId,
        name: agent.name,
        template: agent.template,
        description: agent.description,
        status: agent.status,
        lastInstruction: agent.lastInstruction,
        totalSpentUsd: parseFloat(agent.totalSpentUsd),
        createdAt: agent.createdAt.toISOString(),
      },
      recentReceipts: receipts.map((r) => ({
        id: r.id,
        resourceUrl: r.resourceUrl,
        amount: r.amount.toString(),
        token: r.token,
        succeeded: r.succeeded,
        paidAt: r.paidAt.toISOString(),
      })),
    },
  })
})

// ─── PATCH /agents/:agentId — pause/resume/revoke ─────────────────────────────

agentsRoutes.patch('/agents/:agentId', async (c) => {
  const userId = c.get('userId')
  const agentId = c.req.param('agentId')

  const agent = await ownsAgent(userId, agentId)
  if (!agent) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Agent not found' } }, 404)
  }

  const body = await c.req.json().catch(() => ({} as any))
  const { status, name, description } = body

  const update: any = { updatedAt: new Date() }
  if (status && ['active', 'paused', 'revoked'].includes(status)) {
    update.status = status
  }
  if (name !== undefined) {
    if (typeof name !== 'string' || name.trim().length === 0 || name.length > 60) {
      return c.json({ error: { code: 'VALIDATION', message: 'invalid name' } }, 400)
    }
    update.name = name.trim()
  }
  if (description !== undefined) {
    update.description = description ? String(description).trim() : null
  }

  const [updated] = await db
    .update(agents)
    .set(update)
    .where(eq(agents.id, agentId))
    .returning()

  return c.json({ data: { agent: updated } })
})

// ─── POST /agents/:agentId/instruct ───────────────────────────────────────────
//
// The "tell your agent what to do" endpoint. Currently a stub that records
// the instruction; full execution requires the x402 service registry +
// instruction parser, which is Phase 5B of the ship plan.
//
// What this DOES today:
//   - Records the instruction
//   - Returns a structured plan describing what would happen
//   - Does NOT execute payments yet — that's the next session
//
// What we tell users honestly: this endpoint understands x402-protected URLs.
// It does not browse arbitrary websites, fill forms, or solve CAPTCHAs.

agentsRoutes.post('/agents/:agentId/instruct', async (c) => {
  const userId = c.get('userId')
  const agentId = c.req.param('agentId')

  const agent = await ownsAgent(userId, agentId)
  if (!agent) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Agent not found' } }, 404)
  }

  if (agent.status !== 'active') {
    return c.json(
      {
        error: {
          code: 'AGENT_INACTIVE',
          message: `Agent is ${agent.status}. Resume it first.`,
        },
      },
      400,
    )
  }

  const body = await c.req.json().catch(() => ({} as any))
  const { instruction } = body
  if (!instruction || typeof instruction !== 'string') {
    return c.json({ error: { code: 'VALIDATION', message: 'instruction required' } }, 400)
  }

  // Parse the instruction. v1: detect URLs in the text. If it contains a URL,
  // assume the user wants the agent to fetch (and possibly pay for) that URL.
  // If no URL, return an honest "I can only handle x402 URLs right now" plan.
  const urlMatches = instruction.match(/https?:\/\/[^\s]+/g) ?? []

  const plan = {
    instruction,
    urls: urlMatches,
    canExecute: urlMatches.length > 0,
    explanation:
      urlMatches.length > 0
        ? `Will attempt to fetch ${urlMatches.length} URL${urlMatches.length === 1 ? '' : 's'}. If any returns HTTP 402, I'll pay it through your spending policy.`
        : "I can only handle URLs that return HTTP 402 (x402 paywalls) right now. Try giving me a URL like https://api.example.com/premium. I can't browse the open web, fill forms, or solve CAPTCHAs.",
  }

  // Record the instruction on the agent
  await db
    .update(agents)
    .set({ lastInstruction: instruction, updatedAt: new Date() })
    .where(eq(agents.id, agentId))

  return c.json({ data: { plan, status: 'planned' } })
})
