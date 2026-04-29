import type { ChainId } from './types.js'

/** Solana is Clutch's primary chain. */
export const PRIMARY_CHAIN: ChainId = 'solana'

export const SUPPORTED_CHAINS: ChainId[] = [
  'solana', // primary
  'ethereum',
  'base',
  'polygon',
  'arbitrum',
  'optimism',
]

export const CHAIN_NATIVE_TOKEN: Record<ChainId, string> = {
  solana: 'SOL',
  ethereum: 'ETH',
  base: 'ETH',
  polygon: 'MATIC',
  arbitrum: 'ETH',
  optimism: 'ETH',
}

export const CHAIN_DECIMALS: Record<ChainId, number> = {
  solana: 9, // lamports
  ethereum: 18,
  base: 18,
  polygon: 18,
  arbitrum: 18,
  optimism: 18,
}

export const CHAIN_EXPLORER: Record<ChainId, string> = {
  solana: 'https://solscan.io',
  ethereum: 'https://etherscan.io',
  base: 'https://basescan.org',
  polygon: 'https://polygonscan.com',
  arbitrum: 'https://arbiscan.io',
  optimism: 'https://optimistic.etherscan.io',
}

export const CHAIN_LABEL: Record<ChainId, string> = {
  solana: 'Solana',
  ethereum: 'Ethereum',
  base: 'Base',
  polygon: 'Polygon',
  arbitrum: 'Arbitrum',
  optimism: 'Optimism',
}

/** RPC environment variable names per chain. */
export const CHAIN_RPC_ENV: Record<ChainId, string> = {
  solana: 'SOLANA_RPC_URL',
  ethereum: 'ETHEREUM_RPC_URL',
  base: 'BASE_RPC_URL',
  polygon: 'POLYGON_RPC_URL',
  arbitrum: 'ARBITRUM_RPC_URL',
  optimism: 'OPTIMISM_RPC_URL',
}

/** Clutch native balance is stored in lamports (SOL, 9 decimals). */
export const NATIVE_DECIMALS = 9
export const NATIVE_TOKEN = 'SOL'
export const LAMPORTS_PER_SOL = 1_000_000_000n

export const MAX_WALLETS_PER_POCKET = 20

/** Well-known SPL token decimals. */
export const SPL_DECIMALS: Record<string, number> = {
  SOL: 9,
  USDC: 6,
  USDT: 6,
  BONK: 5,
  JUP: 6,
  RAY: 6,
  ORCA: 6,
  mSOL: 9,
  stSOL: 9,
  WIF: 6,
  PYTH: 6,
  JTO: 9,
}

/** Well-known SPL token mint addresses on Solana mainnet. */
export const TOKEN_MINTS: Record<string, string> = {
  SOL: 'So11111111111111111111111111111111111111112',
  USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  USDT: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
  BONK: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
  JUP: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
  RAY: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R',
  ORCA: 'orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE',
  mSOL: 'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So',
  stSOL: '7dHbWXmci3dT8UFYWYZweBLXgycu7Y3iL6trKn1Y7ARj',
  WIF: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm',
  PYTH: 'HZ1JovNiVvGrCs7KMhgDsJMXnFHJf9S19R3MJQbPyBU6',
  JTO: 'jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL',
}
