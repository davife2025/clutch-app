/**
 * Message protocol between content script ↔ background ↔ popup.
 * All chrome.runtime.sendMessage calls use this discriminated union.
 */

export interface X402Detection {
  url: string
  amount: string
  currency: string
  payTo: string
  network: string
  description?: string
  expiresAt: number
  detectedAt: number
}

export type ExtensionMessage =
  // Content → Background
  | { type: 'X402_DETECTED'; payload: X402Detection }
  // Popup → Background
  | { type: 'GET_PENDING_402S' }
  | { type: 'CLEAR_402'; url: string }
  | { type: 'PAY_402'; detection: X402Detection }
  | { type: 'SYNC_BALANCES' }
  // Background → Popup
  | { type: 'PENDING_402S_RESPONSE'; pending: X402Detection[] }
  | { type: 'PAYMENT_RESULT'; success: boolean; txHash?: string; error?: string }
