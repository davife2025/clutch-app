import type { ChainId } from '@clutch/core'
import { EVMConnector } from './providers/evm.js'
import { SolanaConnector } from './providers/solana.js'
import type { ReadOnlyConnector, SigningConnector } from './types.js'

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

/**
 * ConnectorRegistry — manages chain connectors for Clutch.
 *
 * Solana is the only signing chain. EVM chains are read-only (for the pocket
 * aggregation view). Use `solana()` to get the signing connector, and `get()`
 * for any read-only access.
 */
export class ConnectorRegistry {
  private solanaConnector: SolanaConnector
  private evmConnectors = new Map<ChainId, EVMConnector>()

  constructor(config: RegistryConfig = {}) {
    this.solanaConnector = new SolanaConnector(config.solanaRpcUrl ?? PUBLIC_RPCS.solana)

    const evmMap: Array<[ChainId, string | undefined, string]> = [
      ['ethereum', config.ethRpcUrl, PUBLIC_RPCS.ethereum],
      ['base', config.baseRpcUrl, PUBLIC_RPCS.base],
      ['polygon', config.polygonRpcUrl, PUBLIC_RPCS.polygon],
      ['arbitrum', config.arbitrumRpcUrl, PUBLIC_RPCS.arbitrum],
      ['optimism', config.optimismRpcUrl, PUBLIC_RPCS.optimism],
    ]

    for (const [chain, configUrl, publicUrl] of evmMap) {
      this.evmConnectors.set(chain, new EVMConnector(chain, configUrl ?? publicUrl))
    }
  }

  /** Get a read-only connector for any chain (Solana or EVM). */
  get(chain: ChainId): ReadOnlyConnector | undefined {
    if (chain === 'solana') return this.solanaConnector
    return this.evmConnectors.get(chain)
  }

  getOrThrow(chain: ChainId): ReadOnlyConnector {
    const c = this.get(chain)
    if (!c) throw new Error(`No connector registered for chain: ${chain}`)
    return c
  }

  /** Get the Solana signing connector — the only chain Clutch transacts on. */
  solana(): SigningConnector {
    return this.solanaConnector
  }

  /** Get a SigningConnector — only Solana qualifies. */
  getSigningConnector(chain: ChainId): SigningConnector | null {
    return chain === 'solana' ? this.solanaConnector : null
  }

  all(): ReadOnlyConnector[] {
    return [this.solanaConnector, ...this.evmConnectors.values()]
  }

  async pingAll(): Promise<Partial<Record<ChainId, boolean>>> {
    const results: Partial<Record<ChainId, boolean>> = {}
    await Promise.allSettled(
      this.all().map(async (connector) => {
        results[connector.chain] = await connector.ping()
      }),
    )
    return results
  }
}
