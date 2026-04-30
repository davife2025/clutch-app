export interface X402PaymentRequired {
  /** Amount in smallest token units (lamports, micro-USDC, wei) */
  amount: string
  /** Token: USDC, SOL, ETH, etc. */
  currency: string
  /** Recipient address */
  payTo: string
  /** Chain: solana, ethereum, base, etc. */
  network: string
  /** Unix timestamp — payment must complete before this */
  expiresAt: number
  /** Human-readable description of what's being paid for */
  description?: string
  /** Resource being unlocked (URL or ID) */
  resource?: string
  /** Optional receipt verification endpoint */
  receiptUrl?: string
}

export interface X402PaymentProof {
  txHash: string
  network: string
  amount: string
  currency: string
  paidAt: number
  payTo: string
}

export interface X402Receipt {
  receiptId: string
  txHash: string
  verifiedAt: number
  resource?: string
}
