'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Home, Wallet, Sparkles, Activity, Shield, Settings, LogOut } from 'lucide-react'
import { api } from '@/lib/api'

const NAV = [
  { href: '/dashboard', label: 'Pocket', icon: Home },
  { href: '/dashboard/wallets', label: 'Wallets', icon: Wallet },
  { href: '/dashboard/agent', label: 'Agent', icon: Sparkles },
  { href: '/dashboard/activity', label: 'Activity', icon: Activity },
  { href: '/dashboard/policy', label: 'Policy', icon: Shield },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()

  function logout() {
    api.clearToken()
    router.push('/')
  }

  return (
    <aside className="w-60 bg-ink-800/40 border-r border-ink-700/60 backdrop-blur-sm flex flex-col">
      <div className="p-6">
        <Link href="/dashboard" className="inline-flex items-center gap-3 group">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-gold to-gold-600 flex items-center justify-center group-hover:scale-105 transition">
            <span className="text-ink-900 font-display font-bold text-lg">C</span>
          </div>
          <span className="font-display text-xl tracking-tight text-cream">Clutch</span>
        </Link>
      </div>

      <nav className="flex-1 px-3 space-y-1">
        {NAV.map((item) => {
          const Icon = item.icon
          const active = item.href === '/dashboard'
            ? pathname === '/dashboard'
            : pathname.startsWith(item.href)

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition ${
                active
                  ? 'bg-gold/10 text-gold border border-gold/20'
                  : 'text-ink-200 hover:bg-ink-700/40 hover:text-cream border border-transparent'
              }`}
            >
              <Icon className="w-4 h-4" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="p-3">
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-ink-300 hover:bg-ink-700/40 hover:text-rust transition"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </div>
    </aside>
  )
}
