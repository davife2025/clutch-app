'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Bot, Shield, ShieldOff, ArrowRight, Plus, Pencil, X, Check } from 'lucide-react'
import { api } from '@/lib/api'
import { formatUsd } from '@/lib/format'

interface Grant {
  id: string
  agent: {
    id: string
    name: string
    tagline: string
    logoUrl: string | null
    category: string
    publicKey: string
  }
  maxPerTxUsd: number | null
  maxPerDayUsd: number | null
  allowedRecipients: string[]
  allowedTokens: string[]
  expiresAt: string | null
  status: 'active' | 'revoked' | 'expired'
  spentUsd: number
  lastUsedAt: string | null
  createdAt: string
}

export default function GrantsPage() {
  const [grants, setGrants] = useState<Grant[]>([])
  const [loading, setLoading] = useState(true)
  const [revoking, setRevoking] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | null>(null)

  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoadError(null)
    const pocketId = api.getPocketId()
    if (!pocketId) {
      setLoadError('No pocket selected. Go to your Pocket tab to set one up.')
      setLoading(false)
      return
    }
    const { data, error } = await api.listGrants(pocketId)
    if (error) {
      // Surface the error instead of showing an empty list with no explanation
      setLoadError(error.message)
    } else if (data) {
      setGrants(data.grants)
    }
    setLoading(false)
  }

  async function revoke(grantId: string) {
    if (!confirm('Revoke this agent\'s authorization? They won\'t be able to spend from this pocket.')) return
    setRevoking(grantId)
    await api.revokeGrant(grantId)
    setRevoking(null)
    load()
  }

  async function saveEdit(grantId: string, update: { maxPerTxUsd: number | null; maxPerDayUsd: number | null }) {
    await api.updateGrant(grantId, update)
    setEditing(null)
    load()
  }

  const active = grants.filter((g) => g.status === 'active')
  const inactive = grants.filter((g) => g.status !== 'active')

  return (
    <div className="animate-fade-up">
      <div className="flex items-end justify-between mb-10">
        <div>
          <p className="text-xs tracking-widest text-ink-300 uppercase mb-2">Authorized agents</p>
          <h1 className="font-display text-5xl font-light tracking-tighter text-cream">
            Who can spend from this pocket
          </h1>
          <p className="text-ink-200 mt-3 max-w-xl">
            Agents you've authorized to make payments from this pocket. Each one has its own scoped
            limits — they can never exceed your overall pocket policy.
          </p>
        </div>
        <Link
          href="/registry"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-gold hover:bg-gold-300 text-ink-900 rounded-lg font-medium transition shrink-0"
        >
          <Plus className="w-4 h-4" />
          Browse registry
        </Link>
      </div>

      {loading ? (
        <div className="text-ink-300">Loading...</div>
      ) : loadError ? (
        <div className="p-5 rounded-xl border border-rust/30 bg-rust/5">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-rust/10 border border-rust/20 flex items-center justify-center text-rust shrink-0">
              <Shield className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-cream font-medium mb-1">Could not load grants</p>
              <p className="text-ink-200 text-sm mb-3">{loadError}</p>
              <p className="text-xs text-ink-400">
                If this says "Unauthorized" or "Invalid token," the API server may have been
                redeployed with a different JWT secret since you signed in. Sign out and back in
                to refresh your session. Don't worry — your data is safe.
              </p>
              <button
                onClick={() => {
                  setLoading(true)
                  load()
                }}
                className="mt-3 px-3 py-1.5 text-xs text-cream bg-ink-700 hover:bg-ink-600 rounded transition"
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      ) : grants.length === 0 ? (
        <div className="text-center py-16 px-6 rounded-2xl border border-dashed border-ink-600 bg-ink-800/40">
          <Shield className="w-12 h-12 text-ink-400 mx-auto mb-4" />
          <h3 className="font-display text-2xl text-cream mb-2">No authorized agents yet</h3>
          <p className="text-ink-300 mb-6 max-w-md mx-auto">
            Browse the registry to find agents that pay for things you want — APIs, content,
            inference, market data. Authorize one to spend from your pocket within rules you set.
          </p>
          <Link
            href="/registry"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-gold hover:bg-gold-300 text-ink-900 rounded-lg font-medium transition"
          >
            Browse registry
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      ) : (
        <div className="space-y-8">
          {active.length > 0 && (
            <section>
              <h2 className="font-display text-xl text-cream mb-4 flex items-center gap-2">
                <Shield className="w-5 h-5 text-moss" />
                Active ({active.length})
              </h2>
              <div className="space-y-3">
                {active.map((g) => (
                  <GrantRow
                    key={g.id}
                    grant={g}
                    onRevoke={() => revoke(g.id)}
                    revoking={revoking === g.id}
                    isEditing={editing === g.id}
                    onStartEdit={() => setEditing(g.id)}
                    onCancelEdit={() => setEditing(null)}
                    onSaveEdit={(u) => saveEdit(g.id, u)}
                  />
                ))}
              </div>
            </section>
          )}

          {inactive.length > 0 && (
            <section>
              <h2 className="font-display text-xl text-cream mb-4 flex items-center gap-2 opacity-60">
                <ShieldOff className="w-5 h-5" />
                Past ({inactive.length})
              </h2>
              <div className="space-y-3 opacity-60">
                {inactive.map((g) => (
                  <GrantRow key={g.id} grant={g} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}

function GrantRow({
  grant,
  onRevoke,
  revoking,
  isEditing,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
}: {
  grant: Grant
  onRevoke?: () => void
  revoking?: boolean
  isEditing?: boolean
  onStartEdit?: () => void
  onCancelEdit?: () => void
  onSaveEdit?: (u: { maxPerTxUsd: number | null; maxPerDayUsd: number | null }) => void
}) {
  const isActive = grant.status === 'active'
  const expiresIn = grant.expiresAt ? new Date(grant.expiresAt).getTime() - Date.now() : null
  const expiresInDays = expiresIn ? Math.ceil(expiresIn / (1000 * 60 * 60 * 24)) : null

  // Edit-mode local state
  const [editMaxPerTx, setEditMaxPerTx] = useState<number | null>(grant.maxPerTxUsd)
  const [editMaxPerDay, setEditMaxPerDay] = useState<number | null>(grant.maxPerDayUsd)
  const [saving, setSaving] = useState(false)

  // Reset edit state if grant changes underneath us
  useEffect(() => {
    setEditMaxPerTx(grant.maxPerTxUsd)
    setEditMaxPerDay(grant.maxPerDayUsd)
  }, [grant.maxPerTxUsd, grant.maxPerDayUsd, isEditing])

  async function handleSave() {
    if (!onSaveEdit) return
    setSaving(true)
    await onSaveEdit({ maxPerTxUsd: editMaxPerTx, maxPerDayUsd: editMaxPerDay })
    setSaving(false)
  }

  return (
    <div className="p-5 rounded-xl border border-ink-700/60 bg-ink-800/40 hover:border-ink-600 transition">
      <div className="flex items-start gap-4">
        <Link
          href={`/registry/${grant.agent.id}`}
          target="_blank"
          className="w-11 h-11 rounded-xl bg-gold/10 border border-gold/20 flex items-center justify-center text-gold shrink-0"
        >
          {grant.agent.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={grant.agent.logoUrl} alt={grant.agent.name} className="w-full h-full rounded-xl object-cover" />
          ) : (
            <Bot className="w-5 h-5" />
          )}
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <Link
              href={`/registry/${grant.agent.id}`}
              target="_blank"
              className="font-display text-lg text-cream hover:text-gold transition"
            >
              {grant.agent.name}
            </Link>
            <span
              className={`text-xs uppercase tracking-wider px-2 py-0.5 rounded border ${
                grant.status === 'active'
                  ? 'bg-moss/10 text-moss border-moss/20'
                  : grant.status === 'expired'
                    ? 'bg-gold/10 text-gold border-gold/20'
                    : 'bg-rust/10 text-rust border-rust/20'
              }`}
            >
              {grant.status}
            </span>
          </div>
          <p className="text-sm text-ink-200 mb-3">{grant.agent.tagline}</p>

          {isEditing ? (
            <div className="space-y-3 mb-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-ink-300 mb-1">Per-transaction (USD)</label>
                  <DollarInput value={editMaxPerTx} onChange={setEditMaxPerTx} />
                </div>
                <div>
                  <label className="block text-xs text-ink-300 mb-1">Daily (USD)</label>
                  <DollarInput value={editMaxPerDay} onChange={setEditMaxPerDay} />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-gold hover:bg-gold-300 disabled:opacity-50 text-ink-900 rounded-md text-xs font-medium transition"
                >
                  <Check className="w-3 h-3" />
                  {saving ? 'Saving...' : 'Save changes'}
                </button>
                <button
                  onClick={onCancelEdit}
                  disabled={saving}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-ink-300 hover:text-cream transition text-xs"
                >
                  <X className="w-3 h-3" />
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Limits */}
              <div className="flex items-center gap-4 text-xs text-ink-300 flex-wrap mb-2">
                {grant.maxPerTxUsd != null && (
                  <span>
                    Per-tx: <span className="text-cream tabular">{formatUsd(grant.maxPerTxUsd)}</span>
                  </span>
                )}
                {grant.maxPerDayUsd != null && (
                  <span>
                    Daily: <span className="text-cream tabular">{formatUsd(grant.maxPerDayUsd)}</span>
                  </span>
                )}
                {grant.allowedTokens.length > 0 && (
                  <span>
                    Tokens: <span className="text-cream">{grant.allowedTokens.join(', ')}</span>
                  </span>
                )}
                {expiresInDays !== null && expiresInDays > 0 && isActive && (
                  <span>
                    Expires: <span className="text-cream tabular">{expiresInDays} days</span>
                  </span>
                )}
              </div>

              {/* Usage */}
              <div className="text-xs text-ink-400 tabular">
                {formatUsd(grant.spentUsd)} spent
                {grant.lastUsedAt
                  ? ` · last used ${new Date(grant.lastUsedAt).toLocaleDateString()}`
                  : ' · never used'}
              </div>
            </>
          )}
        </div>

        {isActive && !isEditing && (
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={onStartEdit}
              title="Edit limits"
              className="p-1.5 text-ink-400 hover:text-cream rounded transition"
            >
              <Pencil className="w-4 h-4" />
            </button>
            <button
              onClick={onRevoke}
              disabled={revoking}
              className="px-3 py-1.5 text-xs text-ink-300 hover:text-rust border border-ink-700 hover:border-rust/40 rounded-md transition disabled:opacity-50"
            >
              {revoking ? 'Revoking...' : 'Revoke'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function DollarInput({
  value,
  onChange,
}: {
  value: number | null
  onChange: (v: number | null) => void
}) {
  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-300 text-sm">$</span>
      <input
        type="number"
        min="0"
        step="0.01"
        value={value ?? ''}
        onChange={(e) => {
          const s = e.target.value
          if (s === '') return onChange(null)
          const n = parseFloat(s)
          if (!isNaN(n) && n >= 0) onChange(n)
        }}
        placeholder="No limit"
        className="w-full pl-7 pr-3 py-1.5 bg-ink-900 border border-ink-600 focus:border-gold rounded-md text-cream placeholder-ink-400 focus:outline-none transition tabular text-sm"
      />
    </div>
  )
}
