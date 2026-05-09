'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Search, ArrowRight, Bot, TrendingUp, FileText, Cpu, Database, MessageSquare, MoreHorizontal } from 'lucide-react'
import { Logo } from '@/components/brand/Logo'
import { formatUsd } from '@/lib/format'
import { api } from '@/lib/api'

interface Agent {
  id: string
  name: string
  tagline: string
  logoUrl: string | null
  category: string
  paymentScope: string | null
  activeGrantsCount: number
  totalVolumeUsd: number
  publicKey: string
}

const CATEGORIES = [
  { id: 'all', label: 'All', icon: Bot },
  { id: 'trading', label: 'Trading', icon: TrendingUp },
  { id: 'content', label: 'Content', icon: FileText },
  { id: 'inference', label: 'Inference', icon: Cpu },
  { id: 'data', label: 'Data', icon: Database },
  { id: 'social', label: 'Social', icon: MessageSquare },
  { id: 'other', label: 'Other', icon: MoreHorizontal },
]

export default function RegistryPage() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState('all')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<'popular' | 'newest'>('popular')

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, sort])

  // Debounced search reload
  useEffect(() => {
    const t = setTimeout(load, 300)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  async function load() {
    setLoading(true)
    const { data } = await api.listRegistry({
      category: category === 'all' ? undefined : category,
      search: search.trim() || undefined,
      sort,
    })
    if (data) setAgents(data.agents)
    setLoading(false)
  }

  return (
    <main className="min-h-screen bg-ink-900 text-cream">
      {/* Top nav — registry is public, so simpler nav */}
      <nav className="border-b border-ink-700/60 px-8 py-5">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <Logo size={32} />
            <span className="font-display text-lg tracking-tight">Clutch</span>
          </Link>
          <div className="flex items-center gap-6 text-sm">
            <Link href="/registry" className="text-cream font-medium">
              Registry
            </Link>
            <Link href="/auth/login" className="text-ink-200 hover:text-cream transition">
              Sign in
            </Link>
            <Link
              href="/auth/try"
              className="px-3 py-1.5 bg-gold hover:bg-gold-300 text-ink-900 rounded-md font-medium transition"
            >
              Open a pocket
            </Link>
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-8 py-12">
        {/* Header */}
        <div className="mb-10">
          <p className="text-xs tracking-widest text-ink-300 uppercase mb-2">Agent registry</p>
          <h1 className="font-display text-5xl font-light tracking-tighter mb-4">
            AI agents you can authorize
          </h1>
          <p className="text-ink-200 max-w-2xl text-lg leading-relaxed">
            Public directory of AI agents that accept payment through Clutch. Authorize an agent
            to spend from your pocket within rules you set. Revoke any time.
          </p>
        </div>

        {/* Search + sort */}
        <div className="flex items-center gap-3 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search agents..."
              className="w-full pl-10 pr-4 py-2.5 bg-ink-800/40 border border-ink-700/60 focus:border-gold rounded-lg text-cream placeholder-ink-400 focus:outline-none transition text-sm"
            />
          </div>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as 'popular' | 'newest')}
            className="px-4 py-2.5 bg-ink-800/40 border border-ink-700/60 focus:border-gold rounded-lg text-cream focus:outline-none transition text-sm"
          >
            <option value="popular">Most popular</option>
            <option value="newest">Newest</option>
          </select>
        </div>

        {/* Category pills */}
        <div className="flex items-center gap-2 mb-8 flex-wrap">
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon
            const active = category === cat.id
            return (
              <button
                key={cat.id}
                onClick={() => setCategory(cat.id)}
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition border ${
                  active
                    ? 'bg-gold/10 text-gold border-gold/30'
                    : 'bg-ink-800/40 text-ink-200 border-ink-700/60 hover:border-ink-600'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {cat.label}
              </button>
            )
          })}
        </div>

        {/* Agent grid */}
        {loading ? (
          <div className="text-ink-300 text-center py-12">Loading...</div>
        ) : agents.length === 0 ? (
          <div className="text-center py-16 px-6 rounded-2xl border border-dashed border-ink-600 bg-ink-800/40">
            <Bot className="w-12 h-12 text-ink-400 mx-auto mb-4" />
            <h3 className="font-display text-2xl text-cream mb-2">No agents yet</h3>
            <p className="text-ink-300 mb-6 max-w-md mx-auto">
              {search
                ? `No agents match "${search}".`
                : 'The registry is empty for this category. Check back soon, or register your own.'}
            </p>
            <Link
              href="/dashboard/my-agents/new"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-gold hover:bg-gold-300 text-ink-900 rounded-lg font-medium transition"
            >
              Register your agent
            </Link>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {agents.map((agent) => (
              <Link
                key={agent.id}
                href={`/registry/${agent.id}`}
                className="group p-5 rounded-xl border border-ink-700/60 bg-ink-800/40 hover:border-ink-600 hover:bg-ink-800/60 transition"
              >
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-gold/10 border border-gold/20 flex items-center justify-center text-gold shrink-0">
                    {agent.logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={agent.logoUrl}
                        alt={agent.name}
                        className="w-full h-full rounded-lg object-cover"
                      />
                    ) : (
                      <Bot className="w-5 h-5" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-display text-base text-cream truncate group-hover:text-gold transition">
                      {agent.name}
                    </h3>
                    <p className="text-xs text-ink-400 capitalize">{agent.category}</p>
                  </div>
                </div>
                <p className="text-sm text-ink-200 line-clamp-2 leading-snug mb-4">
                  {agent.tagline}
                </p>
                <div className="flex items-center justify-between text-xs text-ink-400 pt-3 border-t border-ink-700/40">
                  <span className="tabular">
                    {agent.activeGrantsCount}{' '}
                    {agent.activeGrantsCount === 1 ? 'user' : 'users'}
                  </span>
                  <span className="tabular">{formatUsd(agent.totalVolumeUsd)} volume</span>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Submit CTA */}
        <div className="mt-16 p-8 rounded-2xl border border-ink-700/60 bg-ink-800/40 text-center">
          <h3 className="font-display text-2xl text-cream mb-3">Building an agent?</h3>
          <p className="text-ink-200 mb-5 max-w-lg mx-auto">
            Register it here so users can authorize it to make payments from their pockets.
            Free, takes 2 minutes.
          </p>
          <Link
            href="/dashboard/my-agents/new"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-gold hover:bg-gold-300 text-ink-900 rounded-lg font-medium transition"
          >
            Register your agent
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </main>
  )
}
