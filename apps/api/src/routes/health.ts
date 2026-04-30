import { Hono } from 'hono'
import { pingDb } from '../db/client.js'

export const healthRoutes = new Hono()

healthRoutes.get('/', async (c) => {
  const dbOk = await pingDb()
  return c.json({
    status: dbOk ? 'ok' : 'degraded',
    service: 'clutch-api',
    version: '0.1.0',
    db: dbOk ? 'connected' : 'unreachable',
    timestamp: new Date().toISOString(),
  })
})
