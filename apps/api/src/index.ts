import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { pingDb } from './db/client.js'

const app = new Hono()

// ─── Middleware ────────────────────────────────────────────────────────────────

app.use('*', logger())
app.use('*', cors({ origin: process.env.CORS_ORIGIN ?? '*' }))

// ─── Health ───────────────────────────────────────────────────────────────────

app.get('/health', async (c) => {
  const dbOk = await pingDb()
  return c.json({
    status: dbOk ? 'ok' : 'degraded',
    service: 'clutch-api',
    version: '0.1.0',
    db: dbOk ? 'connected' : 'unreachable',
    timestamp: new Date().toISOString(),
  })
})

// ─── Routes (added per session) ───────────────────────────────────────────────

// Session 2: app.route('/auth', authRoutes)
// Session 2: app.route('/pockets', pocketRoutes)
// Session 2: app.route('/pockets', walletRoutes)
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
