'use client'

import { useEffect, useRef, useState } from 'react'
import { Send, Sparkles, ArrowRight, Loader2 } from 'lucide-react'
import { api } from '@/lib/api'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

export default function AgentPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [showPayForm, setShowPayForm] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight)
  }, [messages])

  async function sendMessage(text: string) {
    const pocketId = api.getPocketId()
    if (!pocketId) return

    const userMsg: Message = { role: 'user', content: text }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    setStreaming(true)

    let assistantText = ''
    setMessages([...newMessages, { role: 'assistant', content: '' }])

    try {
      for await (const chunk of api.chatStream(pocketId, newMessages)) {
        assistantText += chunk
        setMessages([...newMessages, { role: 'assistant', content: assistantText }])
      }
    } catch (err) {
      setMessages([
        ...newMessages,
        { role: 'assistant', content: `Error: ${(err as Error).message}` },
      ])
    } finally {
      setStreaming(false)
    }
  }

  return (
    <div className="animate-fade-up h-[calc(100vh-5rem)] flex flex-col">
      {/* Header */}
      <div className="flex items-end justify-between mb-6">
        <div>
          <p className="text-xs tracking-widest text-ink-300 uppercase mb-2">Agent</p>
          <h1 className="font-display text-5xl font-light tracking-tighter text-cream">
            Talk to your pocket
          </h1>
        </div>
        <button
          onClick={() => setShowPayForm(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-gold hover:bg-gold-300 text-ink-900 rounded-lg font-medium transition"
        >
          <Sparkles className="w-4 h-4" />
          AI payment
        </button>
      </div>

      {showPayForm && <PayModal onClose={() => setShowPayForm(false)} />}

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto rounded-2xl border border-ink-700/60 bg-ink-800/40 backdrop-blur-sm p-8 mb-4"
      >
        {messages.length === 0 ? (
          <EmptyState onSuggest={(s) => sendMessage(s)} />
        ) : (
          <div className="space-y-6 max-w-3xl mx-auto">
            {messages.map((m, i) => (
              <MessageBubble key={i} message={m} streaming={streaming && i === messages.length - 1} />
            ))}
          </div>
        )}
      </div>

      {/* Input */}
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (input.trim() && !streaming) sendMessage(input.trim())
        }}
        className="flex items-center gap-3 p-3 rounded-2xl border border-ink-700/60 bg-ink-800/40 backdrop-blur-sm focus-within:border-gold/40 transition"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about your pocket, or tell me what to send..."
          disabled={streaming}
          className="flex-1 bg-transparent px-4 py-2 text-cream placeholder-ink-400 focus:outline-none"
        />
        <button
          type="submit"
          disabled={!input.trim() || streaming}
          className="p-3 bg-gold hover:bg-gold-300 disabled:opacity-30 disabled:cursor-not-allowed text-ink-900 rounded-lg transition"
        >
          {streaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </form>
    </div>
  )
}

function EmptyState({ onSuggest }: { onSuggest: (s: string) => void }) {
  const suggestions = [
    "What's in my pocket?",
    'How much SOL do I have?',
    'Which wallet should I use to pay 5 USDC?',
    'Estimate the fee for sending 1 USDC on Solana',
  ]

  return (
    <div className="text-center py-12 max-w-xl mx-auto">
      <div className="inline-flex w-14 h-14 rounded-2xl bg-gold/10 border border-gold/20 items-center justify-center text-gold mb-6">
        <Sparkles className="w-7 h-7" />
      </div>
      <h3 className="font-display text-3xl text-cream mb-3">Your Solana-native agent</h3>
      <p className="text-ink-200 mb-10">
        Ask anything about your pocket. The agent knows your balances, can estimate Solana fees,
        and execute payments through the right wallet.
      </p>
      <div className="grid grid-cols-2 gap-3">
        {suggestions.map((s) => (
          <button
            key={s}
            onClick={() => onSuggest(s)}
            className="text-left p-4 rounded-xl border border-ink-700/60 bg-ink-800/40 hover:border-gold/30 hover:bg-ink-800/60 text-sm text-ink-100 transition"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  )
}

function MessageBubble({ message, streaming }: { message: Message; streaming?: boolean }) {
  const isUser = message.role === 'user'
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-5 py-3 ${
          isUser
            ? 'bg-gold text-ink-900'
            : 'bg-ink-700/40 border border-ink-600 text-ink-50'
        }`}
      >
        <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
        {streaming && (
          <span className="inline-block w-2 h-4 bg-gold ml-1 animate-pulse" />
        )}
      </div>
    </div>
  )
}

function PayModal({ onClose }: { onClose: () => void }) {
  const [to, setTo] = useState('')
  const [amount, setAmount] = useState('')
  const [token, setToken] = useState('USDC')
  const [memo, setMemo] = useState('')
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setResult(null)
    setLoading(true)

    const pocketId = api.getPocketId()
    if (!pocketId) return

    const { data, error } = await api.payViaAgent(pocketId, { to, amount, token, memo })
    setLoading(false)

    if (error) {
      setError(error.message)
      return
    }

    setResult(data)
  }

  return (
    <div className="fixed inset-0 bg-ink-900/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="w-full max-w-lg bg-ink-800 border border-ink-600 rounded-2xl p-8 animate-fade-up">
        <h2 className="font-display text-2xl text-cream mb-1">AI payment</h2>
        <p className="text-sm text-ink-300 mb-6">
          The agent picks the optimal wallet and routes through Solana.
        </p>

        {result ? (
          <div className="space-y-4">
            <div className="px-4 py-3 rounded-lg bg-moss/10 border border-moss/30 text-moss text-sm">
              ✓ Payment {result.status}
            </div>
            <div className="space-y-2 text-sm">
              <Row label="Tx hash" value={result.txHash} mono />
              <Row label="Chain" value={result.chain} />
              <Row label="Amount" value={`${result.amount} ${result.token}`} />
              <Row label="Reasoning" value={result.reasoning} />
            </div>
            <button
              onClick={onClose}
              className="w-full mt-4 px-5 py-3 bg-gold hover:bg-gold-300 text-ink-900 rounded-lg font-medium transition"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <Field label="Recipient address" value={to} onChange={setTo} placeholder="So11111..." mono />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Amount" value={amount} onChange={setAmount} placeholder="10" />
              <label className="block">
                <span className="block text-sm text-ink-200 mb-2">Token</span>
                <select
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  className="w-full px-4 py-3 bg-ink-900 border border-ink-600 focus:border-gold rounded-lg text-cream focus:outline-none transition"
                >
                  <option value="USDC">USDC</option>
                  <option value="SOL">SOL</option>
                  <option value="USDT">USDT</option>
                  <option value="BONK">BONK</option>
                </select>
              </label>
            </div>
            <Field label="Memo (optional)" value={memo} onChange={setMemo} placeholder="What's this for?" />

            {error && (
              <div className="px-4 py-3 rounded-lg bg-rust/10 border border-rust/30 text-rust text-sm">
                {error}
              </div>
            )}

            <div className="flex items-center gap-3 pt-2">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-5 py-3 bg-gold hover:bg-gold-300 disabled:opacity-50 text-ink-900 rounded-lg font-medium flex items-center justify-center gap-2 transition"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Routing...
                  </>
                ) : (
                  <>
                    Pay
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-3 border border-ink-600 hover:border-ink-400 text-ink-200 rounded-lg transition"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  mono,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  mono?: boolean
}) {
  return (
    <label className="block">
      <span className="block text-sm text-ink-200 mb-2">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full px-4 py-3 bg-ink-900 border border-ink-600 focus:border-gold rounded-lg text-cream placeholder-ink-400 focus:outline-none transition ${
          mono ? 'font-mono text-sm' : ''
        }`}
      />
    </label>
  )
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start gap-4">
      <span className="text-ink-300 w-24 shrink-0">{label}</span>
      <span className={`text-cream break-all ${mono ? 'font-mono text-xs' : ''}`}>{value}</span>
    </div>
  )
}
