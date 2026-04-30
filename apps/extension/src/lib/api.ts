/**
 * API client for the extension.
 * Uses chrome.storage.local instead of localStorage so the popup,
 * background worker, and content script all share state.
 */

const STORAGE = {
  TOKEN: 'clutch_token',
  POCKET_ID: 'clutch_pocket_id',
  API_URL: 'clutch_api_url',
}

const DEFAULT_API_URL = 'http://localhost:3001'

export interface ApiError {
  code: string
  message: string
}

class ExtensionApi {
  async getApiUrl(): Promise<string> {
    const stored = await chrome.storage.local.get(STORAGE.API_URL)
    return stored[STORAGE.API_URL] ?? DEFAULT_API_URL
  }

  async setApiUrl(url: string) {
    await chrome.storage.local.set({ [STORAGE.API_URL]: url })
  }

  async getToken(): Promise<string | null> {
    const stored = await chrome.storage.local.get(STORAGE.TOKEN)
    return stored[STORAGE.TOKEN] ?? null
  }

  async setToken(token: string) {
    await chrome.storage.local.set({ [STORAGE.TOKEN]: token })
  }

  async clearToken() {
    await chrome.storage.local.remove([STORAGE.TOKEN, STORAGE.POCKET_ID])
  }

  async getPocketId(): Promise<string | null> {
    const stored = await chrome.storage.local.get(STORAGE.POCKET_ID)
    return stored[STORAGE.POCKET_ID] ?? null
  }

  async setPocketId(pocketId: string) {
    await chrome.storage.local.set({ [STORAGE.POCKET_ID]: pocketId })
  }

  async isAuthenticated(): Promise<boolean> {
    return !!(await this.getToken())
  }

  private async request<T>(
    path: string,
    options: RequestInit = {},
  ): Promise<{ data?: T; error?: ApiError }> {
    const apiUrl = await this.getApiUrl()
    const token = await this.getToken()

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) ?? {}),
    }
    if (token) headers.Authorization = `Bearer ${token}`

    try {
      const res = await fetch(`${apiUrl}${path}`, { ...options, headers })
      const json = await res.json()
      return json
    } catch (err) {
      return { error: { code: 'NETWORK', message: (err as Error).message } }
    }
  }

  // ── Auth ────────────────────────────────────────────────────────────────────
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

  async getPocketSummary(pocketId: string) {
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
    }>(`/balances/${pocketId}/summary`)
  }

  // ── Agent payment — the 402 handler ─────────────────────────────────────────
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
}

export const api = new ExtensionApi()
