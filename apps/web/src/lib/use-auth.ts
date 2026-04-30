'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { api } from './api'

export function useAuthGuard() {
  const router = useRouter()
  useEffect(() => {
    if (!api.isAuthenticated()) {
      router.push('/auth/login')
    }
  }, [router])
}
