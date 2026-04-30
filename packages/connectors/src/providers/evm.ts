import { createPublicClient, http, type Address, type PublicClient, type Chain } from 'viem'
import { mainnet, base, polygon, arbitrum, optimism } from 'viem/chains'
import type { ReadOnlyConnector, TokenBalance } from '../types.js'
import type { ChainId } from '@clutch/core'

/**
 * EVM connector — READ-ONLY.
 *
 * Clutch transacts on Solana. EVM wallets in a pocket are external balances
 * shown for completeness, not for signing. If a user wants to pay USD, the
 * agent will route through USDC on Solana, not USDC on Ethereum.
 */

const ERC20_ABI = [
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const

const KNOWN_TOKENS: Partial<
  Record<ChainId, Array<{ symbol: string; address: Address; decimals: number }>>
> = {
  ethereum: [
    { symbol: 'USDC', address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', decimals: 6 },
    { symbol: 'USDT', address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', decimals: 6 },
    { symbol: 'DAI', address: '0x6B175474E89094C44Da98b954EedeAC495271d0F', decimals: 18 },
  ],
  base: [{ symbol: 'USDC', address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', decimals: 6 }],
  polygon: [
    { symbol: 'USDC', address: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', decimals: 6 },
    { symbol: 'USDT', address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', decimals: 6 },
  ],
  arbitrum: [
    { symbol: 'USDC', address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', decimals: 6 },
    { symbol: 'ARB', address: '0x912CE59144191C1204E64559FE8253a0e49E6548', decimals: 18 },
  ],
  optimism: [
    { symbol: 'USDC', address: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85', decimals: 6 },
    { symbol: 'OP', address: '0x4200000000000000000000000000000000000042', decimals: 18 },
  ],
}

const VIEM_CHAINS: Record<string, Chain> = {
  ethereum: mainnet,
  base,
  polygon,
  arbitrum,
  optimism,
}

const CHAIN_NATIVE: Record<string, string> = {
  ethereum: 'ETH',
  base: 'ETH',
  polygon: 'MATIC',
  arbitrum: 'ETH',
  optimism: 'ETH',
}

export class EVMConnector implements ReadOnlyConnector {
  readonly chain: ChainId
  readonly name: string
  private client: PublicClient

  constructor(chain: ChainId, rpcUrl: string) {
    this.chain = chain
    this.name = `EVM:${chain} (read-only)`
    this.client = createPublicClient({
      chain: VIEM_CHAINS[chain],
      transport: http(rpcUrl),
    }) as PublicClient
  }

  async ping(): Promise<boolean> {
    try {
      await this.client.getBlockNumber()
      return true
    } catch {
      return false
    }
  }

  async getNativeBalance(address: string): Promise<bigint> {
    return this.client.getBalance({ address: address as Address })
  }

  async getBalances(address: string): Promise<TokenBalance[]> {
    const addr = address as Address
    const results: TokenBalance[] = []

    const nativeBalance = await this.getNativeBalance(address)
    results.push({
      token: CHAIN_NATIVE[this.chain] ?? 'ETH',
      amount: nativeBalance,
      decimals: 18,
    })

    const knownTokens = KNOWN_TOKENS[this.chain] ?? []
    await Promise.allSettled(
      knownTokens.map(async (token) => {
        try {
          const balance = (await this.client.readContract({
            address: token.address,
            abi: ERC20_ABI,
            functionName: 'balanceOf',
            args: [addr],
          })) as bigint

          if (balance > 0n) {
            results.push({
              token: token.symbol,
              amount: balance,
              decimals: token.decimals,
              contractAddress: token.address,
            })
          }
        } catch {
          // Non-fatal
        }
      }),
    )

    return results
  }
}
