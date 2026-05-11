import type { ConnectorRegistry, WalletConnectManager } from '@clutch/connectors'
import { getJupiterQuote, executeJupiterSwap } from '@clutch/connectors'
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
  /** Solana RPC URL — needed for swap execution */
  solanaRpcUrl?: string
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
      case 'quote_swap':
        return this.quoteSwap(input)
      case 'swap_tokens':
        return this.swapTokens(input)
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

    try {
      const decimals = SPL_DECIMALS[token] ?? 9
      const amountRaw = BigInt(Math.floor(Number(amount) * 10 ** decimals))
      const connector = this.config.registry.solana()

      // 1. Build the unsigned versioned transaction
      const { PublicKey, VersionedTransaction } = await import('@solana/web3.js')
      const fromPubkey = new PublicKey(meta.address)
      const { tx, blockhash, lastValidBlockHeight } = await connector.buildTransferTransaction(
        fromPubkey,
        {
          to: toAddress,
          amount: amountRaw,
          token,
          chain: 'solana',
        },
      )

      // 2. Serialize the (unsigned) tx for WC — the wallet expects base64
      const serialized = Buffer.from(tx.serialize()).toString('base64')

      // 3. Send to the user's wallet via WalletConnect — the wallet pops up,
      //    user approves, returns the signed transaction.
      //
      //    Per Solana WalletConnect spec, the response is a base64 signed tx.
      const signedBase64 = await this.config.wcManager.signSolanaTransaction(
        meta.wcSessionTopic,
        serialized,
      )

      // 4. Deserialize the signed tx and submit
      const signedBuf = Buffer.from(signedBase64, 'base64')
      const signedTx = VersionedTransaction.deserialize(signedBuf)

      const receipt = await connector.sendSignedTransaction(
        signedTx,
        blockhash,
        lastValidBlockHeight,
      )

      return {
        success: receipt.status === 'success',
        txHash: receipt.txHash,
        chain: 'solana',
        method: 'walletconnect',
        fromAddress: meta.address,
        toAddress,
        amount,
        token,
        gasUsed: receipt.gasUsed.toString(),
        status: receipt.status,
        explorerUrl: `https://solscan.io/tx/${receipt.txHash}`,
      }
    } catch (err) {
      // Common failure modes: user rejected in wallet, session expired,
      // network error. Surface a clear message.
      const message = (err as Error).message ?? String(err)
      if (message.toLowerCase().includes('user') && message.toLowerCase().includes('reject')) {
        return { error: 'Payment rejected in your wallet' }
      }
      if (message.toLowerCase().includes('session')) {
        return { error: 'WalletConnect session expired — reconnect this wallet' }
      }
      return { error: `WalletConnect signing failed: ${message}` }
    }
  }

  // ─── quote_swap (Jupiter quote) ───────────────────────────────────────────

  private async quoteSwap(input: Record<string, string>) {
    const { inputToken, outputToken, amount } = input

    try {
      const quote = await getJupiterQuote({
        inputToken,
        outputToken,
        amount,
        slippageBps: 50,
      })

      if (!quote) {
        return {
          error: `No swap route from ${inputToken} to ${outputToken}`,
          suggestion: 'Try a different token pair or check token symbols.',
        }
      }

      // Get USD value for context
      const outputPrice = await this.config.priceService.getUsdPrice(outputToken)
      const outputUsd = outputPrice
        ? (Number(quote.outputAmount) * outputPrice).toFixed(2)
        : null

      return {
        inputToken: quote.inputToken,
        outputToken: quote.outputToken,
        inputAmount: quote.inputAmount,
        outputAmount: quote.outputAmount,
        minimumReceived: quote.minimumReceived,
        priceImpactPct: quote.priceImpactPct,
        outputUsdValue: outputUsd,
        route: quote.route,
        exchange: 'Jupiter',
      }
    } catch (err) {
      return { error: `Quote failed: ${String(err)}` }
    }
  }

  // ─── swap_tokens (Jupiter swap execution) ─────────────────────────────────

  private async swapTokens(input: Record<string, string>) {
    const { walletId, inputToken, outputToken, amount, slippageBps } = input

    if (!this.config.getWalletMeta) {
      return { error: 'Swap execution not configured — getWalletMeta missing' }
    }
    if (!this.config.vault) {
      return { error: 'Swap execution requires the vault — only custodial wallets can swap directly' }
    }

    const meta = await this.config.getWalletMeta(walletId)
    if (!meta) return { error: `Wallet ${walletId} not found` }

    if (meta.chain !== 'solana') {
      return { error: 'Swaps only run on Solana wallets' }
    }

    if (meta.connectionType !== 'custodial') {
      return {
        error: `Wallet ${walletId} is ${meta.connectionType}. Direct Jupiter swap requires a custodial wallet (vault-decryptable key).`,
        suggestion:
          'For WalletConnect wallets, the user should swap manually in their wallet first, then return to pay.',
      }
    }

    if (!meta.encryptedKey) {
      return { error: 'Custodial wallet has no encrypted key' }
    }

    const rpcUrl =
      this.config.solanaRpcUrl ?? process.env.SOLANA_RPC_URL ?? 'https://api.mainnet-beta.solana.com'

    try {
      const privateKey = this.config.vault.decryptKey(meta.encryptedKey)

      const result = await executeJupiterSwap(rpcUrl, privateKey, {
        inputToken,
        outputToken,
        amount,
        slippageBps: slippageBps ? Number(slippageBps) : 50,
      })

      return {
        success: true,
        txHash: result.txHash,
        inputToken: result.inputToken,
        outputToken: result.outputToken,
        inputAmount: result.inputAmount,
        outputAmount: result.outputAmount,
        explorerUrl: `https://solscan.io/tx/${result.txHash}`,
        message: `Swapped ${result.inputAmount} ${result.inputToken} for ${result.outputAmount} ${result.outputToken}`,
      }
    } catch (err) {
      return { error: `Swap execution failed: ${String(err)}` }
    }
  }
}
