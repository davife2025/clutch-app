import Link from 'next/link'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-ink-900 flex flex-col">
      <nav className="px-8 py-8">
        <Link href="/" className="inline-flex items-center gap-3 group">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-gold to-gold-600 flex items-center justify-center group-hover:scale-105 transition">
            <span className="text-ink-900 font-display font-bold text-lg">C</span>
          </div>
          <span className="font-display text-xl tracking-tight text-cream">Clutch</span>
        </Link>
      </nav>
      <div className="flex-1 flex items-center justify-center px-8 pb-24">
        <div className="w-full max-w-md">{children}</div>
      </div>
    </main>
  )
}
