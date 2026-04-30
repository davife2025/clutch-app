import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { errorMiddleware } from './middleware/error.js'
import { healthRoutes } from './routes/health.js'
import { authRoutes } from './routes/auth.js'
import { pocketRoutes } from './routes/pocket.js'
import { walletRoutes } from './routes/wallet.js'

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

// Session 3: app.route('/balances', balanceRoutes)
// Session 4: app.route('/pockets', fundsRoutes)
// Session 4: app.route('/transactions', transactionRoutes)
// Session 6: app.route('/agent', agentRoutes)
// Session 6: app.route('/pockets', payRoutes)

// ─── 404 ──────────────────────────────────────────────────────────────────────

app.notFound((c) =>
  c.json({ error: { code: 'NOT_FOUND', message: 'Route not found' } }, 404),
)

// ─── Start ────────────────────────────────────────────────────────────────────

const port = Number(process.env.PORT ?? 3001)
console.log(`🫙  Clutch API v0.1.0  →  http://localhost:${port}`)

export default { port, fetch: app.fetch }
