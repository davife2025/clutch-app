'use client'

import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Bot, Check, Shield, AlertTriangle, ArrowRight } from 'lucide-react'
import { api } from '@/lib/api'

interface Agent {
  id: string
  name: string
  tagline: string
  description: string
  publicKey: string
  homepage: string | null
  logoUrl: string | null
  category: string
  paymentScope: string | null
  activeGrantsCount: number
}

export default function AuthorizePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [agent, setAgent] = useState<Agent | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // Default scope — sensible safe-by-default values
  const [maxPerTxUsd, setMaxPerTxUsd] = useState<number | null>(1)
  const [maxPerDayUsd, setMaxPerDayUsd] = useState<number | null>(10)
  const [allowedTokens, setAllowedTokens] = useState<string[]>(['USDC'])
  const [expiresIn, setExpiresIn] = useState<'never' | '1d' | '7d' | '30d'>('30d')

  useEffect(() => {
    load()
  }, [id])

  async function load() {
    const { data, error } = await api.getRegistryAgent(id)
    if (error || !data) {
      setError(error?.message ?? 'Agent not found')
    } else {
      setAgent(data.agent)
    }
    setLoading(false)
  }

  async function authorize() {
    if (!agent) return
    const pocketId = api.getPocketId()
    if (!pocketId) {
      setError('No pocket selected. Open or create a pocket first.')
      return
    }
    setSubmitting(true)
    setError('')

    let expiresAt: string | null = null
    if (expiresIn !== 'never') {
      const days = expiresIn === '1d' ? 1 : expiresIn === '7d' ? 7 : 30
      const d = new Date()
      d.setUTCDate(d.getUTCDate() + days)
      expiresAt = d.toISOString()
    }

    const { error: apiErr } = await api.createGrant(pocketId, {
      registeredAgentId: agent.id,
      maxPerTxUsd,
      maxPerDayUsd,
      allowedTokens: allowedTokens.length > 0 ? allowedTokens : null,
      expiresAt,
    })

    setSubmitting(false)
    if (apiErr) {
      setError(apiErr.message)
      return
    }

    router.push('/dashboard/grants')
  }

  if (loading) return <div className="text-ink-300">Loading...</div>

  if (!agent) {
    return (
      <div className="animate-fade-up text-center py-16">
        <h1 className="font-display text-3xl text-cream mb-2">Agent not found</h1>
        <p className="text-ink-300 mb-6">{error || 'This agent may have been removed.'}</p>
        <Link
          href="/registry"
          className="inline-flex items-center gap-2 px-4 py-2 bg-gold hover:bg-gold-300 text-ink-900 rounded-lg font-medium transition"
        >
          Back to registry
        </Link>
      </div>
    )
  }

  return (
    <div className="animate-fade-up max-w-2xl">
      <Link
        href={`/registry/${agent.id}`}
        target="_blank"
        className="inline-flex items-center gap-2 text-sm text-ink-300 hover:text-cream transition mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        View public listing
      </Link>

      <div className="mb-8">
        <p className="text-xs tracking-widest text-ink-300 uppercase mb-2">Authorize agent</p>
        <h1 className="font-display text-4xl font-light tracking-tighter text-cream">
          Set the rules for this agent
        </h1>
      </div>

      {/* Agent identity card */}
      <div className="mb-8 p-5 rounded-xl border border-ink-700/60 bg-ink-800/40">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-gold/10 border border-gold/20 flex items-center justify-center text-gold shrink-0">
            {agent.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={agent.logoUrl} alt={agent.name} className="w-full h-full rounded-xl object-cover" />
            ) : (
              <Bot className="w-6 h-6" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h2 className="font-display text-xl text-cream">{agent.name}</h2>
              <span className="text-xs uppercase tracking-wider text-ink-400 bg-ink-700/60 px-2 py-0.5 rounded border border-ink-700">
                {agent.category}
              </span>
            </div>
            <p className="text-sm text-ink-200 mb-2">{agent.tagline}</p>
            <p className="text-xs text-ink-400 font-mono truncate" title={agent.publicKey}>
              {agent.publicKey.slice(0, 16)}...{agent.publicKey.slice(-8)}
            </p>
          </div>
        </div>
        {agent.paymentScope && (
          <div className="mt-4 pt-4 border-t border-ink-700/60 text-sm text-ink-200">
            <p className="text-xs uppercase tracking-widest text-ink-400 mb-1">Agent says it pays for</p>
            {agent.paymentScope}
          </div>
        )}
      </div>

      {/* Scope form */}
      <div className="space-y-5">
        <Section title="Limits">
          <Field label="Max per transaction (USD)">
            <DollarInput value={maxPerTxUsd} onChange={setMaxPerTxUsd} placeholder="No limit" />
          </Field>
          <Field label="Max per day (USD)">
            <DollarInput value={maxPerDayUsd} onChange={setMaxPerDayUsd} placeholder="No limit" />
          </Field>
        </Section>

        <Section title="Tokens">
          <Field label="Allowed tokens" hint="Empty = inherits pocket policy. Only stablecoins recommended.">
            <div className="flex gap-2 flex-wrap">
              {['USDC', 'USDT', 'SOL'].map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() =>
                    setAllowedTokens(
                      allowedTokens.includes(t)
                        ? allowedTokens.filter((x) => x !== t)
                        : [...allowedTokens, t],
                    )
                  }
                  className={`px-3 py-1.5 rounded-md text-sm border transition ${
                    allowedTokens.includes(t)
                      ? 'bg-gold/10 text-gold border-gold/30'
                      : 'bg-ink-900 text-ink-200 border-ink-600 hover:border-ink-500'
                  }`}
                >
                  {allowedTokens.includes(t) && <Check className="w-3 h-3 inline mr-1" />}
                  {t}
                </button>
              ))}
            </div>
          </Field>
        </Section>

        <Section title="Expiration">
          <Field label="When does this authorization expire?">
            <div className="grid grid-cols-4 gap-2">
              {(['1d', '7d', '30d', 'never'] as const).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setExpiresIn(opt)}
                  className={`px-3 py-2 rounded-md text-sm border transition ${
                    expiresIn === opt
                      ? 'bg-gold/10 text-gold border-gold/30'
                      : 'bg-ink-900 text-ink-200 border-ink-600 hover:border-ink-500'
                  }`}
                >
                  {opt === 'never' ? 'Never' : opt === '1d' ? '24 hours' : opt === '7d' ? '7 days' : '30 days'}
                </button>
              ))}
            </div>
          </Field>
        </Section>

        {/* Trust warning */}
        <div className="p-4 rounded-xl border border-gold/30 bg-gold/5 flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-gold shrink-0 mt-0.5" />
          <div className="text-sm text-ink-200">
            <p className="text-cream font-medium mb-1">Authorize what you trust</p>
            <p>
              Once authorized, this agent can spend from your pocket within the rules above. You can
              revoke at any time from the Grants page. The agent never sees your wallet keys — every
              payment is signed and routed through Clutch.
            </p>
          </div>
        </div>

        {error && (
          <div className="px-4 py-3 rounded-lg bg-rust/10 border border-rust/30 text-rust text-sm">
            {error}
          </div>
        )}

        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={authorize}
            disabled={submitting}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-gold hover:bg-gold-300 disabled:opacity-50 text-ink-900 rounded-lg font-medium transition"
          >
            <Shield className="w-4 h-4" />
            {submitting ? 'Authorizing...' : 'Authorize agent'}
            {!submitting && <ArrowRight className="w-4 h-4" />}
          </button>
          <Link
            href="/registry"
            className="px-4 py-2.5 text-ink-300 hover:text-cream transition text-sm"
          >
            Cancel
          </Link>
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="p-5 rounded-xl border border-ink-700/60 bg-ink-800/40">
      <h3 className="font-display text-base text-cream mb-4">{title}</h3>
      <div className="space-y-4">{children}</div>
    </div>
  )
}

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="block text-sm text-cream mb-1.5">
        {label}
        {hint && <span className="text-ink-400 font-normal ml-2 text-xs">{hint}</span>}
      </label>
      {children}
    </div>
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
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-300">$</span>
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
        className="w-full pl-8 pr-4 py-2 bg-ink-900 border border-ink-600 focus:border-gold rounded-lg text-cream placeholder-ink-400 focus:outline-none transition tabular"
      />
    </div>
  )
}
