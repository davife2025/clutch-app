import 'dotenv/config'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { serve } from '@hono/node-server'
import { createNodeWebSocket } from '@hono/node-ws'
import { errorMiddleware } from './middleware/error.js'
import { rateLimit } from './middleware/rate-limit.js'
import { healthRoutes } from './routes/health.js'
import { authRoutes } from './routes/auth.js'
import { pocketRoutes } from './routes/pocket.js'
import { walletRoutes } from './routes/wallet.js'
import { balanceRoutes } from './routes/balance.js'
import { fundsRoutes } from './routes/funds.js'
import { transactionRoutes } from './routes/transactions.js'
import { webhookRoutes } from './routes/webhook.js'
import { connectRoutes } from './routes/connect.js'
import { agentRoutes } from './routes/agent.js'
import { payRoutes } from './routes/pay.js'
import { x402Routes } from './routes/x402.js'
import { policyRoutes } from './routes/policy.js'
import {
  registerClient,
  removeClient,
  startRealtimeWorkers,
  verifyWsToken,
} from './realtime/manager.js'

const app = new Hono()
const { upgradeWebSocket, injectWebSocket } = createNodeWebSocket({ app })

// ─── Middleware ────────────────────────────────────────────────────────────────

app.use('*', logger())
app.use('*', cors({ origin: process.env.CORS_ORIGIN ?? '*' }))
app.use('*', errorMiddleware)

// ─── Rate limits (applied per-route for explicit policy) ──────────────────────
//
// Auth is the most attack-prone — strict limits.
// Payment endpoints get a reasonable limit to prevent runaway agent loops.
// General reads are rate-limited globally with a high ceiling.

app.use(
  '/auth/login',
  rateLimit({ max: 5, windowMs: 60_000, key: 'auth-login' }),
)
app.use(
  '/auth/register',
  rateLimit({ max: 3, windowMs: 5 * 60_000, key: 'auth-register' }),
)
app.use(
  '/auth/anonymous',
  rateLimit({ max: 5, windowMs: 5 * 60_000, key: 'auth-anonymous' }),
)
app.use(
  '/auth/upgrade',
  rateLimit({ max: 3, windowMs: 60_000, key: 'auth-upgrade' }),
)
app.use(
  '/pockets/:id/pay/agent',
  rateLimit({ max: 10, windowMs: 60_000, key: 'pay-agent' }),
)
app.use(
  '/agent/*',
  rateLimit({ max: 30, windowMs: 60_000, key: 'agent' }),
)
app.use(
  '/webhook/*',
  rateLimit({ max: 60, windowMs: 60_000, key: 'webhook' }),
)

// ─── Routes ───────────────────────────────────────────────────────────────────

app.route('/health', healthRoutes)
app.route('/auth', authRoutes)
app.route('/pockets', pocketRoutes)
app.route('/pockets', walletRoutes)
app.route('/balances', balanceRoutes)
app.route('/pockets', fundsRoutes)
app.route('/transactions', transactionRoutes)
app.route('/webhook', webhookRoutes)
app.route('/pockets', connectRoutes)
app.route('/agent', agentRoutes)
app.route('/pockets', payRoutes)
app.route('/pockets', policyRoutes)
app.route('/x402', x402Routes)

// ─── WebSocket ─────────────────────────────────────────────────────────────────

app.get(
  '/ws',
  upgradeWebSocket(async (c) => {
    const token = c.req.query('token')
    const userId = await verifyWsToken(token)
    let clientId = ''

    return {
      onOpen(_evt, ws) {
        if (!userId) {
          ws.send(JSON.stringify({ type: 'error', message: 'Invalid or missing token' }))
          ws.close(4001, 'Unauthorized')
          return
        }
        clientId = `${userId}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`
        registerClient(clientId, userId, ws)
      },
      onClose() {
        if (clientId) removeClient(clientId)
      },
      onError(err) {
        console.error('[ws] error:', err)
      },
      // Echo client messages back as pong if they send "ping"
      onMessage(evt, ws) {
        const data = typeof evt.data === 'string' ? evt.data : ''
        if (data === 'ping') ws.send(JSON.stringify({ type: 'ping', t: Date.now() }))
      },
    }
  }),
)

// ─── 404 ──────────────────────────────────────────────────────────────────────

app.notFound((c) =>
  c.json({ error: { code: 'NOT_FOUND', message: 'Route not found' } }, 404),
)

// ─── Start ────────────────────────────────────────────────────────────────────

const port = Number(process.env.PORT ?? 3001)

const server = serve(
  { fetch: app.fetch, port },
  (info) => {
    console.log(`🫙  Clutch API v0.1.0  →  http://localhost:${info.port}`)
    console.log(`    WebSocket          →  ws://localhost:${info.port}/ws?token=<jwt>`)
  },
)

console.log('DATABASE_URL:', process.env.DATABASE_URL) 
console.log('DATABASE_URL_DIRECT:', process.env.DATABASE_URL_DIRECT) 
console.log('JWT_SECRET:', process.env.JWT_SECRET) 

injectWebSocket(server)
startRealtimeWorkers()

export default app
