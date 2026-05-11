'use client'

import { useEffect, useState, use } from 'react'
import Link from 'next/link'
import { ArrowLeft, Bot, ExternalLink, Key, Shield, Users } from 'lucide-react'
import { Logo } from '@/components/brand/Logo'
import { formatUsd } from '@/lib/format'
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
  totalVolumeUsd: number
  createdAt: string
}

export default function AgentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [agent, setAgent] = useState<Agent | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    load()
  }, [id])

  async function load() {
    const { data, error } = await api.getRegistryAgent(id)
    if (error) {
      setNotFound(true)
    } else if (data) {
      setAgent(data.agent)
    }
    setLoading(false)
  }

  if (loading) {
    return <div className="min-h-screen bg-ink-900 text-cream flex items-center justify-center">Loading...</div>
  }

  if (notFound || !agent) {
    return (
      <main className="min-h-screen bg-ink-900 text-cream flex items-center justify-center">
        <div className="text-center">
          <h1 className="font-display text-3xl mb-2">Agent not found</h1>
          <p className="text-ink-300 mb-6">This agent doesn't exist or was removed.</p>
          <Link
            href="/registry"
            className="inline-flex items-center gap-2 px-4 py-2 bg-gold hover:bg-gold-300 text-ink-900 rounded-lg font-medium transition"
          >
            Back to registry
          </Link>
        </div>
      </main>
    )
  }

  const truncatedKey = `${agent.publicKey.slice(0, 8)}...${agent.publicKey.slice(-8)}`
  const isAuthed = api.isAuthenticated()
  const authorizeHref = isAuthed
    ? `/dashboard/authorize/${agent.id}`
    : `/auth/login?next=/dashboard/authorize/${agent.id}`

  return (
    <main className="min-h-screen bg-ink-900 text-cream">
      <nav className="border-b border-ink-700/60 px-8 py-5">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <Logo size={32} />
            <span className="font-display text-lg tracking-tight">Clutch</span>
          </Link>
          <div className="flex items-center gap-6 text-sm">
            <Link href="/registry" className="text-ink-200 hover:text-cream transition">
              Registry
            </Link>
            <Link href="/auth/login" className="text-ink-200 hover:text-cream transition">
              Sign in
            </Link>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-8 py-10">
        <Link
          href="/registry"
          className="inline-flex items-center gap-2 text-sm text-ink-300 hover:text-cream transition mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to registry
        </Link>

        {/* Header card */}
        <div className="flex items-start gap-5 mb-10">
          <div className="w-20 h-20 rounded-2xl bg-gold/10 border border-gold/20 flex items-center justify-center text-gold shrink-0">
            {agent.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={agent.logoUrl}
                alt={agent.name}
                className="w-full h-full rounded-2xl object-cover"
              />
            ) : (
              <Bot className="w-9 h-9" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <h1 className="font-display text-4xl tracking-tighter">{agent.name}</h1>
              <span className="text-xs uppercase tracking-wider text-ink-400 bg-ink-800/60 px-2 py-1 rounded border border-ink-700">
                {agent.category}
              </span>
            </div>
            <p className="text-ink-200 text-lg leading-snug">{agent.tagline}</p>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3 mb-10">
          <div className="p-4 rounded-xl border border-ink-700/60 bg-ink-800/40">
            <div className="flex items-center gap-2 text-ink-400 text-xs mb-2">
              <Users className="w-3.5 h-3.5" />
              Authorized users
            </div>
            <div className="font-display text-2xl tabular text-cream">{agent.activeGrantsCount}</div>
          </div>
          <div className="p-4 rounded-xl border border-ink-700/60 bg-ink-800/40">
            <div className="flex items-center gap-2 text-ink-400 text-xs mb-2">
              <Shield className="w-3.5 h-3.5" />
              Volume routed
            </div>
            <div className="font-display text-2xl tabular text-cream">
              {formatUsd(agent.totalVolumeUsd)}
            </div>
          </div>
          <div className="p-4 rounded-xl border border-ink-700/60 bg-ink-800/40">
            <div className="flex items-center gap-2 text-ink-400 text-xs mb-2">
              <Key className="w-3.5 h-3.5" />
              Public key
            </div>
            <div className="font-mono text-xs text-cream truncate" title={agent.publicKey}>
              {truncatedKey}
            </div>
          </div>
        </div>

        {/* Description */}
        <section className="mb-10">
          <h2 className="font-display text-xl mb-3">About this agent</h2>
          <div className="prose prose-invert prose-sm max-w-none text-ink-200 leading-relaxed whitespace-pre-wrap">
            {agent.description}
          </div>
        </section>

        {/* Payment scope */}
        {agent.paymentScope && (
          <section className="mb-10">
            <h2 className="font-display text-xl mb-3">What this agent pays for</h2>
            <div className="p-5 rounded-xl border border-ink-700/60 bg-ink-800/40 text-ink-200 text-sm leading-relaxed">
              {agent.paymentScope}
            </div>
          </section>
        )}

        {/* Homepage */}
        {agent.homepage && (
          <section className="mb-10">
            <h2 className="font-display text-xl mb-3">Homepage</h2>
            <a
              href={agent.homepage}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 text-gold hover:underline"
            >
              {agent.homepage}
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </section>
        )}

        {/* Authorize CTA */}
        <div className="p-6 rounded-2xl border border-gold/30 bg-gold/5 text-center">
          <h3 className="font-display text-xl mb-2">Authorize this agent to pay from your pocket</h3>
          <p className="text-ink-200 text-sm mb-5 max-w-md mx-auto">
            You set the rules — per-transaction caps, daily limits, allowed recipients. Revoke
            access in one click any time. The agent never sees your wallet keys.
          </p>
          <Link
            href={authorizeHref}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-gold hover:bg-gold-300 text-ink-900 rounded-lg font-medium transition"
          >
            {isAuthed ? 'Authorize this agent' : 'Sign in to authorize'}
          </Link>
          <p className="text-xs text-ink-400 mt-3">
            Don't have a Clutch pocket?{' '}
            <Link href="/auth/try" className="text-gold hover:underline">
              Open one in 30 seconds.
            </Link>
          </p>
        </div>

        {/* Identity warning */}
        <div className="mt-8 p-4 rounded-xl border border-ink-700/60 bg-ink-800/40 text-xs text-ink-300">
          <p className="font-medium text-cream mb-1">Verify before you authorize</p>
          <p>
            Check the agent's homepage and public key match what you expect. Anyone can register
            an agent with any name. Reputation accrues from successful payments under
            authorization — newer agents have less.
          </p>
        </div>
      </div>
    </main>
  )
}
