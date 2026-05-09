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

export const txStatusEnum = pgEnum('tx_status', [
  'pending',
  'confirmed',
  'failed',
  'policy_denied',
])
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

// ─── x402 Receipts ────────────────────────────────────────────────────────────
//
// Audit-grade record of every paywall payment made through Clutch.
// Distinct from the general `transactions` table because receipts have
// different semantics — they bind a payment to a specific resource URL
// and HTTP status, with the original 402 challenge preserved for proof.

export const x402Receipts = pgTable(
  'x402_receipts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    pocketId: uuid('pocket_id')
      .notNull()
      .references(() => pockets.id, { onDelete: 'cascade' }),
    /** Paywalled URL the agent was trying to access */
    resourceUrl: text('resource_url').notNull(),
    /** HTTP method (GET, POST, ...) */
    method: text('method').notNull().default('GET'),
    /** Solana tx signature for the payment */
    txHash: text('tx_hash').notNull(),
    /** Amount in token's smallest unit */
    amount: bigint('amount', { mode: 'bigint' }).notNull(),
    token: text('token').notNull(),
    /** Recipient from the 402 challenge — the resource owner */
    payTo: text('pay_to').notNull(),
    /** USD value at time of payment, for cost tracking dashboards */
    amountUsd: text('amount_usd'),
    /** Final HTTP status after the payment was retried (200, 403, 500...) */
    finalStatus: integer('final_status'),
    /** Whether the post-payment request succeeded — agents need this for retry logic */
    succeeded: boolean('succeeded').notNull().default(false),
    /** Original 402 challenge body, JSON-encoded — kept for dispute resolution */
    challenge: text('challenge'),
    paidAt: timestamp('paid_at').defaultNow().notNull(),
  },
  (t) => [
    index('receipts_pocket_idx').on(t.pocketId),
    index('receipts_resource_idx').on(t.resourceUrl),
    index('receipts_paid_at_idx').on(t.paidAt),
  ],
)

// ─── Agents ───────────────────────────────────────────────────────────────────
//
// A user-created payment agent. Distinct from the AI tool-use agent in the
// codebase — this is a *named persona* the user has configured to handle
// specific x402 payment workflows. Each agent is bound to one pocket and
// inherits that pocket's spending policy.

export const agentStatusEnum = pgEnum('agent_status', ['active', 'paused', 'revoked'])

export const agents = pgTable(
  'agents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    pocketId: uuid('pocket_id')
      .notNull()
      .references(() => pockets.id, { onDelete: 'cascade' }),
    /** User-chosen agent name, e.g. "API spending agent" */
    name: text('name').notNull(),
    /** Template the agent was created from, for analytics + UI */
    template: text('template').notNull().default('custom'),
    /** Free-text description of what the agent does — shown in the UI */
    description: text('description'),
    status: agentStatusEnum('status').notNull().default('active'),
    /** Last-known instruction the user gave the agent */
    lastInstruction: text('last_instruction'),
    /** Total amount this agent has spent (USD), for the per-agent dashboard */
    totalSpentUsd: text('total_spent_usd').notNull().default('0'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [index('agents_pocket_idx').on(t.pocketId)],
)

// ─── Registered Agents (the public registry) ──────────────────────────────────
//
// Different from `agents` above, which are user-private payment templates.
// `registered_agents` is the public directory: agents that any user can
// discover and authorize to make payments from their pocket.
//
// Identity is the Ed25519 public key. The agent proves ownership by signing
// payment-request payloads. We never custody the agent's private key — that
// stays with the agent operator.

export const registeredAgentStatusEnum = pgEnum('registered_agent_status', [
  'active',
  'unlisted',
  'suspended',
])

export const registeredAgents = pgTable(
  'registered_agents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** The user (developer) who registered this agent — they manage it */
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** Display name shown in the directory, e.g. "MarketBot" */
    name: text('name').notNull(),
    /** Short tagline for the directory listing — under 140 chars */
    tagline: text('tagline').notNull(),
    /** Full description shown on the agent's detail page */
    description: text('description').notNull(),
    /** Ed25519 public key (base58-encoded) — agent's identity */
    publicKey: text('public_key').notNull().unique(),
    /** Where the agent's payment requests come from (for callback verification) */
    homepage: text('homepage'),
    /** Logo URL, if provided */
    logoUrl: text('logo_url'),
    /** Category for filtering — e.g. "trading", "content", "inference" */
    category: text('category').notNull().default('other'),
    /** What the agent typically pays for, semicolon-separated free text */
    paymentScope: text('payment_scope'),
    status: registeredAgentStatusEnum('status').notNull().default('active'),
    /** How many users have an active grant for this agent — for sort/discovery */
    activeGrantsCount: integer('active_grants_count').notNull().default(0),
    /** Total volume this agent has moved through Clutch in USD — for trust signal */
    totalVolumeUsd: text('total_volume_usd').notNull().default('0'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('registered_agents_pubkey_idx').on(t.publicKey),
    index('registered_agents_owner_idx').on(t.ownerId),
    index('registered_agents_status_idx').on(t.status),
    index('registered_agents_category_idx').on(t.category),
  ],
)

// ─── Agent Grants (per-user authorizations) ───────────────────────────────────
//
// When a user authorizes an agent, we create a grant binding their pocket to
// the agent with a scoped policy. The grant's policy operates inside the
// pocket's overall policy — both must permit a payment for it to go through.

export const agentGrantStatusEnum = pgEnum('agent_grant_status', [
  'active',
  'revoked',
  'expired',
])

export const agentGrants = pgTable(
  'agent_grants',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    pocketId: uuid('pocket_id')
      .notNull()
      .references(() => pockets.id, { onDelete: 'cascade' }),
    registeredAgentId: uuid('registered_agent_id')
      .notNull()
      .references(() => registeredAgents.id, { onDelete: 'cascade' }),
    /** Per-tx limit in USD scoped to this agent. Null = no per-tx limit. */
    maxPerTxUsd: text('max_per_tx_usd'),
    /** Daily cap in USD scoped to this agent. Null = no daily cap. */
    maxPerDayUsd: text('max_per_day_usd'),
    /** Allowed recipients for this agent's payments (CSV). Null = inherits pocket policy. */
    allowedRecipients: text('allowed_recipients'),
    /** Allowed tokens for this agent (CSV). Null = inherits pocket policy. */
    allowedTokens: text('allowed_tokens'),
    /** Optional expiration — null means never expires (until revoked) */
    expiresAt: timestamp('expires_at'),
    status: agentGrantStatusEnum('status').notNull().default('active'),
    /** Total this agent has spent under this grant, in USD */
    spentUsd: text('spent_usd').notNull().default('0'),
    /** When the agent last actually used this grant */
    lastUsedAt: timestamp('last_used_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [
    index('agent_grants_pocket_idx').on(t.pocketId),
    index('agent_grants_agent_idx').on(t.registeredAgentId),
    // A pocket can only have one active grant per agent — enforce uniqueness
    uniqueIndex('agent_grants_pocket_agent_idx').on(t.pocketId, t.registeredAgentId),
  ],
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
