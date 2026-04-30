import { db } from '../db/client.js'
import { wallets, walletBalances } from '../db/schema.js'
import { eq } from 'drizzle-orm'
import { priceService } from './price.service.js'
import { ConnectorRegistry } from '@clutch/connectors'
import type { ChainId } from '@clutch/core'

/** Singleton registry — reads RPC URLs from env at construction time. */
const registry = new ConnectorRegistry({
  solanaRpcUrl: process.env.SOLANA_RPC_URL,
  ethRpcUrl: process.env.ETHEREUM_RPC_URL,
  baseRpcUrl: process.env.BASE_RPC_URL,
  polygonRpcUrl: process.env.POLYGON_RPC_URL,
  arbitrumRpcUrl: process.env.ARBITRUM_RPC_URL,
  optimismRpcUrl: process.env.OPTIMISM_RPC_URL,
})

export class BalanceService {
  /**
   * Sync balances for all wallets in a pocket.
   * Fetches on-chain balances, prices, and upserts into DB.
   */
  async syncPocketBalances(pocketId: string): Promise<void> {
    const pocketWallets = await db.query.wallets.findMany({
      where: eq(wallets.pocketId, pocketId),
    })

    await Promise.allSettled(
      pocketWallets.map((w) => this.syncWalletBalance(w.id, w.address, w.chain as ChainId)),
    )
  }

  /**
   * Sync balances for a single wallet.
   */
  async syncWalletBalance(walletId: string, address: string, chain: ChainId): Promise<void> {
    const connector = registry.get(chain)
    if (!connector) {
      console.warn(`[balance] no connector for chain: ${chain}`)
      return
    }

    try {
      const balanceList = await connector.getBalances(address)
      const tokens = balanceList.map((b) => b.token)
      const prices = await priceService.getBatchPrices(tokens)

      for (const bal of balanceList) {
        const usdValue = prices[bal.token.toUpperCase()]
          ? (Number(bal.amount) / 10 ** bal.decimals) * prices[bal.token.toUpperCase()]
          : null

        await db
          .insert(walletBalances)
          .values({
            walletId,
            chain: chain as any,
            token: bal.token,
            amount: bal.amount,
            decimals: bal.decimals,
            usdValue: usdValue?.toFixed(2) ?? null,
            fetchedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: [walletBalances.walletId, walletBalances.token],
            set: {
              amount: bal.amount,
              usdValue: usdValue?.toFixed(2) ?? null,
              fetchedAt: new Date(),
            },
          })
      }
    } catch (err) {
      console.error(`[balance] failed to sync wallet ${walletId}:`, err)
    }
  }

  /**
   * Get total USD value across all wallets in a pocket.
   */
  async getPocketTotalUsd(pocketId: string): Promise<number> {
    const pocketWallets = await db.query.wallets.findMany({
      where: eq(wallets.pocketId, pocketId),
      with: { balances: true },
    })

    let total = 0
    for (const wallet of pocketWallets) {
      for (const bal of wallet.balances) {
        total += parseFloat(bal.usdValue ?? '0')
      }
    }
    return Math.round(total * 100) / 100
  }

  /** Get the connector registry for direct access (used by agent, etc). */
  getRegistry(): ConnectorRegistry {
    return registry
  }
}

export const balanceService = new BalanceService()
