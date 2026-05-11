import { describe, it, expect } from 'vitest'
import { validate, registerSchema, addWalletSchema, createPocketSchema } from '../src/lib/validation.js'

describe('input validation schemas', () => {
  describe('registerSchema', () => {
    it('accepts a valid registration', () => {
      const r = validate({ email: 'user@example.com', password: 'password123' }, registerSchema)
      expect(r.ok).toBe(true)
    })

    it('rejects invalid email', () => {
      const r = validate({ email: 'not-an-email', password: 'password123' }, registerSchema)
      expect(r.ok).toBe(false)
    })

    it('rejects short password', () => {
      const r = validate({ email: 'user@example.com', password: 'short' }, registerSchema)
      expect(r.ok).toBe(false)
    })
  })

  describe('createPocketSchema', () => {
    it('accepts valid name', () => {
      const r = validate({ name: 'Travel Pocket' }, createPocketSchema)
      expect(r.ok).toBe(true)
      if (r.ok) expect(r.data.name).toBe('Travel Pocket')
    })

    it('uses default name when missing', () => {
      const r = validate({}, createPocketSchema)
      expect(r.ok).toBe(true)
      if (r.ok) expect(r.data.name).toBe('My Pocket')
    })

    it('rejects names over 100 chars', () => {
      const r = validate({ name: 'x'.repeat(101) }, createPocketSchema)
      expect(r.ok).toBe(false)
    })
  })

  describe('addWalletSchema', () => {
    it('accepts a valid Solana wallet', () => {
      const r = validate(
        {
          address: 'So11111111111111111111111111111111111111112',
          chain: 'solana',
          type: 'hot',
        },
        addWalletSchema,
      )
      expect(r.ok).toBe(true)
      if (r.ok) {
        expect(r.data.chain).toBe('solana')
        expect(r.data.connectionType).toBe('manual')
      }
    })

    it('defaults chain to solana', () => {
      const r = validate(
        { address: 'So11111111111111111111111111111111111111112' },
        addWalletSchema,
      )
      expect(r.ok).toBe(true)
      if (r.ok) {
        expect(r.data.chain).toBe('solana')
        expect(r.data.type).toBe('hot')
      }
    })

    it('rejects invalid chain', () => {
      const r = validate(
        { address: 'address', chain: 'bitcoin' },
        addWalletSchema,
      )
      expect(r.ok).toBe(false)
    })

    it('rejects address that is too short', () => {
      const r = validate({ address: 'tiny' }, addWalletSchema)
      expect(r.ok).toBe(false)
    })

    it('accepts walletconnect connectionType', () => {
      const r = validate(
        {
          address: 'So11111111111111111111111111111111111111112',
          connectionType: 'walletconnect',
        },
        addWalletSchema,
      )
      expect(r.ok).toBe(true)
    })

    it('accepts custodial connectionType', () => {
      const r = validate(
        {
          address: 'So11111111111111111111111111111111111111112',
          connectionType: 'custodial',
        },
        addWalletSchema,
      )
      expect(r.ok).toBe(true)
    })
  })
})
