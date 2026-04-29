// ─── Chain ────────────────────────────────────────────────────────────────────

/** Solana is the primary chain. EVM chains are supported as secondary. */
export type ChainId = 'solana' | 'ethereum' | 'base' | 'polygon' | 'arbitrum' | 'optimism'

export type WalletType = 'hot' | 'cold' | 'hardware' | 'native'

/** How this wallet was connected to the pocket. */
export type ConnectionType = 'manual' | 'walletconnect' | 'custodial'

// ─── Wallet ───────────────────────────────────────────────────────────────────

export interface Wallet {
  id: string
  pocketId: string
  type: WalletType
  connectionType: ConnectionType
  address: string
  chain: ChainId
  label?: string
  isDefault: boolean
  addedAt: Date
}

export interface WalletBalance {
  walletId: string
  chain: ChainId
  token: string // 'SOL', 'USDC', 'BONK', 'ETH', etc.
  amount: bigint
  decimals: number
  usdValue?: number
  fetchedAt: Date
}

// ─── Pocket ───────────────────────────────────────────────────────────────────

export interface Pocket {
  id: string
  ownerId: string
  name: string
  wallets: Wallet[]
  /** Native balance in lamports (1 SOL = 1_000_000_000 lamports) */
  nativeBalance: bigint
  createdAt: Date
  updatedAt: Date
}

/** Aggregated view of a pocket — total USD, per-wallet breakdown. */
export interface PocketSummary {
  pocket: Pocket
  totalUsdValue: number
  wallets: Array<{
    wallet: Wallet
    usdValue: number
    balances: WalletBalance[]
  }>
}

// ─── User ─────────────────────────────────────────────────────────────────────

export interface User {
  id: string
  email: string
  passwordHash: string
  createdAt: Date
  updatedAt: Date
}

// ─── Transactions ─────────────────────────────────────────────────────────────

export type TxStatus = 'pending' | 'confirmed' | 'failed'
export type TxType = 'deposit' | 'withdraw' | 'payment' | 'transfer'

export interface Transaction {
  id: string
  pocketId: string
  walletId?: string
  type: TxType
  status: TxStatus
  fromAddress: string
  toAddress: string
  amount: bigint
  token: string
  chain: ChainId
  txHash?: string
  memo?: string
  createdAt: Date
  confirmedAt?: Date
}

// ─── Payments ─────────────────────────────────────────────────────────────────

export interface PaymentIntent {
  to: string
  amount: bigint
  token: string
  chain: ChainId
  fromWalletId?: string
  memo?: string
  x402?: boolean
}

export interface PaymentResult {
  txHash: string
  walletId: string
  chain: ChainId
  paidAt: Date
  fee?: bigint
}

// ─── API ──────────────────────────────────────────────────────────────────────

export interface ApiResponse<T> {
  data: T
  error?: never
}
export interface ApiError {
  data?: never
  error: { code: string; message: string }
}
export type ApiResult<T> = ApiResponse<T> | ApiError
