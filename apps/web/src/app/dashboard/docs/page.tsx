'use client'

import Link from 'next/link'
import { Code, BookOpen, Zap, Shield, Terminal, ExternalLink, Copy, Check, Bot } from 'lucide-react'
import { useState } from 'react'

export default function DocsPage() {
  const [copied, setCopied] = useState<string | null>(null)

  function copy(snippet: string, id: string) {
    navigator.clipboard.writeText(snippet)
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div className="animate-fade-up max-w-4xl">
      <div className="mb-10">
        <p className="text-xs tracking-widest text-ink-300 uppercase mb-2">Developer docs</p>
        <h1 className="font-display text-5xl font-light tracking-tighter text-cream">
          Embed Clutch in your agent
        </h1>
        <p className="text-ink-200 mt-3 max-w-2xl text-lg">
          Drop into Solana Agent Kit, GOAT, ElizaOS, LangGraph, or any framework. Five lines, no rewrites.
        </p>
      </div>

      {/* Quick start */}
      <Section title="Quick start" icon={Zap}>
        <Step number={1} title="Install the SDK">
          <CodeBlock id="install" snippet="npm install @clutch/x402" copy={copy} copied={copied} />
        </Step>

        <Step number={2} title="Get your API token">
          <p className="text-sm text-ink-200 mb-3">
            Open DevTools → Application → Local Storage → <code className="text-gold font-mono">clutch_token</code>. Copy that value.
          </p>
          <p className="text-xs text-ink-400 italic">
            Note: real <code className="font-mono">pk_live_...</code> API keys ship in a future release. For now, JWT tokens work.
          </p>
        </Step>

        <Step number={3} title="Wrap your fetch">
          <CodeBlock
            id="basic-usage"
            snippet={`import { Clutch } from '@clutch/x402'

const clutch = new Clutch({ apiKey: process.env.CLUTCH_TOKEN })

// Auto-pays HTTP 402 paywalls within your spending policy
const res = await clutch.fetch('https://api.example.com/premium')
const data = await res.json()`}
            copy={copy}
            copied={copied}
          />
        </Step>
      </Section>

      {/* Spending policy */}
      <Section title="Spending policy" icon={Shield}>
        <p className="text-sm text-ink-200 mb-4">
          Set rules once. Every payment — explicit or x402 auto-pay — gets evaluated server-side
          before any chain interaction.
        </p>
        <CodeBlock
          id="policy"
          snippet={`await clutch.updatePolicy({
  enabled: true,
  maxPerTxUsd: 5,        // single transaction cap
  maxPerDayUsd: 50,      // 24-hour cumulative cap
  allowedTokens: ['USDC'],
  blockedRecipients: ['known.scam'],
})`}
          copy={copy}
          copied={copied}
        />

        <p className="text-sm text-ink-200 mb-3 mt-6">
          When a payment is denied, you get a structured error code:
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
          <DenialCode code="TX_LIMIT_EXCEEDED" desc="Single tx over per-tx cap" />
          <DenialCode code="DAILY_LIMIT_EXCEEDED" desc="24h budget exhausted" />
          <DenialCode code="RECIPIENT_BLOCKED" desc="Recipient on blocklist" />
          <DenialCode code="TOKEN_NOT_ALLOWED" desc="Token not in allowlist" />
        </div>
      </Section>

      {/* Agent platform */}
      <Section title="Agent platform" icon={Bot}>
        <p className="text-sm text-ink-200 mb-4">
          Beyond the SDK: register your agent in the public Clutch registry. Users browse,
          authorize with scoped limits, your agent makes signed payment requests.
        </p>
        <CodeBlock
          id="register"
          snippet={`// Step 1: Register your agent (developer-side, one-time)
const res = await fetch('https://api.clutch.app/registry/agents', {
  method: 'POST',
  headers: {
    'Authorization': \`Bearer \${YOUR_TOKEN}\`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    name: 'MarketBot',
    tagline: 'Pays for market data feeds',
    description: '...',
    publicKey: AGENT_ED25519_PUBLIC_KEY,
    category: 'trading',
  }),
})`}
          copy={copy}
          copied={copied}
        />

        <p className="text-sm text-ink-200 mb-3 mt-6">
          Then your agent makes signed payment requests. No user JWT required — the Ed25519
          signature is the auth.
        </p>
        <CodeBlock
          id="signed-pay"
          snippet={`import nacl from 'tweetnacl'
import bs58 from 'bs58'

const payload = {
  pocketId, to, amount, token: 'USDC',
  timestamp: Math.floor(Date.now() / 1000),
  nonce: crypto.randomBytes(16).toString('hex'),
}

const message = new TextEncoder().encode(JSON.stringify(payload))
const signature = nacl.sign.detached(message, AGENT_PRIVATE_KEY_BYTES)

const res = await fetch('https://api.clutch.app/agent-pay', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    payload,
    signature: bs58.encode(signature),
    publicKey: AGENT_PUBLIC_KEY_BS58,
  }),
})`}
          copy={copy}
          copied={copied}
        />

        <Link
          href="/registry"
          className="inline-flex items-center gap-2 mt-4 text-sm text-gold hover:underline"
        >
          Browse the registry
          <ExternalLink className="w-3 h-3" />
        </Link>
      </Section>

      {/* Framework integrations */}
      <Section title="Framework integrations" icon={Code}>
        <Tabs />
      </Section>

      {/* Self-host */}
      <Section title="Self-host or embed" icon={Terminal}>
        <p className="text-sm text-ink-200 mb-3">
          Clutch is open infrastructure. Run your own instance pointed at your own Solana RPC,
          embed the API as a service in your existing platform, or fork and modify.
        </p>
        <CodeBlock
          id="self-host"
          snippet={`# Clone, configure, deploy
git clone github.com/clutch-app/clutch
cd clutch
cp .env.example .env       # set DATABASE_URL, JWT_SECRET, VAULT_MASTER_KEY
pnpm install
pnpm --filter @clutch/api db:push
pnpm --filter @clutch/api start`}
          copy={copy}
          copied={copied}
        />
        <p className="text-xs text-ink-400 italic mt-3">
          Postgres + Solana RPC are the only external dependencies.
        </p>
      </Section>

      {/* Reference */}
      <Section title="API reference" icon={BookOpen}>
        <div className="grid gap-2">
          <RefLink method="POST" path="/auth/register" desc="Create a user + pocket" />
          <RefLink method="POST" path="/auth/anonymous" desc="One-click anonymous signup" />
          <RefLink method="GET" path="/pockets/:id" desc="Get pocket with balances" />
          <RefLink method="POST" path="/pockets/:id/pay/agent" desc="LLM-routed payment" />
          <RefLink method="PUT" path="/pockets/:id/policy" desc="Update spending policy" />
          <RefLink method="GET" path="/pockets/:id/receipts" desc="x402 receipt audit log" />
          <RefLink method="GET" path="/registry/agents" desc="Public agent directory" />
          <RefLink method="POST" path="/registry/agents" desc="Register an agent" />
          <RefLink method="POST" path="/pockets/:id/grants" desc="Authorize a registered agent" />
          <RefLink method="POST" path="/agent-pay" desc="Signed payment request from agent" />
        </div>
      </Section>
    </div>
  )
}

// ─── Components ───────────────────────────────────────────────────────────────

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string
  icon: any
  children: React.ReactNode
}) {
  return (
    <section className="mb-12">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-9 h-9 rounded-lg bg-gold/10 border border-gold/20 flex items-center justify-center text-gold">
          <Icon className="w-4 h-4" />
        </div>
        <h2 className="font-display text-2xl text-cream">{title}</h2>
      </div>
      <div className="pl-12">{children}</div>
    </section>
  )
}

function Step({ number, title, children }: { number: number; title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h3 className="text-sm font-medium text-cream mb-2">
        <span className="text-gold mr-2">{number}.</span>
        {title}
      </h3>
      {children}
    </div>
  )
}

function CodeBlock({
  snippet,
  id,
  copy,
  copied,
}: {
  snippet: string
  id: string
  copy: (s: string, id: string) => void
  copied: string | null
}) {
  return (
    <div className="relative group">
      <pre className="bg-ink-900 border border-ink-700/60 rounded-lg p-4 overflow-x-auto text-xs font-mono text-ink-100 leading-relaxed">
        {snippet}
      </pre>
      <button
        onClick={() => copy(snippet, id)}
        className="absolute top-3 right-3 p-1.5 bg-ink-800/80 border border-ink-700 hover:border-gold/40 rounded text-ink-300 hover:text-gold transition opacity-0 group-hover:opacity-100"
        title="Copy"
      >
        {copied === id ? <Check className="w-3.5 h-3.5 text-moss" /> : <Copy className="w-3.5 h-3.5" />}
      </button>
    </div>
  )
}

function DenialCode({ code, desc }: { code: string; desc: string }) {
  return (
    <div className="px-3 py-2 rounded bg-ink-900 border border-ink-700/60">
      <span className="text-rust">{code}</span>
      <span className="text-ink-400 ml-2 text-[11px] not-italic font-sans">— {desc}</span>
    </div>
  )
}

function RefLink({ method, path, desc }: { method: string; path: string; desc: string }) {
  const methodColor = {
    GET: 'text-moss',
    POST: 'text-gold',
    PUT: 'text-cream',
    PATCH: 'text-cream',
    DELETE: 'text-rust',
  }[method] ?? 'text-cream'

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg border border-ink-700/60 bg-ink-800/40 hover:border-ink-600 transition">
      <span className={`text-xs font-mono font-medium w-12 ${methodColor}`}>{method}</span>
      <span className="text-sm font-mono text-cream">{path}</span>
      <span className="text-xs text-ink-400 ml-auto">{desc}</span>
    </div>
  )
}

function Tabs() {
  const [active, setActive] = useState<'agent-kit' | 'goat' | 'eliza' | 'langraph'>('agent-kit')
  const snippets = {
    'agent-kit': `import { SolanaAgentKit } from 'solana-agent-kit'
import { Clutch } from '@clutch/x402'

const clutch = new Clutch({ apiKey: process.env.CLUTCH_TOKEN! })
const agent = new SolanaAgentKit(/* ... */)

// Override fetch with the policy-aware version
agent.fetch = (url, init) => clutch.fetch(url, init)`,
    'goat': `import { getOnChainTools } from '@goat-sdk/core'
import { Clutch } from '@clutch/x402'

const clutch = new Clutch({ apiKey: process.env.CLUTCH_TOKEN! })
const tools = await getOnChainTools({
  /* your wallet */
  onPaywall: (url) => clutch.fetch(url),
})`,
    'eliza': `import { Clutch } from '@clutch/x402'

const clutch = new Clutch({ apiKey: process.env.CLUTCH_TOKEN! })

// In your character actions
export const fetchPaid = async (url: string) => {
  return clutch.fetch(url)
}`,
    'langraph': `import { Clutch } from '@clutch/x402'

const clutch = new Clutch({ apiKey: process.env.CLUTCH_TOKEN! })

const tools = [
  {
    name: 'fetch_paywalled',
    description: 'Fetch URL, auto-pay HTTP 402 within budget',
    handler: async ({ url }) => {
      const res = await clutch.fetch(url)
      return res.text()
    },
  },
]`,
  }

  const labels = { 'agent-kit': 'Solana Agent Kit', 'goat': 'GOAT', 'eliza': 'ElizaOS', 'langraph': 'LangGraph' }

  return (
    <div>
      <div className="flex gap-1 mb-3 border-b border-ink-700/60">
        {Object.entries(labels).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setActive(k as any)}
            className={`px-3 py-2 text-sm transition border-b-2 ${
              active === k
                ? 'text-gold border-gold'
                : 'text-ink-300 border-transparent hover:text-cream'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <pre className="bg-ink-900 border border-ink-700/60 rounded-lg p-4 overflow-x-auto text-xs font-mono text-ink-100 leading-relaxed">
        {snippets[active]}
      </pre>
    </div>
  )
}
