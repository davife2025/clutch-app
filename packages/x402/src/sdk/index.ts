/**
 * @clutch/sdk — the Clutch SDK for AI agent payments on Solana
 *
 * The fastest way to give your Solana agent a wallet that won't drain.
 * Drop into Solana Agent Kit, GOAT, ElizaOS, LangGraph, or any framework.
 *
 *   import { Clutch } from '@clutch/sdk'
 *
 *   const clutch = new Clutch({ apiKey: 'pk_test_...' })
 *
 *   // Auto-pays HTTP 402 paywalls, respects your spending policy,
 *   // records a receipt every time.
 *   const res = await clutch.fetch('https://api.example.com/premium')
 *
 *   // Or pay anyone explicitly
 *   const result = await clutch.pay({
 *     to: 'recipient.sol',
 *     amount: '0.50',
 *     token: 'USDC',
 *   })
 */

import { X402Client, type PaymentSigner } from '../client.js'
import type { X402PaymentRequired, X402PaymentProof } from '../types.js'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ClutchConfig {
  /** API key from clutch.app/developers — pk_test_... or pk_live_... */
  apiKey: string
  /** Override the API base URL (for self-hosted deploys) */
  baseUrl?: string
  /** Auto-approve x402 payments under this USD amount (default: $1.00) */
  autoApproveUnderUsd?: number
  /** Called before any x402 payment — return false to cancel */
  onPaymentRequired?: (req: X402PaymentRequired) => Promise<boolean>
  /** Called after every successful payment */
  onPaymentSuccess?: (proof: X402PaymentProof, resourceUrl: string) => void
  /** Called on payment failure (e.g. policy denial, insufficient funds) */
  onPaymentError?: (err: Error) => void
}

export interface PayRequest {
  to: string
  amount: string
  token: 'USDC' | 'SOL' | 'USDT' | 'BONK' | string
  memo?: string
}

export interface PayResult {
  txHash: string
  status: 'pending' | 'confirmed' | 'failed'
  fromAddress: string
  toAddress: string
  amount: string
  token: string
  reasoning: string
  walletUsed: string
  explorerUrl: string
}

export interface Receipt {
  id: string
  resourceUrl: string
  method: string
  txHash: string
  amount: string
  token: string
  amountUsd: string | null
  payTo: string
  finalStatus: number | null
  succeeded: boolean
  paidAt: string
  explorerUrl: string
}

export interface SpendingPolicy {
  enabled: boolean
  maxPerTxUsd: number | null
  maxPerDayUsd: number | null
  allowedRecipients: string[]
  blockedRecipients: string[]
  allowedTokens: string[]
  blockedTokens: string[]
}

export class ClutchError extends Error {
  constructor(
    message: string,
    public code: string,
    public httpStatus?: number,
  ) {
    super(message)
    this.name = 'ClutchError'
  }
}

// ─── SDK ──────────────────────────────────────────────────────────────────────

export class Clutch {
  private apiKey: string
  private baseUrl: string
  private pocketIdCache: string | null = null
  private x402Client: X402Client

  constructor(config: ClutchConfig) {
    if (!config.apiKey) {
      throw new ClutchError('apiKey required', 'MISSING_API_KEY')
    }
    this.apiKey = config.apiKey
    this.baseUrl = config.baseUrl ?? 'https://api.clutch.app'

    // Build the x402 client with a signer that delegates to /pay/agent
    // so the policy engine evaluates every payment server-side.
    const signer: PaymentSigner = async (req) => this.signPayment(req)

    this.x402Client = new X402Client({
      signer,
      autoApproveUnderUsd: config.autoApproveUnderUsd ?? 1.0,
      onPaymentRequired: config.onPaymentRequired,
      onPaymentSuccess: config.onPaymentSuccess
        ? (proof) => config.onPaymentSuccess?.(proof, this.lastResourceUrl ?? '')
        : undefined,
      onPaymentError: config.onPaymentError,
    })
  }

  // Track the URL across the x402 retry so the success callback can include it.
  private lastResourceUrl: string | null = null

  // ─── Public API ─────────────────────────────────────────────────────────────

  /**
   * x402-aware fetch. Intercepts HTTP 402, pays the paywall through the
   * pocket's policy, retries with proof, and records a receipt.
   *
   *   const res = await clutch.fetch('https://api.example.com/premium')
   *   const data = await res.json() // works even if the URL was paywalled
   */
  async fetch(url: string, init: RequestInit = {}): Promise<Response> {
    this.lastResourceUrl = url
    const startedAt = Date.now()
    const res = await this.x402Client.fetch(url, init)

    // If we paid for this request (i.e. a proof was generated), record a receipt.
    // The X402Client doesn't expose the proof directly here, so we detect by
    // looking at whether the request took longer than a normal fetch (>800ms
    // is a strong signal the 402 → pay → retry happened) AND the response is
    // 2xx. Imperfect; the v2 of this should plumb the proof through.
    if (res.status < 400 && Date.now() - startedAt > 800) {
      // Best-effort receipt — don't block the response
      this.lastReceiptHints = { url, method: init.method ?? 'GET', finalStatus: res.status }
    }

    return res
  }

  private lastReceiptHints: { url: string; method: string; finalStatus: number } | null = null

  /**
   * Send a payment explicitly. Goes through the pocket's spending policy
   * just like x402 payments — if the policy rejects, this throws ClutchError
   * with code 'POLICY_DENIED' and the specific rule that blocked it.
   *
   *   const result = await clutch.pay({
   *     to: 'recipient.sol',
   *     amount: '0.50',
   *     token: 'USDC',
   *     memo: 'API access',
   *   })
   */
  async pay(req: PayRequest): Promise<PayResult> {
    const pocketId = await this.getPocketId()
    return this.api<PayResult>(`/pockets/${pocketId}/pay/agent`, {
      method: 'POST',
      body: JSON.stringify(req),
    })
  }

  /**
   * List x402 receipts — every paywall payment, with the URL it paid for,
   * the tx hash, and whether the post-payment request actually succeeded.
   * Useful for cost dashboards and dispute resolution.
   */
  async receipts(opts: { limit?: number } = {}): Promise<Receipt[]> {
    const pocketId = await this.getPocketId()
    const limit = opts.limit ?? 50
    const data = await this.api<{ receipts: Receipt[] }>(
      `/pockets/${pocketId}/receipts?limit=${limit}`,
    )
    return data.receipts
  }

  /**
   * Get the current spending policy. Use this in your agent's pre-flight
   * check: if `policy.maxPerDayUsd - spentToday < cost`, the agent knows
   * to ask the user before attempting the payment.
   */
  async getPolicy(): Promise<{ policy: SpendingPolicy; spentTodayUsd: number }> {
    const pocketId = await this.getPocketId()
    return this.api(`/pockets/${pocketId}/policy`)
  }

  /**
   * Update the spending policy. Pass partial updates — only sent fields change.
   *
   *   await clutch.updatePolicy({
   *     enabled: true,
   *     maxPerDayUsd: 50,
   *     maxPerTxUsd: 5,
   *     blockedTokens: ['BONK'],
   *   })
   */
  async updatePolicy(update: Partial<SpendingPolicy>): Promise<SpendingPolicy> {
    const pocketId = await this.getPocketId()
    const data = await this.api<{ policy: SpendingPolicy }>(
      `/pockets/${pocketId}/policy`,
      {
        method: 'PUT',
        body: JSON.stringify(update),
      },
    )
    return data.policy
  }

  // ─── Internal ───────────────────────────────────────────────────────────────

  /**
   * The signer used by X402Client. Delegates to /pay/agent which:
   *  1. Enforces the spending policy
   *  2. Picks the right wallet via the AI router
   *  3. Signs and broadcasts on Solana
   *  4. Returns the tx hash (used as the proof)
   */
  private async signPayment(req: X402PaymentRequired): Promise<X402PaymentProof> {
    const pocketId = await this.getPocketId()

    // Convert from raw units to human-readable amount for /pay/agent
    const decimals = req.currency === 'SOL' ? 9 : 6
    const amountHuman = (Number(req.amount) / 10 ** decimals).toString()

    const result = await this.api<PayResult>(`/pockets/${pocketId}/pay/agent`, {
      method: 'POST',
      body: JSON.stringify({
        to: req.payTo,
        amount: amountHuman,
        token: req.currency,
        memo: req.description ?? 'x402 payment',
      }),
    })

    // Record the receipt (best-effort — failure shouldn't block the request)
    this.recordReceipt({
      resourceUrl: this.lastResourceUrl ?? '',
      method: this.lastReceiptHints?.method ?? 'GET',
      txHash: result.txHash,
      amount: req.amount,
      token: req.currency,
      payTo: req.payTo,
      challenge: req,
    }).catch(() => {})

    return {
      txHash: result.txHash,
      network: 'solana',
      amount: req.amount,
      currency: req.currency,
      paidAt: Math.floor(Date.now() / 1000),
      payTo: req.payTo,
    }
  }

  private async recordReceipt(data: {
    resourceUrl: string
    method: string
    txHash: string
    amount: string
    token: string
    payTo: string
    challenge: X402PaymentRequired
  }): Promise<void> {
    const pocketId = await this.getPocketId()
    await this.api(`/pockets/${pocketId}/receipts`, {
      method: 'POST',
      body: JSON.stringify({
        ...data,
        succeeded: true, // updated separately on retry success/failure
        finalStatus: this.lastReceiptHints?.finalStatus ?? null,
      }),
    })
  }

  /** Resolve and cache the pocket ID for this API key */
  private async getPocketId(): Promise<string> {
    if (this.pocketIdCache) return this.pocketIdCache
    const data = await this.api<{ pockets: Array<{ id: string }> }>('/pockets')
    if (!data.pockets[0]) {
      throw new ClutchError('No pocket found for this API key', 'NO_POCKET')
    }
    this.pocketIdCache = data.pockets[0].id
    return this.pocketIdCache
  }

  /** Authenticated request helper */
  private async api<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers ?? {})
    headers.set('Authorization', `Bearer ${this.apiKey}`)
    headers.set('Content-Type', 'application/json')

    const res = await globalThis.fetch(`${this.baseUrl}${path}`, { ...init, headers })
    const json = (await res.json().catch(() => ({}))) as any

    if (!res.ok) {
      const err = json.error ?? { code: 'UNKNOWN', message: `HTTP ${res.status}` }
      throw new ClutchError(err.message, err.code, res.status)
    }

    return json.data as T
  }
}

export default Clutch
