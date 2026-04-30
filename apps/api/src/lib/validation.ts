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

// ─── Funds ────────────────────────────────────────────────────────────────────

export const depositSchema = z.object({
  amount: z
    .union([z.string(), z.number()])
    .transform((v) => String(v))
    .refine((v) => !isNaN(Number(v)) && Number(v) > 0, 'Amount must be a positive number'),
  txHash: z.string().optional(),
})

export const withdrawSchema = z.object({
  amount: z
    .union([z.string(), z.number()])
    .transform((v) => String(v))
    .refine((v) => !isNaN(Number(v)) && Number(v) > 0, 'Amount must be a positive number'),
  toAddress: z.string().min(20, 'Destination address required'),
})

// ─── Custodial wallet import ──────────────────────────────────────────────────

export const importWalletSchema = z.object({
  privateKey: z.string().min(32, 'Invalid private key'),
  chain: z.enum(chainIdValues).default('solana'),
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
