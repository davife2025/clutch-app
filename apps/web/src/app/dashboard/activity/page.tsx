'use client'

import { useEffect, useState } from 'react'
import { ArrowDownLeft, ArrowUpRight, Activity as ActivityIcon, ExternalLink, Shield } from 'lucide-react'
import { api } from '@/lib/api'
import { truncateAddress, formatRelativeTime } from '@/lib/format'

export default function ActivityPage() {
  const [transactions, setTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadTransactions()
  }, [])

  async function loadTransactions() {
    const pocketId = api.getPocketId()
    if (!pocketId) return
    const { data } = await api.getTransactions(pocketId, 100)
    setTransactions(data?.transactions ?? [])
    setLoading(false)
  }

  return (
    <div className="animate-fade-up">
      <div className="mb-10">
        <p className="text-xs tracking-widest text-ink-300 uppercase mb-2">Activity</p>
        <h1 className="font-display text-5xl font-light tracking-tighter text-cream">
          Transaction history
        </h1>
      </div>

      {loading ? (
        <div className="text-ink-300">Loading...</div>
      ) : transactions.length === 0 ? (
        <div className="text-center py-16 px-6 rounded-2xl border border-dashed border-ink-600 bg-ink-800/40">
          <ActivityIcon className="w-12 h-12 text-ink-400 mx-auto mb-4" />
          <h3 className="font-display text-2xl text-cream mb-2">No activity yet</h3>
          <p className="text-ink-300">
            Deposits, withdrawals, and payments will appear here.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-ink-700/60 bg-ink-800/40 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-ink-700/60 text-xs uppercase tracking-wider text-ink-300">
                <th className="text-left px-6 py-4">Type</th>
                <th className="text-left px-6 py-4">From / To</th>
                <th className="text-right px-6 py-4">Amount</th>
                <th className="text-left px-6 py-4">Status</th>
                <th className="text-right px-6 py-4">When</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx) => (
                <tr
                  key={tx.id}
                  className={`border-b border-ink-700/40 last:border-0 hover:bg-ink-700/20 transition ${
                    tx.status === 'policy_denied' ? 'opacity-70' : ''
                  }`}
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                          tx.status === 'policy_denied'
                            ? 'bg-moss/10 text-moss'
                            : tx.type === 'deposit'
                              ? 'bg-moss/10 text-moss'
                              : 'bg-gold/10 text-gold'
                        }`}
                      >
                        {tx.status === 'policy_denied' ? (
                          <Shield className="w-4 h-4" />
                        ) : tx.type === 'deposit' ? (
                          <ArrowDownLeft className="w-4 h-4" />
                        ) : (
                          <ArrowUpRight className="w-4 h-4" />
                        )}
                      </div>
                      <div>
                        <span className="capitalize text-cream">{tx.type}</span>
                        {tx.status === 'policy_denied' && tx.memo ? (
                          <p className="text-xs text-ink-400 italic mt-0.5 max-w-xs truncate">
                            {tx.memo}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm font-mono text-ink-200">
                    {truncateAddress(tx.toAddress)}
                  </td>
                  <td className="px-6 py-4 text-right tabular text-cream">
                    {(Number(tx.amount) / 1e6).toFixed(4)} {tx.token}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`text-xs uppercase tracking-wider px-2 py-1 rounded ${
                        tx.status === 'confirmed'
                          ? 'bg-moss/10 text-moss border border-moss/20'
                          : tx.status === 'pending'
                            ? 'bg-gold/10 text-gold border border-gold/20'
                            : tx.status === 'policy_denied'
                              ? 'bg-moss/10 text-moss border border-moss/20'
                              : 'bg-rust/10 text-rust border border-rust/20'
                      }`}
                    >
                      {tx.status === 'policy_denied' ? 'blocked' : tx.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right text-sm text-ink-300">
                    <div className="flex items-center justify-end gap-2">
                      {formatRelativeTime(tx.createdAt)}
                      {tx.txHash && (
                        <a
                          href={`https://solscan.io/tx/${tx.txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-ink-400 hover:text-gold transition"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
