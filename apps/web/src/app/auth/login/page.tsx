'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { api } from '@/lib/api'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { data, error } = await api.login(email, password)
    setLoading(false)

    if (error || !data) {
      setError(error?.message ?? 'Login failed')
      return
    }

    api.setToken(data.token)
    api.setAnonymous(false)
    // Fetch first pocket
    const { data: pocketData } = await api.listPockets()
    if (pocketData?.pockets[0]) {
      api.setPocketId(pocketData.pockets[0].id)
    }
    router.push('/dashboard')
  }

  return (
    <div className="animate-fade-up">
      <h1 className="font-display text-4xl font-light tracking-tighter mb-2 text-cream">
        Welcome back
      </h1>
      <p className="text-ink-200 mb-10">Sign in to your pocket.</p>

      <form onSubmit={handleSubmit} className="space-y-5">
        <Field
          label="Email"
          type="email"
          value={email}
          onChange={setEmail}
          placeholder="you@example.com"
          autoComplete="email"
          required
        />
        <Field
          label="Password"
          type="password"
          value={password}
          onChange={setPassword}
          placeholder="••••••••"
          autoComplete="current-password"
          required
        />

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
          {loading ? 'Signing in...' : 'Sign in'}
          {!loading && <ArrowRight className="w-4 h-4" />}
        </button>
      </form>

      <p className="mt-8 text-sm text-ink-300 text-center">
        New here?{' '}
        <Link href="/auth/register" className="text-gold hover:text-gold-300 transition">
          Open a pocket
        </Link>
      </p>
    </div>
  )
}

function Field({
  label,
  type,
  value,
  onChange,
  placeholder,
  autoComplete,
  required,
}: {
  label: string
  type: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  autoComplete?: string
  required?: boolean
}) {
  return (
    <label className="block">
      <span className="block text-sm text-ink-200 mb-2">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required={required}
        className="w-full px-4 py-3 bg-ink-800 border border-ink-600 focus:border-gold rounded-lg text-cream placeholder-ink-400 focus:outline-none transition"
      />
    </label>
  )
}
