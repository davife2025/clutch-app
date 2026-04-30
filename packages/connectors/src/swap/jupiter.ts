/**
 * Jupiter v6 swap client — Solana's primary DEX aggregator.
 *
 * Used internally by the agent when the optimal payment requires a token
 * conversion (e.g. user has SOL, needs to pay USDC).
 *
 * Not a full DeFi suite — just quote + swap, the minimum needed for the
 * "swap-then-pay" agent flow.
 *
 * Docs: https://station.jup.ag/docs/apis/swap-api
 */

import { TOKEN_MINTS, SPL_DECIMALS } from '@clutch/core'
import {
  Connection,
  Keypair,
  VersionedTransaction,
} from '@solana/web3.js'
import bs58 from 'bs58'

const JUPITER_QUOTE_URL = 'https://quote-api.jup.ag/v6/quote'
const JUPITER_SWAP_URL = 'https://quote-api.jup.ag/v6/swap'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface QuoteParams {
  inputToken: string
  outputToken: string
  /** Human-readable amount (e.g. "1.5") */
  amount: string
  /** Slippage in basis points — default 50 (0.5%) */
  slippageBps?: number
}

export interface QuoteResult {
  inputToken: string
  outputToken: string
  inputAmount: string
  outputAmount: string
  /** Minimum received after slippage */
  minimumReceived: string
  priceImpactPct: number
  route: string[]
  /** Raw quote — passed back to /swap */
  raw: any
}

export interface SwapResult {
  txHash: string
  inputAmount: string
  outputAmount: string
  inputToken: string
  outputToken: string
}

// ─── Quote ──────────────────────────────────────────────────────────────────

/**
 * Get a swap quote from Jupiter.
 * Returns null if no route exists.
 */
export async function getJupiterQuote(params: QuoteParams): Promise<QuoteResult | null> {
  const inputMint = TOKEN_MINTS[params.inputToken.toUpperCase()]
  const outputMint = TOKEN_MINTS[params.outputToken.toUpperCase()]
  if (!inputMint || !outputMint) {
    throw new Error(`Unknown token: ${!inputMint ? params.inputToken : params.outputToken}`)
  }

  const inputDecimals = SPL_DECIMALS[params.inputToken.toUpperCase()] ?? 9
  const outputDecimals = SPL_DECIMALS[params.outputToken.toUpperCase()] ?? 9

  const amountRaw = BigInt(Math.floor(Number(params.amount) * 10 ** inputDecimals))

  const url = new URL(JUPITER_QUOTE_URL)
  url.searchParams.set('inputMint', inputMint)
  url.searchParams.set('outputMint', outputMint)
  url.searchParams.set('amount', amountRaw.toString())
  url.searchParams.set('slippageBps', String(params.slippageBps ?? 50))
  url.searchParams.set('swapMode', 'ExactIn')

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
    if (!res.ok) return null
    const quote: any = await res.json()
    if (!quote || !quote.outAmount) return null

    const route = (quote.routePlan ?? []).map((step: any) => step.swapInfo?.label ?? 'Unknown')

    return {
      inputToken: params.inputToken.toUpperCase(),
      outputToken: params.outputToken.toUpperCase(),
      inputAmount: params.amount,
      outputAmount: (Number(quote.outAmount) / 10 ** outputDecimals).toFixed(6),
      minimumReceived: (
        Number(quote.otherAmountThreshold) / 10 ** outputDecimals
      ).toFixed(6),
      priceImpactPct: parseFloat(quote.priceImpactPct ?? '0'),
      route,
      raw: quote,
    }
  } catch (err) {
    console.error('[jupiter] quote failed:', err)
    return null
  }
}

// ─── Build swap transaction ─────────────────────────────────────────────────

/**
 * Get the signed swap transaction from Jupiter.
 * Returns a base64-encoded VersionedTransaction.
 */
async function buildSwapTransaction(quote: any, userPublicKey: string): Promise<string | null> {
  try {
    const res = await fetch(JUPITER_SWAP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quoteResponse: quote,
        userPublicKey,
        wrapAndUnwrapSol: true,
        // Use auto compute unit price for reliable landing
        prioritizationFeeLamports: 'auto',
        dynamicComputeUnitLimit: true,
      }),
      signal: AbortSignal.timeout(8000),
    })

    if (!res.ok) return null
    const data: any = await res.json()
    return data.swapTransaction ?? null
  } catch (err) {
    console.error('[jupiter] swap build failed:', err)
    return null
  }
}

// ─── Execute swap ───────────────────────────────────────────────────────────

/**
 * Execute a Jupiter swap end-to-end.
 *
 * Flow:
 *   1. Get quote
 *   2. Build swap transaction (server-side via Jupiter)
 *   3. Decode, sign with the wallet's private key
 *   4. Send and confirm on-chain
 */
export async function executeJupiterSwap(
  rpcUrl: string,
  privateKeyBase58: string,
  params: QuoteParams,
): Promise<SwapResult> {
  const quote = await getJupiterQuote(params)
  if (!quote) throw new Error('No swap route available')

  const secretKey = bs58.decode(privateKeyBase58)
  const keypair = Keypair.fromSecretKey(secretKey)

  const swapTxBase64 = await buildSwapTransaction(quote.raw, keypair.publicKey.toBase58())
  if (!swapTxBase64) throw new Error('Failed to build swap transaction')

  const txBuf = Buffer.from(swapTxBase64, 'base64')
  const tx = VersionedTransaction.deserialize(txBuf)
  tx.sign([keypair])

  const connection = new Connection(rpcUrl, 'confirmed')
  const txHash = await connection.sendTransaction(tx, {
    skipPreflight: false,
    maxRetries: 3,
    preflightCommitment: 'confirmed',
  })

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed')
  await connection.confirmTransaction(
    { signature: txHash, blockhash, lastValidBlockHeight },
    'confirmed',
  )

  return {
    txHash,
    inputAmount: quote.inputAmount,
    outputAmount: quote.outputAmount,
    inputToken: quote.inputToken,
    outputToken: quote.outputToken,
  }
}
