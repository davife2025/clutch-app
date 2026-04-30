'use client'

import { Sidebar } from '@/components/layout/Sidebar'
import { useAuthGuard } from '@/lib/use-auth'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  useAuthGuard()

  return (
    <div className="min-h-screen bg-ink-900 flex">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className="max-w-6xl mx-auto px-10 py-10">{children}</div>
      </main>
    </div>
  )
}
