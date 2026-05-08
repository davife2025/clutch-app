import Link from 'next/link'
import { ArrowUpRight, Wallet, Sparkles, Shield } from 'lucide-react'

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-ink-900 text-ink-50">
      {/* Background atmosphere */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-gold/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-moss/10 rounded-full blur-[120px]" />
      </div>

      {/* Nav */}
      <nav className="relative z-10 max-w-6xl mx-auto px-8 py-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-gold to-gold-600 flex items-center justify-center">
            <span className="text-ink-900 font-display font-bold text-lg">C</span>
          </div>
          <span className="font-display text-xl tracking-tight">Clutch</span>
        </div>
        <div className="flex items-center gap-6">
          <Link
            href="/auth/login"
            className="text-ink-200 hover:text-cream transition text-sm"
          >
            Sign in
          </Link>
          <Link
            href="/auth/register"
            className="px-4 py-2 bg-gold hover:bg-gold-300 text-ink-900 rounded-md text-sm font-medium transition"
          >
            Get started
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative z-10 max-w-6xl mx-auto px-8 pt-20 pb-32">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 mb-8 rounded-full border border-ink-500/40 bg-ink-700/40 backdrop-blur-sm text-xs text-ink-200 tabular animate-fade-in">
            <span className="w-1.5 h-1.5 bg-gold rounded-full animate-pulse" />
            Built on Solana · x402 · Claude AI
          </div>

          <h1 className="font-display text-7xl md:text-8xl font-light tracking-tightest leading-[0.95] mb-8 animate-fade-up">
            Wallets your AI
            <br />
            <span className="italic font-normal text-gold">won't drain.</span>
          </h1>

          <p
            className="text-xl text-ink-200 max-w-2xl leading-relaxed mb-12 animate-fade-up"
            style={{ animationDelay: '0.1s' }}
          >
            AI agents on Solana run with full custody — one bad decision and the wallet drains.
            Clutch is the payment layer between agents and the chain: spending limits, audit logs,
            x402 handling, and one-click revocation that any agent can plug into in five minutes.
          </p>

          <div
            className="flex flex-wrap items-center gap-4 mb-6 animate-fade-up"
            style={{ animationDelay: '0.2s' }}
          >
            <Link
              href="/auth/try"
              className="group px-6 py-3 bg-gold hover:bg-gold-300 text-ink-900 rounded-lg font-medium flex items-center gap-2 transition"
            >
              Try without signing up
              <ArrowUpRight className="w-4 h-4 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </Link>
            <Link
              href="/auth/register"
              className="px-6 py-3 border border-ink-500 hover:border-ink-300 text-ink-100 rounded-lg font-medium transition"
            >
              Open a pocket
            </Link>
            <Link
              href="/auth/login"
              className="px-6 py-3 text-ink-200 hover:text-cream rounded-lg font-medium transition"
            >
              Sign in
            </Link>
          </div>
          <p className="text-xs text-ink-400 mb-20 animate-fade-up" style={{ animationDelay: '0.25s' }}>
            No email, no credit card — try it now and add an account later if you keep using it.
          </p>
        </div>

        {/* Three-column feature grid */}
        <div className="grid md:grid-cols-3 gap-px bg-ink-700/60 border border-ink-700/60 rounded-2xl overflow-hidden">
          <Feature
            icon={<Shield className="w-5 h-5" />}
            title="Spending guardrails"
            body="Per-transaction caps, daily limits, recipient allowlists. Enforced server-side before any chain interaction — even a hallucinating agent can't bypass them."
          />
          <Feature
            icon={<Sparkles className="w-5 h-5" />}
            title="Agent-native routing"
            body="The AI picks the optimal wallet, swaps via Jupiter when needed, signs through the vault or WalletConnect, broadcasts on Solana — all in one call."
          />
          <Feature
            icon={<Wallet className="w-5 h-5" />}
            title="x402 payment handling"
            body="Drop the fetch wrapper into any agent. HTTP 402 paywalls get paid automatically within policy — programmatic access without subscriptions."
          />
        </div>
      </section>

      {/* Why Solana */}
      <section className="relative z-10 max-w-6xl mx-auto px-8 py-24 border-t border-ink-700/60">
        <div className="grid md:grid-cols-2 gap-16">
          <div>
            <p className="text-xs tracking-widest text-gold uppercase mb-6">Why Solana</p>
            <h2 className="font-display text-5xl font-light tracking-tighter leading-tight mb-6">
              The only chain where micropayments actually work.
            </h2>
          </div>
          <div className="space-y-8 text-ink-200 leading-relaxed">
            <p>
              At <span className="text-cream tabular">$0.0003</span> per transaction and sub-second
              finality, Solana is the natural home for autonomous AI payments and x402 streaming.
            </p>
            <p>
              EVM wallets are supported as <span className="text-cream">read-only external balances</span>{' '}
              for portfolio completeness — but Clutch transacts on Solana only. Honest, focused,
              and economically aligned.
            </p>
            <div className="pt-6 grid grid-cols-3 gap-6">
              <Stat label="Avg fee" value="$0.0003" />
              <Stat label="Finality" value="~400ms" />
              <Stat label="TPS" value="65k" />
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 max-w-6xl mx-auto px-8 py-12 border-t border-ink-700/60 flex items-center justify-between text-sm text-ink-300">
        <p>© 2026 Clutch. Solana-native.</p>
        <div className="flex items-center gap-6">
          <Link href="/auth/register" className="hover:text-cream transition">
            Get started
          </Link>
        </div>
      </footer>
    </main>
  )
}

function Feature({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="bg-ink-800/80 backdrop-blur-sm p-8 hover:bg-ink-700/40 transition">
      <div className="w-10 h-10 rounded-lg bg-gold/10 border border-gold/20 flex items-center justify-center text-gold mb-5">
        {icon}
      </div>
      <h3 className="font-display text-xl font-medium mb-2 text-cream">{title}</h3>
      <p className="text-ink-200 text-sm leading-relaxed">{body}</p>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-display text-3xl tabular text-cream mb-1">{value}</div>
      <div className="text-xs text-ink-300 uppercase tracking-wider">{label}</div>
    </div>
  )
}
