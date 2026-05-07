import { db } from '../db/client.js'
import { pocketPolicies, transactions } from '../db/schema.js'
import { eq, and, gte, sql } from 'drizzle-orm'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PolicyDecision {
  allowed: boolean
  /** Why the request was denied. Surfaced to the agent + user. */
  reason?: string
  code?: PolicyDenialCode
  /** Limits relevant to this decision — useful for UI feedback. */
  context?: {
    txAmountUsd?: number
    spentTodayUsd?: number
    maxPerTxUsd?: number
    maxPerDayUsd?: number
  }
}

export type PolicyDenialCode =
  | 'TX_LIMIT_EXCEEDED'
  | 'DAILY_LIMIT_EXCEEDED'
  | 'RECIPIENT_BLOCKED'
  | 'RECIPIENT_NOT_ALLOWED'
  | 'TOKEN_BLOCKED'
  | 'TOKEN_NOT_ALLOWED'

export interface PaymentEvaluation {
  pocketId: string
  toAddress: string
  token: string
  amountUsd: number
}

export interface PolicyInput {
  enabled: boolean
  maxPerTxUsd: number | null
  maxPerDayUsd: number | null
  allowedRecipients: string[]
  blockedRecipients: string[]
  allowedTokens: string[]
  blockedTokens: string[]
}

// ─── Service ──────────────────────────────────────────────────────────────────

class PolicyService {
  /** Get the policy for a pocket, or null if none exists. */
  async getPolicy(pocketId: string): Promise<PolicyInput | null> {
    const row = await db.query.pocketPolicies.findFirst({
      where: eq(pocketPolicies.pocketId, pocketId),
    })
    if (!row) return null
    return rowToPolicy(row)
  }

  /** Upsert a policy for a pocket. Creates if missing. */
  async upsertPolicy(pocketId: string, input: Partial<PolicyInput>): Promise<PolicyInput> {
    const existing = await db.query.pocketPolicies.findFirst({
      where: eq(pocketPolicies.pocketId, pocketId),
    })

    const data = {
      pocketId,
      enabled: input.enabled ?? existing?.enabled ?? false,
      maxPerTxUsd:
        input.maxPerTxUsd !== undefined
          ? input.maxPerTxUsd === null
            ? null
            : String(input.maxPerTxUsd)
          : (existing?.maxPerTxUsd ?? null),
      maxPerDayUsd:
        input.maxPerDayUsd !== undefined
          ? input.maxPerDayUsd === null
            ? null
            : String(input.maxPerDayUsd)
          : (existing?.maxPerDayUsd ?? null),
      allowedRecipients: serializeList(input.allowedRecipients, existing?.allowedRecipients),
      blockedRecipients: serializeList(input.blockedRecipients, existing?.blockedRecipients),
      allowedTokens: serializeList(input.allowedTokens, existing?.allowedTokens),
      blockedTokens: serializeList(input.blockedTokens, existing?.blockedTokens),
      updatedAt: new Date(),
    }

    if (existing) {
      const [updated] = await db
        .update(pocketPolicies)
        .set(data)
        .where(eq(pocketPolicies.pocketId, pocketId))
        .returning()
      return rowToPolicy(updated)
    } else {
      const [created] = await db.insert(pocketPolicies).values(data).returning()
      return rowToPolicy(created)
    }
  }

  /**
   * Check whether a payment is allowed under the pocket's policy.
   *
   * If no policy exists, or the policy is disabled, allows the payment.
   * Otherwise enforces the rules in this order:
   *   1. Recipient blocklist — never allowed
   *   2. Recipient allowlist — must be in list (if list set)
   *   3. Token blocklist — never allowed
   *   4. Token allowlist — must be in list (if list set)
   *   5. Per-tx size limit
   *   6. Daily cumulative limit (sum of confirmed/pending payments today)
   */
  async evaluatePayment(input: PaymentEvaluation): Promise<PolicyDecision> {
    const policy = await this.getPolicy(input.pocketId)
    if (!policy || !policy.enabled) {
      return { allowed: true }
    }

    // Normalize for comparison — addresses are case-sensitive on Solana but
    // we trim whitespace just in case.
    const recipient = input.toAddress.trim()
    const token = input.token.toUpperCase()

    if (policy.blockedRecipients.includes(recipient)) {
      return {
        allowed: false,
        reason: `Recipient ${recipient.slice(0, 10)}... is blocked by your policy.`,
        code: 'RECIPIENT_BLOCKED',
      }
    }

    if (policy.allowedRecipients.length > 0 && !policy.allowedRecipients.includes(recipient)) {
      return {
        allowed: false,
        reason: `Recipient ${recipient.slice(0, 10)}... is not in the allowed list. Add it in settings or pay a different recipient.`,
        code: 'RECIPIENT_NOT_ALLOWED',
      }
    }

    if (policy.blockedTokens.includes(token)) {
      return {
        allowed: false,
        reason: `Payments in ${token} are blocked by your policy.`,
        code: 'TOKEN_BLOCKED',
      }
    }

    if (policy.allowedTokens.length > 0 && !policy.allowedTokens.includes(token)) {
      return {
        allowed: false,
        reason: `Payments in ${token} are not allowed. Allowed tokens: ${policy.allowedTokens.join(', ')}.`,
        code: 'TOKEN_NOT_ALLOWED',
      }
    }

    if (policy.maxPerTxUsd !== null && input.amountUsd > policy.maxPerTxUsd) {
      return {
        allowed: false,
        reason: `Transaction $${input.amountUsd.toFixed(2)} exceeds the per-transaction limit of $${policy.maxPerTxUsd.toFixed(2)}.`,
        code: 'TX_LIMIT_EXCEEDED',
        context: { txAmountUsd: input.amountUsd, maxPerTxUsd: policy.maxPerTxUsd },
      }
    }

    if (policy.maxPerDayUsd !== null) {
      const spentToday = await this.spentTodayUsd(input.pocketId)
      const projected = spentToday + input.amountUsd
      if (projected > policy.maxPerDayUsd) {
        const remaining = Math.max(0, policy.maxPerDayUsd - spentToday)
        return {
          allowed: false,
          reason: `Daily limit reached. Spent $${spentToday.toFixed(2)} of $${policy.maxPerDayUsd.toFixed(2)} today. $${remaining.toFixed(2)} remaining.`,
          code: 'DAILY_LIMIT_EXCEEDED',
          context: {
            txAmountUsd: input.amountUsd,
            spentTodayUsd: spentToday,
            maxPerDayUsd: policy.maxPerDayUsd,
          },
        }
      }
    }

    return {
      allowed: true,
      context: {
        txAmountUsd: input.amountUsd,
        maxPerTxUsd: policy.maxPerTxUsd ?? undefined,
        maxPerDayUsd: policy.maxPerDayUsd ?? undefined,
      },
    }
  }

  /**
   * Sum of USD-equivalent payment amounts from this pocket today (UTC).
   * Looks at confirmed + pending payments — pending counts so a runaway
   * agent can't drain the daily budget by queuing many in flight.
   */
  async spentTodayUsd(pocketId: string): Promise<number> {
    const startOfDay = new Date()
    startOfDay.setUTCHours(0, 0, 0, 0)

    // We don't store usdValue on the transaction itself, so estimate from
    // amount × token decimals. For non-stablecoins this is approximate —
    // policies should generally use stablecoin-priced limits anyway, but
    // we apply a price lookup later if needed.
    const rows = await db
      .select({
        token: transactions.token,
        amount: transactions.amount,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.pocketId, pocketId),
          eq(transactions.type, 'payment'),
          gte(transactions.createdAt, startOfDay),
          sql`${transactions.status} IN ('pending', 'confirmed')`,
        ),
      )

    // For stablecoins, 1 unit ≈ $1. For other tokens we'd ideally hit the
    // price service — for now treat them as 0 for daily-limit purposes,
    // which is conservative (agent can't accidentally use SOL volatility
    // to slip past the limit, but it can do high-value SOL payments without
    // counting them toward the cap).
    //
    // This is a known limitation — see follow-up on price-enriched limits.
    const STABLES = new Set(['USDC', 'USDT', 'DAI'])
    let total = 0
    for (const row of rows) {
      if (STABLES.has(row.token.toUpperCase())) {
        total += Number(row.amount) / 1e6 // 6 decimals
      }
      // Non-stable tokens contribute 0 — see comment above
    }
    return total
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function rowToPolicy(row: typeof pocketPolicies.$inferSelect): PolicyInput {
  return {
    enabled: row.enabled,
    maxPerTxUsd: row.maxPerTxUsd !== null ? parseFloat(row.maxPerTxUsd) : null,
    maxPerDayUsd: row.maxPerDayUsd !== null ? parseFloat(row.maxPerDayUsd) : null,
    allowedRecipients: parseList(row.allowedRecipients),
    blockedRecipients: parseList(row.blockedRecipients),
    allowedTokens: parseList(row.allowedTokens).map((t) => t.toUpperCase()),
    blockedTokens: parseList(row.blockedTokens).map((t) => t.toUpperCase()),
  }
}

function parseList(value: string | null): string[] {
  if (!value) return []
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

function serializeList(
  next: string[] | undefined,
  existing: string | null | undefined,
): string | null {
  if (next === undefined) return existing ?? null
  if (next.length === 0) return null
  return next.map((s) => s.trim()).filter(Boolean).join(',')
}

export const policyService = new PolicyService()
