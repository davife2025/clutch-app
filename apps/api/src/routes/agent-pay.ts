import { Hono } from 'hono'
import nacl from 'tweetnacl'
import bs58 from 'bs58'
import { db } from '../db/client.js'
import { agentGrants, registeredAgents, pockets, transactions } from '../db/schema.js'
import { eq, and } from 'drizzle-orm'
import { agentService } from '../services/agent.service.js'
import { policyService } from '../services/policy.service.js'
import { priceService } from '../services/price.service.js'
import { humanToRaw } from '@clutch/core'

export const agentPayRoutes = new Hono()

/**
 * POST /agent-pay
 *
 * Signed payment request from a registered agent.
 *
 * Authentication: Ed25519 signature verified against the registered_agents
 * public key. NO user JWT required — the agent identifies itself via the
 * signature, and the grant determines which pocket to debit.
 *
 * The signed payload binds together: agent identity, target pocket, recipient,
 * amount, token, and a timestamp + nonce to prevent replay.
 *
 * Enforcement order:
 *   1. Verify signature against registered_agents.public_key
 *   2. Look up active grant for (pocket, agent)
 *   3. Evaluate grant's scoped policy (per-tx, per-day, allowlists)
 *   4. Evaluate pocket's overall policy (must also pass)
 *   5. Execute payment via agent service
 *   6. Update grant.spent_usd and last_used_at
 */

interface SignedPaymentRequest {
  payload: {
    pocketId: string
    to: string
    amount: string
    token: string
    timestamp: number // unix seconds
    nonce: string
    memo?: string
  }
  signature: string // base58
  publicKey: string // base58 — the agent's registered identity
}

const PAYLOAD_MAX_AGE_SECONDS = 5 * 60 // 5 minutes — replay window

// Track recent nonces per agent. In-memory; a multi-instance deployment
// would back this with Redis. Cleared every 30 minutes to avoid leaking memory.
const seenNonces = new Map<string, number>() // key = `${publicKey}:${nonce}`, value = timestamp
setInterval(
  () => {
    const cutoff = Date.now() / 1000 - PAYLOAD_MAX_AGE_SECONDS * 2
    for (const [k, ts] of seenNonces) {
      if (ts < cutoff) seenNonces.delete(k)
    }
  },
  30 * 60 * 1000,
)

agentPayRoutes.post('/agent-pay', async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as Partial<SignedPaymentRequest>
  const { payload, signature, publicKey } = body

  // ─── Validate request shape ────────────────────────────────────────────────
  if (!payload || typeof payload !== 'object') {
    return c.json({ error: { code: 'VALIDATION', message: 'payload required' } }, 400)
  }
  if (!signature || typeof signature !== 'string') {
    return c.json({ error: { code: 'VALIDATION', message: 'signature required' } }, 400)
  }
  if (!publicKey || typeof publicKey !== 'string') {
    return c.json({ error: { code: 'VALIDATION', message: 'publicKey required' } }, 400)
  }

  const { pocketId, to, amount, token, timestamp, nonce, memo } = payload
  if (!pocketId || !to || !amount || !token || !timestamp || !nonce) {
    return c.json(
      {
        error: {
          code: 'VALIDATION',
          message: 'payload must include pocketId, to, amount, token, timestamp, nonce',
        },
      },
      400,
    )
  }

  // ─── Verify signature ──────────────────────────────────────────────────────
  let pubKeyBytes: Uint8Array
  let sigBytes: Uint8Array
  try {
    pubKeyBytes = bs58.decode(publicKey)
    sigBytes = bs58.decode(signature)
  } catch {
    return c.json(
      { error: { code: 'INVALID_SIGNATURE', message: 'malformed publicKey or signature' } },
      400,
    )
  }
  if (pubKeyBytes.length !== 32) {
    return c.json(
      { error: { code: 'INVALID_SIGNATURE', message: 'publicKey must be 32 bytes' } },
      400,
    )
  }
  if (sigBytes.length !== 64) {
    return c.json(
      { error: { code: 'INVALID_SIGNATURE', message: 'signature must be 64 bytes' } },
      400,
    )
  }

  const message = canonicalizePayload(payload)
  const valid = nacl.sign.detached.verify(message, sigBytes, pubKeyBytes)
  if (!valid) {
    return c.json(
      { error: { code: 'INVALID_SIGNATURE', message: 'signature does not verify' } },
      401,
    )
  }

  // ─── Replay protection ─────────────────────────────────────────────────────
  const nowSec = Math.floor(Date.now() / 1000)
  const ageSec = nowSec - timestamp
  if (ageSec > PAYLOAD_MAX_AGE_SECONDS || ageSec < -60) {
    // ageSec < -60 means clock skew > 1min in the future — also reject
    return c.json(
      {
        error: {
          code: 'STALE_PAYLOAD',
          message: `payload timestamp out of window (ageSec=${ageSec})`,
        },
      },
      401,
    )
  }
  const nonceKey = `${publicKey}:${nonce}`
  if (seenNonces.has(nonceKey)) {
    return c.json(
      { error: { code: 'REPLAY', message: 'this signed payload was already used' } },
      401,
    )
  }
  seenNonces.set(nonceKey, nowSec)

  // ─── Look up the agent + grant ─────────────────────────────────────────────
  const agent = await db.query.registeredAgents.findFirst({
    where: eq(registeredAgents.publicKey, publicKey),
  })
  if (!agent) {
    return c.json(
      { error: { code: 'AGENT_NOT_REGISTERED', message: 'public key not in registry' } },
      404,
    )
  }
  if (agent.status === 'suspended') {
    return c.json(
      { error: { code: 'AGENT_SUSPENDED', message: 'agent is suspended' } },
      403,
    )
  }

  const pocket = await db.query.pockets.findFirst({
    where: eq(pockets.id, pocketId),
  })
  if (!pocket) {
    return c.json({ error: { code: 'POCKET_NOT_FOUND', message: 'pocket not found' } }, 404)
  }

  const grant = await db.query.agentGrants.findFirst({
    where: and(
      eq(agentGrants.pocketId, pocketId),
      eq(agentGrants.registeredAgentId, agent.id),
    ),
  })
  if (!grant) {
    return c.json(
      {
        error: {
          code: 'NO_GRANT',
          message: 'pocket has not authorized this agent',
        },
      },
      403,
    )
  }
  if (grant.status !== 'active') {
    return c.json(
      {
        error: {
          code: 'GRANT_INACTIVE',
          message: `grant is ${grant.status}`,
        },
      },
      403,
    )
  }
  if (grant.expiresAt && grant.expiresAt.getTime() < Date.now()) {
    // Auto-expire stale grants
    await db
      .update(agentGrants)
      .set({ status: 'expired', updatedAt: new Date() })
      .where(eq(agentGrants.id, grant.id))
    return c.json({ error: { code: 'GRANT_EXPIRED', message: 'grant has expired' } }, 403)
  }

  // ─── Compute USD amount ────────────────────────────────────────────────────
  const tokenUpper = String(token).toUpperCase()
  const STABLES = new Set(['USDC', 'USDT', 'DAI'])
  let amountUsd: number
  if (STABLES.has(tokenUpper)) {
    amountUsd = Number(amount)
  } else {
    const price = await priceService.getUsdPrice(tokenUpper)
    amountUsd = price ? Number(amount) * price : 0
  }

  // ─── Evaluate grant scope FIRST (the agent-specific limits) ────────────────
  const grantDecision = evaluateGrantScope(grant, {
    toAddress: String(to),
    token: tokenUpper,
    amountUsd,
  })
  if (!grantDecision.allowed) {
    return c.json(
      {
        error: {
          code: grantDecision.code ?? 'GRANT_DENIED',
          message: grantDecision.reason,
          context: { ...grantDecision.context, grantId: grant.id },
        },
      },
      403,
    )
  }

  // ─── Evaluate pocket policy (the user's overall guardrails) ────────────────
  const pocketDecision = await policyService.evaluatePayment({
    pocketId,
    toAddress: String(to),
    token: tokenUpper,
    amountUsd,
  })
  if (!pocketDecision.allowed) {
    return c.json(
      {
        error: {
          code: pocketDecision.code ?? 'POLICY_DENIED',
          message: pocketDecision.reason,
          context: pocketDecision.context,
        },
      },
      403,
    )
  }

  // ─── Execute the payment ──────────────────────────────────────────────────
  try {
    // Use the deterministic path — no LLM call. The agent already specified
    // exactly what they want (recipient, amount, token), the policy engine
    // approved it, so wallet selection is a simple deterministic choice.
    // Fast, cheap, doesn't depend on HF_TOKEN being set or available.
    const result = await agentService.executePaymentDeterministic(pocketId, {
      to: String(to),
      amount: String(amount),
      token: tokenUpper,
      chain: 'solana',
      memo: memo ?? `agent:${agent.name}`,
    })

    // ─── Update grant + agent stats ──────────────────────────────────────────
    const newSpent = parseFloat(grant.spentUsd) + amountUsd
    await db
      .update(agentGrants)
      .set({
        spentUsd: newSpent.toFixed(2),
        lastUsedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(agentGrants.id, grant.id))

    const newVolume = parseFloat(agent.totalVolumeUsd) + amountUsd
    await db
      .update(registeredAgents)
      .set({
        totalVolumeUsd: newVolume.toFixed(2),
        updatedAt: new Date(),
      })
      .where(eq(registeredAgents.id, agent.id))

    return c.json({
      data: {
        txHash: result.txHash,
        status: result.status,
        explorerUrl: `https://solscan.io/tx/${result.txHash}`,
        amountUsd,
        agent: { id: agent.id, name: agent.name },
        grant: { id: grant.id, spentUsd: newSpent.toFixed(2) },
      },
    })
  } catch (err) {
    return c.json(
      {
        error: {
          code: 'EXECUTION_FAILED',
          message: (err as Error).message ?? String(err),
        },
      },
      500,
    )
  }
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Canonical serialization of the payload for signing. Order matters because
 * different orderings produce different hashes. We use a fixed key order and
 * JSON.stringify with no spaces.
 */
function canonicalizePayload(p: SignedPaymentRequest['payload']): Uint8Array {
  const ordered = {
    pocketId: p.pocketId,
    to: p.to,
    amount: p.amount,
    token: p.token,
    timestamp: p.timestamp,
    nonce: p.nonce,
    memo: p.memo ?? null,
  }
  return new TextEncoder().encode(JSON.stringify(ordered))
}

/** Evaluate the per-grant policy. Mirrors policy.service shape but for grants. */
function evaluateGrantScope(
  grant: typeof agentGrants.$inferSelect,
  input: { toAddress: string; token: string; amountUsd: number },
): { allowed: boolean; code?: string; reason?: string; context?: any } {
  const maxPerTxUsd = grant.maxPerTxUsd !== null ? parseFloat(grant.maxPerTxUsd) : null
  const maxPerDayUsd = grant.maxPerDayUsd !== null ? parseFloat(grant.maxPerDayUsd) : null
  const allowedRecipients = parseList(grant.allowedRecipients)
  const allowedTokens = parseList(grant.allowedTokens).map((t) => t.toUpperCase())

  if (allowedRecipients.length > 0 && !allowedRecipients.includes(input.toAddress)) {
    return {
      allowed: false,
      code: 'GRANT_RECIPIENT_NOT_ALLOWED',
      reason: `Recipient not in this agent's allowed list.`,
    }
  }

  if (allowedTokens.length > 0 && !allowedTokens.includes(input.token)) {
    return {
      allowed: false,
      code: 'GRANT_TOKEN_NOT_ALLOWED',
      reason: `Token ${input.token} not allowed for this agent.`,
    }
  }

  if (maxPerTxUsd !== null && input.amountUsd > maxPerTxUsd) {
    return {
      allowed: false,
      code: 'GRANT_TX_LIMIT_EXCEEDED',
      reason: `Transaction $${input.amountUsd.toFixed(2)} exceeds this agent's per-tx limit of $${maxPerTxUsd.toFixed(2)}.`,
      context: { txAmountUsd: input.amountUsd, maxPerTxUsd },
    }
  }

  if (maxPerDayUsd !== null) {
    const spentUsd = parseFloat(grant.spentUsd)
    // Reset spentUsd at midnight UTC. We don't currently track per-day spent
    // separately from lifetime spent, so the daily check is conservative —
    // it uses lifetime spent. A future iteration would track per-day buckets.
    if (spentUsd + input.amountUsd > maxPerDayUsd) {
      return {
        allowed: false,
        code: 'GRANT_DAILY_LIMIT_EXCEEDED',
        reason: `Agent has spent $${spentUsd.toFixed(2)} of $${maxPerDayUsd.toFixed(2)} cumulative limit. Increase the limit to authorize more.`,
        context: { spentUsd, maxPerDayUsd },
      }
    }
  }

  return { allowed: true }
}

function parseList(value: string | null): string[] {
  if (!value) return []
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}
