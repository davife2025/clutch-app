'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Sparkles, ArrowRight } from 'lucide-react'
import { api } from '@/lib/api'

export default function TryPage() {
  const router = useRouter()
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data, error } = await api.anonymous()
      if (cancelled) return
      if (error || !data) {
        setError(error?.message ?? 'Could not start a guest session')
        return
      }
      api.setToken(data.token)
      api.setPocketId(data.pocketId)
      api.setAnonymous(true)
      router.replace('/dashboard')
    })()
    return () => {
      cancelled = true
    }
  }, [router])

  return (
    <div className="animate-fade-up text-center">
      <div className="inline-flex w-14 h-14 rounded-2xl bg-gold/10 border border-gold/20 items-center justify-center text-gold mb-6">
        <Sparkles className="w-7 h-7" />
      </div>
      <h1 className="font-display text-3xl font-light tracking-tight text-cream mb-3">
        Setting up your pocket...
      </h1>
      <p className="text-ink-200 text-sm mb-8 max-w-sm mx-auto">
        Creating a guest account so you can try Clutch right now. You can add an email later
        without losing anything.
      </p>

      {error ? (
        <div className="space-y-4">
          <div className="px-4 py-3 rounded-lg bg-rust/10 border border-rust/30 text-rust text-sm">
            {error}
          </div>
          <Link
            href="/auth/register"
            className="inline-flex items-center gap-2 px-5 py-3 bg-gold hover:bg-gold-300 text-ink-900 rounded-lg font-medium transition"
          >
            Sign up instead
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      ) : (
        <div className="flex justify-center">
          <div className="w-6 h-6 border-2 border-ink-600 border-t-gold rounded-full animate-spin" />
        </div>
      )}
    </div>
  )
}
