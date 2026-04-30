/**
 * Solana Wallet Standard adapter.
 *
 * Phantom, Backpack, Solflare, and most modern Solana wallets expose themselves
 * via the Wallet Standard (https://github.com/wallet-standard/wallet-standard).
 *
 * This is browser-only — Node.js doesn't have window.navigator.wallets.
 * The API uses WalletConnect for server-side / mobile flows.
 */

export interface DetectedWallet {
  name: string
  icon: string
  accounts: Array<{ address: string; publicKey: Uint8Array }>
  features: {
    signMessage: boolean
    signTransaction: boolean
    signAndSendTransaction: boolean
  }
}

export interface ConnectedWallet extends DetectedWallet {
  /** Sign a Solana transaction (raw bytes). Returns signed tx bytes. */
  signTransaction: (tx: Uint8Array) => Promise<Uint8Array>
  /** Sign a UTF-8 message. Returns base58 signature. */
  signMessage: (message: string) => Promise<string>
  /** Sign and broadcast in one step. Returns tx signature. */
  signAndSendTransaction?: (tx: Uint8Array) => Promise<string>
  /** Disconnect this wallet. */
  disconnect: () => Promise<void>
}

/**
 * Detect available Solana wallets in the browser.
 * Returns wallets that implement the Wallet Standard.
 */
export function detectWallets(): DetectedWallet[] {
  if (typeof window === 'undefined') return []

  const wallets: DetectedWallet[] = []

  // Wallet Standard: window.navigator.wallets (newer) or window.phantom.solana (legacy)
  const nav = (window as any).navigator
  if (nav?.wallets?.get) {
    try {
      const standardWallets = nav.wallets.get()
      for (const w of standardWallets) {
        if (!w.chains?.some((c: string) => c.startsWith('solana:'))) continue
        wallets.push({
          name: w.name,
          icon: w.icon,
          accounts: w.accounts ?? [],
          features: {
            signMessage: 'solana:signMessage' in w.features,
            signTransaction: 'solana:signTransaction' in w.features,
            signAndSendTransaction: 'solana:signAndSendTransaction' in w.features,
          },
        })
      }
    } catch {
      // Wallet Standard not available
    }
  }

  // Legacy fallbacks for wallets that haven't migrated to Wallet Standard yet
  const w = window as any
  if (w.phantom?.solana?.isPhantom && !wallets.find((x) => x.name === 'Phantom')) {
    wallets.push({
      name: 'Phantom',
      icon: 'https://phantom.app/img/logo.png',
      accounts: [],
      features: { signMessage: true, signTransaction: true, signAndSendTransaction: true },
    })
  }
  if (w.backpack?.isBackpack && !wallets.find((x) => x.name === 'Backpack')) {
    wallets.push({
      name: 'Backpack',
      icon: 'https://backpack.app/icon.png',
      accounts: [],
      features: { signMessage: true, signTransaction: true, signAndSendTransaction: true },
    })
  }
  if (w.solflare?.isSolflare && !wallets.find((x) => x.name === 'Solflare')) {
    wallets.push({
      name: 'Solflare',
      icon: 'https://solflare.com/icon.png',
      accounts: [],
      features: { signMessage: true, signTransaction: true, signAndSendTransaction: true },
    })
  }

  return wallets
}

/**
 * Connect to a Solana wallet by name.
 * Returns a ConnectedWallet with signing capabilities.
 */
export async function connectWallet(name: string): Promise<ConnectedWallet | null> {
  if (typeof window === 'undefined') return null

  const w = window as any
  let provider: any

  switch (name.toLowerCase()) {
    case 'phantom':
      provider = w.phantom?.solana
      break
    case 'backpack':
      provider = w.backpack
      break
    case 'solflare':
      provider = w.solflare
      break
    default:
      // Try Wallet Standard
      const standardWallets = w.navigator?.wallets?.get?.() ?? []
      provider = standardWallets.find((sw: any) => sw.name === name)
  }

  if (!provider) return null

  // Connect — triggers the wallet popup
  const response = await provider.connect()
  const publicKey = response.publicKey ?? provider.publicKey

  if (!publicKey) return null

  return {
    name,
    icon: provider.icon ?? '',
    accounts: [{ address: publicKey.toString(), publicKey: publicKey.toBytes() }],
    features: { signMessage: true, signTransaction: true, signAndSendTransaction: true },

    signTransaction: async (tx: Uint8Array) => {
      const signed = await provider.signTransaction(tx)
      return signed.serialize ? signed.serialize() : signed
    },

    signMessage: async (message: string) => {
      const encoded = new TextEncoder().encode(message)
      const result = await provider.signMessage(encoded)
      const signature = result.signature ?? result
      // Convert to base58
      const bs58 = await import('bs58')
      return bs58.default.encode(signature)
    },

    signAndSendTransaction: async (tx: Uint8Array) => {
      const result = await provider.signAndSendTransaction(tx)
      return result.signature ?? result
    },

    disconnect: async () => {
      await provider.disconnect?.()
    },
  }
}
