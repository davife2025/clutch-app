import type { ChainId } from '@clutch/core'

export interface TokenBalance {
  token: string
  amount: bigint
  decimals: number
  contractAddress?: string // undefined for native tokens
}

export interface TxRequest {
  to: string
  amount: bigint
  token: string
  chain: ChainId
  /** Solana: priority fee in micro-lamports per compute unit */
  priorityFeeMicroLamports?: number
  /** Solana: compute unit limit override */
  computeUnitLimit?: number
}

export interface TxReceipt {
  txHash: string
  blockNumber: bigint
  gasUsed: bigint
  status: 'success' | 'reverted'
}

/**
 * Read-only connector — fetches balances and pings RPC.
 * All chains (Solana + EVM) implement this for the pocket aggregation view.
 */
export interface ReadOnlyConnector {
  readonly chain: ChainId
  readonly name: string

  getBalances(address: string): Promise<TokenBalance[]>
  getNativeBalance(address: string): Promise<bigint>
  ping(): Promise<boolean>
}

/**
 * Signing connector — Solana only.
 * Clutch transacts exclusively on Solana. EVM wallets are read-only.
 */
export interface SigningConnector extends ReadOnlyConnector {
  readonly chain: 'solana'

  estimateGas(request: TxRequest): Promise<bigint>
  /**
   * Sign and send a transaction. The privateKey is base58-encoded.
   * Handles ATA creation, priority fees, and versioned transactions automatically.
   */
  sendTransaction(request: TxRequest, privateKey: string): Promise<TxReceipt>
  /** Sign a message — used for x402 proofs and authentication. */
  signMessage(message: string, privateKey: string): Promise<string>
  /** Check if the recipient needs an ATA created for a given SPL token. */
  needsAtaCreation(toAddress: string, tokenSymbol: string): Promise<boolean>
}

// Backwards compat — old code referred to WalletConnector. Alias to ReadOnlyConnector.
export type WalletConnector = ReadOnlyConnector
