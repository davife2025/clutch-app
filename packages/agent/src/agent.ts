import Anthropic from '@anthropic-ai/sdk'
import type { ChainId } from '@clutch/core'
import type {
  PocketContext,
  AgentDecision,
  AgentAnalysis,
  PaymentRequest,
  PaymentExecution,
} from './types.js'
import { AGENT_TOOLS } from './tools.js'

const MODEL = 'claude-sonnet-4-20250514'
const MAX_TOOL_ROUNDS = 8

export interface ToolExecutor {
  execute(toolName: string, input: Record<string, string>): Promise<unknown>
}

export class ClutchAgent {
  private client: Anthropic

  constructor(apiKey?: string) {
    this.client = new Anthropic({ apiKey: apiKey ?? process.env.ANTHROPIC_API_KEY })
  }

  // ── Payment routing (decide only) ──────────────────────────────────────────

  async resolvePayment(
    context: PocketContext,
    request: PaymentRequest,
    executor: ToolExecutor,
  ): Promise<AgentDecision> {
    const messages: Anthropic.Messages.MessageParam[] = [
      { role: 'user', content: buildPaymentUserMessage(request) },
    ]

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const response = await this.client.messages.create({
        model: MODEL,
        max_tokens: 1024,
        system: buildPaymentSystemPrompt(context),
        tools: AGENT_TOOLS as any,
        messages,
      })

      messages.push({ role: 'assistant', content: response.content })

      const toolResults: Anthropic.Messages.ToolResultBlockParam[] = []
      let decision: AgentDecision | null = null

      for (const block of response.content) {
        if (block.type !== 'tool_use') continue

        if (block.name === 'select_payment_wallet') {
          const input = block.input as any
          decision = {
            walletId: input.walletId,
            chain: input.chain as ChainId,
            token: input.token,
            reasoning: input.reasoning,
            confidence: input.confidence,
          }
          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: JSON.stringify({ confirmed: true }),
          })
        } else if (block.name === 'execute_payment' || block.name === 'swap_tokens') {
          // In resolve-only mode, don't execute on-chain actions — just confirm selection
          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: JSON.stringify({ skipped: true, reason: 'resolve-only mode' }),
          })
        } else {
          const result = await executor.execute(block.name, block.input as Record<string, string>)
          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: JSON.stringify(result),
          })
        }
      }

      messages.push({ role: 'user', content: toolResults })
      if (decision) return decision
    }

    throw new Error('Agent exceeded max tool rounds without selecting a wallet')
  }

  // ── Full payment execution (decide + send) ─────────────────────────────────

  async executePayment(
    context: PocketContext,
    request: PaymentRequest,
    executor: ToolExecutor,
  ): Promise<PaymentExecution> {
    const messages: Anthropic.Messages.MessageParam[] = [
      {
        role: 'user',
        content: buildPaymentUserMessage(request) +
          '\n\nAfter selecting the wallet, ALSO call execute_payment to send the transaction.',
      },
    ]

    let decision: AgentDecision | null = null
    let execution: any = null

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const response = await this.client.messages.create({
        model: MODEL,
        max_tokens: 1024,
        system: buildPaymentSystemPrompt(context),
        tools: AGENT_TOOLS as any,
        messages,
      })

      messages.push({ role: 'assistant', content: response.content })

      const toolResults: Anthropic.Messages.ToolResultBlockParam[] = []

      for (const block of response.content) {
        if (block.type !== 'tool_use') continue

        if (block.name === 'select_payment_wallet') {
          const input = block.input as any
          decision = {
            walletId: input.walletId,
            chain: input.chain as ChainId,
            token: input.token,
            reasoning: input.reasoning,
            confidence: input.confidence,
          }
          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: JSON.stringify({ confirmed: true, message: 'Now call execute_payment' }),
          })
        } else if (block.name === 'execute_payment') {
          execution = await executor.execute(block.name, block.input as Record<string, string>)
          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: JSON.stringify(execution),
          })
        } else {
          const result = await executor.execute(block.name, block.input as Record<string, string>)
          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: JSON.stringify(result),
          })
        }
      }

      messages.push({ role: 'user', content: toolResults })

      if (decision && execution) {
        return {
          decision,
          txHash: execution.txHash ?? '',
          chain: decision.chain,
          fromAddress: execution.fromAddress ?? '',
          toAddress: request.to,
          amount: request.amount,
          token: request.token,
          status: execution.success ? 'confirmed' : execution.pending ? 'pending' : 'failed',
        }
      }
    }

    throw new Error('Agent exceeded max tool rounds without completing payment')
  }

  // ── Analysis ───────────────────────────────────────────────────────────────

  async analyzePocket(context: PocketContext): Promise<AgentAnalysis> {
    const response = await this.client.messages.create({
      model: MODEL,
      max_tokens: 2048,
      system: `You are Clutch's AI portfolio analyst. Clutch is a Solana-first wallet pocket.
Analyse the user's portfolio and return ONLY valid JSON — no markdown, no preamble.`,
      messages: [{ role: 'user', content: buildAnalysisPrompt(context) }],
    })

    const text = response.content
      .filter((b): b is Anthropic.Messages.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('')

    try {
      return JSON.parse(text.trim()) as AgentAnalysis
    } catch {
      return {
        summary: text.slice(0, 200),
        insights: [],
        totalUsdValue: context.totalUsdValue,
        healthScore: 50,
        suggestedActions: [],
      }
    }
  }

  // ── Chat ───────────────────────────────────────────────────────────────────

  async *chat(
    context: PocketContext,
    messages: Array<{ role: 'user' | 'assistant'; content: string }>,
    executor: ToolExecutor,
  ): AsyncGenerator<string> {
    const stream = this.client.messages.stream({
      model: MODEL,
      max_tokens: 1024,
      system: buildChatSystemPrompt(context),
      tools: AGENT_TOOLS as any,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    })

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        yield event.delta.text
      }
    }
  }
}

// ── Prompt builders ──────────────────────────────────────────────────────────

function buildPaymentSystemPrompt(ctx: PocketContext): string {
  const solanaWallets = ctx.wallets.filter((w) => w.wallet.chain === 'solana')
  const evmWallets = ctx.wallets.filter((w) => w.wallet.chain !== 'solana')

  const formatWallet = (w: typeof ctx.wallets[number]) => {
    const bals = w.balances
      .map(
        (b) =>
          `    ${b.token}: ${(Number(b.amount) / 10 ** b.decimals).toFixed(6)} (~$${b.usdValue ?? '?'})`,
      )
      .join('\n')
    return `  Wallet ${w.wallet.id} [${w.wallet.chain}] ${w.wallet.label ?? w.wallet.address.slice(0, 8)}...
    Type: ${w.wallet.type} · Connection: ${w.wallet.connectionType}${w.wallet.isDefault ? ' (default)' : ''}
${bals || '    (no balances cached)'}`
  }

  const solanaSection = solanaWallets.length
    ? solanaWallets.map(formatWallet).join('\n\n')
    : '  (no Solana wallets — payment cannot be executed)'

  const evmSection = evmWallets.length
    ? evmWallets.map(formatWallet).join('\n\n')
    : '  (none)'

  return `You are Clutch's AI payment router. Clutch is Solana-native.

POCKET: "${ctx.pocketName}"
Native SOL in pocket: ${ctx.nativeBalanceSol} SOL (~$${ctx.nativeBalanceUsd.toFixed(2)})
Total portfolio value: $${ctx.totalUsdValue.toFixed(2)}

═══ SOLANA WALLETS (signing-capable) ═══
${solanaSection}

═══ EXTERNAL BALANCES (read-only, cannot sign) ═══
${evmSection}

CORE RULE: Clutch executes payments ONLY on Solana.
- EVM wallets are shown for portfolio completeness but CANNOT be used for payment
- For USD payments, use USDC on Solana (~$0.0003 fee, sub-second finality)
- For SOL payments, use native SOL from a Solana wallet
- "manual" connectionType wallets are read-only — pick "custodial" or "walletconnect"

YOUR JOB:
1. Use tools to check Solana wallet balances and estimate fees
2. Pick the best Solana wallet (default first if it has funds)
3. Call select_payment_wallet — chain MUST be "solana"
4. Call execute_payment to send the transaction

SWAP-THEN-PAY (for token mismatches):
If a Solana wallet has enough total value but in the WRONG token (e.g. user wants
to pay USDC but the wallet only has SOL), use this flow:
  a) Call quote_swap to see the swap rate (input → output)
  b) If price impact is acceptable (< 1% for stable pairs), call swap_tokens
     to convert via Jupiter — this only works on custodial wallets
  c) Then call select_payment_wallet and execute_payment with the new token
Only use swap-then-pay when there's no Solana wallet that already holds the
target token. Direct payment is always preferred.

If no Solana wallet has sufficient balance (after considering swaps), say so
clearly. Do NOT route to EVM.`
}

function buildPaymentUserMessage(req: PaymentRequest): string {
  return `Pay ${req.amount} ${req.token} to ${req.to} on Solana${req.memo ? `\nMemo: ${req.memo}` : ''}`
}

function buildAnalysisPrompt(ctx: PocketContext): string {
  const walletDetails = ctx.wallets.map((w) => ({
    id: w.wallet.id,
    chain: w.wallet.chain,
    type: w.wallet.type,
    connectionType: w.wallet.connectionType,
    label: w.wallet.label,
    balances: w.balances.map((b) => ({
      token: b.token,
      amount: (Number(b.amount) / 10 ** b.decimals).toFixed(6),
      usdValue: b.usdValue,
    })),
    totalUsd: w.totalUsdValue,
  }))

  return `Analyse this Clutch pocket and return JSON:
{
  "summary": "2-3 sentence overview",
  "insights": [{ "type": "low_balance|diversification|gas_optimization|rebalance|info", "severity": "info|warning|critical", "title": "...", "message": "...", "walletId": "optional", "chain": "optional" }],
  "totalUsdValue": ${ctx.totalUsdValue},
  "healthScore": 0-100,
  "suggestedActions": ["..."]
}

POCKET: ${JSON.stringify({ name: ctx.pocketName, totalUsd: ctx.totalUsdValue, nativeSol: ctx.nativeBalanceSol, wallets: walletDetails }, null, 2)}`
}

function buildChatSystemPrompt(ctx: PocketContext): string {
  const solanaCount = ctx.wallets.filter((w) => w.wallet.chain === 'solana').length
  const evmCount = ctx.wallets.length - solanaCount
  return `You are Clutch's AI assistant — a Solana-native wallet agent.

POCKET: "${ctx.pocketName}"
Total value: $${ctx.totalUsdValue.toFixed(2)}
Solana wallets: ${solanaCount} (signing-capable)
External (read-only): ${evmCount}
Native SOL in pocket: ${ctx.nativeBalanceSol} SOL

You specialize in Solana — SPL tokens, lamports, priority fees, ATAs, the Solana ecosystem.
Payments execute on Solana only. EVM wallets are external balances shown for completeness.
Be concise and practical. Cite Solana primitives when relevant (e.g. "ATA creation costs 0.00204 SOL").`
}
