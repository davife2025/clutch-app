'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Send, Sparkles, ExternalLink, Pause, Play, Ban, AlertCircle, Info } from 'lucide-react'
import { api } from '@/lib/api'

interface Agent {
  id: string
  pocketId: string
  name: string
  template: string
  description: string | null
  status: 'active' | 'paused' | 'revoked'
  lastInstruction: string | null
  totalSpentUsd: number
  createdAt: string
}

interface Plan {
  instruction: string
  urls: string[]
  canExecute: boolean
  explanation: string
}

interface Receipt {
  id: string
  resourceUrl: string
  amount: string
  token: string
  succeeded: boolean
  paidAt: string
}

export default function AgentDetailPage({ params }: { params: { id: string } }) {
  const { id } = params
  const [agent, setAgent] = useState<Agent | null>(null)
  const [receipts, setReceipts] = useState<Receipt[]>([])
  const [instruction, setInstruction] = useState('')
  const [plan, setPlan] = useState<Plan | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    load()
  }, [id])

  async function load() {
    const { data } = await api.getAgent(id)
    if (data) {
      setAgent(data.agent)
      setReceipts(data.recentReceipts)
    }
    setLoading(false)
  }

  async function submit() {
    if (!instruction.trim()) return
    setSubmitting(true)
    setError('')
    setPlan(null)
    const { data, error: apiErr } = await api.instructAgent(id, instruction.trim())
    setSubmitting(false)
    if (apiErr || !data) {
      setError(apiErr?.message ?? 'Failed to instruct agent')
      return
    }
    setPlan(data.plan)
    load() // refresh lastInstruction
  }

  async function setStatus(status: 'active' | 'paused' | 'revoked') {
    await api.updateAgent(id, { status })
    load()
  }

  if (loading || !agent) return <div className="text-ink-300">Loading...</div>

  const statusStyles = {
    active: 'bg-moss/10 text-moss border-moss/20',
    paused: 'bg-gold/10 text-gold border-gold/20',
    revoked: 'bg-rust/10 text-rust border-rust/20',
  }[agent.status]

  return (
    <div className="animate-fade-up max-w-3xl">
      <Link
        href="/dashboard/agents"
        className="inline-flex items-center gap-2 text-sm text-ink-300 hover:text-cream transition mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to agents
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between mb-10 gap-6">
        <div className="min-w-0 flex-1">
          <p className="text-xs tracking-widest text-ink-300 uppercase mb-2">{agent.template}</p>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="font-display text-5xl font-light tracking-tighter text-cream">
              {agent.name}
            </h1>
            <span
              className={`text-xs uppercase tracking-wider px-2 py-1 rounded border ${statusStyles}`}
            >
              {agent.status}
            </span>
          </div>
          {agent.description ? (
            <p className="text-ink-200 mt-3">{agent.description}</p>
          ) : null}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {agent.status === 'active' && (
            <button
              onClick={() => setStatus('paused')}
              className="p-2 text-ink-300 hover:text-gold border border-ink-700 hover:border-gold/40 rounded-lg transition"
              title="Pause"
            >
              <Pause className="w-4 h-4" />
            </button>
          )}
          {agent.status === 'paused' && (
            <button
              onClick={() => setStatus('active')}
              className="p-2 text-ink-300 hover:text-moss border border-ink-700 hover:border-moss/40 rounded-lg transition"
              title="Resume"
            >
              <Play className="w-4 h-4" />
            </button>
          )}
          {agent.status !== 'revoked' && (
            <button
              onClick={() => setStatus('revoked')}
              className="p-2 text-ink-300 hover:text-rust border border-ink-700 hover:border-rust/40 rounded-lg transition"
              title="Revoke"
            >
              <Ban className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Instruction interface */}
      {agent.status === 'active' ? (
        <div className="mb-8">
          <label className="block text-sm text-cream mb-3">
            Tell your agent what to do
          </label>
          <div className="rounded-xl border border-ink-700/60 bg-ink-800/40 p-4">
            <textarea
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              rows={3}
              placeholder='Try: "Fetch https://api.example.com/premium and pay if it returns a 402."'
              className="w-full bg-transparent text-cream placeholder-ink-400 focus:outline-none resize-none"
            />
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-ink-700/60">
              <p className="text-xs text-ink-400 italic">
                Include the URL you want fetched. The agent only handles HTTP 402 paywalls — no
                form filling.
              </p>
              <button
                onClick={submit}
                disabled={submitting || !instruction.trim()}
                className="inline-flex items-center gap-2 px-4 py-2 bg-gold hover:bg-gold-300 disabled:opacity-50 text-ink-900 rounded-lg text-sm font-medium transition"
              >
                {submitting ? 'Planning...' : 'Run'}
                {!submitting && <Send className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="mb-8 px-4 py-3 rounded-lg bg-ink-800/40 border border-ink-700/60 text-sm text-ink-300">
          Agent is {agent.status}. Resume it to give new instructions.
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mb-6 px-4 py-3 rounded-lg bg-rust/10 border border-rust/30 text-rust text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      {/* Plan output */}
      {plan && (
        <div className="mb-8 rounded-xl border border-ink-700/60 bg-ink-800/40 p-5">
          <div className="flex items-start gap-3 mb-3">
            <div className="w-8 h-8 rounded-lg bg-gold/10 border border-gold/20 flex items-center justify-center text-gold shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-cream font-medium mb-1">Agent plan</p>
              <p className="text-sm text-ink-200">{plan.explanation}</p>
            </div>
          </div>
          {plan.urls.length > 0 && (
            <div className="ml-11 space-y-1">
              {plan.urls.map((url, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 text-xs font-mono text-ink-300"
                >
                  <span className="text-ink-500">{idx + 1}.</span>
                  <span className="truncate">{url}</span>
                </div>
              ))}
            </div>
          )}
          {plan.canExecute ? (
            <div className="mt-4 pt-3 border-t border-ink-700/60 flex items-center gap-2 text-xs text-ink-400">
              <Info className="w-3.5 h-3.5" />
              Live execution lands in the next release. For now this is a dry-run plan.
            </div>
          ) : null}
        </div>
      )}

      {/* Receipts */}
      <div>
        <h2 className="font-display text-2xl text-cream mb-4">Recent payments</h2>
        {receipts.length === 0 ? (
          <p className="text-ink-300 text-sm">
            No payments yet. Once your agent pays an x402 paywall, you'll see it here.
          </p>
        ) : (
          <div className="rounded-xl border border-ink-700/60 bg-ink-800/40 overflow-hidden">
            {receipts.map((r, idx) => (
              <a
                key={r.id}
                href={`https://solscan.io/tx/${r.id}`}
                target="_blank"
                rel="noreferrer"
                className={`flex items-center justify-between px-5 py-4 hover:bg-ink-700/20 transition ${
                  idx > 0 ? 'border-t border-ink-700/40' : ''
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-cream font-mono truncate">{r.resourceUrl}</p>
                  <p className="text-xs text-ink-400 mt-0.5">
                    {new Date(r.paidAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-sm tabular text-cream">
                    {(Number(r.amount) / 1e6).toFixed(4)} {r.token}
                  </span>
                  <ExternalLink className="w-3.5 h-3.5 text-ink-400" />
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
