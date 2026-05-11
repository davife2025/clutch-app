/**
 * ClutchAgent — payment routing, analysis, and chat through Kimi K2.
 *
 * Uses Hugging Face Inference Providers, which exposes an OpenAI-compatible
 * endpoint that fans out to any of HF's hosted providers (Together, Fireworks,
 * Hyperbolic, Novita, etc). The default model is moonshotai/Kimi-K2-Instruct-0905
 * — strong tool-use, 256k context, much cheaper than Claude.
 *
 * Override behavior via env:
 *   HF_TOKEN                    — required
 *   CLUTCH_LLM_BASE_URL         — defaults to https://router.huggingface.co/v1
 *   CLUTCH_LLM_MODEL            — defaults to moonshotai/Kimi-K2-Instruct-0905
 *
 * Why HF Inference Providers and not Moonshot directly:
 *   HF unifies billing across 15+ providers, automatic provider failover,
 *   and the same OpenAI API shape. If Moonshot's hosted endpoint goes down,
 *   HF routes to Together or Fireworks transparently. Set CLUTCH_LLM_BASE_URL
 *   to https://api.moonshot.ai/v1 if you want to hit Moonshot directly.
 */

import OpenAI from 'openai'
import type { ChatCompletionMessageParam, ChatCompletionTool } from 'openai/resources/chat/completions'
import type { ChainId } from '@clutch/core'
import type {
  PocketContext,
  AgentDecision,
  AgentAnalysis,
  PaymentRequest,
  PaymentExecution,
} from './types.js'
import { AGENT_TOOLS } from './tools.js'

const DEFAULT_BASE_URL = 'https://router.huggingface.co/v1'
const DEFAULT_MODEL = 'moonshotai/Kimi-K2-Instruct-0905'
const MAX_TOOL_ROUNDS = 8
const TEMPERATURE = 0.6 // Kimi K2's recommended temperature

export interface ToolExecutor {
  execute(toolName: string, input: Record<string, string>): Promise<unknown>
}

export class ClutchAgent {
  private client: OpenAI
  private model: string

  constructor(apiKey?: string) {
    const token = apiKey ?? process.env.HF_TOKEN ?? process.env.HUGGINGFACE_TOKEN
    if (!token) {
      // Don't throw at construction time — allow analysis-only flows to succeed
      // even without a token. Throw on first actual API call instead.
      console.warn('[ClutchAgent] HF_TOKEN not set — LLM calls will fail until set')
    }
    this.client = new OpenAI({
      apiKey: token ?? 'missing',
      baseURL: process.env.CLUTCH_LLM_BASE_URL ?? DEFAULT_BASE_URL,
    })
    this.model = process.env.CLUTCH_LLM_MODEL ?? DEFAULT_MODEL
  }

  // ── Payment routing (decide only) ──────────────────────────────────────────

  async resolvePayment(
    context: PocketContext,
    request: PaymentRequest,
    executor: ToolExecutor,
  ): Promise<AgentDecision> {
    const messages: ChatCompletionMessageParam[] = [
      { role: 'system', content: buildPaymentSystemPrompt(context) },
      { role: 'user', content: buildPaymentUserMessage(request) },
    ]
    const tools = toOpenAITools(AGENT_TOOLS)

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages,
        tools,
        temperature: TEMPERATURE,
        max_tokens: 1024,
      })
      const msg = response.choices[0]?.message
      if (!msg) throw new Error('Empty response from LLM')

      messages.push(msg)

      // No tool calls? The model is just talking — allow it but don't loop forever.
      if (!msg.tool_calls || msg.tool_calls.length === 0) {
        throw new Error(`Agent did not call select_payment_wallet. Reply: ${msg.content ?? ''}`)
      }

      let decision: AgentDecision | null = null
      for (const tc of msg.tool_calls) {
        if (tc.type !== 'function') continue
        const name = tc.function.name
        const input = safeParseJson(tc.function.arguments) as Record<string, any>

        if (name === 'select_payment_wallet') {
          decision = {
            walletId: String(input.walletId),
            chain: input.chain as ChainId,
            token: String(input.token),
            reasoning: String(input.reasoning ?? ''),
            confidence: (input.confidence ?? "medium") as "high" | "medium" | "low",
          }
          messages.push({
            role: 'tool',
            tool_call_id: tc.id,
            content: JSON.stringify({ confirmed: true }),
          })
        } else if (name === 'execute_payment' || name === 'swap_tokens') {
          // resolve-only mode: don't actually execute
          messages.push({
            role: 'tool',
            tool_call_id: tc.id,
            content: JSON.stringify({ skipped: true, reason: 'resolve-only mode' }),
          })
        } else {
          const result = await executor.execute(name, input)
          messages.push({
            role: 'tool',
            tool_call_id: tc.id,
            content: JSON.stringify(result),
          })
        }
      }

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
    const messages: ChatCompletionMessageParam[] = [
      { role: 'system', content: buildPaymentSystemPrompt(context) },
      {
        role: 'user',
        content:
          buildPaymentUserMessage(request) +
          '\n\nAfter selecting the wallet, ALSO call execute_payment to send the transaction.',
      },
    ]
    const tools = toOpenAITools(AGENT_TOOLS)

    let decision: AgentDecision | null = null
    let execution: any = null

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages,
        tools,
        temperature: TEMPERATURE,
        max_tokens: 1024,
      })
      const msg = response.choices[0]?.message
      if (!msg) throw new Error('Empty response from LLM')

      messages.push(msg)

      if (!msg.tool_calls || msg.tool_calls.length === 0) {
        throw new Error(`Agent stopped without executing. Reply: ${msg.content ?? ''}`)
      }

      for (const tc of msg.tool_calls) {
        if (tc.type !== 'function') continue
        const name = tc.function.name
        const input = safeParseJson(tc.function.arguments) as Record<string, any>

        if (name === 'select_payment_wallet') {
          decision = {
            walletId: String(input.walletId),
            chain: input.chain as ChainId,
            token: String(input.token),
            reasoning: String(input.reasoning ?? ''),
            confidence: (input.confidence ?? "medium") as "high" | "medium" | "low",
          }
          messages.push({
            role: 'tool',
            tool_call_id: tc.id,
            content: JSON.stringify({ confirmed: true, message: 'Now call execute_payment' }),
          })
        } else if (name === 'execute_payment') {
          execution = await executor.execute(name, input)
          messages.push({
            role: 'tool',
            tool_call_id: tc.id,
            content: JSON.stringify(execution),
          })
        } else {
          const result = await executor.execute(name, input)
          messages.push({
            role: 'tool',
            tool_call_id: tc.id,
            content: JSON.stringify(result),
          })
        }
      }

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

  // ── Analysis (no tools, JSON output) ──────────────────────────────────────

  async analyzePocket(context: PocketContext): Promise<AgentAnalysis> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      temperature: TEMPERATURE,
      max_tokens: 2048,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `You are Clutch's AI portfolio analyst. Clutch is a Solana-first wallet pocket.
Analyse the user's portfolio and return ONLY valid JSON — no markdown, no preamble.`,
        },
        { role: 'user', content: buildAnalysisPrompt(context) },
      ],
    })

    const text = response.choices[0]?.message?.content ?? ''
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

  // ── Chat (streaming) ──────────────────────────────────────────────────────

  async *chat(
    context: PocketContext,
    messages: Array<{ role: 'user' | 'assistant'; content: string }>,
    _executor: ToolExecutor,
  ): AsyncGenerator<string> {
    const stream = await this.client.chat.completions.create({
      model: this.model,
      temperature: TEMPERATURE,
      max_tokens: 1024,
      stream: true,
      messages: [
        { role: 'system', content: buildChatSystemPrompt(context) },
        ...messages.map((m) => ({ role: m.role, content: m.content }) as ChatCompletionMessageParam),
      ],
    })

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content
      if (delta) yield delta
    }
  }
}

// ── Tool format conversion ────────────────────────────────────────────────────
//
// AGENT_TOOLS uses Anthropic's shape ({ name, description, input_schema }).
// OpenAI's chat completions API uses ({ type: 'function', function: { name,
// description, parameters }}). Convert at runtime so we don't have to touch
// the canonical tool definitions.

function toOpenAITools(
  tools: Array<{ name: string; description: string; input_schema: any }>,
): ChatCompletionTool[] {
  return tools.map((t) => ({
    type: 'function' as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.input_schema,
    },
  }))
}

function safeParseJson(s: string): unknown {
  try {
    return JSON.parse(s)
  } catch {
    return {}
  }
}

// ── Prompt builders (same as before) ──────────────────────────────────────────

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
