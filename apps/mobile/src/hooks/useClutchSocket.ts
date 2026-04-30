import { useEffect, useRef, useState, useCallback } from 'react'
import * as SecureStore from 'expo-secure-store'
import Constants from 'expo-constants'

export type ClutchEvent =
  | { type: 'connected'; userId: string; serverTime: string }
  | { type: 'ping'; t: number }
  | {
      type: 'balance_update'
      pocketId: string
      totalUsd: number
      solanaUsd: number
      externalUsd: number
      updatedAt: string
    }
  | { type: 'tx_pending'; txHash: string; pocketId: string }
  | { type: 'tx_confirmed'; txHash: string; pocketId: string; status: 'confirmed' | 'failed' }
  | { type: 'price_tick'; prices: Record<string, number> }
  | { type: 'error'; message: string }

const TOKEN_KEY = 'clutch_token'
const API_URL =
  Constants.expoConfig?.extra?.apiUrl ?? process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001'
const RECONNECT_DELAYS = [1000, 2000, 4000, 8000, 16000]

interface UseClutchSocketOptions {
  onEvent?: (event: ClutchEvent) => void
  enabled?: boolean
}

/**
 * Real-time WebSocket hook for the mobile app.
 * Uses expo-secure-store for the JWT and React Native's WebSocket primitive.
 */
export function useClutchSocket({ onEvent, enabled = true }: UseClutchSocketOptions = {}) {
  const [status, setStatus] = useState<'idle' | 'connecting' | 'open' | 'closed'>('idle')
  const wsRef = useRef<WebSocket | null>(null)
  const attemptRef = useRef(0)
  const onEventRef = useRef(onEvent)
  const closedByUserRef = useRef(false)

  useEffect(() => {
    onEventRef.current = onEvent
  }, [onEvent])

  const connect = useCallback(async () => {
    const token = await SecureStore.getItemAsync(TOKEN_KEY)
    if (!token) {
      setStatus('idle')
      return
    }

    setStatus('connecting')
    closedByUserRef.current = false

    const wsUrl = API_URL.replace(/^http/, 'ws') + `/ws?token=${encodeURIComponent(token)}`
    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    ws.onopen = () => {
      setStatus('open')
      attemptRef.current = 0
    }

    ws.onmessage = (e) => {
      try {
        const event = JSON.parse(typeof e.data === 'string' ? e.data : '') as ClutchEvent
        onEventRef.current?.(event)
      } catch {
        // ignore malformed
      }
    }

    ws.onclose = () => {
      setStatus('closed')
      wsRef.current = null
      if (closedByUserRef.current) return
      const delay = RECONNECT_DELAYS[Math.min(attemptRef.current, RECONNECT_DELAYS.length - 1)]
      attemptRef.current += 1
      setTimeout(() => {
        if (!closedByUserRef.current) connect()
      }, delay)
    }

    ws.onerror = () => {
      // close handler will trigger reconnect
    }
  }, [])

  useEffect(() => {
    if (!enabled) return
    connect()
    return () => {
      closedByUserRef.current = true
      wsRef.current?.close()
    }
  }, [enabled, connect])

  return { status }
}
