'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, ArrowRight, AlertCircle, Info } from 'lucide-react'
import { api } from '@/lib/api'

const CATEGORIES = ['trading', 'content', 'inference', 'data', 'social', 'other'] as const

export default function RegisterAgentPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [tagline, setTagline] = useState('')
  const [description, setDescription] = useState('')
  const [publicKey, setPublicKey] = useState('')
  const [homepage, setHomepage] = useState('')
  const [logoUrl, setLogoUrl] = useState('')
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>('inference')
  const [paymentScope, setPaymentScope] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSubmitting(true)

    const { data, error: apiErr } = await api.registerAgent({
      name: name.trim(),
      tagline: tagline.trim(),
      description: description.trim(),
      publicKey: publicKey.trim(),
      homepage: homepage.trim() || undefined,
      logoUrl: logoUrl.trim() || undefined,
      category,
      paymentScope: paymentScope.trim() || undefined,
    })

    setSubmitting(false)

    if (apiErr || !data) {
      setError(apiErr?.message ?? 'Failed to register agent')
      return
    }

    router.push(`/registry/${data.agent.id}`)
  }

  return (
    <div className="animate-fade-up max-w-3xl">
      <Link
        href="/dashboard/my-agents"
        className="inline-flex items-center gap-2 text-sm text-ink-300 hover:text-cream transition mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to my agents
      </Link>

      <div className="mb-10">
        <p className="text-xs tracking-widest text-ink-300 uppercase mb-2">Register an agent</p>
        <h1 className="font-display text-5xl font-light tracking-tighter text-cream">
          Publish to the registry
        </h1>
        <p className="text-ink-200 mt-3 max-w-xl">
          Make your agent discoverable. Users can browse the registry, find your agent, and
          authorize it to spend from their pocket within rules they set.
        </p>
      </div>

      <form onSubmit={submit} className="space-y-6">
        {/* Identity */}
        <Section title="Identity" subtitle="The on-chain identity of your agent">
          <Field label="Public key (Ed25519, base58)">
            <input
              value={publicKey}
              onChange={(e) => setPublicKey(e.target.value)}
              placeholder="So11111111111111111111111111111111111111112"
              required
              className="w-full px-3 py-2.5 bg-ink-900 border border-ink-600 focus:border-gold rounded-lg text-cream placeholder-ink-400 focus:outline-none transition font-mono text-sm"
            />
            <p className="text-xs text-ink-400 mt-2 leading-relaxed">
              The agent's public key. Your agent will sign payment requests with the matching
              private key. We never see the private key.
            </p>
          </Field>
        </Section>

        {/* Listing */}
        <Section title="Listing" subtitle="What users see in the registry">
          <Field label="Name" hint="Max 60 characters">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
              required
              placeholder="MarketBot"
              className="w-full px-3 py-2.5 bg-ink-900 border border-ink-600 focus:border-gold rounded-lg text-cream placeholder-ink-400 focus:outline-none transition"
            />
          </Field>

          <Field label="Tagline" hint="Max 140 characters">
            <input
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              maxLength={140}
              required
              placeholder="Pays for market data feeds within budget"
              className="w-full px-3 py-2.5 bg-ink-900 border border-ink-600 focus:border-gold rounded-lg text-cream placeholder-ink-400 focus:outline-none transition"
            />
            <p className="text-xs text-ink-400 mt-1 tabular">{tagline.length} / 140</p>
          </Field>

          <Field label="Description" hint="Markdown-friendly, max 4000 characters">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={4000}
              required
              rows={6}
              placeholder="Explain what the agent does, what kinds of payments it makes, and what services it works with."
              className="w-full px-3 py-2.5 bg-ink-900 border border-ink-600 focus:border-gold rounded-lg text-cream placeholder-ink-400 focus:outline-none transition resize-none"
            />
            <p className="text-xs text-ink-400 mt-1 tabular">{description.length} / 4000</p>
          </Field>

          <Field label="Category">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as (typeof CATEGORIES)[number])}
              className="w-full px-3 py-2.5 bg-ink-900 border border-ink-600 focus:border-gold rounded-lg text-cream focus:outline-none transition capitalize"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Payment scope" hint="What this agent typically pays for. Helps users decide whether to authorize it.">
            <textarea
              value={paymentScope}
              onChange={(e) => setPaymentScope(e.target.value)}
              rows={3}
              placeholder="Pays for market data API calls (under $0.10 per request) and historical data downloads (up to $5 per request)."
              className="w-full px-3 py-2.5 bg-ink-900 border border-ink-600 focus:border-gold rounded-lg text-cream placeholder-ink-400 focus:outline-none transition resize-none"
            />
          </Field>
        </Section>

        {/* Optional */}
        <Section title="Optional" subtitle="Trust signals — recommended but not required">
          <Field label="Homepage">
            <input
              type="url"
              value={homepage}
              onChange={(e) => setHomepage(e.target.value)}
              placeholder="https://your-agent.com"
              className="w-full px-3 py-2.5 bg-ink-900 border border-ink-600 focus:border-gold rounded-lg text-cream placeholder-ink-400 focus:outline-none transition"
            />
          </Field>

          <Field label="Logo URL">
            <input
              type="url"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder="https://your-agent.com/logo.png"
              className="w-full px-3 py-2.5 bg-ink-900 border border-ink-600 focus:border-gold rounded-lg text-cream placeholder-ink-400 focus:outline-none transition"
            />
          </Field>
        </Section>

        {/* Honest reminder */}
        <div className="p-4 rounded-xl border border-ink-700/60 bg-ink-800/40 flex items-start gap-3">
          <Info className="w-4 h-4 text-ink-300 shrink-0 mt-0.5" />
          <div className="text-sm text-ink-200">
            Once registered, your agent is publicly discoverable. You can edit details or unlist
            it any time. Users authorize agents to spend from their pockets within rules{' '}
            <span className="text-cream">they</span> set — not rules you set. Your agent's
            payments must satisfy both your spec and each user's policy.
          </div>
        </div>

        {error && (
          <div className="px-4 py-3 rounded-lg bg-rust/10 border border-rust/30 text-rust text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={submitting || !name.trim() || !tagline.trim() || !description.trim() || !publicKey.trim()}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-gold hover:bg-gold-300 disabled:opacity-50 text-ink-900 rounded-lg font-medium transition"
          >
            {submitting ? 'Registering...' : 'Register agent'}
            {!submitting && <ArrowRight className="w-4 h-4" />}
          </button>
          <Link
            href="/dashboard/my-agents"
            className="px-4 py-2.5 text-ink-300 hover:text-cream transition text-sm"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  )
}

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
