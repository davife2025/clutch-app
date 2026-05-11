import { describe, it, expect } from 'vitest'
import { encrypt, decrypt, VaultService } from '../src/index.js'

const MASTER_KEY = 'test-master-key-do-not-use-in-prod-12345'

describe('encrypt / decrypt round-trip', () => {
  it('round-trips a Solana private key', () => {
    const key = '5J3mBbAH58CpQ3Y5RNJpUKPE62SQ5tfcvU2JpbnkeyhfsYB1Jcn4MK4iLU8zU8gqzNk'
    const blob = encrypt(key, MASTER_KEY)
    expect(decrypt(blob, MASTER_KEY)).toBe(key)
  })

  it('round-trips an EVM private key', () => {
    const key = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'
    const blob = encrypt(key, MASTER_KEY)
    expect(decrypt(blob, MASTER_KEY)).toBe(key)
  })

  it('produces different ciphertext for the same plaintext (random IV/salt)', () => {
    const key = 'secret-key-value'
    const blob1 = encrypt(key, MASTER_KEY)
    const blob2 = encrypt(key, MASTER_KEY)
    expect(blob1).not.toBe(blob2)
    // Both still decrypt correctly
    expect(decrypt(blob1, MASTER_KEY)).toBe(key)
    expect(decrypt(blob2, MASTER_KEY)).toBe(key)
  })

  it('fails to decrypt with the wrong master key', () => {
    const blob = encrypt('secret', MASTER_KEY)
    expect(() => decrypt(blob, 'wrong-key')).toThrow()
  })

  it('fails to decrypt a tampered blob', () => {
    const blob = encrypt('secret', MASTER_KEY)
    // Tamper with the last byte (which is part of the ciphertext or auth tag)
    const tampered = blob.slice(0, -2) + 'XX'
    expect(() => decrypt(tampered, MASTER_KEY)).toThrow()
  })

  it('returns a base64 string', () => {
    const blob = encrypt('test', MASTER_KEY)
    expect(blob).toMatch(/^[A-Za-z0-9+/=]+$/)
  })
})

describe('VaultService', () => {
  it('reports unconfigured when master key is empty', () => {
    const v = new VaultService('')
    expect(v.isConfigured()).toBe(false)
  })

  it('reports configured when master key is set', () => {
    const v = new VaultService(MASTER_KEY)
    expect(v.isConfigured()).toBe(true)
  })

  it('throws when encrypting without a master key', () => {
    const v = new VaultService('')
    expect(() => v.encryptKey('whatever')).toThrow(/master key/i)
  })

  it('verifies a valid blob', () => {
    const v = new VaultService(MASTER_KEY)
    const blob = v.encryptKey('my-secret-key')
    expect(v.verify(blob)).toBe(true)
  })

  it('rejects an invalid blob', () => {
    const v = new VaultService(MASTER_KEY)
    expect(v.verify('not-a-real-blob')).toBe(false)
  })

  it('rejects a blob encrypted with a different master key', () => {
    const v1 = new VaultService(MASTER_KEY)
    const v2 = new VaultService('different-master-key-for-testing-987654')
    const blob = v1.encryptKey('shared-secret')
    expect(v2.verify(blob)).toBe(false)
  })
})
