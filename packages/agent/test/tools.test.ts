import { describe, it, expect, vi } from 'vitest'
import { AGENT_TOOLS, TOOL_NAMES, ClutchToolExecutor } from '../src/index.js'

describe('agent tool definitions', () => {
  it('exposes 7 tools', () => {
    expect(AGENT_TOOLS).toHaveLength(7)
  })

  it('includes all expected tools', () => {
    expect(TOOL_NAMES).toEqual([
      'get_wallet_balance',
      'estimate_gas_fee',
      'get_token_price',
      'select_payment_wallet',
      'execute_payment',
      'quote_swap',
      'swap_tokens',
    ])
  })

  it('every tool has name + description + input_schema', () => {
    for (const tool of AGENT_TOOLS) {
      expect(tool.name).toBeTruthy()
      expect(tool.description).toBeTruthy()
      expect(tool.input_schema).toBeTruthy()
      expect(tool.input_schema.type).toBe('object')
      expect(Array.isArray(tool.input_schema.required)).toBe(true)
    }
  })

  it('every required field appears in properties', () => {
    for (const tool of AGENT_TOOLS) {
      for (const field of tool.input_schema.required) {
        expect(tool.input_schema.properties).toHaveProperty(field)
      }
    }
  })
})

describe('ClutchToolExecutor dispatch', () => {
  function buildExecutor() {
    return new ClutchToolExecutor({
      registry: {} as any,
      priceService: {
        getUsdPrice: vi.fn().mockResolvedValue(150.5),
        getBatchPrices: vi.fn().mockResolvedValue({ SOL: 150.5, USDC: 1 }),
      },
    })
  }

  it('returns error for unknown tool', async () => {
    const ex = buildExecutor()
    const result: any = await ex.execute('does_not_exist', {})
    expect(result.error).toMatch(/Unknown tool/i)
  })

  it('returns price from get_token_price', async () => {
    const ex = buildExecutor()
    const result: any = await ex.execute('get_token_price', { token: 'SOL' })
    expect(result).toEqual({ token: 'SOL', usdPrice: 150.5 })
  })

  it('rejects estimate_gas_fee for non-Solana chains', async () => {
    const ex = buildExecutor()
    const result: any = await ex.execute('estimate_gas_fee', {
      chain: 'ethereum',
      token: 'USDC',
      amount: '1',
      toAddress: '0xabc',
    })
    expect(result.error).toMatch(/Solana/i)
    expect(result.suggestion).toBeTruthy()
  })

  it('rejects execute_payment for non-Solana chains', async () => {
    const ex = buildExecutor()
    const result: any = await ex.execute('execute_payment', {
      walletId: 'wallet-1',
      chain: 'ethereum',
      token: 'USDC',
      amount: '5',
      toAddress: '0xabc',
    })
    expect(result.error).toMatch(/Solana/i)
  })

  it('rejects swap_tokens without vault config', async () => {
    const ex = new ClutchToolExecutor({
      registry: {} as any,
      priceService: {
        getUsdPrice: vi.fn(),
        getBatchPrices: vi.fn(),
      },
      // no vault, no getWalletMeta
    })
    const result: any = await ex.execute('swap_tokens', {
      walletId: 'wallet-1',
      inputToken: 'SOL',
      outputToken: 'USDC',
      amount: '1',
    })
    expect(result.error).toBeTruthy()
  })

  it('rejects swap_tokens for non-Solana wallet', async () => {
    const ex = new ClutchToolExecutor({
      registry: {} as any,
      priceService: {
        getUsdPrice: vi.fn(),
        getBatchPrices: vi.fn(),
      },
      vault: { decryptKey: vi.fn(), encryptKey: vi.fn(), isConfigured: () => true, verify: () => true } as any,
      getWalletMeta: vi.fn().mockResolvedValue({
        address: '0xabc',
        chain: 'ethereum',
        connectionType: 'custodial',
        encryptedKey: 'blob',
      }),
    })
    const result: any = await ex.execute('swap_tokens', {
      walletId: 'wallet-1',
      inputToken: 'SOL',
      outputToken: 'USDC',
      amount: '1',
    })
    expect(result.error).toMatch(/Solana/i)
  })

  it('rejects swap_tokens for walletconnect wallet', async () => {
    const ex = new ClutchToolExecutor({
      registry: {} as any,
      priceService: {
        getUsdPrice: vi.fn(),
        getBatchPrices: vi.fn(),
      },
      vault: { decryptKey: vi.fn(), encryptKey: vi.fn(), isConfigured: () => true, verify: () => true } as any,
      getWalletMeta: vi.fn().mockResolvedValue({
        address: 'SoLAddr',
        chain: 'solana',
        connectionType: 'walletconnect',
        wcSessionTopic: 'topic-1',
      }),
    })
    const result: any = await ex.execute('swap_tokens', {
      walletId: 'wallet-1',
      inputToken: 'SOL',
      outputToken: 'USDC',
      amount: '1',
    })
    expect(result.error).toMatch(/custodial/i)
    expect(result.suggestion).toBeTruthy()
  })
})
