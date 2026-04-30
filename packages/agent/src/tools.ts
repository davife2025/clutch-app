import type { AgentTool } from './types.js'

export const AGENT_TOOLS: AgentTool[] = [
  {
    name: 'get_wallet_balance',
    description:
      'Get the current token balances for a wallet. Returns all token balances with USD values.',
    input_schema: {
      type: 'object',
      properties: {
        walletId: { type: 'string', description: 'The wallet ID' },
        address: { type: 'string', description: 'The wallet address' },
        chain: {
          type: 'string',
          description: 'Chain ID: solana, ethereum, base, polygon, arbitrum, optimism',
        },
      },
      required: ['walletId', 'address', 'chain'],
    },
  },
  {
    name: 'estimate_gas_fee',
    description:
      'Estimate gas fee in USD for a transaction. Use this to compare costs across chains.',
    input_schema: {
      type: 'object',
      properties: {
        chain: { type: 'string', description: 'Chain to estimate gas on' },
        token: { type: 'string', description: 'Token being sent' },
        amount: { type: 'string', description: 'Amount in human-readable units' },
        toAddress: { type: 'string', description: 'Destination address' },
      },
      required: ['chain', 'token', 'amount', 'toAddress'],
    },
  },
  {
    name: 'get_token_price',
    description: 'Get current USD price for a token.',
    input_schema: {
      type: 'object',
      properties: {
        token: { type: 'string', description: 'Token symbol e.g. SOL, USDC, ETH' },
      },
      required: ['token'],
    },
  },
  {
    name: 'select_payment_wallet',
    description:
      'Select which wallet, chain, and token to use for payment. Call this once you have enough context.',
    input_schema: {
      type: 'object',
      properties: {
        walletId: { type: 'string', description: 'Wallet ID to pay from' },
        chain: { type: 'string', description: 'Chain to execute on' },
        token: { type: 'string', description: 'Token to use' },
        reasoning: { type: 'string', description: 'Why this wallet/chain/token was chosen' },
        confidence: { type: 'string', description: 'high | medium | low' },
      },
      required: ['walletId', 'chain', 'token', 'reasoning', 'confidence'],
    },
  },
  {
    name: 'execute_payment',
    description:
      'Execute a payment on-chain. Signs and broadcasts the transaction. Only call this AFTER select_payment_wallet confirms the choice.',
    input_schema: {
      type: 'object',
      properties: {
        walletId: { type: 'string', description: 'Wallet ID to send from' },
        chain: { type: 'string', description: 'Chain to execute on' },
        token: { type: 'string', description: 'Token to send' },
        amount: { type: 'string', description: 'Amount in human-readable units' },
        toAddress: { type: 'string', description: 'Destination address' },
      },
      required: ['walletId', 'chain', 'token', 'amount', 'toAddress'],
    },
  },
]

export const TOOL_NAMES = AGENT_TOOLS.map((t) => t.name)
