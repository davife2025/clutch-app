import { describe, it, expect } from 'vitest'
import { Hono } from 'hono'
import { rateLimit } from '../src/middleware/rate-limit.js'

function buildApp(config: Parameters<typeof rateLimit>[0]) {
  const app = new Hono()
  app.use('/test', rateLimit(config))
  app.get('/test', (c) => c.json({ ok: true }))
  return app
}

const TEST_IP = '203.0.113.1'

describe('rateLimit middleware', () => {
  it('allows requests under the limit', async () => {
    const app = buildApp({ max: 5, windowMs: 60_000, key: 'test-allow' })
    for (let i = 0; i < 5; i++) {
      const res = await app.request('/test', { headers: { 'x-forwarded-for': TEST_IP } })
      expect(res.status).toBe(200)
    }
  })

  it('returns 429 once the limit is exceeded', async () => {
    const app = buildApp({ max: 3, windowMs: 60_000, key: 'test-block' })
    for (let i = 0; i < 3; i++) {
      const r = await app.request('/test', { headers: { 'x-forwarded-for': TEST_IP } })
      expect(r.status).toBe(200)
    }
    const blocked = await app.request('/test', { headers: { 'x-forwarded-for': TEST_IP } })
    expect(blocked.status).toBe(429)
    const body = (await blocked.json()) as any
    expect(body.error.code).toBe('RATE_LIMITED')
  })

  it('sends rate-limit headers', async () => {
    const app = buildApp({ max: 10, windowMs: 60_000, key: 'test-headers' })
    const res = await app.request('/test', { headers: { 'x-forwarded-for': TEST_IP } })
    expect(res.headers.get('X-RateLimit-Limit')).toBe('10')
    expect(res.headers.get('X-RateLimit-Remaining')).toBe('9')
  })

  it('sends Retry-After when blocked', async () => {
    const app = buildApp({ max: 1, windowMs: 60_000, key: 'test-retry' })
    await app.request('/test', { headers: { 'x-forwarded-for': TEST_IP } })
    const blocked = await app.request('/test', { headers: { 'x-forwarded-for': TEST_IP } })
    expect(blocked.status).toBe(429)
    expect(blocked.headers.get('Retry-After')).toBeTruthy()
  })

  it('isolates buckets per IP', async () => {
    const app = buildApp({ max: 2, windowMs: 60_000, key: 'test-isolate' })
    // IP A burns its budget
    await app.request('/test', { headers: { 'x-forwarded-for': '10.0.0.1' } })
    await app.request('/test', { headers: { 'x-forwarded-for': '10.0.0.1' } })
    const aBlocked = await app.request('/test', { headers: { 'x-forwarded-for': '10.0.0.1' } })
    expect(aBlocked.status).toBe(429)
    // IP B is unaffected
    const bOk = await app.request('/test', { headers: { 'x-forwarded-for': '10.0.0.2' } })
    expect(bOk.status).toBe(200)
  })

  it('isolates buckets per route key', async () => {
    const app1 = buildApp({ max: 1, windowMs: 60_000, key: 'route-A' })
    const app2 = buildApp({ max: 1, windowMs: 60_000, key: 'route-B' })
    // Different route keys → different buckets, even for the same IP
    const r1 = await app1.request('/test', { headers: { 'x-forwarded-for': '10.0.0.5' } })
    const r2 = await app2.request('/test', { headers: { 'x-forwarded-for': '10.0.0.5' } })
    expect(r1.status).toBe(200)
    expect(r2.status).toBe(200)
  })
})
