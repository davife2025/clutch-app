import type { X402PaymentRequired, X402PaymentProof } from './types.js'

export interface PaywallConfig {
  /** Amount in smallest token units */
  amount: string
  /** Token: USDC, SOL, etc. */
  currency: string
  /** Recipient address */
  payTo: string
  /** Chain: solana, ethereum, base, etc. */
  network: string
  /** What's being paid for */
  description?: string
  /** How long the payment request is valid (default: 300s) */
  ttlSeconds?: number
}

/**
 * Create a 402 response body for a paywalled endpoint.
 *
 * Example (Hono):
 *   app.get('/premium', async (c) => {
 *     const proof = c.req.header('X-Payment-Proof')
 *     if (!proof || !(await verifyProof(JSON.parse(proof), config))) {
 *       return c.json(createPaymentRequired(config), 402)
 *     }
 *     return c.json({ data: 'premium content' })
 *   })
 */
export function createPaymentRequired(config: PaywallConfig): X402PaymentRequired {
  return {
    amount: config.amount,
    currency: config.currency,
    payTo: config.payTo,
    network: config.network,
    description: config.description,
    expiresAt: Math.floor(Date.now() / 1000) + (config.ttlSeconds ?? 300),
  }
}

/**
 * Verify a payment proof.
 * Basic validation — production should verify the tx on-chain.
 */
export async function verifyProof(
  proof: X402PaymentProof,
  config: PaywallConfig,
): Promise<boolean> {
  if (!proof.txHash || !proof.network || !proof.amount) return false
  if (proof.network !== config.network) return false
  if (proof.payTo !== config.payTo) return false
  // Check payment isn't stale (5 minute window)
  const now = Math.floor(Date.now() / 1000)
  if (now - proof.paidAt > 300) return false
  // TODO: verify txHash on-chain — check recipient, amount, confirmation
  return true
}

/**
 * Hono middleware factory for paywalled routes.
 *
 * Usage:
 *   import { x402Middleware } from '@clutch/x402'
 *   app.use('/premium/*', x402Middleware({ amount: '1000000', currency: 'USDC', payTo: '...', network: 'solana' }))
 */
export function x402Middleware(config: PaywallConfig) {
  return async (c: any, next: () => Promise<void>) => {
    const proofHeader = c.req.header('X-Payment-Proof')

    if (proofHeader) {
      try {
        const proof = JSON.parse(proofHeader) as X402PaymentProof
        if (await verifyProof(proof, config)) {
          await next()
          return
        }
      } catch {
        // Invalid proof — fall through to 402
      }
    }

    return c.json(createPaymentRequired(config), 402)
  }
}
