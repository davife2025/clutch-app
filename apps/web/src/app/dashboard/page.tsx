'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Wallet, Sparkles, Plus, RefreshCw, Wifi, WifiOff } from 'lucide-react'
import { api } from '@/lib/api'
import { formatUsd, truncateAddress, chainLabel } from '@/lib/format'
import { useClutchSocket } from '@/hooks/useClutchSocket'
import { UpgradeBanner } from '@/components/layout/UpgradeBanner'
import { PolicyStatusCard } from '@/components/pocket/PolicyStatusCard'

export default function DashboardPage() {
  const [summary, setSummary] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [livePulse, setLivePulse] = useState(false)

  // Live updates via WebSocket
  const { status: wsStatus } = useClutchSocket({
    onEvent: (event) => {
      if (event.type === 'balance_update' && summary && event.pocketId === summary.pocketId) {
        // Refetch fresh summary so wallet-level breakdowns stay accurate
        loadSummary()
        setLivePulse(true)
        setTimeout(() => setLivePulse(false), 800)
      }
      if (event.type === 'tx_confirmed' && summary && event.pocketId === summary.pocketId) {
        loadSummary()
      }
    },
  })

  useEffect(() => {
    loadSummary()
  }, [])

  async function loadSummary() {
    setLoadError(null)
    const cachedPocketId = api.getPocketId()

    // First try the cached pocket. If that fails, fall back to listPockets so
    // we recover from a stale localStorage entry instead of dead-ending.
    if (cachedPocketId) {
      const { data, error } = await api.getPocketSummary(cachedPocketId)
      if (data) {
        setSummary(data)
        setLoading(false)
        return
      }
      // The cached pocket lookup failed (404 = stale, 401 = the auth guard will
      // handle it, anything else = transient). Either way, try listPockets.
      if (error?.code === 'NOT_FOUND') {
        api.setPocketId('') // clear stale cache so we don't loop on it
      }
    }

    // No cached pocket OR cached lookup failed — list pockets and use the first.
    const { data: list, error: listErr } = await api.listPockets()
    if (listErr) {
      setLoadError(listErr.message)
      setLoading(false)
      return
    }
    if (list?.pockets[0]) {
      api.setPocketId(list.pockets[0].id)
      const { data: s, error } = await api.getPocketSummary(list.pockets[0].id)
      if (s) {
        setSummary(s)
      } else {
        setLoadError(error?.message ?? 'Could not load pocket summary')
      }
    }
    // If list.pockets is empty, summary stays null — and we render the genuine
    // "no pocket exists" empty state below (which now does NOT redirect).
    setLoading(false)
  }

  async function handleSync() {
    if (!summary) return
    setSyncing(true)
    await api.syncBalances(summary.pocketId)
    setTimeout(async () => {
      await loadSummary()
      setSyncing(false)
    }, 2000)
  }

  if (loading) {
    return (
      <div className="space-y-8 animate-fade-in">
        <div className="h-12 w-64 bg-ink-700/40 rounded animate-shimmer bg-gradient-to-r from-ink-700/40 via-ink-600/40 to-ink-700/40 bg-[length:200%_100%]" />
        <div className="h-48 bg-ink-700/40 rounded-2xl animate-shimmer bg-gradient-to-r from-ink-700/40 via-ink-600/40 to-ink-700/40 bg-[length:200%_100%]" />
      </div>
    )
  }

  if (!summary) {
    // Three real cases here:
    //   1. Load actually failed (network, 500, etc.) — offer retry
    //   2. User has no pockets yet — that's a backend bug since signup
    //      creates a pocket atomically, but show a "create one" CTA that
    //      hits the API instead of bouncing through register
    //   3. Token is bad — handled upstream by useAuthGuard, won't reach here
    return (
      <div className="text-center py-20 max-w-sm mx-auto">
        <p className="text-cream font-display text-2xl mb-2">
          {loadError ? 'Could not load your pocket' : 'No pocket yet'}
        </p>
        <p className="text-ink-300 text-sm mb-6">
          {loadError
            ? loadError
            : 'Your account exists but has no pocket attached. This usually means signup didn\'t complete cleanly.'}
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => {
              setLoading(true)
              loadSummary()
            }}
            className="px-4 py-2 bg-gold hover:bg-gold-300 text-ink-900 rounded-lg font-medium transition text-sm"
          >
            Retry
          </button>
          <button
            onClick={async () => {
              setLoading(true)
              const { data } = await api.createPocket('My pocket')
              if (data?.pocket?.id) {
                api.setPocketId(data.pocket.id)
                await loadSummary()
              } else {
                setLoading(false)
              }
            }}
            className="px-4 py-2 border border-ink-600 hover:border-ink-500 text-cream rounded-lg transition text-sm"
          >
            Create a pocket
          </button>
        </div>
      </div>
    )
  }

  const hasNoWallets = summary.solanaWallets.length === 0 && summary.externalBalances.length === 0

  return (
    <div className="space-y-10 animate-fade-up">
      <UpgradeBanner />

      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs tracking-widest text-ink-300 uppercase mb-2">Pocket</p>
          <h1 className="font-display text-5xl font-light tracking-tighter text-cream">
            {summary.name}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs ${
              wsStatus === 'open'
                ? 'border-moss/30 text-moss bg-moss/5'
                : 'border-ink-600 text-ink-400'
            }`}
            title={`WebSocket: ${wsStatus}`}
          >
            {wsStatus === 'open' ? (
              <>
                <span
                  className={`w-1.5 h-1.5 rounded-full bg-moss ${
                    livePulse ? 'animate-ping' : 'animate-pulse'
                  }`}
                />
                Live
              </>
            ) : (
              <>
                <WifiOff className="w-3 h-3" />
                Offline
              </>
            )}
          </div>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-2 px-3 py-2 text-sm text-ink-200 hover:text-cream border border-ink-600 hover:border-ink-400 rounded-lg transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing...' : 'Sync balances'}
          </button>
        </div>
      </div>

      {/* Total balance card */}
      <div className="card-glow relative overflow-hidden rounded-2xl border border-ink-700/60 bg-gradient-to-br from-ink-800/80 via-ink-800/40 to-ink-700/40 backdrop-blur-sm p-10">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gold/5 rounded-full blur-3xl pointer-events-none" />

        <p className="text-xs tracking-widest text-gold uppercase mb-3">Total balance</p>
        <p className="font-display text-7xl font-light tracking-tightest tabular text-cream mb-8">
          {formatUsd(summary.totalUsd)}
        </p>

        <div className="grid grid-cols-3 gap-px bg-ink-700/60 rounded-xl overflow-hidden">
          <Stat label="Solana" value={formatUsd(summary.solanaUsd)} accent />
          <Stat label="External" value={formatUsd(summary.externalUsd)} />
          <Stat label="Native SOL" value={`${parseFloat(summary.nativeBalanceSol).toFixed(4)}`} />
        </div>
      </div>

      {/* Policy status — surfaces guardrails on the dashboard */}
      <PolicyStatusCard />

      {/* Empty state */}
      {hasNoWallets && (
        <div className="text-center py-12 px-6 rounded-2xl border border-dashed border-ink-600 bg-ink-800/40">
          <Wallet className="w-12 h-12 text-ink-400 mx-auto mb-4" />
          <h3 className="font-display text-2xl text-cream mb-2">Your pocket is empty</h3>
          <p className="text-ink-300 mb-6 max-w-md mx-auto">
            Connect a Solana wallet to start. Phantom, Backpack, Solflare — anything that speaks
            Wallet Standard or WalletConnect.
          </p>
          <Link
            href="/dashboard/wallets"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-gold hover:bg-gold-300 text-ink-900 rounded-lg font-medium transition"
          >
            <Plus className="w-4 h-4" />
            Add a wallet
          </Link>
        </div>
      )}

      {/* Solana wallets */}
      {summary.solanaWallets.length > 0 && (
        <section>
          <SectionHeader title="Solana wallets" subtitle="Signing-capable · the real pocket" />
          <div className="grid md:grid-cols-2 gap-4">
            {summary.solanaWallets.map((w: any) => (
              <WalletCard key={w.walletId} wallet={w} primary />
            ))}
          </div>
        </section>
      )}

      {/* External balances */}
      {summary.externalBalances.length > 0 && (
        <section>
          <SectionHeader
            title="External balances"
            subtitle="Read-only · shown for portfolio completeness"
          />
          <div className="grid md:grid-cols-2 gap-4">
            {summary.externalBalances.map((w: any) => (
              <WalletCard key={w.walletId} wallet={w} />
            ))}
          </div>
        </section>
      )}

      {/* Quick actions */}
      <section className="grid md:grid-cols-2 gap-4">
        <ActionCard
          href="/dashboard/wallets"
          icon={<Plus className="w-5 h-5" />}
          title="Add a wallet"
          description="Connect Phantom, Backpack, or import a key into the vault."
        />
        <ActionCard
          href="/dashboard/agent"
          icon={<Sparkles className="w-5 h-5" />}
          title="Pay via agent"
          description="Tell the agent what to send. It picks the best wallet and routes through Solana."
        />
      </section>
    </div>
  )
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="bg-ink-800/80 p-5">
      <p className="text-xs tracking-widest text-ink-300 uppercase mb-1.5">{label}</p>
      <p
        className={`font-display text-2xl tabular ${
          accent ? 'text-gold' : 'text-cream'
        }`}
      >
        {value}
      </p>
    </div>
  )
}

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="flex items-baseline justify-between mb-4">
      <h2 className="font-display text-2xl font-medium text-cream">{title}</h2>
      <p className="text-sm text-ink-300">{subtitle}</p>
    </div>
  )
}

function WalletCard({ wallet, primary }: { wallet: any; primary?: boolean }) {
  return (
    <div
      className={`card-glow p-6 rounded-xl border bg-ink-800/40 backdrop-blur-sm transition ${
        primary
          ? 'border-gold/20 hover:border-gold/40'
          : 'border-ink-700/60 hover:border-ink-600'
      }`}
    >
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <p className="font-medium text-cream">{wallet.label}</p>
            {wallet.isDefault && (
              <span className="px-1.5 py-0.5 text-[10px] tracking-wider uppercase bg-gold/10 text-gold border border-gold/20 rounded">
                Default
              </span>
            )}
          </div>
          <p className="text-xs font-mono text-ink-300">
            {chainLabel(wallet.chain)} · {truncateAddress(wallet.address)}
          </p>
        </div>
        <p className="font-display text-xl tabular text-cream">{formatUsd(wallet.usdValue)}</p>
      </div>

      <div className="space-y-1 pt-4 border-t border-ink-700/60">
        {wallet.tokens.length === 0 ? (
          <p className="text-xs text-ink-400">No balances</p>
        ) : (
          wallet.tokens.slice(0, 3).map((t: any) => (
            <div key={t.token} className="flex items-center justify-between text-sm">
              <span className="text-ink-200 font-mono">{t.token}</span>
              <span className="text-ink-300 tabular">
                {(Number(t.amount) / 10 ** t.decimals).toFixed(4)}
                {t.usdValue && (
                  <span className="text-ink-400 ml-2">${parseFloat(t.usdValue).toFixed(2)}</span>
                )}
              </span>
            </div>
          ))
        )}
        {wallet.tokens.length > 3 && (
          <p className="text-xs text-ink-400 pt-1">+{wallet.tokens.length - 3} more tokens</p>
        )}
      </div>

      <div className="flex items-center gap-2 mt-4 text-xs">
        <span
          className={`px-2 py-0.5 rounded uppercase tracking-wider ${
            wallet.canSign
              ? 'bg-moss/10 text-moss border border-moss/20'
              : 'bg-ink-700/60 text-ink-300 border border-ink-600'
          }`}
        >
          {wallet.canSign ? 'Can sign' : 'Read-only'}
        </span>
        <span className="text-ink-400 font-mono">{wallet.connectionType}</span>
      </div>
    </div>
  )
}

function ActionCard({
  href,
  icon,
  title,
  description,
}: {
  href: string
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <Link
      href={href}
      className="group p-6 rounded-xl border border-ink-700/60 bg-ink-800/40 hover:border-gold/30 hover:bg-ink-800/60 transition"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 rounded-lg bg-gold/10 border border-gold/20 flex items-center justify-center text-gold">
          {icon}
        </div>
        <ArrowRight className="w-4 h-4 text-ink-400 group-hover:text-gold group-hover:translate-x-0.5 transition" />
      </div>
      <h3 className="font-display text-lg font-medium text-cream mb-1">{title}</h3>
      <p className="text-sm text-ink-300">{description}</p>
    </Link>
  )
}
