import { z } from 'zod'

// ─── Auth ─────────────────────────────────────────────────────────────────────

export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, 'Password is required'),
})

// ─── Pockets ──────────────────────────────────────────────────────────────────

export const createPocketSchema = z.object({
  name: z.string().min(1).max(100).default('My Pocket'),
})

// ─── Wallets ──────────────────────────────────────────────────────────────────

const chainIdValues = ['solana', 'ethereum', 'base', 'polygon', 'arbitrum', 'optimism'] as const
const walletTypeValues = ['hot', 'cold', 'hardware', 'native'] as const
const connectionTypeValues = ['manual', 'walletconnect', 'custodial'] as const

export const addWalletSchema = z.object({
  address: z.string().min(20, 'Invalid wallet address'),
  chain: z.enum(chainIdValues).default('solana'),
  type: z.enum(walletTypeValues).default('hot'),
  connectionType: z.enum(connectionTypeValues).default('manual'),
  label: z.string().max(50).optional(),
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Parse body with zod. Returns data or throws-style early return. */
export function validate<T extends z.ZodSchema>(
  body: unknown,
  schema: T,
): { ok: true; data: z.infer<T> } | { ok: false; error: string } {
  const result = schema.safeParse(body)
  if (!result.success) {
    const message = result.error.issues.map((i) => i.message).join(', ')
    return { ok: false, error: message }
  }
  return { ok: true, data: result.data }
}
