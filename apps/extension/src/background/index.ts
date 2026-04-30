/**
 * Clutch background service worker (Manifest V3).
 *
 * Responsibilities:
 *   - Track pending 402 detections across tabs
 *   - Update the action badge with the count
 *   - Forward PAY_402 requests to the Clutch API via the agent
 *   - Periodic balance sync (every 5 minutes)
 */

import type { ExtensionMessage, X402Detection } from '../lib/messages'

const STORAGE = {
  TOKEN: 'clutch_token',
  POCKET_ID: 'clutch_pocket_id',
  API_URL: 'clutch_api_url',
  PENDING: 'clutch_pending_402s',
  LAST_SYNCED: 'clutch_last_synced',
}

const DEFAULT_API_URL = 'http://localhost:3001'

// ─── Lifecycle ──────────────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(() => {
  console.log('[clutch] background installed')
  chrome.alarms.create('balance-sync', { periodInMinutes: 5 })
})

// ─── Pending 402 list ───────────────────────────────────────────────────────

async function getPending(): Promise<X402Detection[]> {
  const stored = await chrome.storage.local.get(STORAGE.PENDING)
  return stored[STORAGE.PENDING] ?? []
}

async function setPending(list: X402Detection[]) {
  await chrome.storage.local.set({ [STORAGE.PENDING]: list })
  updateBadge(list.length)
}

function updateBadge(count: number) {
  chrome.action.setBadgeText({ text: count > 0 ? String(count) : '' })
  chrome.action.setBadgeBackgroundColor({ color: '#C9A961' })
}

// ─── Message routing ────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
  handleMessage(message, sendResponse).catch((err) => {
    console.error('[clutch] message error:', err)
    sendResponse({ error: String(err) })
  })
  return true // keep channel open for async response
})

async function handleMessage(
  message: ExtensionMessage,
  sendResponse: (r: any) => void,
) {
  switch (message.type) {
    case 'X402_DETECTED': {
      const pending = await getPending()
      // Dedupe by URL
      const filtered = pending.filter((p) => p.url !== message.payload.url)
      filtered.unshift(message.payload)
      // Keep only the 10 most recent
      await setPending(filtered.slice(0, 10))
      sendResponse({ ok: true })
      break
    }

    case 'GET_PENDING_402S': {
      const pending = await getPending()
      sendResponse({ pending })
      break
    }

    case 'CLEAR_402': {
      const pending = await getPending()
      await setPending(pending.filter((p) => p.url !== message.url))
      sendResponse({ ok: true })
      break
    }

    case 'PAY_402': {
      const result = await pay402(message.detection)
      sendResponse(result)
      break
    }

    case 'SYNC_BALANCES': {
      await syncBalances()
      sendResponse({ ok: true })
      break
    }

    default:
      sendResponse({ error: `Unknown message type` })
  }
}

// ─── Pay a 402 via the Clutch agent ─────────────────────────────────────────

async function pay402(
  detection: X402Detection,
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  const stored = await chrome.storage.local.get([
    STORAGE.TOKEN,
    STORAGE.POCKET_ID,
    STORAGE.API_URL,
  ])

  const token = stored[STORAGE.TOKEN]
  const pocketId = stored[STORAGE.POCKET_ID]
  const apiUrl = stored[STORAGE.API_URL] ?? DEFAULT_API_URL

  if (!token) {
    return { success: false, error: 'Sign in to Clutch first — click the extension icon' }
  }
  if (!pocketId) {
    return { success: false, error: 'No pocket configured — open Clutch popup' }
  }

  // Convert smallest-unit amount to human-readable for the agent
  const decimals = ['USDC', 'USDT', 'DAI'].includes(detection.currency) ? 6 : 9
  const humanAmount = (Number(detection.amount) / 10 ** decimals).toString()

  try {
    const res = await fetch(`${apiUrl}/pockets/${pocketId}/pay/agent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        to: detection.payTo,
        amount: humanAmount,
        token: detection.currency,
        memo: detection.description,
      }),
    })

    const json = (await res.json()) as any

    if (!res.ok || json.error) {
      return { success: false, error: json.error?.message ?? 'Payment failed' }
    }

    // Remove from pending
    const pending = await getPending()
    await setPending(pending.filter((p) => p.url !== detection.url))

    // Show notification
    chrome.notifications?.create({
      type: 'basic',
      iconUrl: '',
      title: 'Clutch · payment confirmed',
      message: `Paid ${humanAmount} ${detection.currency} on ${detection.network}`,
    })

    return { success: true, txHash: json.data?.txHash }
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }
}

// ─── Periodic balance sync ──────────────────────────────────────────────────

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'balance-sync') {
    await syncBalances()
  }
})

async function syncBalances() {
  const stored = await chrome.storage.local.get([
    STORAGE.TOKEN,
    STORAGE.POCKET_ID,
    STORAGE.API_URL,
  ])

  if (!stored[STORAGE.TOKEN] || !stored[STORAGE.POCKET_ID]) return

  try {
    const apiUrl = stored[STORAGE.API_URL] ?? DEFAULT_API_URL
    await fetch(`${apiUrl}/balances/${stored[STORAGE.POCKET_ID]}/sync`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${stored[STORAGE.TOKEN]}` },
    })
    await chrome.storage.local.set({ [STORAGE.LAST_SYNCED]: Date.now() })
  } catch (err) {
    console.error('[clutch] balance sync failed:', err)
  }
}

console.log('[clutch] background service worker ready')
