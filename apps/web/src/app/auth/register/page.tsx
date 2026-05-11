'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { api } from '@/lib/api'

export default function RegisterPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { data, error } = await api.register(email, password)
    setLoading(false)

    if (error || !data) {
      setError(error?.message ?? 'Registration failed')
      return
    }

    api.setToken(data.token)
    api.setPocketId(data.pocketId)
    api.setAnonymous(false)
    router.push('/dashboard')
  }

  return (
    <div className="animate-fade-up">
      <h1 className="font-display text-4xl font-light tracking-tighter mb-2 text-cream">
        Open a pocket
      </h1>
      <p className="text-ink-200 mb-10">Your wallets, unified. One minute to set up.</p>

      <form onSubmit={handleSubmit} className="space-y-5">
        <label className="block">
          <span className="block text-sm text-ink-200 mb-2">Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            required
            className="w-full px-4 py-3 bg-ink-800 border border-ink-600 focus:border-gold rounded-lg text-cream placeholder-ink-400 focus:outline-none transition"
          />
        </label>

        <label className="block">
          <span className="block text-sm text-ink-200 mb-2">Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
            autoComplete="new-password"
            minLength={8}
            required
            className="w-full px-4 py-3 bg-ink-800 border border-ink-600 focus:border-gold rounded-lg text-cream placeholder-ink-400 focus:outline-none transition"
          />
        </label>

        {error && (
          <div className="px-4 py-3 rounded-lg bg-rust/10 border border-rust/30 text-rust text-sm">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full px-5 py-3 bg-gold hover:bg-gold-300 disabled:opacity-50 text-ink-900 rounded-lg font-medium flex items-center justify-center gap-2 transition"
        >
          {loading ? 'Creating pocket...' : 'Create pocket'}
          {!loading && <ArrowRight className="w-4 h-4" />}
        </button>
      </form>

      <p className="mt-8 text-sm text-ink-300 text-center">
        Already have a pocket?{' '}
        <Link href="/auth/login" className="text-gold hover:text-gold-300 transition">
          Sign in
        </Link>
      </p>
    </div>
  )
}
