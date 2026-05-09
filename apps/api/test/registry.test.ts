import { describe, it, expect } from 'vitest'

// We test the public-key validation helper inline here. The route handlers
// require DB integration which we cover in a separate suite.

function isValidBase58Pubkey(s: string): boolean {
  if (s.length < 32 || s.length > 44) return false
  return /^[1-9A-HJ-NP-Za-km-z]+$/.test(s)
}

describe('registry pubkey validation', () => {
  it('accepts a valid Solana public key', () => {
    // Common test addresses
    expect(isValidBase58Pubkey('So11111111111111111111111111111111111111112')).toBe(true)
    expect(isValidBase58Pubkey('5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d')).toBe(true)
    expect(isValidBase58Pubkey('11111111111111111111111111111111')).toBe(true)
  })

  it('rejects strings that are too short', () => {
    expect(isValidBase58Pubkey('abc')).toBe(false)
    expect(isValidBase58Pubkey('123456789012345678901234567890')).toBe(false) // 30 chars
  })

  it('rejects strings that are too long', () => {
    expect(isValidBase58Pubkey('1'.repeat(50))).toBe(false)
  })

  it('rejects strings with non-base58 characters', () => {
    // 0, O, I, l are not in base58
    expect(isValidBase58Pubkey('0o0o0o0o0o0o0o0o0o0o0o0o0o0o0o0o')).toBe(false)
    expect(isValidBase58Pubkey('IIIIIIIIIIIIIIIIIIIIIIIIIIIIIIII')).toBe(false)
    expect(isValidBase58Pubkey('llllllllllllllllllllllllllllllll')).toBe(false)
    expect(isValidBase58Pubkey('OOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOO')).toBe(false)
  })

  it('rejects EVM addresses (0x prefix)', () => {
    expect(isValidBase58Pubkey('0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48')).toBe(false)
  })

  it('rejects empty string', () => {
    expect(isValidBase58Pubkey('')).toBe(false)
  })
})

// Round-trip the registry-agent validation logic. Mirrors what the route does
// without needing the DB.
function validateRegistration(body: any): string[] {
  const errs: string[] = []
  const { name, tagline, description, publicKey, category } = body

  if (!name || typeof name !== 'string' || name.trim().length === 0 || name.length > 60) {
    errs.push('name required (1-60 chars)')
  }
  if (!tagline || typeof tagline !== 'string' || tagline.length > 140) {
    errs.push('tagline required (max 140 chars)')
  }
  if (!description || typeof description !== 'string' || description.length > 4000) {
    errs.push('description required (max 4000 chars)')
  }
  if (!publicKey || typeof publicKey !== 'string') {
    errs.push('publicKey required')
  } else if (!isValidBase58Pubkey(publicKey)) {
    errs.push('publicKey invalid')
  }
  const validCategories = ['trading', 'content', 'inference', 'data', 'social', 'other']
  if (category && !validCategories.includes(category)) {
    errs.push('category invalid')
  }
  return errs
}

describe('registry agent registration validation', () => {
  const valid = {
    name: 'MarketBot',
    tagline: 'Pays for market data feeds within budget',
    description: 'A specialized agent that subscribes to market data APIs.',
    publicKey: 'So11111111111111111111111111111111111111112',
    category: 'trading',
  }

  it('accepts a fully-valid registration', () => {
    expect(validateRegistration(valid)).toEqual([])
  })

  it('rejects missing name', () => {
    expect(validateRegistration({ ...valid, name: undefined })).toContain(
      'name required (1-60 chars)',
    )
  })

  it('rejects empty name', () => {
    expect(validateRegistration({ ...valid, name: '   ' })).toContain(
      'name required (1-60 chars)',
    )
  })

  it('rejects name over 60 chars', () => {
    expect(validateRegistration({ ...valid, name: 'a'.repeat(61) })).toContain(
      'name required (1-60 chars)',
    )
  })

  it('rejects tagline over 140 chars', () => {
    expect(validateRegistration({ ...valid, tagline: 'a'.repeat(141) })).toContain(
      'tagline required (max 140 chars)',
    )
  })

  it('rejects description over 4000 chars', () => {
    expect(validateRegistration({ ...valid, description: 'a'.repeat(4001) })).toContain(
      'description required (max 4000 chars)',
    )
  })

  it('rejects invalid public key', () => {
    expect(validateRegistration({ ...valid, publicKey: 'not-a-key' })).toContain(
      'publicKey invalid',
    )
  })

  it('rejects unknown category', () => {
    expect(validateRegistration({ ...valid, category: 'fishing' })).toContain('category invalid')
  })

  it('allows omitted category (defaults applied later)', () => {
    expect(validateRegistration({ ...valid, category: undefined })).toEqual([])
  })

  it('produces multiple errors when multiple fields invalid', () => {
    const errs = validateRegistration({
      name: '',
      tagline: '',
      description: '',
      publicKey: 'short',
    })
    expect(errs.length).toBeGreaterThanOrEqual(4)
  })
})
