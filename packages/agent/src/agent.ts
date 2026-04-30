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
        } else if (block.name === 'execute_payment') {
          // In resolve-only mode, don't actually execute — just confirm selection
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
  const walletSummary = ctx.wallets
    .map((w) => {
      const bals = w.balances
        .map(
          (b) =>
            `    ${b.token}: ${(Number(b.amount) / 10 ** b.decimals).toFixed(6)} (~$${b.usdValue ?? '?'})`,
        )
        .join('\n')
      return `  Wallet ${w.wallet.id} [${w.wallet.chain}] ${w.wallet.label ?? w.wallet.address.slice(0, 8)}...
    Type: ${w.wallet.type} · Connection: ${w.wallet.connectionType}${w.wallet.isDefault ? ' (default)' : ''}
${bals || '    (no balances cached)'}`
    })
    .join('\n\n')

  return `You are Clutch's AI payment router for a Solana-first wallet pocket.

POCKET: "${ctx.pocketName}"
Native SOL balance (in pocket): ${ctx.nativeBalanceSol} SOL (~$${ctx.nativeBalanceUsd.toFixed(2)})
Total portfolio value: $${ctx.totalUsdValue.toFixed(2)}

WALLETS:
${walletSummary}

YOUR JOB:
1. Understand the payment request
2. Use tools to check balances and estimate fees
3. Select the optimal wallet:
   - Prefer Solana — lower fees, faster finality
   - Prefer USDC on Solana for USD-denominated payments
   - Prefer the default wallet when it has enough funds
   - Fall back to EVM chains only if no Solana option works
   - ONLY pick wallets with connectionType "custodial" or "walletconnect" — "manual" wallets cannot sign
4. Call select_payment_wallet with your decision
5. Then call execute_payment to send the transaction

Be decisive. Explain your reasoning clearly.`
}

function buildPaymentUserMessage(req: PaymentRequest): string {
  return `Pay ${req.amount} ${req.token} to ${req.to}${req.chain ? ` on ${req.chain}` : ' (pick best chain — prefer Solana)'}${req.memo ? `\nMemo: ${req.memo}` : ''}`
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
  return `You are Clutch's AI assistant — a Solana-first wallet agent.

POCKET: "${ctx.pocketName}"
Total value: $${ctx.totalUsdValue.toFixed(2)}
Wallets: ${ctx.wallets.length} (${ctx.wallets.filter((w) => w.wallet.chain === 'solana').length} Solana)
Native SOL in pocket: ${ctx.nativeBalanceSol} SOL

You can check balances, estimate gas, look up prices, and execute payments.
Be concise and practical.`
}
