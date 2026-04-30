import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import { authMiddleware } from '../middleware/auth.js'
import { agentService } from '../services/agent.service.js'

type Env = { Variables: { userId: string } }

export const agentRoutes = new Hono<Env>()
agentRoutes.use('*', authMiddleware)

/**
 * POST /agent/analyze/:pocketId
 * Full pocket analysis — insights, health score, suggested actions.
 */
agentRoutes.post('/analyze/:pocketId', async (c) => {
  const pocketId = c.req.param('pocketId')
  try {
    const analysis = await agentService.analyzeP(pocketId)
    return c.json({ data: { analysis } })
  } catch (err: any) {
    if (err.message?.includes('ANTHROPIC_API_KEY')) {
      return c.json(
        { error: { code: 'CONFIG_ERROR', message: 'AI agent not configured — set ANTHROPIC_API_KEY' } },
        503,
      )
    }
    return c.json({ error: { code: 'AGENT_ERROR', message: err.message } }, 500)
  }
})

/**
 * POST /agent/resolve-payment
 * Agent picks optimal wallet/chain/token (but does NOT execute).
 */
agentRoutes.post('/resolve-payment', async (c) => {
  const body = await c.req.json().catch(() => ({} as any))
  const { pocketId, to, amount, token, chain, memo } = body

  if (!pocketId || !to || !amount || !token) {
    return c.json(
      { error: { code: 'VALIDATION', message: 'pocketId, to, amount, token required' } },
      400,
    )
  }

  try {
    const decision = await agentService.resolvePayment(pocketId, { to, amount, token, chain, memo })
    return c.json({ data: { decision } })
  } catch (err: any) {
    return c.json({ error: { code: 'AGENT_ERROR', message: err.message } }, 500)
  }
})

/**
 * POST /agent/chat/:pocketId
 * Streaming chat via Server-Sent Events.
 */
agentRoutes.post('/chat/:pocketId', async (c) => {
  const pocketId = c.req.param('pocketId')
  const body = await c.req.json().catch(() => ({} as any))
  const { messages } = body

  if (!Array.isArray(messages) || messages.length === 0) {
    return c.json({ error: { code: 'VALIDATION', message: 'messages array required' } }, 400)
  }

  return streamSSE(c, async (stream) => {
    try {
      for await (const chunk of agentService.chat(pocketId, messages)) {
        await stream.writeSSE({ data: chunk, event: 'chunk' })
      }
      await stream.writeSSE({ data: '', event: 'done' })
    } catch (err: any) {
      await stream.writeSSE({ data: err.message, event: 'error' })
    }
  })
})
