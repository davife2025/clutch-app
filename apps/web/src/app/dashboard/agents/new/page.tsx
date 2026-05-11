'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, ArrowRight, Sparkles, Cpu, FileText, Zap } from 'lucide-react'
import { api } from '@/lib/api'

const TEMPLATES = [
  {
    id: 'api-spending',
    name: 'API spending agent',
    icon: Cpu,
    description:
      'Pays for x402-protected APIs on your behalf. Good for inference services, data feeds, or any API that returns HTTP 402.',
    suggestedPolicy: 'Per-call cap of $0.10, daily limit of $5.',
  },
  {
    id: 'content-paywall',
    name: 'Content paywall agent',
    icon: FileText,
    description:
      'Pays per-article paywalls so you can read content without subscriptions. Works on any site that returns HTTP 402.',
    suggestedPolicy: 'Per-article cap of $1, daily limit of $10.',
  },
  {
    id: 'inference',
    name: 'Per-call inference agent',
    icon: Zap,
    description:
      'Tightly-scoped agent that only pays for AI inference calls. Useful when you want a hard separation between agent budgets.',
    suggestedPolicy: 'Per-call cap of $0.05, daily limit of $2.',
  },
  {
    id: 'custom',
    name: 'Custom agent',
    icon: Sparkles,
    description:
      'Start from scratch. You set the name, description, and policy yourself.',
    suggestedPolicy: 'Inherits the pocket policy you have set.',
  },
] as const

export default function NewAgentPage() {
  const router = useRouter()
  const [step, setStep] = useState<1 | 2>(1)
  const [template, setTemplate] = useState<string>('api-spending')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  const selected = TEMPLATES.find((t) => t.id === template) ?? TEMPLATES[0]

  function pickTemplate(id: string) {
    setTemplate(id)
    const t = TEMPLATES.find((x) => x.id === id)
    if (t && !name) setName(t.name)
    if (t && !description) setDescription(t.description)
    setStep(2)
  }

  async function create() {
    if (!name.trim()) {
      setError('Name your agent first.')
      return
    }
    setCreating(true)
    setError('')
    const pocketId = api.getPocketId()
    if (!pocketId) {
      setError('No pocket selected.')
      setCreating(false)
      return
    }
    const { data, error: apiErr } = await api.createAgent(pocketId, {
      name: name.trim(),
      template,
      description: description.trim() || undefined,
    })
    setCreating(false)
    if (apiErr || !data) {
      setError(apiErr?.message ?? 'Failed to create agent')
      return
    }
    router.push(`/dashboard/agents/${data.agent.id}`)
  }

  return (
    <div className="animate-fade-up max-w-3xl">
      <Link
        href="/dashboard/agents"
        className="inline-flex items-center gap-2 text-sm text-ink-300 hover:text-cream transition mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to agents
      </Link>

      <div className="mb-10">
        <p className="text-xs tracking-widest text-ink-300 uppercase mb-2">Step {step} of 2</p>
        <h1 className="font-display text-5xl font-light tracking-tighter text-cream">
          {step === 1 ? 'Pick a template' : 'Name your agent'}
        </h1>
      </div>

      {step === 1 ? (
        <div className="grid sm:grid-cols-2 gap-3">
          {TEMPLATES.map((t) => (
            <button
              key={t.id}
              onClick={() => pickTemplate(t.id)}
              className={`text-left p-5 rounded-xl border bg-ink-800/40 transition ${
                template === t.id
                  ? 'border-gold/40 bg-gold/5'
                  : 'border-ink-700/60 hover:border-ink-600'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-gold/10 border border-gold/20 flex items-center justify-center text-gold shrink-0">
                  <t.icon className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-display text-base text-cream mb-1">{t.name}</h3>
                  <p className="text-sm text-ink-300 leading-snug mb-2">{t.description}</p>
                  <p className="text-xs text-ink-400 italic">{t.suggestedPolicy}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="space-y-5">
          <div className="p-4 rounded-lg bg-ink-800/40 border border-ink-700/60 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gold/10 border border-gold/20 flex items-center justify-center text-gold shrink-0">
              <selected.icon className="w-4 h-4" />
            </div>
            <div>
              <p className="text-sm text-cream">{selected.name}</p>
              <button
                onClick={() => setStep(1)}
                className="text-xs text-ink-300 hover:text-gold transition"
              >
                Change template →
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs uppercase tracking-widest text-ink-300 mb-2">
              Name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Give your agent a name"
              maxLength={60}
              autoFocus
              className="w-full px-4 py-2.5 bg-ink-900 border border-ink-600 focus:border-gold rounded-lg text-cream placeholder-ink-400 focus:outline-none transition"
            />
          </div>

          <div>
            <label className="block text-xs uppercase tracking-widest text-ink-300 mb-2">
              Description (optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="What is this agent for?"
              className="w-full px-4 py-2.5 bg-ink-900 border border-ink-600 focus:border-gold rounded-lg text-cream placeholder-ink-400 focus:outline-none transition resize-none"
            />
          </div>

          <div className="p-4 rounded-lg border border-ink-700/60 bg-ink-800/40 text-sm text-ink-200">
            This agent will inherit the spending policy on your pocket. To set per-agent limits,
            use multiple pockets — each pocket has its own policy.
            <Link href="/dashboard/policy" className="text-gold hover:underline ml-1">
              Open policy →
            </Link>
          </div>

          {error ? (
            <div className="px-4 py-3 rounded-lg bg-rust/10 border border-rust/30 text-rust text-sm">
              {error}
            </div>
          ) : null}

          <div className="flex items-center gap-3">
            <button
              onClick={create}
              disabled={creating || !name.trim()}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-gold hover:bg-gold-300 disabled:opacity-50 text-ink-900 rounded-lg font-medium transition"
            >
              {creating ? 'Creating...' : 'Create agent'}
              {!creating && <ArrowRight className="w-4 h-4" />}
            </button>
            <button
              onClick={() => setStep(1)}
              className="px-4 py-2.5 text-ink-300 hover:text-cream transition text-sm"
            >
              Back
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
