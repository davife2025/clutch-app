import { Hono } from 'hono'
import {
  createPaymentRequired,
  verifyProof,
  type PaywallConfig,
  type X402PaymentProof,
} from '@clutch/x402'

export const x402Routes = new Hono()

// ─── Demo paywall config ──────────────────────────────────────────────────────

const DEMO_PAYWALL: PaywallConfig = {
  amount: '100000', // 0.1 USDC (6 decimals)
  currency: 'USDC',
  payTo: 'DemoRecipient111111111111111111111111111111', // placeholder
  network: 'solana',
  description: 'Clutch x402 demo — premium data access',
  ttlSeconds: 300,
}

// ─── GET /x402/demo — paywalled endpoint ──────────────────────────────────────

/**
 * Demo endpoint that returns 402 unless a valid payment proof is provided.
 *
 * Test flow:
 *   1. GET /x402/demo → 402 with payment requirements
 *   2. Pay via Clutch agent
 *   3. GET /x402/demo with X-Payment-Proof header → 200 with premium data
 */
x402Routes.get('/demo', async (c) => {
  const proofHeader = c.req.header('X-Payment-Proof')

  if (proofHeader) {
    try {
      const proof = JSON.parse(proofHeader) as X402PaymentProof
      const valid = await verifyProof(proof, DEMO_PAYWALL)
      if (valid) {
        return c.json({
          data: {
            message: 'Welcome to premium content! Payment verified.',
            txHash: proof.txHash,
            paidAt: new Date(proof.paidAt * 1000).toISOString(),
            content: {
              insight: 'Solana processes 65,000 TPS with 400ms finality.',
              fact: 'The average Solana transaction costs $0.00025.',
            },
          },
        })
      }
    } catch {
      // Invalid proof — fall through to 402
    }
  }

  // No valid proof — return 402 with payment requirements
  return c.json(createPaymentRequired(DEMO_PAYWALL), 402)
})

// ─── GET /x402/info — explains the x402 protocol ─────────────────────────────

x402Routes.get('/info', (c) => {
  return c.json({
    data: {
      protocol: 'x402',
      version: '1.0',
      description:
        'HTTP 402 Payment Required — autonomous micropayments via Clutch pockets',
      flow: [
        '1. Client calls a paywalled API endpoint',
        '2. Server returns HTTP 402 with payment requirements (amount, currency, payTo, network)',
        '3. X402Client intercepts the 402 and calls the signer',
        '4. Clutch agent picks the best wallet, signs, and broadcasts the payment',
        '5. Client retries the request with X-Payment-Proof header',
        '6. Server verifies the proof and returns the content',
      ],
      demoEndpoint: 'GET /x402/demo',
      paywall: DEMO_PAYWALL,
    },
  })
})
