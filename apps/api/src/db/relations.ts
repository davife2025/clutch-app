import { relations } from 'drizzle-orm'
import { users, pockets, wallets, walletBalances, transactions, pocketPolicies } from './schema.js'

export const usersRelations = relations(users, ({ many }) => ({
  pockets: many(pockets),
}))

export const pocketsRelations = relations(pockets, ({ one, many }) => ({
  owner: one(users, { fields: [pockets.ownerId], references: [users.id] }),
  wallets: many(wallets),
  transactions: many(transactions),
  policy: one(pocketPolicies, {
    fields: [pockets.id],
    references: [pocketPolicies.pocketId],
  }),
}))

export const walletsRelations = relations(wallets, ({ one, many }) => ({
  pocket: one(pockets, { fields: [wallets.pocketId], references: [pockets.id] }),
  balances: many(walletBalances),
}))

export const walletBalancesRelations = relations(walletBalances, ({ one }) => ({
  wallet: one(wallets, { fields: [walletBalances.walletId], references: [wallets.id] }),
}))

export const transactionsRelations = relations(transactions, ({ one }) => ({
  pocket: one(pockets, { fields: [transactions.pocketId], references: [pockets.id] }),
  wallet: one(wallets, { fields: [transactions.walletId], references: [wallets.id] }),
}))

export const pocketPoliciesRelations = relations(pocketPolicies, ({ one }) => ({
  pocket: one(pockets, {
    fields: [pocketPolicies.pocketId],
    references: [pockets.id],
  }),
}))
