'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Sparkles, X, ArrowRight, Check } from 'lucide-react'
import { api } from '@/lib/api'

export function UpgradeBanner() {
  const router = useRouter()
  const [show, setShow] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  if (!show) return null
  if (typeof window === 'undefined') return null
  if (!api.isAnonymous()) return null

  async function handleUpgrade(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { data, error } = await api.upgrade(email, password)
    setLoading(false)
    if (error || !data) {
      setError(error?.message ?? 'Upgrade failed')
      return
    }
    api.setToken(data.token)
    api.setAnonymous(false)
    setSuccess(true)
    setTimeout(() => {
      setShow(false)
      router.refresh()
    }, 1500)
  }

  if (success) {
    return (
      <div className="rounded-xl border border-moss/30 bg-moss/10 p-4 flex items-center gap-3 animate-fade-up">
        <Check className="w-5 h-5 text-moss" />
        <p className="text-cream text-sm">Account secured. You can sign in from any device now.</p>
      </div>
    )
  }

  if (showForm) {
    return (
      <div className="rounded-xl border border-gold/30 bg-ink-800/60 p-5 animate-fade-up">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-xs tracking-widest text-gold uppercase mb-1">Save your pocket</p>
            <h3 className="font-display text-lg text-cream">Add an email to keep this account</h3>
          </div>
          <button
            onClick={() => setShowForm(false)}
            className="p-1 text-ink-400 hover:text-cream transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleUpgrade} className="grid sm:grid-cols-2 gap-3">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            required
            className="px-3 py-2 bg-ink-900 border border-ink-600 focus:border-gold rounded-lg text-cream placeholder-ink-400 focus:outline-none transition text-sm"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
            autoComplete="new-password"
            minLength={8}
            required
            className="px-3 py-2 bg-ink-900 border border-ink-600 focus:border-gold rounded-lg text-cream placeholder-ink-400 focus:outline-none transition text-sm"
          />
          {error ? (
            <div className="sm:col-span-2 px-3 py-2 rounded-lg bg-rust/10 border border-rust/30 text-rust text-xs">
              {error}
            </div>
          ) : null}
          <button
            type="submit"
            disabled={loading}
            className="sm:col-span-2 px-4 py-2 bg-gold hover:bg-gold-300 disabled:opacity-50 text-ink-900 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition"
          >
            {loading ? 'Saving...' : 'Save account'}
            {!loading && <ArrowRight className="w-3.5 h-3.5" />}
          </button>
        </form>
        <p className="text-xs text-ink-400 mt-3">
          Your pocket, wallets, and history are preserved — we just attach an email so you can sign
          in from another device.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-gold/20 bg-gradient-to-r from-gold/5 to-transparent p-4 flex items-center justify-between gap-4 animate-fade-up">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-9 h-9 rounded-lg bg-gold/10 border border-gold/20 flex items-center justify-center text-gold shrink-0">
          <Sparkles className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <p className="text-sm text-cream font-medium">You're using a guest account</p>
          <p className="text-xs text-ink-300">
            Add an email to keep access if you switch devices or clear your browser.
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={() => setShowForm(true)}
          className="px-3 py-1.5 bg-gold hover:bg-gold-300 text-ink-900 rounded-md text-xs font-medium transition"
        >
          Save account
        </button>
        <button
          onClick={() => setShow(false)}
          className="p-1.5 text-ink-400 hover:text-cream transition"
          title="Dismiss"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}
