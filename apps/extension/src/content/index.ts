/**
 * Clutch content script — runs on every web page.
 *
 * Watches network responses for HTTP 402 (Payment Required). When detected,
 * parses the x402 payment request body, notifies the background worker,
 * and shows a subtle floating prompt asking the user to pay through their
 * Clutch pocket.
 *
 * This is the extension's signature feature — turns any 402-gated API into
 * a one-click Clutch payment.
 */

import type { ExtensionMessage, X402Detection } from '../lib/messages'

const STYLE_ID = '__clutch_402_styles'
const PROMPT_ID = '__clutch_402_prompt'
const SEEN = new Set<string>()

// ─── Inject styles for the floating prompt ──────────────────────────────────

function injectStyles() {
  if (document.getElementById(STYLE_ID)) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = `
    #${PROMPT_ID} {
      all: initial;
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 2147483647;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      animation: __clutch_slide_up 0.4s cubic-bezier(0.16, 1, 0.3, 1);
    }
    @keyframes __clutch_slide_up {
      from { opacity: 0; transform: translateY(20px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .__clutch_card {
      background: #13110D;
      border: 1px solid rgba(201, 169, 97, 0.25);
      border-radius: 14px;
      padding: 18px 20px;
      width: 340px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5), 0 0 30px rgba(201, 169, 97, 0.08);
      color: #F5F1E8;
    }
    .__clutch_header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 12px;
    }
    .__clutch_logo {
      width: 28px;
      height: 28px;
      border-radius: 8px;
      background: linear-gradient(135deg, #C9A961, #7E6B33);
      display: flex;
      align-items: center;
      justify-content: center;
      color: #0B0A07;
      font-weight: 700;
      font-family: Georgia, serif;
      font-size: 16px;
    }
    .__clutch_eyebrow {
      font-size: 10px;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      color: #C9A961;
      font-weight: 500;
    }
    .__clutch_title {
      font-size: 14px;
      color: #F5F1E8;
      margin-top: 2px;
    }
    .__clutch_close {
      margin-left: auto;
      background: none;
      border: none;
      color: #9A9485;
      cursor: pointer;
      font-size: 18px;
      padding: 0;
      line-height: 1;
    }
    .__clutch_close:hover { color: #F5F1E8; }
    .__clutch_body {
      font-size: 13px;
      color: #C9C5B7;
      margin-bottom: 14px;
      line-height: 1.5;
    }
    .__clutch_amount {
      color: #F5F1E8;
      font-weight: 600;
    }
    .__clutch_actions {
      display: flex;
      gap: 8px;
    }
    .__clutch_btn_primary {
      flex: 1;
      background: #C9A961;
      color: #0B0A07;
      border: none;
      border-radius: 10px;
      padding: 10px 14px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.15s;
    }
    .__clutch_btn_primary:hover { background: #D2B670; }
    .__clutch_btn_secondary {
      background: transparent;
      color: #C9C5B7;
      border: 1px solid #3A3528;
      border-radius: 10px;
      padding: 10px 14px;
      font-size: 13px;
      cursor: pointer;
      transition: all 0.15s;
    }
    .__clutch_btn_secondary:hover { border-color: #5C574A; color: #F5F1E8; }
  `
  ;(document.head || document.documentElement).appendChild(style)
}

// ─── Show the payment prompt ────────────────────────────────────────────────

function showPrompt(detection: X402Detection) {
  if (SEEN.has(detection.url)) return
  SEEN.add(detection.url)

  injectStyles()
  document.getElementById(PROMPT_ID)?.remove()

  const root = document.createElement('div')
  root.id = PROMPT_ID

  const decimals = ['USDC', 'USDT', 'DAI'].includes(detection.currency) ? 6 : 9
  const human = (Number(detection.amount) / 10 ** decimals).toFixed(4).replace(/\.?0+$/, '')

  root.innerHTML = `
    <div class="__clutch_card">
      <div class="__clutch_header">
        <div class="__clutch_logo">C</div>
        <div>
          <div class="__clutch_eyebrow">Clutch · 402 detected</div>
          <div class="__clutch_title">${escapeHtml(detection.description ?? 'Payment required')}</div>
        </div>
        <button class="__clutch_close" data-action="close" aria-label="Close">×</button>
      </div>
      <div class="__clutch_body">
        Pay <span class="__clutch_amount">${human} ${escapeHtml(detection.currency)}</span> on
        ${escapeHtml(detection.network)} to access this resource.
      </div>
      <div class="__clutch_actions">
        <button class="__clutch_btn_primary" data-action="pay">Pay through pocket</button>
        <button class="__clutch_btn_secondary" data-action="close">Dismiss</button>
      </div>
    </div>
  `

  root.querySelector('[data-action="pay"]')?.addEventListener('click', () => {
    const msg: ExtensionMessage = { type: 'PAY_402', detection }
    chrome.runtime.sendMessage(msg, (response) => {
      // Replace card with result state
      if (response?.success) {
        root.querySelector('.__clutch_card')!.innerHTML = `
          <div class="__clutch_header">
            <div class="__clutch_logo">C</div>
            <div>
              <div class="__clutch_eyebrow" style="color: #5C7456;">Paid · refresh to access</div>
              <div class="__clutch_title">Payment confirmed</div>
            </div>
          </div>
          <div class="__clutch_body" style="font-family: monospace; font-size: 11px; word-break: break-all;">
            ${escapeHtml(response.txHash ?? '')}
          </div>
        `
        setTimeout(() => root.remove(), 4000)
      } else {
        root.querySelector('.__clutch_card')!.innerHTML = `
          <div class="__clutch_header">
            <div class="__clutch_logo" style="background: linear-gradient(135deg, #A85B3B, #5C2812);">!</div>
            <div>
              <div class="__clutch_eyebrow" style="color: #A85B3B;">Payment failed</div>
              <div class="__clutch_title">${escapeHtml(response?.error ?? 'Open Clutch to sign in')}</div>
            </div>
            <button class="__clutch_close" data-action="close" aria-label="Close">×</button>
          </div>
        `
        root
          .querySelector('[data-action="close"]')
          ?.addEventListener('click', () => root.remove())
      }
    })
  })

  root.querySelector('[data-action="close"]')?.addEventListener('click', () => {
    root.remove()
  })

  document.body.appendChild(root)
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// ─── Patch fetch ────────────────────────────────────────────────────────────

const originalFetch = window.fetch
window.fetch = async function (...args: Parameters<typeof fetch>) {
  const response = await originalFetch.apply(this, args)
  if (response.status === 402) {
    handle402(response.clone(), args[0]).catch(() => {})
  }
  return response
}

// ─── Patch XMLHttpRequest ───────────────────────────────────────────────────

const originalSend = XMLHttpRequest.prototype.send
XMLHttpRequest.prototype.send = function (body) {
  this.addEventListener('load', () => {
    if (this.status === 402) {
      try {
        const data = JSON.parse(this.responseText)
        if (data && data.amount && data.currency && data.payTo) {
          notifyDetection({
            url: this.responseURL,
            amount: String(data.amount),
            currency: String(data.currency),
            payTo: String(data.payTo),
            network: String(data.network ?? 'solana'),
            description: data.description,
            expiresAt: Number(data.expiresAt ?? 0),
            detectedAt: Date.now(),
          })
        }
      } catch {
        // Not a valid x402 body
      }
    }
  })
  return originalSend.apply(this, [body] as any)
}

// ─── Parse & notify ─────────────────────────────────────────────────────────

async function handle402(response: Response, input: Parameters<typeof fetch>[0]) {
  let data: any
  try {
    data = await response.json()
  } catch {
    return
  }

  if (!data || !data.amount || !data.currency || !data.payTo) return

  const url =
    typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url

  notifyDetection({
    url,
    amount: String(data.amount),
    currency: String(data.currency),
    payTo: String(data.payTo),
    network: String(data.network ?? 'solana'),
    description: data.description,
    expiresAt: Number(data.expiresAt ?? 0),
    detectedAt: Date.now(),
  })
}

function notifyDetection(detection: X402Detection) {
  const msg: ExtensionMessage = { type: 'X402_DETECTED', payload: detection }
  chrome.runtime.sendMessage(msg).catch(() => {})
  showPrompt(detection)
}

console.debug('[clutch] content script ready — watching for HTTP 402')
