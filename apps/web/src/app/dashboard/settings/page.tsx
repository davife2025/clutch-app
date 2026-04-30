'use client'

import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { api } from '@/lib/api'

export default function SettingsPage() {
  const router = useRouter()

  function logout() {
    api.clearToken()
    router.push('/')
  }

  return (
    <div className="animate-fade-up max-w-2xl">
      <div className="mb-10">
        <p className="text-xs tracking-widest text-ink-300 uppercase mb-2">Settings</p>
        <h1 className="font-display text-5xl font-light tracking-tighter text-cream">
          Account
        </h1>
      </div>

      <div className="space-y-6">
        <Section title="Pocket">
          <p className="text-ink-200 text-sm leading-relaxed mb-4">
            Your pocket holds your wallets and a native SOL balance. Each user starts with one
            default pocket — multiple pockets coming soon.
          </p>
        </Section>

        <Section title="Security">
          <p className="text-ink-200 text-sm leading-relaxed mb-4">
            Custodial wallet keys are encrypted with AES-256-GCM in the vault. Your master key is
            derived from your password via scrypt. WalletConnect sessions are stored securely.
          </p>
        </Section>

        <Section title="About Clutch">
          <p className="text-ink-200 text-sm leading-relaxed mb-2">
            Clutch is a Solana-native wallet pocket. EVM wallets are supported as read-only
            external balances for portfolio completeness.
          </p>
          <p className="text-xs text-ink-400 font-mono mt-4">v0.1.0 · Built on Solana</p>
        </Section>

        <button
          onClick={logout}
          className="flex items-center gap-2 px-4 py-2.5 border border-rust/30 text-rust hover:bg-rust/10 rounded-lg transition"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="p-6 rounded-2xl border border-ink-700/60 bg-ink-800/40">
      <h2 className="font-display text-xl text-cream mb-3">{title}</h2>
      {children}
    </div>
  )
}
