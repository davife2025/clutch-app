'use client'

import { useEffect, useState } from 'react'
import { Shield, ShieldOff, Save, Plus, X, AlertCircle, Check } from 'lucide-react'
import { api } from '@/lib/api'
import { formatUsd } from '@/lib/format'

interface PolicyState {
  enabled: boolean
  maxPerTxUsd: number | null
  maxPerDayUsd: number | null
  allowedRecipients: string[]
  blockedRecipients: string[]
  allowedTokens: string[]
  blockedTokens: string[]
}

export default function PolicyPage() {
  const [policy, setPolicy] = useState<PolicyState | null>(null)
  const [spentToday, setSpentToday] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    load()
  }, [])

  async function load() {
    const pocketId = api.getPocketId()
    if (!pocketId) return
    const { data } = await api.getPolicy(pocketId)
    if (data) {
      setPolicy(data.policy)
      setSpentToday(data.spentTodayUsd)
    }
    setLoading(false)
  }

  async function save() {
    const pocketId = api.getPocketId()
    if (!pocketId || !policy) return
    setSaving(true)
    setError('')
    const { error } = await api.updatePolicy(pocketId, policy)
    setSaving(false)
    if (error) {
      setError(error.message)
      return
    }
    setSavedAt(Date.now())
    setTimeout(() => setSavedAt(null), 2000)
  }

  if (loading || !policy) {
    return <div className="text-ink-300">Loading...</div>
  }

  const dayUsage = policy.maxPerDayUsd ? spentToday / policy.maxPerDayUsd : 0
  const dayPctClamped = Math.min(100, dayUsage * 100)

  return (
    <div className="animate-fade-up max-w-3xl">
      <div className="mb-10">
        <p className="text-xs tracking-widest text-ink-300 uppercase mb-2">Spending policy</p>
        <h1 className="font-display text-5xl font-light tracking-tighter text-cream">
          Guardrails
        </h1>
        <p className="text-ink-200 mt-3 max-w-xl">
          Server-side limits enforced before any payment. Even an AI agent with a hallucination
          can't bypass these — the chain never sees a transaction that violates your policy.
        </p>
      </div>

      <div className="space-y-5">
        {/* Master toggle */}
        <div
          className={`p-5 rounded-xl border transition ${
            policy.enabled
              ? 'border-moss/30 bg-moss/5'
              : 'border-ink-700/60 bg-ink-800/40'
          }`}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div
                className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  policy.enabled
                    ? 'bg-moss/10 border border-moss/20 text-moss'
                    : 'bg-ink-700/40 border border-ink-600 text-ink-300'
                }`}
              >
                {policy.enabled ? <Shield className="w-5 h-5" /> : <ShieldOff className="w-5 h-5" />}
              </div>
              <div>
                <h3 className="font-display text-lg text-cream mb-1">
                  Policy enforcement {policy.enabled ? 'on' : 'off'}
                </h3>
                <p className="text-sm text-ink-300">
                  {policy.enabled
                    ? 'Payments will be denied if they violate any rule below.'
                    : 'No rules are enforced. Turn this on to activate guardrails.'}
                </p>
              </div>
            </div>
            <Toggle
              on={policy.enabled}
              onChange={(on) => setPolicy({ ...policy, enabled: on })}
            />
          </div>
        </div>

        {/* Daily limit + usage bar */}
        <Section title="Daily limit" subtitle="Total USD value of payments per day (UTC)">
          <DollarInput
            value={policy.maxPerDayUsd}
            onChange={(v) => setPolicy({ ...policy, maxPerDayUsd: v })}
            placeholder="No limit"
          />
          {policy.maxPerDayUsd ? (
            <div className="mt-4">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-ink-300">
                  Spent today: <span className="tabular text-cream">{formatUsd(spentToday)}</span>
                </span>
                <span className="text-ink-300 tabular">
                  {dayPctClamped.toFixed(0)}%
                </span>
              </div>
              <div className="h-1.5 bg-ink-700 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all ${
                    dayPctClamped >= 100
                      ? 'bg-rust'
                      : dayPctClamped >= 80
                        ? 'bg-gold'
                        : 'bg-moss'
                  }`}
                  style={{ width: `${dayPctClamped}%` }}
                />
              </div>
            </div>
          ) : null}
        </Section>

        {/* Per-tx limit */}
        <Section title="Per-transaction limit" subtitle="Max USD value of any single payment">
          <DollarInput
            value={policy.maxPerTxUsd}
            onChange={(v) => setPolicy({ ...policy, maxPerTxUsd: v })}
            placeholder="No limit"
          />
        </Section>

        {/* Recipient allowlist */}
        <Section
          title="Recipient allowlist"
          subtitle="If set, payments only go to these addresses. Empty = any address."
        >
          <ListEditor
            items={policy.allowedRecipients}
            onChange={(items) => setPolicy({ ...policy, allowedRecipients: items })}
            placeholder="So111... or wallet.sol"
            mono
          />
        </Section>

        {/* Recipient blocklist */}
        <Section
          title="Recipient blocklist"
          subtitle="Payments to these addresses are always rejected"
        >
          <ListEditor
            items={policy.blockedRecipients}
            onChange={(items) => setPolicy({ ...policy, blockedRecipients: items })}
            placeholder="So111... or wallet.sol"
            mono
          />
        </Section>

        {/* Token allowlist */}
        <Section
          title="Token allowlist"
          subtitle="If set, only these tokens can be sent. Empty = any token."
        >
          <ListEditor
            items={policy.allowedTokens}
            onChange={(items) => setPolicy({ ...policy, allowedTokens: items })}
            placeholder="USDC, SOL, BONK..."
          />
        </Section>

        {/* Token blocklist */}
        <Section title="Token blocklist" subtitle="These tokens can never be sent">
          <ListEditor
            items={policy.blockedTokens}
            onChange={(items) => setPolicy({ ...policy, blockedTokens: items })}
            placeholder="..."
          />
        </Section>

        {/* Save */}
        {error ? (
          <div className="px-4 py-3 rounded-lg bg-rust/10 border border-rust/30 text-rust text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        ) : null}

        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={save}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-gold hover:bg-gold-300 disabled:opacity-50 text-ink-900 rounded-lg font-medium transition"
          >
            {savedAt ? (
              <>
                <Check className="w-4 h-4" />
                Saved
              </>
            ) : saving ? (
              'Saving...'
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save policy
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Components ───────────────────────────────────────────────────────────────

function Section({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: string
  children: React.ReactNode
}) {
  return (
    <div className="p-5 rounded-xl border border-ink-700/60 bg-ink-800/40">
      <h3 className="font-display text-base text-cream mb-1">{title}</h3>
      <p className="text-sm text-ink-300 mb-4">{subtitle}</p>
      {children}
    </div>
  )
}

function Toggle({ on, onChange }: { on: boolean; onChange: (on: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!on)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition ${
        on ? 'bg-gold' : 'bg-ink-700'
      }`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-cream transition ${
          on ? 'translate-x-5' : 'translate-x-0.5'
        }`}
      />
    </button>
  )
}

function DollarInput({
  value,
  onChange,
  placeholder,
}: {
  value: number | null
  onChange: (v: number | null) => void
  placeholder?: string
}) {
  return (
    <div className="relative">
      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-300">$</span>
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
        placeholder={placeholder}
        className="w-full pl-9 pr-4 py-2.5 bg-ink-900 border border-ink-600 focus:border-gold rounded-lg text-cream placeholder-ink-400 focus:outline-none transition tabular"
      />
    </div>
  )
}

function ListEditor({
  items,
  onChange,
  placeholder,
  mono,
}: {
  items: string[]
  onChange: (items: string[]) => void
  placeholder?: string
  mono?: boolean
}) {
  const [draft, setDraft] = useState('')

  function add() {
    const v = draft.trim()
    if (!v || items.includes(v)) return
    onChange([...items, v])
    setDraft('')
  }

  function remove(idx: number) {
    onChange(items.filter((_, i) => i !== idx))
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              add()
            }
          }}
          placeholder={placeholder}
          className={`flex-1 px-3 py-2 bg-ink-900 border border-ink-600 focus:border-gold rounded-lg text-cream placeholder-ink-400 focus:outline-none transition text-sm ${mono ? 'font-mono' : ''}`}
        />
        <button
          onClick={add}
          disabled={!draft.trim()}
          className="p-2 bg-ink-700 hover:bg-ink-600 disabled:opacity-30 rounded-lg text-cream transition"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
      {items.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {items.map((item, idx) => (
            <span
              key={idx}
              className={`inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-md bg-ink-700/60 border border-ink-600 text-xs text-cream ${mono ? 'font-mono' : ''}`}
            >
              {item.length > 24 ? `${item.slice(0, 8)}...${item.slice(-6)}` : item}
              <button
                onClick={() => remove(idx)}
                className="text-ink-400 hover:text-rust transition"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      ) : (
        <p className="text-xs text-ink-400 italic">Empty — no restriction.</p>
      )}
    </div>
  )
}
