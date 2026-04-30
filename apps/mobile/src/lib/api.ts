import * as SecureStore from 'expo-secure-store'
import Constants from 'expo-constants'

const API_URL =
  Constants.expoConfig?.extra?.apiUrl ??
  process.env.EXPO_PUBLIC_API_URL ??
  'http://localhost:3001'

const TOKEN_KEY = 'clutch_token'
const POCKET_KEY = 'clutch_pocket_id'

export interface ApiError {
  code: string
  message: string
}

class ApiClient {
  private token: string | null = null

  async init() {
    this.token = await SecureStore.getItemAsync(TOKEN_KEY)
  }

  async setToken(token: string) {
    this.token = token
    await SecureStore.setItemAsync(TOKEN_KEY, token)
  }

  async clearToken() {
    this.token = null
    await SecureStore.deleteItemAsync(TOKEN_KEY)
    await SecureStore.deleteItemAsync(POCKET_KEY)
  }

  async setPocketId(pocketId: string) {
    await SecureStore.setItemAsync(POCKET_KEY, pocketId)
  }

  async getPocketId(): Promise<string | null> {
    return SecureStore.getItemAsync(POCKET_KEY)
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
    return this.request<{ token: string; userId: string; pocketId: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
  }

  async login(email: string, password: string) {
    return this.request<{ token: string; userId: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
  }

  // ── Pockets ─────────────────────────────────────────────────────────────────
  async listPockets() {
    return this.request<{ pockets: any[] }>('/pockets')
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

  // ── WalletConnect ──────────────────────────────────────────────────────────
  async startConnect(pocketId: string, chains?: string[]) {
    return this.request<{ uri: string; pocketId: string }>(`/pockets/${pocketId}/connect`, {
      method: 'POST',
      body: JSON.stringify({ chains }),
    })
  }

  // ── Transactions ───────────────────────────────────────────────────────────
  async getTransactions(pocketId: string, limit = 50) {
    return this.request<{ transactions: any[] }>(`/transactions/${pocketId}?limit=${limit}`)
  }

  // ── Agent ──────────────────────────────────────────────────────────────────
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

  /** Stream chat via SSE — works in React Native with the modern fetch */
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
    const reader = (res.body as any).getReader()
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
