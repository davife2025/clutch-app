import { encrypt, decrypt } from './crypto.js'

/**
 * VaultService — encrypts and decrypts private keys for custodial wallets.
 *
 * The master key is read from VAULT_MASTER_KEY env var.
 * In production this should come from an HSM, KMS, or secrets manager.
 *
 * Flow:
 *   1. User imports a private key → vault.encryptKey(privateKey) → base64 blob
 *   2. Blob stored in wallets.encrypted_key column
 *   3. When agent needs to sign → vault.decryptKey(blob) → private key → sign → forget
 */
export class VaultService {
  private masterKey: string

  constructor(masterKey?: string) {
    this.masterKey = masterKey ?? process.env.VAULT_MASTER_KEY ?? ''
    if (!this.masterKey) {
      console.warn('[vault] VAULT_MASTER_KEY not set — encryption will fail at runtime')
    }
  }

  /** Encrypt a private key for storage. Returns a base64 blob. */
  encryptKey(privateKey: string): string {
    if (!this.masterKey) throw new Error('Vault master key not configured')
    return encrypt(privateKey, this.masterKey)
  }

  /** Decrypt a stored key blob back to the raw private key. */
  decryptKey(encryptedBlob: string): string {
    if (!this.masterKey) throw new Error('Vault master key not configured')
    return decrypt(encryptedBlob, this.masterKey)
  }

  /** Check if the vault is configured and functional. */
  isConfigured(): boolean {
    return this.masterKey.length > 0
  }

  /** Verify a blob can be decrypted (without returning the key). */
  verify(encryptedBlob: string): boolean {
    try {
      this.decryptKey(encryptedBlob)
      return true
    } catch {
      return false
    }
  }
}

export const vaultService = new VaultService()
