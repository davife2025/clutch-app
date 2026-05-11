'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Bot, Plus, ArrowRight, ExternalLink } from 'lucide-react'
import { api } from '@/lib/api'
import { formatUsd } from '@/lib/format'

interface MyAgent {
  id: string
  name: string
  tagline: string
  description: string
  publicKey: string
  category: string
  status: 'active' | 'unlisted' | 'suspended'
  activeGrantsCount: number
  totalVolumeUsd: number
}

export default function MyAgentsPage() {
  const [agents, setAgents] = useState<MyAgent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    const { data } = await api.listMyRegisteredAgents()
    if (data) setAgents(data.agents)
    setLoading(false)
  }

  return (
    <div className="animate-fade-up">
      <div className="flex items-end justify-between mb-10">
        <div>
          <p className="text-xs tracking-widest text-ink-300 uppercase mb-2">My registered agents</p>
          <h1 className="font-display text-5xl font-light tracking-tighter text-cream">
            Agents you've published
          </h1>
          <p className="text-ink-200 mt-3 max-w-xl">
            Agents you've registered in the public Clutch registry. Users can find these and
            authorize them to spend from their pockets.
          </p>
        </div>
        <Link
          href="/dashboard/my-agents/new"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-gold hover:bg-gold-300 text-ink-900 rounded-lg font-medium transition shrink-0"
        >
          <Plus className="w-4 h-4" />
          Register agent
        </Link>
      </div>

      {loading ? (
        <div className="text-ink-300">Loading...</div>
      ) : agents.length === 0 ? (
        <div className="text-center py-16 px-6 rounded-2xl border border-dashed border-ink-600 bg-ink-800/40">
          <Bot className="w-12 h-12 text-ink-400 mx-auto mb-4" />
          <h3 className="font-display text-2xl text-cream mb-2">No agents registered yet</h3>
          <p className="text-ink-300 mb-6 max-w-md mx-auto">
            Register an agent to make it discoverable. Users can browse the registry and grant
            your agent permission to spend from their pockets within their policy.
          </p>
          <Link
            href="/dashboard/my-agents/new"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-gold hover:bg-gold-300 text-ink-900 rounded-lg font-medium transition"
          >
            <Plus className="w-4 h-4" />
            Register your first agent
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {agents.map((agent) => (
            <div
              key={agent.id}
              className="p-5 rounded-xl border border-ink-700/60 bg-ink-800/40 hover:border-ink-600 transition"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <div className="w-10 h-10 rounded-lg bg-gold/10 border border-gold/20 flex items-center justify-center text-gold shrink-0">
                    <Bot className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className="font-display text-lg text-cream">{agent.name}</h3>
                      <span
                        className={`text-xs uppercase tracking-wider px-2 py-0.5 rounded border ${
                          agent.status === 'active'
                            ? 'bg-moss/10 text-moss border-moss/20'
                            : agent.status === 'unlisted'
                              ? 'bg-gold/10 text-gold border-gold/20'
                              : 'bg-rust/10 text-rust border-rust/20'
                        }`}
                      >
                        {agent.status}
                      </span>
                      <span className="text-xs text-ink-400 capitalize">{agent.category}</span>
                    </div>
                    <p className="text-sm text-ink-200 line-clamp-1">{agent.tagline}</p>
                    <div className="text-xs text-ink-400 mt-1.5 tabular">
                      {agent.activeGrantsCount} active{' '}
                      {agent.activeGrantsCount === 1 ? 'grant' : 'grants'} ·{' '}
                      {formatUsd(agent.totalVolumeUsd)} routed
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Link
                    href={`/registry/${agent.id}`}
                    target="_blank"
                    title="View public listing"
                    className="p-2 text-ink-400 hover:text-cream transition"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </Link>
                  <ArrowRight className="w-4 h-4 text-ink-400" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
