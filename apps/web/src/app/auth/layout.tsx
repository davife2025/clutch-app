import Link from 'next/link'
import { Logo } from '@/components/brand/Logo'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-ink-900 flex flex-col">
      <nav className="px-8 py-8">
        <Link href="/" className="inline-flex items-center gap-3 group">
          <Logo size={36} className="group-hover:scale-105 transition" />
          <span className="font-display text-xl tracking-tight text-cream">Clutch</span>
        </Link>
      </nav>
      <div className="flex-1 flex items-center justify-center px-8 pb-24">
        <div className="w-full max-w-md">{children}</div>
      </div>
    </main>
  )
}
