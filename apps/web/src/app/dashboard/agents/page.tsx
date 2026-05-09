'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Sparkles, Plus, Pause, Play, Ban, ArrowRight, Bot } from 'lucide-react'
import { api } from '@/lib/api'
import { formatUsd } from '@/lib/format'

interface Agent {
  id: string
  name: string
  template: string
  description: string | null
  status: 'active' | 'paused' | 'revoked'
  lastInstruction: string | null
  totalSpentUsd: number
  createdAt: string
}

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    const pocketId = api.getPocketId()
    if (!pocketId) return
    const { data } = await api.listAgents(pocketId)
    if (data) setAgents(data.agents)
    setLoading(false)
  }

  async function setStatus(id: string, status: 'active' | 'paused' | 'revoked') {
    await api.updateAgent(id, { status })
    load()
  }

  return (
    <div className="animate-fade-up">
      <div className="flex items-end justify-between mb-10">
        <div>
          <p className="text-xs tracking-widest text-ink-300 uppercase mb-2">Agents</p>
          <h1 className="font-display text-5xl font-light tracking-tighter text-cream">
            Your payment agents
          </h1>
          <p className="text-ink-200 mt-3 max-w-xl">
            Personas you've set up to handle x402 payments on your behalf. Each one inherits this
            pocket's spending policy.
          </p>
        </div>
        <Link
          href="/dashboard/agents/new"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-gold hover:bg-gold-300 text-ink-900 rounded-lg font-medium transition shrink-0"
        >
          <Plus className="w-4 h-4" />
          New agent
        </Link>
      </div>

      {/* Honest scope card */}
      <div className="mb-8 p-5 rounded-xl border border-ink-700/60 bg-ink-800/40">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-ink-700/60 border border-ink-600 flex items-center justify-center text-ink-200 shrink-0">
            <Bot className="w-4 h-4" />
          </div>
          <div className="text-sm text-ink-200 leading-relaxed">
            <p className="text-cream font-medium mb-1">What these agents can and can't do</p>
            <p>
              <span className="text-cream">Can:</span> call URLs that return HTTP 402 paywalls,
              pay them within your spending policy, log every payment as a receipt, return the
              content to you.
            </p>
            <p className="mt-1">
              <span className="text-cream">Can't:</span> browse arbitrary websites, fill out
              forms, solve CAPTCHAs, create accounts, sign up for things. Set expectations
              accordingly.
            </p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-ink-300">Loading...</div>
      ) : agents.length === 0 ? (
        <div className="text-center py-16 px-6 rounded-2xl border border-dashed border-ink-600 bg-ink-800/40">
          <Sparkles className="w-12 h-12 text-ink-400 mx-auto mb-4" />
          <h3 className="font-display text-2xl text-cream mb-2">No agents yet</h3>
          <p className="text-ink-300 mb-6 max-w-md mx-auto">
            Create your first agent. Pick a template, set the scope, and start instructing it.
          </p>
          <Link
            href="/dashboard/agents/new"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-gold hover:bg-gold-300 text-ink-900 rounded-lg font-medium transition"
          >
            <Plus className="w-4 h-4" />
            Create your first agent
          </Link>
        </div>
      ) : (
        <div className="grid gap-3">
          {agents.map((agent) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              onPause={() => setStatus(agent.id, 'paused')}
              onResume={() => setStatus(agent.id, 'active')}
              onRevoke={() => setStatus(agent.id, 'revoked')}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function AgentCard({
  agent,
  onPause,
  onResume,
  onRevoke,
}: {
  agent: Agent
  onPause: () => void
  onResume: () => void
  onRevoke: () => void
}) {
  const statusStyles = {
    active: 'bg-moss/10 text-moss border-moss/20',
    paused: 'bg-gold/10 text-gold border-gold/20',
    revoked: 'bg-rust/10 text-rust border-rust/20',
  }[agent.status]

  return (
    <div
      className={`p-5 rounded-xl border bg-ink-800/40 transition ${
        agent.status === 'revoked' ? 'border-ink-700/40 opacity-60' : 'border-ink-700/60 hover:border-ink-600'
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <Link href={`/dashboard/agents/${agent.id}`} className="flex items-start gap-3 min-w-0 flex-1 group">
          <div className="w-10 h-10 rounded-lg bg-gold/10 border border-gold/20 flex items-center justify-center text-gold shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-display text-lg text-cream truncate group-hover:text-gold transition">
                {agent.name}
              </h3>
              <span
                className={`text-xs uppercase tracking-wider px-2 py-0.5 rounded border ${statusStyles}`}
              >
                {agent.status}
              </span>
            </div>
            {agent.description ? (
              <p className="text-sm text-ink-300 truncate">{agent.description}</p>
            ) : null}
            <div className="text-xs text-ink-400 mt-1.5 tabular">
              {formatUsd(agent.totalSpentUsd)} spent
              {agent.lastInstruction ? ` · last: "${agent.lastInstruction.slice(0, 40)}${agent.lastInstruction.length > 40 ? '...' : ''}"` : ''}
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-ink-400 group-hover:text-gold group-hover:translate-x-0.5 transition shrink-0 mt-1" />
        </Link>
        <div className="flex items-center gap-1 shrink-0">
          {agent.status === 'active' && (
            <button
              onClick={onPause}
              title="Pause"
              className="p-1.5 text-ink-400 hover:text-gold rounded transition"
            >
              <Pause className="w-4 h-4" />
            </button>
          )}
          {agent.status === 'paused' && (
            <button
              onClick={onResume}
              title="Resume"
              className="p-1.5 text-ink-400 hover:text-moss rounded transition"
            >
              <Play className="w-4 h-4" />
            </button>
          )}
          {agent.status !== 'revoked' && (
            <button
              onClick={onRevoke}
              title="Revoke"
              className="p-1.5 text-ink-400 hover:text-rust rounded transition"
            >
              <Ban className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
