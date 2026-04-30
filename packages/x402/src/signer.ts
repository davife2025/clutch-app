import type { X402PaymentRequired, X402PaymentProof } from './types.js'
import type { PaymentSigner } from './client.js'

export interface AgentSignerOptions {
  /** Clutch API base URL (e.g. http://localhost:3001) */
  apiUrl: string
  /** JWT auth token */
  token: string
  /** Pocket to pay from */
  pocketId: string
}

/**
 * Creates a PaymentSigner that delegates to Clutch's AI agent.
 *
 * Flow:
 *   1. HTTP 402 is intercepted by X402Client
 *   2. This signer calls POST /pockets/:id/pay/agent
 *   3. Agent picks the best wallet, signs, broadcasts
 *   4. Returns proof with txHash
 *
 * One API call — the agent handles everything.
 */
export function createAgentSigner(options: AgentSignerOptions): PaymentSigner {
  return async (req: X402PaymentRequired): Promise<X402PaymentProof> => {
    const { apiUrl, token, pocketId } = options

    // Convert smallest-unit amount to human-readable for the agent
    const decimals = getDecimals(req.currency)
    const humanAmount = (Number(req.amount) / 10 ** decimals).toString()

    const res = await globalThis.fetch(`${apiUrl}/pockets/${pocketId}/pay/agent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        to: req.payTo,
        amount: humanAmount,
        token: req.currency,
        chain: req.network !== 'any' ? req.network : undefined,
        memo: req.description,
      }),
    })

    if (!res.ok) {
      const err = (await res.json().catch(() => ({ error: { message: 'Unknown error' } }))) as any
      throw new Error(`x402 payment failed: ${err.error?.message ?? res.statusText}`)
    }

    const { data } = (await res.json()) as {
      data: {
        txHash: string
        chain: string
        fromAddress: string
        toAddress: string
        amount: string
        token: string
        status: string
      }
    }

    return {
      txHash: data.txHash,
      network: data.chain,
      amount: req.amount,
      currency: data.token,
      paidAt: Math.floor(Date.now() / 1000),
      payTo: req.payTo,
    }
  }
}

function getDecimals(currency: string): number {
  if (['USDC', 'USDT', 'DAI'].includes(currency)) return 6
  if (currency === 'SOL') return 9
  return 18
}
