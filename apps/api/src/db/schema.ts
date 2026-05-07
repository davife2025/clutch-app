import {
  pgTable,
  text,
  timestamp,
  boolean,
  bigint,
  integer,
  uuid,
  pgEnum,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core'

// ─── Enums ────────────────────────────────────────────────────────────────────

export const walletTypeEnum = pgEnum('wallet_type', ['hot', 'cold', 'hardware', 'native'])

export const connectionTypeEnum = pgEnum('connection_type', [
  'manual', // user pasted the address
  'walletconnect', // connected via WalletConnect v2
  'custodial', // Clutch holds the encrypted key
])

/** Solana is the primary chain. */
export const chainIdEnum = pgEnum('chain_id', [
  'solana', // primary
  'ethereum',
  'base',
  'polygon',
  'arbitrum',
  'optimism',
])

export const txStatusEnum = pgEnum('tx_status', ['pending', 'confirmed', 'failed'])
export const txTypeEnum = pgEnum('tx_type', ['deposit', 'withdraw', 'payment', 'transfer'])

// ─── Users ────────────────────────────────────────────────────────────────────

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Null for anonymous accounts. Becomes set on upgrade. */
    email: text('email'),
    /** Null for anonymous accounts. Becomes set on upgrade. */
    passwordHash: text('password_hash'),
    /** True for accounts created without email/password. */
    isAnonymous: boolean('is_anonymous').notNull().default(false),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  // Unique index on email — Postgres treats NULLs as distinct, so multiple
  // anonymous users (all with email=NULL) coexist fine.
  (t) => [uniqueIndex('users_email_idx').on(t.email)],
)

// ─── Pockets ──────────────────────────────────────────────────────────────────

export const pockets = pgTable(
  'pockets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull().default('My Pocket'),
    /** Native balance in lamports (9 decimals). 1 SOL = 1_000_000_000 lamports. */
    nativeBalance: bigint('native_balance', { mode: 'bigint' }).notNull().default(BigInt(0)),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [index('pockets_owner_idx').on(t.ownerId)],
)

// ─── Wallets ──────────────────────────────────────────────────────────────────

export const wallets = pgTable(
  'wallets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    pocketId: uuid('pocket_id')
      .notNull()
      .references(() => pockets.id, { onDelete: 'cascade' }),
    type: walletTypeEnum('type').notNull(),
    connectionType: connectionTypeEnum('connection_type').notNull().default('manual'),
    address: text('address').notNull(),
    /** Default chain is solana. */
    chain: chainIdEnum('chain').notNull().default('solana'),
    label: text('label'),
    isDefault: boolean('is_default').notNull().default(false),
    /** Encrypted private key blob — only populated for custodial wallets. */
    encryptedKey: text('encrypted_key'),
    /** WalletConnect session topic — only populated for walletconnect type. */
    wcSessionTopic: text('wc_session_topic'),
    addedAt: timestamp('added_at').defaultNow().notNull(),
  },
  (t) => [
    index('wallets_pocket_idx').on(t.pocketId),
    uniqueIndex('wallets_address_chain_idx').on(t.address, t.chain),
  ],
)

// ─── Wallet balances (cached) ─────────────────────────────────────────────────

export const walletBalances = pgTable(
  'wallet_balances',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    walletId: uuid('wallet_id')
      .notNull()
      .references(() => wallets.id, { onDelete: 'cascade' }),
    chain: chainIdEnum('chain').notNull(),
    token: text('token').notNull(), // 'SOL', 'USDC', 'BONK', etc.
    amount: bigint('amount', { mode: 'bigint' }).notNull().default(BigInt(0)),
    decimals: integer('decimals').notNull().default(9), // Solana default = 9
    usdValue: text('usd_value'), // stored as string to avoid float precision
    fetchedAt: timestamp('fetched_at').defaultNow().notNull(),
  },
  (t) => [
    index('balances_wallet_idx').on(t.walletId),
    uniqueIndex('balances_wallet_token_idx').on(t.walletId, t.token),
  ],
)

// ─── Transactions ─────────────────────────────────────────────────────────────

export const transactions = pgTable(
  'transactions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    pocketId: uuid('pocket_id')
      .notNull()
      .references(() => pockets.id, { onDelete: 'cascade' }),
    walletId: uuid('wallet_id').references(() => wallets.id, { onDelete: 'set null' }),
    type: txTypeEnum('type').notNull(),
    status: txStatusEnum('status').notNull().default('pending'),
    fromAddress: text('from_address').notNull(),
    toAddress: text('to_address').notNull(),
    /** Amount in the token's smallest unit (lamports for SOL, micro-USDC for USDC). */
    amount: bigint('amount', { mode: 'bigint' }).notNull(),
    token: text('token').notNull(),
    chain: chainIdEnum('chain').notNull().default('solana'),
    txHash: text('tx_hash'),
    memo: text('memo'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    confirmedAt: timestamp('confirmed_at'),
  },
  (t) => [
    index('txns_pocket_idx').on(t.pocketId),
    index('txns_status_idx').on(t.status),
    index('txns_hash_idx').on(t.txHash),
  ],
)

// ─── Spending Policies ────────────────────────────────────────────────────────
//
// One policy per pocket. Defines guardrails the agent must respect when
// executing payments or swaps. Enforced server-side in the agent executor
// before any on-chain action.

export const pocketPolicies = pgTable(
  'pocket_policies',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    pocketId: uuid('pocket_id')
      .notNull()
      .unique()
      .references(() => pockets.id, { onDelete: 'cascade' }),
    /** Policy is enforced when true. Default off for new pockets. */
    enabled: boolean('enabled').notNull().default(false),
    /** Max single transaction size in USD. Null = no limit. */
    maxPerTxUsd: text('max_per_tx_usd'),
    /** Max cumulative spend per day (UTC) in USD. Null = no limit. */
    maxPerDayUsd: text('max_per_day_usd'),
    /** Comma-separated allowlist of recipient addresses. Null/empty = any address. */
    allowedRecipients: text('allowed_recipients'),
    /** Comma-separated blocklist of recipient addresses. Always rejected. */
    blockedRecipients: text('blocked_recipients'),
    /** Comma-separated allowlist of token symbols (USDC, SOL, ...). Null/empty = any token. */
    allowedTokens: text('allowed_tokens'),
    /** Comma-separated blocklist of token symbols. Always rejected. */
    blockedTokens: text('blocked_tokens'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [index('policies_pocket_idx').on(t.pocketId)],
)

// ─── Type exports ─────────────────────────────────────────────────────────────

export type UserRow = typeof users.$inferSelect
export type NewUserRow = typeof users.$inferInsert
export type PocketRow = typeof pockets.$inferSelect
export type NewPocketRow = typeof pockets.$inferInsert
export type WalletRow = typeof wallets.$inferSelect
export type NewWalletRow = typeof wallets.$inferInsert
export type WalletBalanceRow = typeof walletBalances.$inferSelect
export type TransactionRow = typeof transactions.$inferSelect
export type NewTransactionRow = typeof transactions.$inferInsert
