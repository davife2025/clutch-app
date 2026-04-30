import type { ChainId } from '@clutch/core'
import { EVMConnector } from './providers/evm.js'
import { SolanaConnector } from './providers/solana.js'
import type { WalletConnector } from './types.js'

export interface RegistryConfig {
  solanaRpcUrl?: string
  ethRpcUrl?: string
  baseRpcUrl?: string
  polygonRpcUrl?: string
  arbitrumRpcUrl?: string
  optimismRpcUrl?: string
}

const PUBLIC_RPCS: Record<string, string> = {
  solana: 'https://api.mainnet-beta.solana.com',
  ethereum: 'https://eth.llamarpc.com',
  base: 'https://mainnet.base.org',
  polygon: 'https://polygon-rpc.com',
  arbitrum: 'https://arb1.arbitrum.io/rpc',
  optimism: 'https://mainnet.optimism.io',
}

export class ConnectorRegistry {
  private connectors = new Map<ChainId, WalletConnector>()

  constructor(config: RegistryConfig = {}) {
    // Solana — primary chain, always first
    this.connectors.set(
      'solana',
      new SolanaConnector(config.solanaRpcUrl ?? PUBLIC_RPCS.solana),
    )

    // EVM chains
    const evmMap: Array<[ChainId, string | undefined, string]> = [
      ['ethereum', config.ethRpcUrl, PUBLIC_RPCS.ethereum],
      ['base', config.baseRpcUrl, PUBLIC_RPCS.base],
      ['polygon', config.polygonRpcUrl, PUBLIC_RPCS.polygon],
      ['arbitrum', config.arbitrumRpcUrl, PUBLIC_RPCS.arbitrum],
      ['optimism', config.optimismRpcUrl, PUBLIC_RPCS.optimism],
    ]

    for (const [chain, configUrl, publicUrl] of evmMap) {
      this.connectors.set(chain, new EVMConnector(chain, configUrl ?? publicUrl))
    }
  }

  get(chain: ChainId): WalletConnector | undefined {
    return this.connectors.get(chain)
  }

  getOrThrow(chain: ChainId): WalletConnector {
    const c = this.connectors.get(chain)
    if (!c) throw new Error(`No connector registered for chain: ${chain}`)
    return c
  }

  solana(): WalletConnector {
    return this.getOrThrow('solana')
  }

  all(): WalletConnector[] {
    return [...this.connectors.values()]
  }

  async pingAll(): Promise<Partial<Record<ChainId, boolean>>> {
    const results: Partial<Record<ChainId, boolean>> = {}
    await Promise.allSettled(
      [...this.connectors.entries()].map(async ([chain, connector]) => {
        results[chain] = await connector.ping()
      }),
    )
    return results
  }
}
