/**
 * WebSocket realtime layer for Clutch.
 *
 * Clients connect to ws://host/ws?token=<jwt>
 * Server pushes events to authenticated users:
 *   { type: 'balance_update', pocketId, totalUsd, updatedAt }
 *   { type: 'tx_confirmed',   txHash, pocketId, status }
 *   { type: 'tx_pending',     txHash, pocketId }
 *   { type: 'price_tick',     prices }
 *   { type: 'ping' }
 *   { type: 'connected' }
 */

import { verify } from 'hono/jwt'
import type { WSContext } from 'hono/ws'
import { db } from '../db/client.js'
import { pockets } from '../db/schema.js'
import { eq } from 'drizzle-orm'
import { balanceService } from '../services/balance.service.js'
import { priceService } from '../services/price.service.js'

// ─── Types ──────────────────────────────────────────────────────────────────

export type ServerEvent =
  | { type: 'connected'; userId: string; serverTime: string }
  | { type: 'ping'; t: number }
  | {
      type: 'balance_update'
      pocketId: string
      totalUsd: number
      solanaUsd: number
      externalUsd: number
      updatedAt: string
    }
  | { type: 'tx_pending'; txHash: string; pocketId: string }
  | { type: 'tx_confirmed'; txHash: string; pocketId: string; status: 'confirmed' | 'failed' }
  | { type: 'price_tick'; prices: Record<string, number> }
  | { type: 'error'; message: string }

interface RegisteredClient {
  userId: string
  ws: WSContext
  alive: boolean
  connectedAt: number
}

// ─── State ──────────────────────────────────────────────────────────────────

const clients = new Map<string, RegisteredClient>()

export function getClientCount(): number {
  return clients.size
}

export function getActiveUserIds(): string[] {
  return [...new Set([...clients.values()].map((c) => c.userId))]
}

// ─── Auth ───────────────────────────────────────────────────────────────────

/**
 * Verify the JWT token from the WebSocket query string.
 * Returns the userId or null on failure.
 */
export async function verifyWsToken(token: string | undefined): Promise<string | null> {
  if (!token) return null
  try {
    const payload = await verify(token, process.env.JWT_SECRET!, 'HS256')
    return (payload.sub as string) ?? null
  } catch {
    return null
  }
}

// ─── Client lifecycle ───────────────────────────────────────────────────────

export function registerClient(clientId: string, userId: string, ws: WSContext): void {
  clients.set(clientId, { userId, ws, alive: true, connectedAt: Date.now() })
  console.log(`[ws] connected: ${clientId} (user: ${userId}) — total: ${clients.size}`)

  send(ws, {
    type: 'connected',
    userId,
    serverTime: new Date().toISOString(),
  })
}

export function removeClient(clientId: string): void {
  if (clients.delete(clientId)) {
    console.log(`[ws] disconnected: ${clientId} — total: ${clients.size}`)
  }
}

// ─── Send helpers ───────────────────────────────────────────────────────────

function send(ws: WSContext, event: ServerEvent): void {
  try {
    ws.send(JSON.stringify(event))
  } catch {
    // Channel closed
  }
}

/** Broadcast an event to all sockets owned by a user. */
export function pushToUser(userId: string, event: ServerEvent): number {
  const userClients = [...clients.values()].filter((c) => c.userId === userId && c.alive)
  for (const c of userClients) send(c.ws, event)
  return userClients.length
}

/** Broadcast an event to all connected clients. */
export function broadcast(event: ServerEvent): number {
  for (const c of clients.values()) {
    if (c.alive) send(c.ws, event)
  }
  return clients.size
}

// ─── Domain push functions ──────────────────────────────────────────────────

/**
 * Push a balance update for a pocket — syncs first, then broadcasts to
 * any connected sockets owned by the pocket's owner.
 */
export async function pushBalanceUpdate(userId: string, pocketId: string): Promise<void> {
  const userClients = [...clients.values()].filter((c) => c.userId === userId && c.alive)
  if (userClients.length === 0) return

  try {
    await balanceService.syncPocketBalances(pocketId)
    const totalUsd = await balanceService.getPocketTotalUsd(pocketId)

    // Compute solanaUsd / externalUsd split for the unified pocket view
    const pocket = await db.query.pockets.findFirst({
      where: eq(pockets.id, pocketId),
      with: { wallets: { with: { balances: true } } },
    })
    if (!pocket) return

    let solanaUsd = 0
    let externalUsd = 0
    for (const w of pocket.wallets) {
      const walletUsd = w.balances.reduce((sum, b) => sum + parseFloat(b.usdValue ?? '0'), 0)
      if (w.chain === 'solana') solanaUsd += walletUsd
      else externalUsd += walletUsd
    }

    pushToUser(userId, {
      type: 'balance_update',
      pocketId,
      totalUsd,
      solanaUsd: Math.round(solanaUsd * 100) / 100,
      externalUsd: Math.round(externalUsd * 100) / 100,
      updatedAt: new Date().toISOString(),
    })
  } catch (err) {
    console.error('[ws] balance update failed:', err)
  }
}

/** Notify a user that one of their transactions just confirmed (or failed). */
export function pushTxConfirmed(
  userId: string,
  payload: { txHash: string; pocketId: string; status: 'confirmed' | 'failed' },
): void {
  pushToUser(userId, { type: 'tx_confirmed', ...payload })
}

export function pushTxPending(userId: string, payload: { txHash: string; pocketId: string }): void {
  pushToUser(userId, { type: 'tx_pending', ...payload })
}

// ─── Background workers ─────────────────────────────────────────────────────

let workersStarted = false

export function startRealtimeWorkers(): void {
  if (workersStarted) return
  workersStarted = true

  // Heartbeat ping — every 30s, keeps connections alive through proxies
  setInterval(() => {
    const t = Date.now()
    broadcast({ type: 'ping', t })
  }, 30_000)

  // Balance refresh — every 90s, syncs all pockets owned by active users
  setInterval(async () => {
    const userIds = getActiveUserIds()
    for (const userId of userIds) {
      try {
        const userPockets = await db.query.pockets.findMany({
          where: eq(pockets.ownerId, userId),
        })
        for (const p of userPockets) {
          await pushBalanceUpdate(userId, p.id)
        }
      } catch (err) {
        console.error('[ws] balance worker error:', err)
      }
    }
  }, 90_000)

  // Price tick — every 60s, broadcast top-token prices
  setInterval(async () => {
    if (clients.size === 0) return
    const prices = await priceService.getBatchPrices(['SOL', 'USDC', 'USDT', 'BONK', 'JUP', 'WIF'])
    if (Object.keys(prices).length > 0) {
      broadcast({ type: 'price_tick', prices })
    }
  }, 60_000)

  console.log('[ws] realtime workers started — heartbeat 30s, balance 90s, prices 60s')
}
