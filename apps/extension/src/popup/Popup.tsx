import { useEffect, useState } from 'react'
import { ArrowRight, ExternalLink, RefreshCw, Sparkles, Wallet, X, Zap, LogOut } from 'lucide-react'
import { api } from '../lib/api'
import { tokens } from '../lib/tokens'
import type { X402Detection } from '../lib/messages'

type View = 'loading' | 'login' | 'pocket'

export function Popup() {
  const [view, setView] = useState<View>('loading')
  const [summary, setSummary] = useState<any>(null)
  const [pending, setPending] = useState<X402Detection[]>([])
  const [syncing, setSyncing] = useState(false)

  useEffect(() => {
    init()
  }, [])

  async function init() {
    const authed = await api.isAuthenticated()
    if (!authed) {
      setView('login')
      return
    }
    await Promise.all([loadSummary(), loadPending()])
    setView('pocket')
  }

  async function loadSummary() {
    let pocketId = await api.getPocketId()
    if (!pocketId) {
      const { data } = await api.listPockets()
      if (data?.pockets[0]) {
        await api.setPocketId(data.pockets[0].id)
        pocketId = data.pockets[0].id
      }
    }
    if (pocketId) {
      const { data } = await api.getPocketSummary(pocketId)
      setSummary(data)
    }
  }

  async function loadPending() {
    chrome.runtime.sendMessage({ type: 'GET_PENDING_402S' }, (response) => {
      if (response?.pending) setPending(response.pending)
    })
  }

  async function handleSync() {
    setSyncing(true)
    chrome.runtime.sendMessage({ type: 'SYNC_BALANCES' }, async () => {
      await new Promise((r) => setTimeout(r, 1500))
      await loadSummary()
      setSyncing(false)
    })
  }

  if (view === 'loading') {
    return (
      <Shell>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}>
          <Spinner />
        </div>
      </Shell>
    )
  }

  if (view === 'login') {
    return <LoginView onLoggedIn={init} />
  }

  return (
    <Shell>
      <div className="fade-up" style={{ padding: 20 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <Logo />
          <div style={{ display: 'flex', gap: 6 }}>
            <IconButton onClick={handleSync} title="Sync balances">
              <RefreshCw size={14} style={{ animation: syncing ? 'spin 1s linear infinite' : undefined }} />
            </IconButton>
            <IconButton
              onClick={() => api.clearToken().then(() => setView('login'))}
              title="Sign out"
            >
              <LogOut size={14} />
            </IconButton>
          </div>
        </div>

        {/* Pending 402 alert */}
        {pending.length > 0 ? (
          <PendingSection pending={pending} onPaid={loadPending} onDismiss={loadPending} />
        ) : null}

        {/* Pocket summary */}
        {summary ? (
          <PocketCard summary={summary} />
        ) : (
          <div style={{ color: tokens.ink[300], fontSize: 13 }}>No pocket found.</div>
        )}

        {/* Wallets preview */}
        {summary?.solanaWallets?.length > 0 ? (
          <WalletsPreview wallets={summary.solanaWallets.slice(0, 3)} />
        ) : null}

        {/* Open dashboard */}
        <a
          href="http://localhost:3000/dashboard"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '11px 14px',
            marginTop: 14,
            borderRadius: 10,
            background: tokens.ink[800],
            border: `1px solid ${tokens.ink[700]}`,
            textDecoration: 'none',
            color: tokens.ink[100],
            fontSize: 13,
            transition: 'border-color 0.15s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.borderColor = tokens.gold)}
          onMouseLeave={(e) => (e.currentTarget.style.borderColor = tokens.ink[700])}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ExternalLink size={13} color={tokens.ink[300]} />
            Open dashboard
          </span>
          <ArrowRight size={13} color={tokens.ink[300]} />
        </a>
      </div>
    </Shell>
  )
}

// ─── Shell ──────────────────────────────────────────────────────────────────

function Shell({ children }: { children: React.ReactNode }) {
  return <div style={{ background: tokens.ink[900], minHeight: 480 }}>{children}</div>
}

// ─── Logo ───────────────────────────────────────────────────────────────────

function Logo() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: 8,
          background: `linear-gradient(135deg, ${tokens.gold}, #7E6B33)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: tokens.ink[900],
          fontFamily: 'Fraunces, serif',
          fontWeight: 700,
          fontSize: 16,
        }}
      >
        C
      </div>
      <span style={{ fontFamily: 'Fraunces, serif', fontSize: 18, color: tokens.cream, letterSpacing: '-0.5px' }}>
        Clutch
      </span>
    </div>
  )
}

function IconButton({
  children,
  onClick,
  title,
}: {
  children: React.ReactNode
  onClick: () => void
  title: string
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        width: 28,
        height: 28,
        borderRadius: 7,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: tokens.ink[300],
        transition: 'all 0.15s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = tokens.ink[700]
        e.currentTarget.style.color = tokens.cream
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent'
        e.currentTarget.style.color = tokens.ink[300]
      }}
    >
      {children}
    </button>
  )
}

// ─── Pocket card ────────────────────────────────────────────────────────────

function PocketCard({ summary }: { summary: any }) {
  return (
    <div
      style={{
        padding: 18,
        borderRadius: 14,
        background: tokens.ink[800],
        border: `1px solid rgba(201, 169, 97, 0.15)`,
        marginBottom: 14,
      }}
    >
      <div style={{ fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', color: tokens.gold, marginBottom: 8 }}>
        Total balance
      </div>
      <div
        style={{
          fontFamily: 'Fraunces, serif',
          fontSize: 32,
          fontWeight: 300,
          color: tokens.cream,
          letterSpacing: '-1.2px',
          marginBottom: 14,
        }}
      >
        {formatUsd(summary.totalUsd)}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <Stat label="Solana" value={formatUsd(summary.solanaUsd)} accent />
        <Stat label="External" value={formatUsd(summary.externalUsd)} />
        <Stat label="SOL" value={parseFloat(summary.nativeBalanceSol).toFixed(2)} />
      </div>
    </div>
  )
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div
      style={{
        flex: 1,
        padding: 10,
        background: tokens.ink[700],
        borderRadius: 8,
      }}
    >
      <div style={{ fontSize: 9, letterSpacing: 1.2, textTransform: 'uppercase', color: tokens.ink[300], marginBottom: 3 }}>
        {label}
      </div>
      <div
        style={{
          fontFamily: 'Fraunces, serif',
          fontSize: 14,
          color: accent ? tokens.gold : tokens.cream,
        }}
      >
        {value}
      </div>
    </div>
  )
}

// ─── Wallets preview ────────────────────────────────────────────────────────

function WalletsPreview({ wallets }: { wallets: any[] }) {
  return (
    <div style={{ marginBottom: 4 }}>
      <div
        style={{
          fontSize: 10,
          letterSpacing: 1.5,
          textTransform: 'uppercase',
          color: tokens.ink[300],
          marginBottom: 8,
        }}
      >
        Solana wallets
      </div>
      {wallets.map((w) => (
        <div
          key={w.walletId}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: 10,
            marginBottom: 4,
            background: tokens.ink[800],
            border: `1px solid ${tokens.ink[700]}`,
            borderRadius: 8,
          }}
        >
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 7,
              background: 'rgba(201, 169, 97, 0.1)',
              border: `1px solid rgba(201, 169, 97, 0.2)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Wallet size={13} color={tokens.gold} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ fontSize: 12, color: tokens.cream, fontWeight: 500 }}>{w.label}</div>
              {w.isDefault ? (
                <div
                  style={{
                    fontSize: 8,
                    letterSpacing: 0.8,
                    textTransform: 'uppercase',
                    color: tokens.gold,
                    background: 'rgba(201, 169, 97, 0.1)',
                    border: '1px solid rgba(201, 169, 97, 0.2)',
                    borderRadius: 3,
                    padding: '1px 4px',
                  }}
                >
                  Default
                </div>
              ) : null}
            </div>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: tokens.ink[300] }}>
              {truncateAddress(w.address)}
            </div>
          </div>
          <div style={{ fontFamily: 'Fraunces, serif', fontSize: 13, color: tokens.cream }}>
            {formatUsd(w.usdValue)}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Pending 402 section ────────────────────────────────────────────────────

function PendingSection({
  pending,
  onPaid,
  onDismiss,
}: {
  pending: X402Detection[]
  onPaid: () => void
  onDismiss: () => void
}) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div
        style={{
          fontSize: 10,
          letterSpacing: 1.5,
          textTransform: 'uppercase',
          color: tokens.gold,
          marginBottom: 8,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <Zap size={11} />
        {pending.length} pending {pending.length === 1 ? 'paywall' : 'paywalls'}
      </div>
      {pending.slice(0, 3).map((p) => (
        <PendingItem key={p.url} detection={p} onPaid={onPaid} onDismiss={onDismiss} />
      ))}
    </div>
  )
}

function PendingItem({
  detection,
  onPaid,
  onDismiss,
}: {
  detection: X402Detection
  onPaid: () => void
  onDismiss: () => void
}) {
  const [paying, setPaying] = useState(false)
  const [result, setResult] = useState<'success' | 'error' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const decimals = ['USDC', 'USDT', 'DAI'].includes(detection.currency) ? 6 : 9
  const human = (Number(detection.amount) / 10 ** decimals).toFixed(4).replace(/\.?0+$/, '')

  function handlePay() {
    setPaying(true)
    chrome.runtime.sendMessage({ type: 'PAY_402', detection }, (response) => {
      setPaying(false)
      if (response?.success) {
        setResult('success')
        setTimeout(onPaid, 1500)
      } else {
        setResult('error')
        setError(response?.error ?? 'Payment failed')
      }
    })
  }

  function handleDismiss() {
    chrome.runtime.sendMessage({ type: 'CLEAR_402', url: detection.url }, () => onDismiss())
  }

  return (
    <div
      style={{
        padding: 12,
        marginBottom: 6,
        background: tokens.ink[800],
        border: `1px solid rgba(201, 169, 97, 0.2)`,
        borderRadius: 10,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, color: tokens.cream, marginBottom: 2 }}>
            {detection.description ?? 'Payment required'}
          </div>
          <div
            style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 10,
              color: tokens.ink[300],
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {new URL(detection.url).hostname}
          </div>
        </div>
        <div
          style={{
            fontFamily: 'Fraunces, serif',
            fontSize: 14,
            color: tokens.gold,
            marginLeft: 8,
            whiteSpace: 'nowrap',
          }}
        >
          {human} {detection.currency}
        </div>
      </div>

      {result === 'success' ? (
        <div style={{ fontSize: 11, color: tokens.moss }}>✓ Paid — refresh page to access</div>
      ) : result === 'error' ? (
        <div style={{ fontSize: 11, color: tokens.rust }}>{error}</div>
      ) : (
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={handlePay}
            disabled={paying}
            style={{
              flex: 1,
              padding: '7px 10px',
              borderRadius: 7,
              background: tokens.gold,
              color: tokens.ink[900],
              fontSize: 12,
              fontWeight: 600,
              opacity: paying ? 0.6 : 1,
            }}
          >
            {paying ? 'Routing...' : 'Pay'}
          </button>
          <button
            onClick={handleDismiss}
            style={{
              padding: '7px 10px',
              borderRadius: 7,
              background: 'transparent',
              border: `1px solid ${tokens.ink[600]}`,
              color: tokens.ink[200],
              fontSize: 12,
            }}
          >
            <X size={12} />
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Login view ─────────────────────────────────────────────────────────────

function LoginView({ onLoggedIn }: { onLoggedIn: () => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [apiUrl, setApiUrl] = useState('http://localhost:3001')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    api.getApiUrl().then(setApiUrl)
  }, [])

  async function handleLogin() {
    setError('')
    setLoading(true)
    await api.setApiUrl(apiUrl)
    const { data, error } = await api.login(email, password)
    setLoading(false)
    if (error || !data) {
      setError(error?.message ?? 'Login failed')
      return
    }
    await api.setToken(data.token)
    const { data: pocketData } = await api.listPockets()
    if (pocketData?.pockets[0]) {
      await api.setPocketId(pocketData.pockets[0].id)
    }
    onLoggedIn()
  }

  return (
    <Shell>
      <div className="fade-up" style={{ padding: 24 }}>
        <Logo />
        <div
          style={{
            fontFamily: 'Fraunces, serif',
            fontSize: 26,
            fontWeight: 300,
            color: tokens.cream,
            letterSpacing: '-1px',
            marginTop: 22,
            marginBottom: 4,
          }}
        >
          Sign in
        </div>
        <div style={{ fontSize: 13, color: tokens.ink[200], marginBottom: 22 }}>
          Connect to your pocket to pay 402 paywalls in one click.
        </div>

        <Field label="Email" value={email} onChange={setEmail} type="email" />
        <Field label="Password" value={password} onChange={setPassword} type="password" />
        <Field label="API URL" value={apiUrl} onChange={setApiUrl} type="text" mono />

        {error ? (
          <div
            style={{
              padding: 10,
              background: 'rgba(168, 91, 59, 0.1)',
              border: '1px solid rgba(168, 91, 59, 0.3)',
              borderRadius: 8,
              color: tokens.rust,
              fontSize: 12,
              marginBottom: 12,
            }}
          >
            {error}
          </div>
        ) : null}

        <button
          onClick={handleLogin}
          disabled={loading}
          style={{
            width: '100%',
            padding: 12,
            borderRadius: 10,
            background: tokens.gold,
            color: tokens.ink[900],
            fontSize: 14,
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            opacity: loading ? 0.5 : 1,
          }}
        >
          {loading ? 'Signing in...' : 'Sign in'}
          {loading ? null : <ArrowRight size={14} />}
        </button>
      </div>
    </Shell>
  )
}

function Field({
  label,
  value,
  onChange,
  type,
  mono,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type: string
  mono?: boolean
}) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 12, color: tokens.ink[200], marginBottom: 6 }}>{label}</div>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoCapitalize="none"
        autoCorrect="off"
        style={{
          width: '100%',
          padding: '10px 12px',
          background: tokens.ink[800],
          border: `1px solid ${tokens.ink[600]}`,
          borderRadius: 8,
          color: tokens.cream,
          fontSize: 13,
          fontFamily: mono ? 'JetBrains Mono, monospace' : 'inherit',
          outline: 'none',
        }}
        onFocus={(e) => (e.currentTarget.style.borderColor = tokens.gold)}
        onBlur={(e) => (e.currentTarget.style.borderColor = tokens.ink[600])}
      />
    </div>
  )
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <div
      style={{
        width: 24,
        height: 24,
        border: `2px solid ${tokens.ink[700]}`,
        borderTopColor: tokens.gold,
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }}
    />
  )
}

function formatUsd(value: number | string): string {
  const num = typeof value === 'string' ? parseFloat(value) : value
  if (isNaN(num)) return '$0.00'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num)
}

function truncateAddress(address: string, chars = 4): string {
  if (!address) return ''
  if (address.length < chars * 2 + 4) return address
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`
}

// Inject spin keyframe
const styleSheet = document.createElement('style')
styleSheet.textContent = `@keyframes spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }`
document.head.appendChild(styleSheet)
