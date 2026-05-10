'use client'

import { Sidebar } from '@/components/layout/Sidebar'
import { useAuthGuard } from '@/lib/use-auth'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { checking, authenticated } = useAuthGuard()

  // While checking auth state on first mount, show a soft loading state.
  // Without this, child pages render briefly with no token, fire requests
  // that 401, and the user sees flashes of broken UI.
  if (checking) {
    return (
      <div className="min-h-screen bg-ink-900 flex items-center justify-center">
        <div className="text-ink-400 text-sm">Loading...</div>
      </div>
    )
  }

  // If not authenticated, the guard already pushed to /auth/login.
  // Render nothing while the redirect happens.
  if (!authenticated) return null

  return (
    <div className="min-h-screen bg-ink-900 flex">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className="max-w-6xl mx-auto px-10 py-10">{children}</div>
      </main>
    </div>
  )
}
