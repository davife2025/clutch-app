import { describe, it, expect, vi, beforeEach } from 'vitest'

// We test the pure decision logic by mocking the service's policy fetch.
// Full DB-integration tests live separately.

vi.mock('../src/db/client.js', () => {
  return {
    db: {
      query: { pocketPolicies: { findFirst: vi.fn() } },
      select: vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(() => []) })) })),
      insert: vi.fn(),
      update: vi.fn(),
    },
  }
})

const { policyService } = await import('../src/services/policy.service.js')
const { db } = await import('../src/db/client.js')

function policyRow(overrides: any = {}) {
  return {
    id: 'p1',
    pocketId: 'pocket-1',
    enabled: true,
    maxPerTxUsd: null,
    maxPerDayUsd: null,
    allowedRecipients: null,
    blockedRecipients: null,
    allowedTokens: null,
    blockedTokens: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('policyService.evaluatePayment', () => {
  it('allows when no policy exists', async () => {
    ;(db.query.pocketPolicies.findFirst as any).mockResolvedValueOnce(null)
    const decision = await policyService.evaluatePayment({
      pocketId: 'pocket-1',
      toAddress: 'recipient',
      token: 'USDC',
      amountUsd: 100,
    })
    expect(decision.allowed).toBe(true)
  })

  it('allows when policy is disabled', async () => {
    ;(db.query.pocketPolicies.findFirst as any).mockResolvedValueOnce(
      policyRow({ enabled: false, maxPerTxUsd: '5' }),
    )
    const decision = await policyService.evaluatePayment({
      pocketId: 'pocket-1',
      toAddress: 'recipient',
      token: 'USDC',
      amountUsd: 100,
    })
    expect(decision.allowed).toBe(true)
  })

  it('rejects when amount exceeds per-tx limit', async () => {
    ;(db.query.pocketPolicies.findFirst as any).mockResolvedValueOnce(
      policyRow({ maxPerTxUsd: '10' }),
    )
    const decision = await policyService.evaluatePayment({
      pocketId: 'pocket-1',
      toAddress: 'recipient',
      token: 'USDC',
      amountUsd: 25,
    })
    expect(decision.allowed).toBe(false)
    expect(decision.code).toBe('TX_LIMIT_EXCEEDED')
    expect(decision.context?.maxPerTxUsd).toBe(10)
    expect(decision.context?.txAmountUsd).toBe(25)
  })

  it('allows when amount equals per-tx limit', async () => {
    ;(db.query.pocketPolicies.findFirst as any).mockResolvedValueOnce(
      policyRow({ maxPerTxUsd: '10' }),
    )
    const decision = await policyService.evaluatePayment({
      pocketId: 'pocket-1',
      toAddress: 'recipient',
      token: 'USDC',
      amountUsd: 10,
    })
    expect(decision.allowed).toBe(true)
  })

  it('rejects blocked recipient', async () => {
    ;(db.query.pocketPolicies.findFirst as any).mockResolvedValueOnce(
      policyRow({ blockedRecipients: 'bad-address,worse-address' }),
    )
    const decision = await policyService.evaluatePayment({
      pocketId: 'pocket-1',
      toAddress: 'bad-address',
      token: 'USDC',
      amountUsd: 1,
    })
    expect(decision.allowed).toBe(false)
    expect(decision.code).toBe('RECIPIENT_BLOCKED')
  })

  it('rejects recipient not in allowlist', async () => {
    ;(db.query.pocketPolicies.findFirst as any).mockResolvedValueOnce(
      policyRow({ allowedRecipients: 'good1,good2' }),
    )
    const decision = await policyService.evaluatePayment({
      pocketId: 'pocket-1',
      toAddress: 'unknown',
      token: 'USDC',
      amountUsd: 1,
    })
    expect(decision.allowed).toBe(false)
    expect(decision.code).toBe('RECIPIENT_NOT_ALLOWED')
  })

  it('allows recipient in allowlist', async () => {
    ;(db.query.pocketPolicies.findFirst as any).mockResolvedValueOnce(
      policyRow({ allowedRecipients: 'good1,good2' }),
    )
    const decision = await policyService.evaluatePayment({
      pocketId: 'pocket-1',
      toAddress: 'good2',
      token: 'USDC',
      amountUsd: 1,
    })
    expect(decision.allowed).toBe(true)
  })

  it('rejects blocked token', async () => {
    ;(db.query.pocketPolicies.findFirst as any).mockResolvedValueOnce(
      policyRow({ blockedTokens: 'BONK' }),
    )
    const decision = await policyService.evaluatePayment({
      pocketId: 'pocket-1',
      toAddress: 'r',
      token: 'BONK',
      amountUsd: 1,
    })
    expect(decision.allowed).toBe(false)
    expect(decision.code).toBe('TOKEN_BLOCKED')
  })

  it('rejects token not in allowlist', async () => {
    ;(db.query.pocketPolicies.findFirst as any).mockResolvedValueOnce(
      policyRow({ allowedTokens: 'USDC,USDT' }),
    )
    const decision = await policyService.evaluatePayment({
      pocketId: 'pocket-1',
      toAddress: 'r',
      token: 'BONK',
      amountUsd: 1,
    })
    expect(decision.allowed).toBe(false)
    expect(decision.code).toBe('TOKEN_NOT_ALLOWED')
  })

  it('allows token in allowlist (case-insensitive)', async () => {
    ;(db.query.pocketPolicies.findFirst as any).mockResolvedValueOnce(
      policyRow({ allowedTokens: 'usdc,usdt' }),
    )
    const decision = await policyService.evaluatePayment({
      pocketId: 'pocket-1',
      toAddress: 'r',
      token: 'USDC',
      amountUsd: 1,
    })
    expect(decision.allowed).toBe(true)
  })

  it('checks blocklist before allowlist (block wins)', async () => {
    ;(db.query.pocketPolicies.findFirst as any).mockResolvedValueOnce(
      policyRow({
        allowedRecipients: 'good,blocked-too',
        blockedRecipients: 'blocked-too',
      }),
    )
    const decision = await policyService.evaluatePayment({
      pocketId: 'pocket-1',
      toAddress: 'blocked-too',
      token: 'USDC',
      amountUsd: 1,
    })
    expect(decision.allowed).toBe(false)
    expect(decision.code).toBe('RECIPIENT_BLOCKED')
  })

  it('rejects when daily limit would be exceeded', async () => {
    ;(db.query.pocketPolicies.findFirst as any).mockResolvedValueOnce(
      policyRow({ maxPerDayUsd: '50' }),
    )
    // Mock spentTodayUsd to return 30
    const select = vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() =>
          Promise.resolve([
            { token: 'USDC', amount: BigInt(30_000_000) }, // $30
          ]),
        ),
      })),
    }))
    ;(db.select as any).mockImplementationOnce(select)

    const decision = await policyService.evaluatePayment({
      pocketId: 'pocket-1',
      toAddress: 'r',
      token: 'USDC',
      amountUsd: 25, // 30 + 25 = 55 > 50 limit
    })
    expect(decision.allowed).toBe(false)
    expect(decision.code).toBe('DAILY_LIMIT_EXCEEDED')
    expect(decision.context?.spentTodayUsd).toBe(30)
    expect(decision.context?.maxPerDayUsd).toBe(50)
  })

  it('allows when daily limit not exceeded', async () => {
    ;(db.query.pocketPolicies.findFirst as any).mockResolvedValueOnce(
      policyRow({ maxPerDayUsd: '50' }),
    )
    ;(db.select as any).mockImplementationOnce(() => ({
      from: () => ({ where: () => Promise.resolve([]) }),
    }))

    const decision = await policyService.evaluatePayment({
      pocketId: 'pocket-1',
      toAddress: 'r',
      token: 'USDC',
      amountUsd: 25,
    })
    expect(decision.allowed).toBe(true)
  })

  it('combines all checks — fails on first violation', async () => {
    ;(db.query.pocketPolicies.findFirst as any).mockResolvedValueOnce(
      policyRow({
        maxPerTxUsd: '10',
        blockedRecipients: 'bad',
      }),
    )
    // Recipient block hits before tx limit check
    const decision = await policyService.evaluatePayment({
      pocketId: 'pocket-1',
      toAddress: 'bad',
      token: 'USDC',
      amountUsd: 5,
    })
    expect(decision.code).toBe('RECIPIENT_BLOCKED')
  })
})
