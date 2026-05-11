const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'
const TOKEN_KEY = 'clutch_token'
const POCKET_KEY = 'clutch_pocket_id'
const ANON_KEY = 'clutch_is_anonymous'

export interface ApiError {
  code: string
  message: string
}

class ApiClient {
  // Note: we always re-read from localStorage on each request rather than
  // caching in memory. The previous version cached token in `this.token` and
  // only synced from localStorage in the constructor, which produced bugs
  // when a fresh tab ran the constructor before the token was written, or
  // when navigating between pages caused the singleton to fall out of sync.
  private get token(): string | null {
    if (typeof window === 'undefined') return null
    return localStorage.getItem(TOKEN_KEY)
  }

  setToken(token: string) {
    if (typeof window !== 'undefined') {
      localStorage.setItem(TOKEN_KEY, token)
    }
  }

  clearToken() {
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
    const token = this.token
    if (token) headers.Authorization = `Bearer ${token}`

    try {
      const res = await fetch(`${API_URL}${path}`, { ...options, headers })

      // Handle 401 globally: token is invalid/expired. Clear it and let the
      // auth guard redirect on the next mount. We DON'T redirect from here
      // because that races with React rendering and creates the loop the
      // user was hitting (page mounts → 401 → redirect to login → user logs
      // in → redirect to page → 401 again because token didn't actually
      // refresh, etc).
      if (res.status === 401 && token) {
        this.clearToken()
      }

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

  /** Get spending policy for a pocket */
  async getPolicy(pocketId: string) {
    return this.request<{
      policy: {
        enabled: boolean
        maxPerTxUsd: number | null
        maxPerDayUsd: number | null
        allowedRecipients: string[]
        blockedRecipients: string[]
        allowedTokens: string[]
        blockedTokens: string[]
      }
      spentTodayUsd: number
    }>(`/pockets/${pocketId}/policy`)
  }

  /** Update spending policy. Partial update — only sent fields change. */
  async updatePolicy(
    pocketId: string,
    update: {
      enabled?: boolean
      maxPerTxUsd?: number | null
      maxPerDayUsd?: number | null
      allowedRecipients?: string[]
      blockedRecipients?: string[]
      allowedTokens?: string[]
      blockedTokens?: string[]
    },
  ) {
    return this.request<{ policy: any }>(`/pockets/${pocketId}/policy`, {
      method: 'PUT',
      body: JSON.stringify(update),
    })
  }

  // ── Agents (consumer-facing payment agents) ─────────────────────────────────

  async listAgents(pocketId: string) {
    return this.request<{
      agents: Array<{
        id: string
        name: string
        template: string
        description: string | null
        status: 'active' | 'paused' | 'revoked'
        lastInstruction: string | null
        totalSpentUsd: number
        createdAt: string
      }>
    }>(`/pockets/${pocketId}/agents`)
  }

  async createAgent(
    pocketId: string,
    input: { name: string; template?: string; description?: string },
  ) {
    return this.request<{ agent: { id: string; name: string } }>(
      `/pockets/${pocketId}/agents`,
      { method: 'POST', body: JSON.stringify(input) },
    )
  }

  async getAgent(agentId: string) {
    return this.request<{
      agent: {
        id: string
        pocketId: string
        name: string
        template: string
        description: string | null
        status: 'active' | 'paused' | 'revoked'
        lastInstruction: string | null
        totalSpentUsd: number
        createdAt: string
      }
      recentReceipts: Array<{
        id: string
        resourceUrl: string
        amount: string
        token: string
        succeeded: boolean
        paidAt: string
      }>
    }>(`/agents/${agentId}`)
  }

  async updateAgent(
    agentId: string,
    update: { status?: 'active' | 'paused' | 'revoked'; name?: string; description?: string },
  ) {
    return this.request<{ agent: any }>(`/agents/${agentId}`, {
      method: 'PATCH',
      body: JSON.stringify(update),
    })
  }

  async instructAgent(agentId: string, instruction: string) {
    return this.request<{
      plan: {
        instruction: string
        urls: string[]
        canExecute: boolean
        explanation: string
      }
      status: string
    }>(`/agents/${agentId}/instruct`, {
      method: 'POST',
      body: JSON.stringify({ instruction }),
    })
  }

  // ── Registry (the public agent directory) ───────────────────────────────────

  async listRegistry(opts: { category?: string; search?: string; sort?: string } = {}) {
    const params = new URLSearchParams()
    if (opts.category) params.set('category', opts.category)
    if (opts.search) params.set('search', opts.search)
    if (opts.sort) params.set('sort', opts.sort)
    const qs = params.toString()
    return this.request<{
      agents: Array<{
        id: string
        name: string
        tagline: string
        logoUrl: string | null
        category: string
        paymentScope: string | null
        activeGrantsCount: number
        totalVolumeUsd: number
        publicKey: string
        createdAt: string
      }>
    }>(`/registry/agents${qs ? `?${qs}` : ''}`)
  }

  async getRegistryAgent(id: string) {
    return this.request<{
      agent: {
        id: string
        name: string
        tagline: string
        description: string
        publicKey: string
        homepage: string | null
        logoUrl: string | null
        category: string
        paymentScope: string | null
        activeGrantsCount: number
        totalVolumeUsd: number
        createdAt: string
      }
    }>(`/registry/agents/${id}`)
  }

  async listMyRegisteredAgents() {
    return this.request<{
      agents: Array<{
        id: string
        name: string
        tagline: string
        description: string
        publicKey: string
        homepage: string | null
        logoUrl: string | null
        category: string
        paymentScope: string | null
        status: 'active' | 'unlisted' | 'suspended'
        activeGrantsCount: number
        totalVolumeUsd: number
        createdAt: string
      }>
    }>(`/registry/my-agents`)
  }

  async registerAgent(input: {
    name: string
    tagline: string
    description: string
    publicKey: string
    homepage?: string
    logoUrl?: string
    category?: string
    paymentScope?: string
  }) {
    return this.request<{ agent: { id: string; name: string } }>(`/registry/agents`, {
      method: 'POST',
      body: JSON.stringify(input),
    })
  }

  async updateRegisteredAgent(
    id: string,
    update: Partial<{
      name: string
      tagline: string
      description: string
      homepage: string | null
      logoUrl: string | null
      category: string
      paymentScope: string | null
      status: 'active' | 'unlisted'
    }>,
  ) {
    return this.request<{ agent: any }>(`/registry/agents/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(update),
    })
  }

  async deleteRegisteredAgent(id: string) {
    return this.request<{ id: string; deleted: boolean }>(`/registry/agents/${id}`, {
      method: 'DELETE',
    })
  }

  // ── Grants (per-pocket authorizations of registered agents) ─────────────────

  async listGrants(pocketId: string) {
    return this.request<{
      grants: Array<{
        id: string
        agent: {
          id: string
          name: string
          tagline: string
          logoUrl: string | null
          category: string
          publicKey: string
        }
        maxPerTxUsd: number | null
        maxPerDayUsd: number | null
        allowedRecipients: string[]
        allowedTokens: string[]
        expiresAt: string | null
        status: 'active' | 'revoked' | 'expired'
        spentUsd: number
        lastUsedAt: string | null
        createdAt: string
      }>
    }>(`/pockets/${pocketId}/grants`)
  }

  async createGrant(
    pocketId: string,
    input: {
      registeredAgentId: string
      maxPerTxUsd?: number | null
      maxPerDayUsd?: number | null
      allowedRecipients?: string[] | null
      allowedTokens?: string[] | null
      expiresAt?: string | null
    },
  ) {
    return this.request<{ grant: { id: string } }>(`/pockets/${pocketId}/grants`, {
      method: 'POST',
      body: JSON.stringify(input),
    })
  }

  async updateGrant(
    grantId: string,
    update: Partial<{
      maxPerTxUsd: number | null
      maxPerDayUsd: number | null
      allowedRecipients: string[] | null
      allowedTokens: string[] | null
    }>,
  ) {
    return this.request<{ grant: any }>(`/grants/${grantId}`, {
      method: 'PATCH',
      body: JSON.stringify(update),
    })
  }

  async revokeGrant(grantId: string) {
    return this.request<{ id: string; revoked: boolean }>(`/grants/${grantId}`, {
      method: 'DELETE',
    })
  }

  // ── x402 Receipts (paywall payment audit trail) ─────────────────────────────

  async listReceipts(pocketId: string, limit = 50) {
    return this.request<{
      receipts: Array<{
        id: string
        resourceUrl: string
        method: string
        txHash: string
        amount: string
        token: string
        amountUsd: string | null
        payTo: string
        finalStatus: number | null
        succeeded: boolean
        paidAt: string
        explorerUrl: string
      }>
    }>(`/pockets/${pocketId}/receipts?limit=${limit}`)
  }

  // ── Pockets ─────────────────────────────────────────────────────────────────
  async listPockets() {
    return this.request<{ pockets: any[] }>('/pockets')
  }

  async createPocket(name: string) {
    return this.request<{ pocket: { id: string; name: string } }>('/pockets', {
      method: 'POST',
      body: JSON.stringify({ name }),
    })
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
