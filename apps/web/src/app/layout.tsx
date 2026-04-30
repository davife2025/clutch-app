import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Clutch — Your wallets. Always there.',
  description:
    'A Solana-native wallet pocket. Connect Phantom, Backpack, or any Solana wallet. AI-powered payments. x402 autonomous transactions.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
