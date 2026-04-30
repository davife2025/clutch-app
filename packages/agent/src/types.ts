import type { ChainId, Wallet, WalletBalance } from '@clutch/core'

export interface WalletContext {
  wallet: Wallet
  balances: WalletBalance[]
  totalUsdValue: number
}

export interface PocketContext {
  pocketId: string
  pocketName: string
  nativeBalanceSol: string
  nativeBalanceUsd: number
  wallets: WalletContext[]
  totalUsdValue: number
}

export interface AgentDecision {
  walletId: string
  chain: ChainId
  token: string
  reasoning: string
  estimatedGasFee?: string
  confidence: 'high' | 'medium' | 'low'
}

export interface AgentInsight {
  type: 'low_balance' | 'diversification' | 'gas_optimization' | 'rebalance' | 'info'
  severity: 'info' | 'warning' | 'critical'
  title: string
  message: string
  walletId?: string
  chain?: ChainId
}

export interface AgentAnalysis {
  summary: string
  insights: AgentInsight[]
  totalUsdValue: number
  healthScore: number
  suggestedActions: string[]
}

export interface PaymentRequest {
  to: string
  amount: string
  token: string
  chain?: ChainId
  memo?: string
}

export interface PaymentExecution {
  decision: AgentDecision
  txHash: string
  chain: ChainId
  fromAddress: string
  toAddress: string
  amount: string
  token: string
  status: 'confirmed' | 'pending' | 'failed'
}

export interface AgentTool {
  name: string
  description: string
  input_schema: {
    type: 'object'
    properties: Record<string, { type: string; description: string }>
    required: string[]
  }
}
