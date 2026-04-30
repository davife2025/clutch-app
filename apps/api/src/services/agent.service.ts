import { db } from '../db/client.js'
import { pockets, wallets } from '../db/schema.js'
import { eq, and } from 'drizzle-orm'
import { ClutchAgent, ClutchToolExecutor } from '@clutch/agent'
import type { PocketContext, PaymentRequest, AgentDecision, PaymentExecution } from '@clutch/agent'
import { lamportsToSol } from '@clutch/core'
import { balanceService } from './balance.service.js'
import { priceService } from './price.service.js'
import { vaultService } from '@clutch/vault'
import { createWCManager } from '@clutch/connectors'

const agent = new ClutchAgent()
const wcManager = createWCManager()

/** Build PocketContext from DB for the agent. */
async function buildContext(pocketId: string): Promise<PocketContext> {
  const pocket = await db.query.pockets.findFirst({
    where: eq(pockets.id, pocketId),
    with: {
      wallets: {
        with: { balances: true },
      },
    },
  })

  if (!pocket) throw new Error('Pocket not found')

  const nativeSol = lamportsToSol(pocket.nativeBalance)
  const solPrice = (await priceService.getUsdPrice('SOL')) ?? 0

  return {
    pocketId: pocket.id,
    pocketName: pocket.name,
    nativeBalanceSol: nativeSol,
    nativeBalanceUsd: Number(nativeSol) * solPrice,
    totalUsdValue: await balanceService.getPocketTotalUsd(pocketId),
    wallets: pocket.wallets.map((w) => ({
      wallet: {
        id: w.id,
        pocketId: w.pocketId,
        type: w.type as any,
        connectionType: w.connectionType as any,
        address: w.address,
        chain: w.chain as any,
        label: w.label ?? undefined,
        isDefault: w.isDefault,
        addedAt: w.addedAt,
      },
      balances: w.balances.map((b) => ({
        walletId: b.walletId,
        chain: b.chain as any,
        token: b.token,
        amount: b.amount,
        decimals: b.decimals,
        usdValue: b.usdValue ? Number(b.usdValue) : undefined,
        fetchedAt: b.fetchedAt,
      })),
      totalUsdValue: w.balances.reduce((sum, b) => sum + parseFloat(b.usdValue ?? '0'), 0),
    })),
  }
}

/** Build executor with all dependencies wired. */
function buildExecutor(): ClutchToolExecutor {
  return new ClutchToolExecutor({
    registry: balanceService.getRegistry(),
    priceService,
    vault: vaultService,
    wcManager,
    solanaRpcUrl: process.env.SOLANA_RPC_URL,
    getWalletMeta: async (walletId: string) => {
      const wallet = await db.query.wallets.findFirst({
        where: eq(wallets.id, walletId),
      })
      if (!wallet) return null
      return {
        address: wallet.address,
        chain: wallet.chain,
        connectionType: wallet.connectionType,
        encryptedKey: wallet.encryptedKey,
        wcSessionTopic: wallet.wcSessionTopic,
      }
    },
  })
}

export const agentService = {
  async analyzeP(pocketId: string) {
    const context = await buildContext(pocketId)
    return agent.analyzePocket(context)
  },

  async resolvePayment(pocketId: string, request: PaymentRequest): Promise<AgentDecision> {
    const context = await buildContext(pocketId)
    const executor = buildExecutor()
    return agent.resolvePayment(context, request, executor)
  },

  async executePayment(pocketId: string, request: PaymentRequest): Promise<PaymentExecution> {
    const context = await buildContext(pocketId)
    const executor = buildExecutor()
    return agent.executePayment(context, request, executor)
  },

  async *chat(pocketId: string, messages: Array<{ role: 'user' | 'assistant'; content: string }>) {
    const context = await buildContext(pocketId)
    const executor = buildExecutor()
    yield* agent.chat(context, messages, executor)
  },
}
