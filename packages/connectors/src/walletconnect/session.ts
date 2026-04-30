import SignClient from '@walletconnect/sign-client'

export interface WCSessionInfo {
  topic: string
  peerName: string
  peerIcon?: string
  chains: string[]
  accounts: string[]
  expiry: number
}

/**
 * WalletConnectManager — manages WalletConnect v2 sessions.
 *
 * Flow:
 *   1. connect() → returns pairing URI (for QR code or deep link)
 *   2. User approves in their wallet (Phantom, Backpack, etc.)
 *   3. Session established → accounts and chains available
 *   4. request() to sign transactions through the connected wallet
 */
export class WalletConnectManager {
  private client: SignClient | null = null
  private projectId: string
  private onSessionEstablished?: (session: WCSessionInfo) => void

  constructor(projectId: string) {
    this.projectId = projectId
  }

  async init(): Promise<void> {
    if (this.client) return

    this.client = await SignClient.init({
      projectId: this.projectId,
      metadata: {
        name: 'Clutch',
        description: 'Your wallets. Always there.',
        url: 'https://clutch.app',
        icons: ['https://clutch.app/icon.png'],
      },
    })

    this.client.on('session_event', (event: any) => {
      console.log('[wc] session_event:', event)
    })

    this.client.on('session_delete', (event: any) => {
      console.log('[wc] session_delete:', event.topic)
    })
  }

  onSession(callback: (session: WCSessionInfo) => void): void {
    this.onSessionEstablished = callback
  }

  /**
   * Initiate a new connection.
   * Returns the pairing URI and a promise that resolves when the user approves.
   */
  async connect(chains: string[] = ['solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp']): Promise<{
    uri: string
    approval: Promise<WCSessionInfo>
  }> {
    if (!this.client) throw new Error('WalletConnect not initialized — call init() first')

    const solanaChains = chains.filter((c) => c.startsWith('solana:'))
    const evmChains = chains.filter((c) => c.startsWith('eip155:'))

    const optionalNamespaces: Record<string, any> = {}

    if (solanaChains.length > 0) {
      optionalNamespaces.solana = {
        chains: solanaChains,
        methods: ['solana_signTransaction', 'solana_signMessage'],
        events: [],
      }
    }

    if (evmChains.length > 0) {
      optionalNamespaces.eip155 = {
        chains: evmChains,
        methods: ['eth_sendTransaction', 'personal_sign', 'eth_signTransaction'],
        events: ['chainChanged', 'accountsChanged'],
      }
    }

    const result = await this.client.connect({ optionalNamespaces })

    if (!result.uri) throw new Error('Failed to generate pairing URI')

    // approval is a function that returns a promise
    const approvalPromise = result.approval().then((session: any) => {
      const info = this.extractSessionInfo(session)
      this.onSessionEstablished?.(info)
      return info
    })

    return { uri: result.uri, approval: approvalPromise }
  }

  getSessions(): WCSessionInfo[] {
    if (!this.client) return []
    const sessions = this.client.session.getAll()
    return sessions.map((s: any) => this.extractSessionInfo(s))
  }

  getSession(topic: string): WCSessionInfo | null {
    if (!this.client) return null
    try {
      const session = this.client.session.get(topic)
      return this.extractSessionInfo(session)
    } catch {
      return null
    }
  }

  async disconnect(topic: string): Promise<void> {
    if (!this.client) return
    await this.client.disconnect({
      topic,
      reason: { code: 6000, message: 'User disconnected' },
    })
  }

  async request<T = unknown>(
    topic: string,
    chainId: string,
    method: string,
    params: unknown,
  ): Promise<T> {
    if (!this.client) throw new Error('WalletConnect not initialized')
    return this.client.request<T>({
      topic,
      chainId,
      request: { method, params: params as any },
    })
  }

  async signSolanaTransaction(topic: string, transaction: string): Promise<string> {
    return this.request<string>(
      topic,
      'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp',
      'solana_signTransaction',
      { transaction },
    )
  }

  async signSolanaMessage(topic: string, message: string, pubkey: string): Promise<string> {
    return this.request<string>(
      topic,
      'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp',
      'solana_signMessage',
      { message, pubkey },
    )
  }

  async sendEvmTransaction(
    topic: string,
    chainId: string,
    tx: { from: string; to: string; value?: string; data?: string },
  ): Promise<string> {
    return this.request<string>(topic, chainId, 'eth_sendTransaction', [tx])
  }

  private extractSessionInfo(session: any): WCSessionInfo {
    const peer = session.peer.metadata
    const allAccounts: string[] = []
    const allChains: string[] = []

    for (const namespace of Object.values(session.namespaces) as any[]) {
      if (namespace.accounts) allAccounts.push(...namespace.accounts)
      if (namespace.chains) allChains.push(...namespace.chains)
    }

    return {
      topic: session.topic,
      peerName: peer.name,
      peerIcon: peer.icons?.[0],
      chains: allChains,
      accounts: allAccounts,
      expiry: session.expiry,
    }
  }
}

/** Create a WalletConnectManager from env. */
export function createWCManager(): WalletConnectManager | null {
  const projectId = process.env.WALLETCONNECT_PROJECT_ID
  if (!projectId) {
    console.warn('[wc] WALLETCONNECT_PROJECT_ID not set — WalletConnect disabled')
    return null
  }
  return new WalletConnectManager(projectId)
}
