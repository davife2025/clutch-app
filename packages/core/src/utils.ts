import { randomBytes } from 'crypto'
import type { ChainId } from './types.js'

export function generateId(): string {
  return randomBytes(16).toString('hex')
}

// ── Lamport / SOL conversion ──────────────────────────────────────────────────

/** Convert lamports (bigint) to SOL string. 1 SOL = 1_000_000_000 lamports. */
export function lamportsToSol(lamports: bigint, decimals = 9): string {
  const divisor = BigInt(10 ** decimals)
  const whole = lamports / divisor
  const remainder = lamports % divisor
  const fraction = remainder.toString().padStart(decimals, '0').slice(0, 6).replace(/0+$/, '')
  return fraction ? `${whole}.${fraction}` : `${whole}`
}

/** Convert SOL string to lamports bigint. */
export function solToLamports(sol: string, decimals = 9): bigint {
  const [whole, fraction = ''] = sol.split('.')
  const paddedFraction = fraction.padEnd(decimals, '0').slice(0, decimals)
  return BigInt(whole + paddedFraction)
}

// ── Generic token conversion ──────────────────────────────────────────────────

/** Convert raw token amount (bigint) to human-readable string. */
export function rawToHuman(amount: bigint, decimals: number): string {
  return lamportsToSol(amount, decimals)
}

/** Convert human-readable token string to raw bigint. */
export function humanToRaw(amount: string, decimals: number): bigint {
  return solToLamports(amount, decimals)
}

// ── ETH/wei for EVM chain support ─────────────────────────────────────────────

export function weiToEth(wei: bigint, decimals = 18): string {
  return lamportsToSol(wei, decimals)
}

export function ethToWei(eth: string, decimals = 18): bigint {
  return solToLamports(eth, decimals)
}

// ── Address utils ─────────────────────────────────────────────────────────────

export function truncateAddress(address: string, chars = 4): string {
  if (!address) return ''
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`
}

export function isValidEthAddress(address: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(address)
}

export function isValidSolanaAddress(address: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)
}

export function isValidAddress(address: string, chain: ChainId): boolean {
  if (chain === 'solana') return isValidSolanaAddress(address)
  return isValidEthAddress(address)
}

// ── Misc ──────────────────────────────────────────────────────────────────────

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function formatUsdValue(usd: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(usd)
}
