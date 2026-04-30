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
  data?: string // for smart contract calls
  gasLimit?: bigint
}

export interface TxReceipt {
  txHash: string
  blockNumber: bigint
  gasUsed: bigint
  status: 'success' | 'reverted'
}

/** Read-only connector — can fetch balances and estimate gas. */
export interface WalletConnector {
  readonly chain: ChainId
  readonly name: string

  getBalances(address: string): Promise<TokenBalance[]>
  getNativeBalance(address: string): Promise<bigint>
  estimateGas(request: TxRequest): Promise<bigint>
  ping(): Promise<boolean>
}

/** Signing connector — can also send transactions and sign messages. */
export interface SigningConnector extends WalletConnector {
  sendTransaction(request: TxRequest, privateKey: string): Promise<TxReceipt>
  signMessage(message: string, privateKey: string): Promise<string>
}
