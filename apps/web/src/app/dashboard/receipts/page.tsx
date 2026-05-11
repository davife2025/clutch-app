'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, ExternalLink, Receipt as ReceiptIcon, FileText, AlertCircle } from 'lucide-react'
import { api } from '@/lib/api'
import { formatUsd } from '@/lib/format'

interface Receipt {
  id: string
  resourceUrl: string
  method: string
  txHash: string
  amount: string
  token: string
  amountUsd: string | null
  payTo: string
  finalStatus: number | null
  succeeded: boolean
  paidAt: string
  explorerUrl: string
}

export default function ReceiptsPage() {
  const [receipts, setReceipts] = useState<Receipt[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    const pocketId = api.getPocketId()
    if (!pocketId) {
      setLoading(false)
      return
    }
    const { data } = await api.listReceipts(pocketId, 100)
    if (data) setReceipts(data.receipts)
    setLoading(false)
  }

  // Aggregate stats
  const totalUsd = receipts.reduce((sum, r) => sum + (r.amountUsd ? parseFloat(r.amountUsd) : 0), 0)
  const succeeded = receipts.filter((r) => r.succeeded).length
  const today = new Date().toISOString().slice(0, 10)
  const todayCount = receipts.filter((r) => r.paidAt.startsWith(today)).length

  return (
    <div className="animate-fade-up">
      <div className="mb-10">
        <p className="text-xs tracking-widest text-ink-300 uppercase mb-2">x402 receipts</p>
        <h1 className="font-display text-5xl font-light tracking-tighter text-cream">
          Paywall payment log
        </h1>
        <p className="text-ink-200 mt-3 max-w-2xl">
          Every URL your agents have paid for. Each receipt links the on-chain transaction to the
          resource it unlocked. Use this for cost dashboards and dispute resolution.
        </p>
      </div>

      {/* Stats row */}
      {!loading && receipts.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-8">
          <Stat label="Total payments" value={receipts.length.toString()} />
          <Stat label="Total spent" value={formatUsd(totalUsd)} />
          <Stat label="Today" value={todayCount.toString()} subtext={`${succeeded} succeeded`} />
        </div>
      )}

      {loading ? (
        <div className="text-ink-300">Loading receipts...</div>
      ) : receipts.length === 0 ? (
        <div className="text-center py-16 px-6 rounded-2xl border border-dashed border-ink-600 bg-ink-800/40">
          <ReceiptIcon className="w-12 h-12 text-ink-400 mx-auto mb-4" />
          <h3 className="font-display text-2xl text-cream mb-2">No receipts yet</h3>
          <p className="text-ink-300 mb-6 max-w-md mx-auto">
            When an agent pays for an HTTP 402 paywall through Clutch, a receipt is recorded here
            with the URL, tx hash, amount, and final HTTP status.
          </p>
          <Link
            href="/dashboard/docs"
            className="inline-flex items-center gap-2 text-gold hover:underline text-sm"
          >
            See how to integrate the SDK
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      ) : (
        <div className="rounded-xl border border-ink-700/60 bg-ink-800/40 overflow-hidden">
          <table className="w-full">
            <thead className="bg-ink-900/40 border-b border-ink-700/60">
              <tr className="text-xs uppercase tracking-widest text-ink-400">
                <th className="text-left px-4 py-3 font-medium">Resource</th>
                <th className="text-left px-4 py-3 font-medium">Amount</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-left px-4 py-3 font-medium">Paid</th>
                <th className="text-right px-4 py-3 font-medium">Tx</th>
              </tr>
            </thead>
            <tbody>
              {receipts.map((r, idx) => {
                const url = (() => {
                  try {
                    const u = new URL(r.resourceUrl)
                    return { host: u.hostname, path: u.pathname }
                  } catch {
                    return { host: r.resourceUrl, path: '' }
                  }
                })()

                return (
                  <tr
                    key={r.id}
                    className={`hover:bg-ink-700/20 transition ${
                      idx > 0 ? 'border-t border-ink-700/40' : ''
                    }`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="w-3.5 h-3.5 text-ink-400 shrink-0" />
                        <div className="min-w-0">
                          <div className="text-sm text-cream truncate font-mono">{url.host}</div>
                          <div className="text-xs text-ink-400 truncate font-mono">
                            {r.method} {url.path}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 tabular text-sm">
                      <div className="text-cream">
                        {(Number(r.amount) / 1e6).toFixed(4)} {r.token}
                      </div>
                      {r.amountUsd && (
                        <div className="text-xs text-ink-400">
                          {formatUsd(parseFloat(r.amountUsd))}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {r.succeeded ? (
                        <span className="text-xs uppercase tracking-wider px-2 py-0.5 rounded border bg-moss/10 text-moss border-moss/20">
                          {r.finalStatus ?? 'OK'}
                        </span>
                      ) : (
                        <span className="text-xs uppercase tracking-wider px-2 py-0.5 rounded border bg-rust/10 text-rust border-rust/20 inline-flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          {r.finalStatus ?? 'fail'}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-ink-300 tabular">
                      {new Date(r.paidAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <a
                        href={r.explorerUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-ink-300 hover:text-gold transition font-mono"
                      >
                        {r.txHash.slice(0, 6)}...{r.txHash.slice(-4)}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function Stat({ label, value, subtext }: { label: string; value: string; subtext?: string }) {
  return (
    <div className="p-4 rounded-xl border border-ink-700/60 bg-ink-800/40">
      <p className="text-xs uppercase tracking-widest text-ink-400 mb-2">{label}</p>
      <p className="font-display text-2xl tabular text-cream">{value}</p>
      {subtext && <p className="text-xs text-ink-400 mt-1">{subtext}</p>}
    </div>
  )
}
