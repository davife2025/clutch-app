import type { Context, Next } from 'hono'

interface Bucket {
  tokens: number
  lastRefill: number
}

interface RateLimitConfig {
  /** Max requests allowed in the window */
  max: number
  /** Window in milliseconds */
  windowMs: number
  /** Optional per-route bucket key prefix */
  key?: string
}

/**
 * In-memory rate limiter.
 *
 * Uses a token bucket per (IP + route) pair. Tokens regenerate linearly:
 * if max=10 / windowMs=60000, the bucket refills at 1 token every 6 seconds.
 *
 * Limitations:
 *   - In-memory: each Render instance has its own buckets. For multi-instance
 *     deploys, swap to Redis. For our single-starter-instance deploy, fine.
 *   - Memory grows unbounded with unique IPs — runs a periodic GC.
 */
const buckets = new Map<string, Bucket>()
const GC_INTERVAL_MS = 5 * 60 * 1000 // every 5 minutes

setInterval(() => {
  const cutoff = Date.now() - 30 * 60 * 1000 // 30 minutes idle
  for (const [k, b] of buckets) {
    if (b.lastRefill < cutoff) buckets.delete(k)
  }
}, GC_INTERVAL_MS)

function getClientIp(c: Context): string {
  // Render and Vercel set x-forwarded-for. Fall back to a default key.
  const xff = c.req.header('x-forwarded-for')
  if (xff) return xff.split(',')[0]?.trim() ?? 'unknown'
  return c.req.header('x-real-ip') ?? 'unknown'
}

/**
 * Build a rate-limit middleware with the given config.
 *
 * Usage:
 *   app.use('/auth/login', rateLimit({ max: 5, windowMs: 60_000 }))
 *   app.use('/auth/register', rateLimit({ max: 3, windowMs: 5 * 60_000 }))
 */
export function rateLimit(config: RateLimitConfig) {
  const { max, windowMs, key: keyPrefix = 'default' } = config
  const refillRate = max / windowMs // tokens per ms

  return async (c: Context, next: Next) => {
    const ip = getClientIp(c)
    const bucketKey = `${keyPrefix}:${ip}`
    const now = Date.now()

    let bucket = buckets.get(bucketKey)
    if (!bucket) {
      bucket = { tokens: max, lastRefill: now }
      buckets.set(bucketKey, bucket)
    } else {
      // Refill since last hit
      const elapsed = now - bucket.lastRefill
      bucket.tokens = Math.min(max, bucket.tokens + elapsed * refillRate)
      bucket.lastRefill = now
    }

    if (bucket.tokens < 1) {
      const retryAfterMs = Math.ceil((1 - bucket.tokens) / refillRate)
      c.header('Retry-After', String(Math.ceil(retryAfterMs / 1000)))
      c.header('X-RateLimit-Limit', String(max))
      c.header('X-RateLimit-Remaining', '0')
      return c.json(
        {
          error: {
            code: 'RATE_LIMITED',
            message: 'Too many requests. Please slow down.',
          },
        },
        429,
      )
    }

    bucket.tokens -= 1
    c.header('X-RateLimit-Limit', String(max))
    c.header('X-RateLimit-Remaining', String(Math.floor(bucket.tokens)))

    await next()
  }
}
