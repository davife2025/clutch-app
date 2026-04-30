'use client'

import { useEffect, useState } from 'react'
import { Plus, X, Star, Wallet as WalletIcon } from 'lucide-react'
import { api } from '@/lib/api'
import { formatUsd, truncateAddress, chainLabel } from '@/lib/format'

export default function WalletsPage() {
  const [pocket, setPocket] = useState<any>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadPocket()
  }, [])

  async function loadPocket() {
    const pocketId = api.getPocketId()
    if (!pocketId) return
    const { data } = await api.getPocket(pocketId)
    setPocket(data?.pocket)
    setLoading(false)
  }

  async function handleRemove(walletId: string) {
    if (!confirm('Remove this wallet from your pocket?')) return
    await api.removeWallet(pocket.id, walletId)
    loadPocket()
  }

  async function handleSetDefault(walletId: string) {
    await api.setDefaultWallet(pocket.id, walletId)
    loadPocket()
  }

  if (loading) return <div className="text-ink-300">Loading...</div>

  return (
    <div className="animate-fade-up">
      <div className="flex items-end justify-between mb-10">
        <div>
          <p className="text-xs tracking-widest text-ink-300 uppercase mb-2">Wallets</p>
          <h1 className="font-display text-5xl font-light tracking-tighter text-cream">
            Your wallets
          </h1>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-gold hover:bg-gold-300 text-ink-900 rounded-lg font-medium transition"
        >
          <Plus className="w-4 h-4" />
          Add wallet
        </button>
      </div>

      {showAdd && <AddWalletModal pocketId={pocket.id} onClose={() => { setShowAdd(false); loadPocket() }} />}

      {!pocket?.wallets?.length ? (
        <div className="text-center py-16 px-6 rounded-2xl border border-dashed border-ink-600 bg-ink-800/40">
          <WalletIcon className="w-12 h-12 text-ink-400 mx-auto mb-4" />
          <h3 className="font-display text-2xl text-cream mb-2">No wallets yet</h3>
          <p className="text-ink-300 mb-6">Add your first wallet to start using the pocket.</p>
          <button
            onClick={() => setShowAdd(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-gold hover:bg-gold-300 text-ink-900 rounded-lg font-medium transition"
          >
            <Plus className="w-4 h-4" />
            Add a wallet
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {pocket.wallets.map((w: any) => (
            <div
              key={w.id}
              className="flex items-center justify-between p-5 rounded-xl border border-ink-700/60 bg-ink-800/40 hover:border-ink-600 transition"
            >
              <div className="flex items-center gap-4">
                <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    w.chain === 'solana'
                      ? 'bg-gold/10 border border-gold/20 text-gold'
                      : 'bg-ink-700/40 border border-ink-600 text-ink-300'
                  }`}
                >
                  <WalletIcon className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-cream">{w.label ?? 'Wallet'}</p>
                    {w.isDefault && (
                      <span className="px-1.5 py-0.5 text-[10px] tracking-wider uppercase bg-gold/10 text-gold border border-gold/20 rounded">
                        Default
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-mono text-ink-300">
                    {chainLabel(w.chain)} · {truncateAddress(w.address)} · {w.connectionType}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {!w.isDefault && (
                  <button
                    onClick={() => handleSetDefault(w.id)}
                    className="p-2 text-ink-300 hover:text-gold hover:bg-ink-700/40 rounded transition"
                    title="Set as default"
                  >
                    <Star className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() => handleRemove(w.id)}
                  className="p-2 text-ink-300 hover:text-rust hover:bg-ink-700/40 rounded transition"
                  title="Remove"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function AddWalletModal({ pocketId, onClose }: { pocketId: string; onClose: () => void }) {
  const [address, setAddress] = useState('')
  const [chain, setChain] = useState('solana')
  const [label, setLabel] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { error } = await api.addWallet(pocketId, {
      address,
      chain,
      label: label || undefined,
    })
    setLoading(false)

    if (error) {
      setError(error.message)
      return
    }
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-ink-900/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="w-full max-w-md bg-ink-800 border border-ink-600 rounded-2xl p-8 animate-fade-up">
        <h2 className="font-display text-2xl text-cream mb-6">Add wallet</h2>

        <form onSubmit={handleSubmit} className="space-y-5">
          <label className="block">
            <span className="block text-sm text-ink-200 mb-2">Chain</span>
            <select
              value={chain}
              onChange={(e) => setChain(e.target.value)}
              className="w-full px-4 py-3 bg-ink-900 border border-ink-600 focus:border-gold rounded-lg text-cream focus:outline-none transition"
            >
              <option value="solana">Solana (signing-capable)</option>
              <option value="ethereum">Ethereum (read-only)</option>
              <option value="base">Base (read-only)</option>
              <option value="polygon">Polygon (read-only)</option>
              <option value="arbitrum">Arbitrum (read-only)</option>
              <option value="optimism">Optimism (read-only)</option>
            </select>
          </label>

          <label className="block">
            <span className="block text-sm text-ink-200 mb-2">Address</span>
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder={chain === 'solana' ? 'e.g. So11111...' : '0x...'}
              required
              className="w-full px-4 py-3 bg-ink-900 border border-ink-600 focus:border-gold rounded-lg text-cream placeholder-ink-400 focus:outline-none transition font-mono text-sm"
            />
          </label>

          <label className="block">
            <span className="block text-sm text-ink-200 mb-2">
              Label <span className="text-ink-400">(optional)</span>
            </span>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Phantom main"
              className="w-full px-4 py-3 bg-ink-900 border border-ink-600 focus:border-gold rounded-lg text-cream placeholder-ink-400 focus:outline-none transition"
            />
          </label>

          {error && (
            <div className="px-4 py-3 rounded-lg bg-rust/10 border border-rust/30 text-rust text-sm">
              {error}
            </div>
          )}

          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-5 py-3 bg-gold hover:bg-gold-300 disabled:opacity-50 text-ink-900 rounded-lg font-medium transition"
            >
              {loading ? 'Adding...' : 'Add wallet'}
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
      </div>
    </div>
  )
}
