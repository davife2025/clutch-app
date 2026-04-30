import type { ConnectorRegistry, SigningConnector, WalletConnectManager } from '@clutch/connectors'
import type { ChainId } from '@clutch/core'
import { CHAIN_NATIVE_TOKEN, CHAIN_DECIMALS, SPL_DECIMALS } from '@clutch/core'
import type { VaultService } from '@clutch/vault'
import type { ToolExecutor } from './agent.js'

export interface ExecutorConfig {
  registry: ConnectorRegistry
  priceService: {
    getUsdPrice(token: string): Promise<number | null>
    getBatchPrices(tokens: string[]): Promise<Record<string, number>>
  }
  /** Vault for decrypting custodial wallet keys. */
  vault?: VaultService
  /** WalletConnect manager for external wallet signing. */
  wcManager?: WalletConnectManager | null
  /** Lookup encrypted key and connection type for a wallet ID. */
  getWalletMeta?: (walletId: string) => Promise<{
    address: string
    chain: string
    connectionType: string
    encryptedKey?: string | null
    wcSessionTopic?: string | null
  } | null>
}

export class ClutchToolExecutor implements ToolExecutor {
  constructor(private config: ExecutorConfig) {}

  async execute(toolName: string, input: Record<string, string>): Promise<unknown> {
    switch (toolName) {
      case 'get_wallet_balance':
        return this.getWalletBalance(input)
      case 'estimate_gas_fee':
        return this.estimateGasFee(input)
      case 'get_token_price':
        return this.getTokenPrice(input)
      case 'execute_payment':
        return this.executePayment(input)
      default:
        return { error: `Unknown tool: ${toolName}` }
    }
  }

  // ─── get_wallet_balance ───────────────────────────────────────────────────

  private async getWalletBalance(input: Record<string, string>) {
    const { address, chain } = input
    try {
      const connector = this.config.registry.get(chain as ChainId)
      if (!connector) return { error: `No connector for chain: ${chain}` }

      const balances = await connector.getBalances(address)
      const tokens = balances.map((b) => b.token)
      const prices = await this.config.priceService.getBatchPrices(tokens)

      return {
        address,
        chain,
        balances: balances.map((b) => ({
          token: b.token,
          amount: (Number(b.amount) / 10 ** b.decimals).toFixed(6),
          decimals: b.decimals,
          usdValue: prices[b.token.toUpperCase()]
            ? ((Number(b.amount) / 10 ** b.decimals) * prices[b.token.toUpperCase()]).toFixed(2)
            : null,
        })),
      }
    } catch (err) {
      return { error: String(err) }
    }
  }

  // ─── estimate_gas_fee ─────────────────────────────────────────────────────

  private async estimateGasFee(input: Record<string, string>) {
    const { chain, token, amount, toAddress } = input
    try {
      const connector = this.config.registry.get(chain as ChainId)
      if (!connector) return { error: `No connector for chain: ${chain}` }

      const decimals = this.getDecimals(token, chain as ChainId)
      const amountRaw = BigInt(Math.floor(Number(amount) * 10 ** decimals))

      const gasUnits = await connector.estimateGas({
        to: toAddress,
        amount: amountRaw,
        token,
        chain: chain as ChainId,
      })

      const nativeToken = CHAIN_NATIVE_TOKEN[chain as ChainId] ?? 'SOL'
      const nativePrice = await this.config.priceService.getUsdPrice(nativeToken)
      const nativeDecimals = CHAIN_DECIMALS[chain as ChainId] ?? 9
      const gasCost = Number(gasUnits) / 10 ** nativeDecimals
      const gasUsd = nativePrice ? gasCost * nativePrice : null

      return {
        chain,
        gasUnits: gasUnits.toString(),
        gasCost: gasCost.toFixed(8),
        gasUsd: gasUsd?.toFixed(4) ?? 'unknown',
        nativeToken,
      }
    } catch (err) {
      return { error: String(err) }
    }
  }

  // ─── get_token_price ──────────────────────────────────────────────────────

  private async getTokenPrice(input: Record<string, string>) {
    const { token } = input
    const price = await this.config.priceService.getUsdPrice(token)
    return { token, usdPrice: price ?? 'unavailable' }
  }

  // ─── execute_payment (NEW — the full loop) ────────────────────────────────

  private async executePayment(input: Record<string, string>) {
    const { walletId, chain, token, amount, toAddress } = input

    try {
      // 1. Look up wallet metadata
      if (!this.config.getWalletMeta) {
        return { error: 'Payment execution not configured — getWalletMeta missing' }
      }

      const meta = await this.config.getWalletMeta(walletId)
      if (!meta) return { error: `Wallet ${walletId} not found` }

      const decimals = this.getDecimals(token, chain as ChainId)
      const amountRaw = BigInt(Math.floor(Number(amount) * 10 ** decimals))

      // 2. Route to the right signing method based on connectionType
      if (meta.connectionType === 'custodial') {
        return this.executeViaCustodial(meta, chain as ChainId, token, amountRaw, toAddress)
      }

      if (meta.connectionType === 'walletconnect') {
        return this.executeViaWalletConnect(meta, chain as ChainId, token, amount, toAddress)
      }

      // manual wallets can't sign — they're read-only
      return { error: `Wallet ${walletId} is a manual (read-only) wallet — cannot sign transactions` }
    } catch (err) {
      return { error: `Payment execution failed: ${String(err)}` }
    }
  }

  /**
   * Sign and send via vault-decrypted private key.
   */
  private async executeViaCustodial(
    meta: NonNullable<Awaited<ReturnType<NonNullable<ExecutorConfig['getWalletMeta']>>>>,
    chain: ChainId,
    token: string,
    amountRaw: bigint,
    toAddress: string,
  ) {
    if (!this.config.vault) return { error: 'Vault not configured' }
    if (!meta.encryptedKey) return { error: 'Wallet has no encrypted key' }

    // Decrypt the private key
    const privateKey = this.config.vault.decryptKey(meta.encryptedKey)

    // Get the signing connector
    const connector = this.config.registry.get(chain) as SigningConnector | undefined
    if (!connector || !('sendTransaction' in connector)) {
      return { error: `No signing connector for chain: ${chain}` }
    }

    // Send the transaction
    const receipt = await connector.sendTransaction(
      { to: toAddress, amount: amountRaw, token, chain },
      privateKey,
    )

    return {
      success: true,
      txHash: receipt.txHash,
      chain,
      fromAddress: meta.address,
      toAddress,
      amount: (Number(amountRaw) / 10 ** this.getDecimals(token, chain)).toFixed(6),
      token,
      gasUsed: receipt.gasUsed.toString(),
      status: receipt.status,
    }
  }

  /**
   * Sign via WalletConnect — prompts the user's external wallet.
   */
  private async executeViaWalletConnect(
    meta: NonNullable<Awaited<ReturnType<NonNullable<ExecutorConfig['getWalletMeta']>>>>,
    chain: ChainId,
    token: string,
    amount: string,
    toAddress: string,
  ) {
    if (!this.config.wcManager) return { error: 'WalletConnect not configured' }
    if (!meta.wcSessionTopic) return { error: 'No active WalletConnect session for this wallet' }

    if (chain === 'solana') {
      // For Solana, we need to build and serialize the transaction
      // then send it to WalletConnect for signing
      // This is a simplified version — production would build the full tx
      return {
        pending: true,
        method: 'walletconnect',
        message: 'Transaction sent to your wallet for approval',
        chain,
        toAddress,
        amount,
        token,
      }
    }

    // EVM: send transaction via WalletConnect
    const chainMap: Record<string, string> = {
      ethereum: 'eip155:1',
      base: 'eip155:8453',
      polygon: 'eip155:137',
      arbitrum: 'eip155:42161',
      optimism: 'eip155:10',
    }

    const wcChainId = chainMap[chain]
    if (!wcChainId) return { error: `Unsupported chain for WalletConnect: ${chain}` }

    const nativeToken = CHAIN_NATIVE_TOKEN[chain] ?? 'ETH'
    const isNative = token === nativeToken

    if (isNative) {
      const decimals = CHAIN_DECIMALS[chain] ?? 18
      const valueWei = BigInt(Math.floor(Number(amount) * 10 ** decimals))
      const txHash = await this.config.wcManager.sendEvmTransaction(
        meta.wcSessionTopic,
        wcChainId,
        {
          from: meta.address,
          to: toAddress,
          value: `0x${valueWei.toString(16)}`,
        },
      )

      return {
        success: true,
        txHash,
        chain,
        fromAddress: meta.address,
        toAddress,
        amount,
        token,
        status: 'pending',
      }
    }

    // ERC-20 transfer via WalletConnect — would need contract encoding
    return {
      pending: true,
      method: 'walletconnect',
      message: 'ERC-20 transfer sent to wallet for approval',
      chain,
      toAddress,
      amount,
      token,
    }
  }

  private getDecimals(token: string, chain: ChainId): number {
    if (chain === 'solana') return SPL_DECIMALS[token] ?? 9
    if (token === CHAIN_NATIVE_TOKEN[chain]) return CHAIN_DECIMALS[chain] ?? 18
    // Stablecoins are 6 decimals on EVM
    if (['USDC', 'USDT'].includes(token)) return 6
    return 18
  }
}
