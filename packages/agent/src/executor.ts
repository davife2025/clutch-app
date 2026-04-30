import type { ConnectorRegistry, WalletConnectManager } from '@clutch/connectors'
import type { ChainId } from '@clutch/core'
import { SPL_DECIMALS } from '@clutch/core'
import type { VaultService } from '@clutch/vault'
import type { ToolExecutor } from './agent.js'

export interface ExecutorConfig {
  registry: ConnectorRegistry
  priceService: {
    getUsdPrice(token: string): Promise<number | null>
    getBatchPrices(tokens: string[]): Promise<Record<string, number>>
  }
  vault?: VaultService
  wcManager?: WalletConnectManager | null
  getWalletMeta?: (walletId: string) => Promise<{
    address: string
    chain: string
    connectionType: string
    encryptedKey?: string | null
    wcSessionTopic?: string | null
  } | null>
}

/**
 * Solana-first tool executor.
 *
 * Read tools (balance, gas, price) work for all chains.
 * Write tools (execute_payment) only route to Solana wallets.
 */
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
        readOnly: chain !== 'solana',
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

  // ─── estimate_gas_fee (Solana-only) ───────────────────────────────────────

  private async estimateGasFee(input: Record<string, string>) {
    const { chain, token, amount, toAddress } = input

    if (chain !== 'solana') {
      return {
        error: 'Clutch only executes on Solana — EVM chains are read-only for balance display.',
        suggestion: 'Use Solana for payments. USDC on Solana has fees ~$0.0003 vs $5+ on Ethereum.',
      }
    }

    try {
      const connector = this.config.registry.solana()
      const decimals = SPL_DECIMALS[token] ?? 9
      const amountRaw = BigInt(Math.floor(Number(amount) * 10 ** decimals))

      const lamports = await connector.estimateGas({
        to: toAddress,
        amount: amountRaw,
        token,
        chain: 'solana',
      })

      // Check if recipient ATA needs creation (adds ~0.00204 SOL rent)
      const needsAta = await connector.needsAtaCreation(toAddress, token)
      const ataRentLamports = needsAta ? 2_039_280n : 0n
      const totalLamports = lamports + ataRentLamports

      const solPrice = (await this.config.priceService.getUsdPrice('SOL')) ?? 0
      const totalSol = Number(totalLamports) / 1e9
      const totalUsd = totalSol * solPrice

      return {
        chain: 'solana',
        feeLamports: totalLamports.toString(),
        feeSol: totalSol.toFixed(8),
        feeUsd: totalUsd.toFixed(6),
        ataCreationRequired: needsAta,
        ataRentSol: needsAta ? '0.00204' : '0',
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

  // ─── execute_payment (Solana-only) ────────────────────────────────────────

  private async executePayment(input: Record<string, string>) {
    const { walletId, chain, token, amount, toAddress } = input

    // Hard guard: Solana only
    if (chain !== 'solana') {
      return {
        error: 'Clutch executes payments on Solana only.',
        explanation:
          'EVM wallets in this pocket are read-only. To pay USD, use USDC on Solana (much cheaper and faster).',
        suggestedAction: 'Re-route this payment through a Solana wallet.',
      }
    }

    try {
      if (!this.config.getWalletMeta) {
        return { error: 'Payment execution not configured — getWalletMeta missing' }
      }

      const meta = await this.config.getWalletMeta(walletId)
      if (!meta) return { error: `Wallet ${walletId} not found` }

      // Reject non-Solana wallets even if the agent passed chain=solana
      if (meta.chain !== 'solana') {
        return {
          error: `Wallet ${walletId} is on ${meta.chain}, not Solana. Pick a Solana wallet.`,
        }
      }

      const decimals = SPL_DECIMALS[token] ?? 9
      const amountRaw = BigInt(Math.floor(Number(amount) * 10 ** decimals))

      // Route by connection type
      if (meta.connectionType === 'custodial') {
        return this.executeCustodial(meta, token, amountRaw, toAddress)
      }

      if (meta.connectionType === 'walletconnect') {
        return this.executeWalletConnect(meta, token, amount, toAddress)
      }

      return {
        error: `Wallet ${walletId} is manual (read-only) — cannot sign. Connect via Wallet Standard or import a custodial key.`,
      }
    } catch (err) {
      return { error: `Payment execution failed: ${String(err)}` }
    }
  }

  private async executeCustodial(
    meta: NonNullable<Awaited<ReturnType<NonNullable<ExecutorConfig['getWalletMeta']>>>>,
    token: string,
    amountRaw: bigint,
    toAddress: string,
  ) {
    if (!this.config.vault) return { error: 'Vault not configured' }
    if (!meta.encryptedKey) return { error: 'Wallet has no encrypted key' }

    const privateKey = this.config.vault.decryptKey(meta.encryptedKey)
    const connector = this.config.registry.solana()

    const receipt = await connector.sendTransaction(
      { to: toAddress, amount: amountRaw, token, chain: 'solana' },
      privateKey,
    )

    const decimals = SPL_DECIMALS[token] ?? 9

    return {
      success: receipt.status === 'success',
      txHash: receipt.txHash,
      chain: 'solana',
      fromAddress: meta.address,
      toAddress,
      amount: (Number(amountRaw) / 10 ** decimals).toFixed(6),
      token,
      gasUsed: receipt.gasUsed.toString(),
      status: receipt.status,
      explorerUrl: `https://solscan.io/tx/${receipt.txHash}`,
    }
  }

  private async executeWalletConnect(
    meta: NonNullable<Awaited<ReturnType<NonNullable<ExecutorConfig['getWalletMeta']>>>>,
    token: string,
    amount: string,
    toAddress: string,
  ) {
    if (!this.config.wcManager) return { error: 'WalletConnect not configured' }
    if (!meta.wcSessionTopic) return { error: 'No active WalletConnect session for this wallet' }

    // Solana via WalletConnect — production would build the full versioned tx
    // and serialize it for the user's wallet to sign. This is the structured
    // payload the wallet receives.
    return {
      pending: true,
      method: 'walletconnect',
      message: 'Transaction sent to your wallet for approval',
      chain: 'solana',
      fromAddress: meta.address,
      toAddress,
      amount,
      token,
    }
  }
}
