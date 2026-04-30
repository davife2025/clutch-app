/**
 * PriceService — fetches USD token prices from CoinGecko.
 * Solana ecosystem tokens are prioritised.
 */

interface PriceCache {
  price: number
  fetchedAt: number
}

const CACHE_TTL_MS = 60_000

/** CoinGecko IDs — Solana tokens listed first */
const COINGECKO_IDS: Record<string, string> = {
  // Solana ecosystem (primary)
  SOL: 'solana',
  USDC: 'usd-coin',
  USDT: 'tether',
  BONK: 'bonk',
  JUP: 'jupiter-exchange-solana',
  RAY: 'raydium',
  ORCA: 'orca',
  mSOL: 'msol',
  stSOL: 'lido-staked-sol',
  WIF: 'dogwifcoin',
  PYTH: 'pyth-network',
  JTO: 'jito-governance-token',
  // EVM (secondary)
  ETH: 'ethereum',
  MATIC: 'matic-network',
  DAI: 'dai',
  WBTC: 'wrapped-bitcoin',
  ARB: 'arbitrum',
  OP: 'optimism',
}

const priceCache = new Map<string, PriceCache>()

export class PriceService {
  async getUsdPrice(token: string): Promise<number | null> {
    const key = token.toUpperCase()
    const cached = priceCache.get(key)
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) return cached.price

    const coinId = COINGECKO_IDS[key]
    if (!coinId) return null

    try {
      const res = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`,
        { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(5000) },
      )
      if (!res.ok) return null
      const data = (await res.json()) as Record<string, { usd: number }>
      const price = data[coinId]?.usd ?? null
      if (price !== null) priceCache.set(key, { price, fetchedAt: Date.now() })
      return price
    } catch {
      return null
    }
  }

  async getBatchPrices(tokens: string[]): Promise<Record<string, number>> {
    const unique = [...new Set(tokens.map((t) => t.toUpperCase()))]
    const ids = unique.map((t) => COINGECKO_IDS[t]).filter(Boolean)
    if (ids.length === 0) return {}

    try {
      const res = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(',')}&vs_currencies=usd`,
        { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(8000) },
      )
      if (!res.ok) return {}
      const data = (await res.json()) as Record<string, { usd: number }>
      const result: Record<string, number> = {}
      for (const token of unique) {
        const coinId = COINGECKO_IDS[token]
        if (coinId && data[coinId]?.usd) {
          result[token] = data[coinId].usd
          priceCache.set(token, { price: data[coinId].usd, fetchedAt: Date.now() })
        }
      }
      return result
    } catch {
      return {}
    }
  }
}

export const priceService = new PriceService()
