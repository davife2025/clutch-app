import { describe, it, expect } from 'vitest'
import {
  lamportsToSol,
  solToLamports,
  rawToHuman,
  humanToRaw,
  weiToEth,
  ethToWei,
  truncateAddress,
  isValidEthAddress,
  isValidSolanaAddress,
  isValidAddress,
  formatUsdValue,
  generateId,
  LAMPORTS_PER_SOL,
  MAX_WALLETS_PER_POCKET,
  MAX_POCKETS_PER_USER,
} from '../src/index.js'

describe('lamports/SOL conversion', () => {
  it('converts whole SOL', () => {
    expect(lamportsToSol(1_000_000_000n)).toBe('1')
    expect(lamportsToSol(2_000_000_000n)).toBe('2')
  })

  it('converts fractional SOL', () => {
    expect(lamportsToSol(500_000_000n)).toBe('0.5')
    expect(lamportsToSol(1_500_000_000n)).toBe('1.5')
  })

  it('handles very small amounts', () => {
    // 1 lamport is below the 6-decimal display precision, displays as '0'
    expect(lamportsToSol(1n)).toBe('0')
    expect(lamportsToSol(5000n)).toBe('0.000005')
  })

  it('handles zero', () => {
    expect(lamportsToSol(0n)).toBe('0')
  })

  it('round-trips through solToLamports', () => {
    const cases = ['1', '0.5', '100.123456', '0.000001']
    for (const sol of cases) {
      const lamports = solToLamports(sol)
      // String representation may differ ("100.123456" vs "100.123456") but the bigint should match
      expect(solToLamports(lamportsToSol(lamports))).toBe(lamports)
    }
  })

  it('LAMPORTS_PER_SOL is correct', () => {
    expect(LAMPORTS_PER_SOL).toBe(1_000_000_000n)
  })
})

describe('humanToRaw / rawToHuman', () => {
  it('handles USDC (6 decimals)', () => {
    expect(humanToRaw('1', 6)).toBe(1_000_000n)
    expect(humanToRaw('0.5', 6)).toBe(500_000n)
    expect(rawToHuman(1_000_000n, 6)).toBe('1')
  })

  it('handles BONK (5 decimals)', () => {
    expect(humanToRaw('1', 5)).toBe(100_000n)
    expect(rawToHuman(100_000n, 5)).toBe('1')
  })
})

describe('ETH/wei conversion', () => {
  it('handles 1 ETH', () => {
    expect(weiToEth(1_000_000_000_000_000_000n)).toBe('1')
    expect(ethToWei('1')).toBe(1_000_000_000_000_000_000n)
  })

  it('handles fractional ETH', () => {
    expect(ethToWei('0.5')).toBe(500_000_000_000_000_000n)
  })
})

describe('truncateAddress', () => {
  it('truncates Solana address', () => {
    const addr = 'So11111111111111111111111111111111111111112'
    expect(truncateAddress(addr)).toBe('So1111...1112')
  })

  it('truncates EVM address', () => {
    const addr = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
    expect(truncateAddress(addr)).toBe('0xA0b8...eB48')
  })

  it('respects custom char count', () => {
    expect(truncateAddress('0xabcdef0123456789abcdef0123456789abcdef00', 6)).toBe(
      '0xabcdef...cdef00',
    )
  })

  it('handles empty', () => {
    expect(truncateAddress('')).toBe('')
  })
})

describe('address validation', () => {
  it('validates Solana addresses', () => {
    expect(isValidSolanaAddress('So11111111111111111111111111111111111111112')).toBe(true)
    expect(isValidSolanaAddress('5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d')).toBe(true)
    expect(isValidSolanaAddress('not-an-address')).toBe(false)
    expect(isValidSolanaAddress('0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48')).toBe(false)
  })

  it('validates EVM addresses', () => {
    expect(isValidEthAddress('0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48')).toBe(true)
    expect(isValidEthAddress('0x0000000000000000000000000000000000000000')).toBe(true)
    expect(isValidEthAddress('A0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48')).toBe(false) // no 0x
    expect(isValidEthAddress('0xtoo-short')).toBe(false)
  })

  it('routes by chain', () => {
    const sol = '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d'
    const eth = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
    expect(isValidAddress(sol, 'solana')).toBe(true)
    expect(isValidAddress(eth, 'ethereum')).toBe(true)
    expect(isValidAddress(sol, 'ethereum')).toBe(false)
    expect(isValidAddress(eth, 'solana')).toBe(false)
  })
})

describe('formatUsdValue', () => {
  it('formats with currency symbol and decimals', () => {
    expect(formatUsdValue(1234.5)).toBe('$1,234.50')
    expect(formatUsdValue(0)).toBe('$0.00')
    expect(formatUsdValue(0.123456)).toBe('$0.12')
  })
})

describe('generateId', () => {
  it('returns a 32-char hex string', () => {
    const id = generateId()
    expect(id).toMatch(/^[0-9a-f]{32}$/)
  })

  it('returns unique values', () => {
    const ids = new Set<string>()
    for (let i = 0; i < 100; i++) ids.add(generateId())
    expect(ids.size).toBe(100)
  })
})

describe('limits', () => {
  it('enforces 10 wallets per pocket', () => {
    expect(MAX_WALLETS_PER_POCKET).toBe(10)
  })

  it('enforces 4 pockets per user', () => {
    expect(MAX_POCKETS_PER_USER).toBe(4)
  })
})
