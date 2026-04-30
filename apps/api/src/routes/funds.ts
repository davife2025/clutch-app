import { Hono } from 'hono'
import { db } from '../db/client.js'
import { pockets, wallets, transactions } from '../db/schema.js'
import { eq, and } from 'drizzle-orm'
import { authMiddleware } from '../middleware/auth.js'
import { depositSchema, withdrawSchema, importWalletSchema, validate } from '../lib/validation.js'
import { solToLamports, lamportsToSol } from '@clutch/core'
import { vaultService } from '@clutch/vault'

type Env = { Variables: { userId: string } }

export const fundsRoutes = new Hono<Env>()
fundsRoutes.use('*', authMiddleware)

// ─── Deposit SOL to pocket's native balance ───────────────────────────────────

fundsRoutes.post('/:id/deposit', async (c) => {
  const userId = c.get('userId')
  const pocketId = c.req.param('id')

  const body = await c.req.json().catch(() => ({}))
  const parsed = validate(body, depositSchema)
  if (!parsed.ok) {
    return c.json({ error: { code: 'VALIDATION', message: parsed.error } }, 400)
  }

  const pocket = await db.query.pockets.findFirst({
    where: and(eq(pockets.id, pocketId), eq(pockets.ownerId, userId)),
  })
  if (!pocket) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Pocket not found' } }, 404)
  }

  const lamports = solToLamports(parsed.data.amount)
  const newBalance = pocket.nativeBalance + lamports

  await db
    .update(pockets)
    .set({ nativeBalance: newBalance, updatedAt: new Date() })
    .where(eq(pockets.id, pocketId))

  await db.insert(transactions).values({
    pocketId,
    type: 'deposit',
    status: parsed.data.txHash ? 'confirmed' : 'pending',
    fromAddress: '11111111111111111111111111111111',
    toAddress: pocketId,
    amount: lamports,
    token: 'SOL',
    chain: 'solana',
    txHash: parsed.data.txHash,
    confirmedAt: parsed.data.txHash ? new Date() : undefined,
  })

  return c.json({
    data: {
      pocketId,
      deposited: parsed.data.amount,
      newBalanceLamports: newBalance.toString(),
      newBalanceSol: lamportsToSol(newBalance),
    },
  })
})

// ─── Withdraw SOL from pocket ─────────────────────────────────────────────────

fundsRoutes.post('/:id/withdraw', async (c) => {
  const userId = c.get('userId')
  const pocketId = c.req.param('id')

  const body = await c.req.json().catch(() => ({}))
  const parsed = validate(body, withdrawSchema)
  if (!parsed.ok) {
    return c.json({ error: { code: 'VALIDATION', message: parsed.error } }, 400)
  }

  const pocket = await db.query.pockets.findFirst({
    where: and(eq(pockets.id, pocketId), eq(pockets.ownerId, userId)),
  })
  if (!pocket) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Pocket not found' } }, 404)
  }

  const lamports = solToLamports(parsed.data.amount)
  if (lamports > pocket.nativeBalance) {
    return c.json(
      { error: { code: 'INSUFFICIENT_FUNDS', message: 'Insufficient SOL balance' } },
      400,
    )
  }

  const newBalance = pocket.nativeBalance - lamports

  await db
    .update(pockets)
    .set({ nativeBalance: newBalance, updatedAt: new Date() })
    .where(eq(pockets.id, pocketId))

  await db.insert(transactions).values({
    pocketId,
    type: 'withdraw',
    status: 'pending',
    fromAddress: pocketId,
    toAddress: parsed.data.toAddress,
    amount: lamports,
    token: 'SOL',
    chain: 'solana',
  })

  return c.json({
    data: {
      pocketId,
      withdrawn: parsed.data.amount,
      toAddress: parsed.data.toAddress,
      newBalanceLamports: newBalance.toString(),
      newBalanceSol: lamportsToSol(newBalance),
    },
  })
})

// ─── Get native SOL balance ───────────────────────────────────────────────────

fundsRoutes.get('/:id/balance', async (c) => {
  const userId = c.get('userId')
  const pocketId = c.req.param('id')

  const pocket = await db.query.pockets.findFirst({
    where: and(eq(pockets.id, pocketId), eq(pockets.ownerId, userId)),
  })
  if (!pocket) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Pocket not found' } }, 404)
  }

  return c.json({
    data: {
      pocketId,
      lamports: pocket.nativeBalance.toString(),
      sol: lamportsToSol(pocket.nativeBalance),
    },
  })
})

// ─── Import custodial wallet (key encrypted by vault) ─────────────────────────

fundsRoutes.post('/:id/import-wallet', async (c) => {
  const userId = c.get('userId')
  const pocketId = c.req.param('id')

  const body = await c.req.json().catch(() => ({}))
  const parsed = validate(body, importWalletSchema)
  if (!parsed.ok) {
    return c.json({ error: { code: 'VALIDATION', message: parsed.error } }, 400)
  }

  if (!vaultService.isConfigured()) {
    return c.json(
      { error: { code: 'VAULT_NOT_CONFIGURED', message: 'Vault master key not set' } },
      500,
    )
  }

  const pocket = await db.query.pockets.findFirst({
    where: and(eq(pockets.id, pocketId), eq(pockets.ownerId, userId)),
    with: { wallets: true },
  })
  if (!pocket) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Pocket not found' } }, 404)
  }

  // Derive the public address from the private key
  let address: string
  try {
    if (parsed.data.chain === 'solana') {
      const { Keypair } = await import('@solana/web3.js')
      const bs58 = await import('bs58')
      const secretKey = bs58.default.decode(parsed.data.privateKey)
      const keypair = Keypair.fromSecretKey(secretKey)
      address = keypair.publicKey.toBase58()
    } else {
      const { privateKeyToAccount } = await import('viem/accounts')
      const account = privateKeyToAccount(parsed.data.privateKey as `0x${string}`)
      address = account.address
    }
  } catch {
    return c.json(
      { error: { code: 'INVALID_KEY', message: 'Could not derive address from private key' } },
      400,
    )
  }

  // Encrypt the private key — raw key is never stored
  const encryptedKey = vaultService.encryptKey(parsed.data.privateKey)

  const isDefault = (pocket.wallets as any[]).length === 0

  const [wallet] = await db
    .insert(wallets)
    .values({
      pocketId,
      address,
      chain: parsed.data.chain as any,
      type: 'hot',
      connectionType: 'custodial',
      label: parsed.data.label ?? `Imported ${parsed.data.chain}`,
      isDefault,
      encryptedKey,
    })
    .returning()

  return c.json({
    data: {
      wallet: {
        id: wallet.id,
        address: wallet.address,
        chain: wallet.chain,
        connectionType: wallet.connectionType,
        label: wallet.label,
      },
    },
  }, 201)
})
