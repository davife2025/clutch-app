import { Hono } from 'hono'
import { db } from '../db/client.js'
import { pockets, wallets } from '../db/schema.js'
import { eq, and } from 'drizzle-orm'
import { authMiddleware } from '../middleware/auth.js'
import { createWCManager, type WalletConnectManager } from '@clutch/connectors'

type Env = { Variables: { userId: string } }

export const connectRoutes = new Hono<Env>()
connectRoutes.use('*', authMiddleware)

// ─── Lazy-init WalletConnect manager ──────────────────────────────────────────

let wcManager: WalletConnectManager | null = null
let wcInitPromise: Promise<void> | null = null

async function getWC(): Promise<WalletConnectManager> {
  if (!wcManager) {
    wcManager = createWCManager()
    if (!wcManager) throw new Error('WalletConnect not configured — set WALLETCONNECT_PROJECT_ID')
  }
  if (!wcInitPromise) {
    wcInitPromise = wcManager.init()
  }
  await wcInitPromise
  return wcManager
}

// ─── Initiate WalletConnect pairing ───────────────────────────────────────────

/**
 * POST /pockets/:pocketId/connect
 * Returns a pairing URI for the user to scan with their wallet.
 * Client displays this as a QR code or triggers a deep link.
 */
connectRoutes.post('/:pocketId/connect', async (c) => {
  const userId = c.get('userId')
  const pocketId = c.req.param('pocketId')

  const pocket = await db.query.pockets.findFirst({
    where: and(eq(pockets.id, pocketId), eq(pockets.ownerId, userId)),
  })
  if (!pocket) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Pocket not found' } }, 404)
  }

  let wc: WalletConnectManager
  try {
    wc = await getWC()
  } catch (err) {
    return c.json(
      { error: { code: 'WC_NOT_CONFIGURED', message: (err as Error).message } },
      500,
    )
  }

  // Determine which chains to request
  const body = await c.req.json().catch(() => ({}))
  const chains = (body as any).chains ?? ['solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp']

  const { uri, approval } = await wc.connect(chains)

  // Handle approval in background — when the user approves in their wallet,
  // save the connected wallet to the pocket
  approval
    .then(async (session) => {
      // Parse accounts: "solana:5eykt4U...:ADDRESS" or "eip155:1:0xADDRESS"
      for (const fullAccount of session.accounts) {
        const parts = fullAccount.split(':')
        const address = parts[parts.length - 1]
        const namespace = parts[0]

        let chain: string = 'solana'
        if (namespace === 'eip155') {
          const chainNum = parts[1]
          chain =
            chainNum === '1'
              ? 'ethereum'
              : chainNum === '8453'
                ? 'base'
                : chainNum === '137'
                  ? 'polygon'
                  : chainNum === '42161'
                    ? 'arbitrum'
                    : chainNum === '10'
                      ? 'optimism'
                      : 'ethereum'
        }

        // Check if wallet already exists in this pocket
        const existing = await db.query.wallets.findFirst({
          where: and(eq(wallets.pocketId, pocketId), eq(wallets.address, address)),
        })

        if (!existing) {
          const pocketWallets = await db.query.wallets.findMany({
            where: eq(wallets.pocketId, pocketId),
          })

          await db.insert(wallets).values({
            pocketId,
            address,
            chain: chain as any,
            type: 'hot',
            connectionType: 'walletconnect',
            label: session.peerName,
            isDefault: pocketWallets.length === 0,
            wcSessionTopic: session.topic,
          })
        } else {
          // Update session topic on existing wallet
          await db
            .update(wallets)
            .set({ wcSessionTopic: session.topic, connectionType: 'walletconnect' as any })
            .where(eq(wallets.id, existing.id))
        }
      }

      console.log(`[wc] Connected ${session.peerName} to pocket ${pocketId}`)
    })
    .catch((err) => {
      console.error('[wc] Pairing rejected or failed:', err)
    })

  return c.json({
    data: {
      uri,
      pocketId,
      message: 'Scan QR code or open deep link in your wallet',
    },
  })
})

// ─── Get WalletConnect sessions for a pocket ──────────────────────────────────

connectRoutes.get('/:pocketId/connections', async (c) => {
  const userId = c.get('userId')
  const pocketId = c.req.param('pocketId')

  const pocket = await db.query.pockets.findFirst({
    where: and(eq(pockets.id, pocketId), eq(pockets.ownerId, userId)),
    with: { wallets: true },
  })
  if (!pocket) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Pocket not found' } }, 404)
  }

  const wcWallets = pocket.wallets
    .filter((w) => w.connectionType === 'walletconnect')
    .map((w) => ({
      walletId: w.id,
      address: w.address,
      chain: w.chain,
      label: w.label,
      sessionTopic: w.wcSessionTopic,
      isActive: !!w.wcSessionTopic,
    }))

  return c.json({ data: { connections: wcWallets } })
})

// ─── Disconnect a WalletConnect session ───────────────────────────────────────

connectRoutes.post('/:pocketId/disconnect/:walletId', async (c) => {
  const userId = c.get('userId')
  const pocketId = c.req.param('pocketId')
  const walletId = c.req.param('walletId')

  const pocket = await db.query.pockets.findFirst({
    where: and(eq(pockets.id, pocketId), eq(pockets.ownerId, userId)),
  })
  if (!pocket) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Pocket not found' } }, 404)
  }

  const wallet = await db.query.wallets.findFirst({
    where: and(eq(wallets.id, walletId), eq(wallets.pocketId, pocketId)),
  })
  if (!wallet) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Wallet not found' } }, 404)
  }

  // Disconnect WalletConnect session if active
  if (wallet.wcSessionTopic) {
    try {
      const wc = await getWC()
      await wc.disconnect(wallet.wcSessionTopic)
    } catch {
      // Session may already be expired
    }
  }

  // Clear session topic but keep the wallet record
  await db
    .update(wallets)
    .set({ wcSessionTopic: null })
    .where(eq(wallets.id, walletId))

  return c.json({ data: { disconnected: true, walletId } })
})
