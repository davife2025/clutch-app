const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'
const TOKEN_KEY = 'clutch_token'
const POCKET_KEY = 'clutch_pocket_id'
const ANON_KEY = 'clutch_is_anonymous'

export interface ApiError {
  code: string
  message: string
}

class ApiClient {
  private token: string | null = null

  constructor() {
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem(TOKEN_KEY)
    }
  }

  setToken(token: string) {
    this.token = token
    if (typeof window !== 'undefined') {
      localStorage.setItem(TOKEN_KEY, token)
    }
  }

  clearToken() {
    this.token = null
    if (typeof window !== 'undefined') {
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(POCKET_KEY)
      localStorage.removeItem(ANON_KEY)
    }
  }

  setPocketId(pocketId: string) {
    if (typeof window !== 'undefined') {
      localStorage.setItem(POCKET_KEY, pocketId)
    }
  }

  getPocketId(): string | null {
    if (typeof window === 'undefined') return null
    return localStorage.getItem(POCKET_KEY)
  }

  setAnonymous(isAnonymous: boolean) {
    if (typeof window !== 'undefined') {
      if (isAnonymous) localStorage.setItem(ANON_KEY, '1')
      else localStorage.removeItem(ANON_KEY)
    }
  }

  isAnonymous(): boolean {
    if (typeof window === 'undefined') return false
    return localStorage.getItem(ANON_KEY) === '1'
  }

  isAuthenticated(): boolean {
    return !!this.token
  }

  private async request<T>(
    path: string,
    options: RequestInit = {},
  ): Promise<{ data?: T; error?: ApiError }> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) ?? {}),
    }
    if (this.token) headers.Authorization = `Bearer ${this.token}`

    try {
      const res = await fetch(`${API_URL}${path}`, { ...options, headers })
      const json = await res.json()
      return json
    } catch (err) {
      return { error: { code: 'NETWORK', message: (err as Error).message } }
    }
  }

  // ── Auth ────────────────────────────────────────────────────────────────────
  async register(email: string, password: string) {
    return this.request<{ token: string; userId: string; pocketId: string; isAnonymous: boolean }>(
      '/auth/register',
      {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      },
    )
  }

  async login(email: string, password: string) {
    return this.request<{ token: string; userId: string; isAnonymous: boolean }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
  }

  /** Create an anonymous account — no email required, full access. */
  async anonymous() {
    return this.request<{
      token: string
      userId: string
      pocketId: string
      isAnonymous: boolean
    }>('/auth/anonymous', { method: 'POST' })
  }

  /** Convert an anonymous account to a permanent one. Preserves all data. */
  async upgrade(email: string, password: string) {
    return this.request<{ token: string; userId: string; isAnonymous: boolean }>(
      '/auth/upgrade',
      {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      },
    )
  }

  // ── Pockets ─────────────────────────────────────────────────────────────────
  async listPockets() {
    return this.request<{ pockets: any[] }>('/pockets')
  }

  async getPocket(id: string) {
    return this.request<{ pocket: any }>(`/pockets/${id}`)
  }

  async getPocketSummary(id: string) {
    return this.request<{
      pocketId: string
      name: string
      totalUsd: number
      nativeBalanceSol: string
      solanaUsd: number
      externalUsd: number
      walletCount: number
      solanaWallets: any[]
      externalBalances: any[]
    }>(`/balances/${id}/summary`)
  }

  async syncBalances(pocketId: string) {
    return this.request(`/balances/${pocketId}/sync`, { method: 'POST' })
  }

  // ── Wallets ─────────────────────────────────────────────────────────────────
  async addWallet(
    pocketId: string,
    data: { address: string; chain: string; type?: string; label?: string },
  ) {
    return this.request<{ wallet: any }>(`/pockets/${pocketId}/wallets`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async removeWallet(pocketId: string, walletId: string) {
    return this.request(`/pockets/${pocketId}/wallets/${walletId}`, {
      method: 'DELETE',
    })
  }

  async setDefaultWallet(pocketId: string, walletId: string) {
    return this.request(`/pockets/${pocketId}/wallets/${walletId}/default`, {
      method: 'PATCH',
    })
  }

  // ── Connect (WalletConnect) ─────────────────────────────────────────────────
  async startConnect(pocketId: string, chains?: string[]) {
    return this.request<{ uri: string; pocketId: string }>(`/pockets/${pocketId}/connect`, {
      method: 'POST',
      body: JSON.stringify({ chains }),
    })
  }

  async listConnections(pocketId: string) {
    return this.request<{ connections: any[] }>(`/pockets/${pocketId}/connections`)
  }

  // ── Funds ──────────────────────────────────────────────────────────────────
  async deposit(pocketId: string, amount: string, txHash?: string) {
    return this.request(`/pockets/${pocketId}/deposit`, {
      method: 'POST',
      body: JSON.stringify({ amount, txHash }),
    })
  }

  async withdraw(pocketId: string, amount: string, toAddress: string) {
    return this.request(`/pockets/${pocketId}/withdraw`, {
      method: 'POST',
      body: JSON.stringify({ amount, toAddress }),
    })
  }

  // ── Transactions ───────────────────────────────────────────────────────────
  async getTransactions(pocketId: string, limit = 50) {
    return this.request<{ transactions: any[] }>(`/transactions/${pocketId}?limit=${limit}`)
  }

  // ── Agent ──────────────────────────────────────────────────────────────────
  async analyzePocket(pocketId: string) {
    return this.request<{ analysis: any }>(`/agent/analyze/${pocketId}`, { method: 'POST' })
  }

  async resolvePayment(data: {
    pocketId: string
    to: string
    amount: string
    token: string
    chain?: string
    memo?: string
  }) {
    return this.request<{ decision: any }>('/agent/resolve-payment', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async payViaAgent(
    pocketId: string,
    data: { to: string; amount: string; token: string; memo?: string },
  ) {
    return this.request<{
      txHash: string
      chain: string
      fromAddress: string
      toAddress: string
      amount: string
      token: string
      status: string
      reasoning: string
      walletUsed: string
    }>(`/pockets/${pocketId}/pay/agent`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  /** Stream chat via SSE. Returns an async iterator of text chunks. */
  async *chatStream(
    pocketId: string,
    messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  ): AsyncGenerator<string> {
    const res = await fetch(`${API_URL}/agent/chat/${pocketId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.token}`,
      },
      body: JSON.stringify({ messages }),
    })

    if (!res.body) throw new Error('No response body')

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6)
          if (data) yield data
        }
      }
    }
  }
}

export const api = new ApiClient()
