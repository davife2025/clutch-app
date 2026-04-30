import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { errorMiddleware } from './middleware/error.js'
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

const app = new Hono()

// ─── Middleware ────────────────────────────────────────────────────────────────

app.use('*', logger())
app.use('*', cors({ origin: process.env.CORS_ORIGIN ?? '*' }))
app.use('*', errorMiddleware)

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
app.route('/x402', x402Routes)

// ─── 404 ──────────────────────────────────────────────────────────────────────

app.notFound((c) =>
  c.json({ error: { code: 'NOT_FOUND', message: 'Route not found' } }, 404),
)

// ─── Start ────────────────────────────────────────────────────────────────────

const port = Number(process.env.PORT ?? 3001)
console.log(`🫙  Clutch API v0.1.0  →  http://localhost:${port}`)

export default { port, fetch: app.fetch }
