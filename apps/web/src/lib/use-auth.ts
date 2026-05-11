'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from './api'

/**
 * Guards a page so unauthenticated users are redirected to /auth/login.
 *
 * Why the seemingly redundant `mounted` check:
 *   On the server (during SSR), `api.isAuthenticated()` always returns false
 *   because localStorage is browser-only. If we redirect immediately, the
 *   hydration on the client races against the redirect — which produced the
 *   "I just logged in but got bounced back to login" bug.
 *
 *   By waiting one render after mount, localStorage is readable and the
 *   token check is accurate. Returns `{ checking: true }` during that window
 *   so pages can hold off rendering content until auth state is known.
 */
export function useAuthGuard(): { checking: boolean; authenticated: boolean } {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [authenticated, setAuthenticated] = useState(false)

  useEffect(() => {
    setMounted(true)
    const isAuthed = api.isAuthenticated()
    setAuthenticated(isAuthed)
    if (!isAuthed) {
      router.replace('/auth/login')
    }
  }, [router])

  return { checking: !mounted, authenticated }
}
