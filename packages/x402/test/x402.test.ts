import { describe, it, expect } from 'vitest'
import { createPaymentRequired, verifyProof, type PaywallConfig, type X402PaymentProof } from '../src/index.js'

const config: PaywallConfig = {
  amount: '100000',
  currency: 'USDC',
  payTo: 'DemoRecipient111111111111111111111111111111',
  network: 'solana',
  description: 'test',
  ttlSeconds: 300,
}

describe('createPaymentRequired', () => {
  it('builds a 402 body', () => {
    const req = createPaymentRequired(config)
    expect(req.amount).toBe('100000')
    expect(req.currency).toBe('USDC')
    expect(req.payTo).toBe(config.payTo)
    expect(req.network).toBe('solana')
    expect(req.description).toBe('test')
  })

  it('sets expiresAt 300s in the future by default', () => {
    const before = Math.floor(Date.now() / 1000)
    const req = createPaymentRequired(config)
    const after = Math.floor(Date.now() / 1000)
    expect(req.expiresAt).toBeGreaterThanOrEqual(before + 300)
    expect(req.expiresAt).toBeLessThanOrEqual(after + 300)
  })

  it('respects custom TTL', () => {
    const now = Math.floor(Date.now() / 1000)
    const req = createPaymentRequired({ ...config, ttlSeconds: 60 })
    expect(req.expiresAt).toBeGreaterThanOrEqual(now + 60)
    expect(req.expiresAt).toBeLessThan(now + 70)
  })
})

describe('verifyProof', () => {
  function validProof(): X402PaymentProof {
    return {
      txHash: 'abc123',
      network: 'solana',
      amount: '100000',
      currency: 'USDC',
      paidAt: Math.floor(Date.now() / 1000),
      payTo: config.payTo,
    }
  }

  it('accepts a valid proof', async () => {
    const ok = await verifyProof(validProof(), config)
    expect(ok).toBe(true)
  })

  it('rejects missing txHash', async () => {
    const ok = await verifyProof({ ...validProof(), txHash: '' }, config)
    expect(ok).toBe(false)
  })

  it('rejects wrong network', async () => {
    const ok = await verifyProof({ ...validProof(), network: 'ethereum' }, config)
    expect(ok).toBe(false)
  })

  it('rejects wrong recipient', async () => {
    const ok = await verifyProof({ ...validProof(), payTo: 'someone-else' }, config)
    expect(ok).toBe(false)
  })

  it('rejects stale proof (>5 min old)', async () => {
    const stale = { ...validProof(), paidAt: Math.floor(Date.now() / 1000) - 400 }
    const ok = await verifyProof(stale, config)
    expect(ok).toBe(false)
  })

  it('accepts proof from 1 minute ago', async () => {
    const recent = { ...validProof(), paidAt: Math.floor(Date.now() / 1000) - 60 }
    const ok = await verifyProof(recent, config)
    expect(ok).toBe(true)
  })
})
