import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Clutch — wallets your AI won\'t drain',
  description:
    'The payment layer between AI agents and Solana. Spending limits, audit logs, x402 handling, one-click revocation. Plug into Solana Agent Kit, GOAT, ElizaOS, or LangGraph.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
