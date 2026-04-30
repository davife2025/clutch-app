import { randomBytes, createCipheriv, createDecipheriv, scryptSync } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16
const AUTH_TAG_LENGTH = 16
const SALT_LENGTH = 32
const KEY_LENGTH = 32

/**
 * Derive a 256-bit key from a master password using scrypt.
 * In production, swap scrypt for Argon2id when native bindings are available.
 */
export function deriveKey(masterKey: string, salt: Buffer): Buffer {
  return scryptSync(masterKey, salt, KEY_LENGTH, {
    N: 16384,
    r: 8,
    p: 1,
  })
}

/**
 * Encrypt plaintext using AES-256-GCM.
 *
 * Returns a single base64 string: salt(32) + iv(16) + authTag(16) + ciphertext
 * All the material needed to decrypt is packed into one blob.
 */
export function encrypt(plaintext: string, masterKey: string): string {
  const salt = randomBytes(SALT_LENGTH)
  const key = deriveKey(masterKey, salt)
  const iv = randomBytes(IV_LENGTH)

  const cipher = createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()

  // Pack: salt + iv + authTag + ciphertext
  const packed = Buffer.concat([salt, iv, authTag, encrypted])
  return packed.toString('base64')
}

/**
 * Decrypt a blob produced by encrypt().
 */
export function decrypt(blob: string, masterKey: string): string {
  const packed = Buffer.from(blob, 'base64')

  const salt = packed.subarray(0, SALT_LENGTH)
  const iv = packed.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH)
  const authTag = packed.subarray(
    SALT_LENGTH + IV_LENGTH,
    SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH,
  )
  const ciphertext = packed.subarray(SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH)

  const key = deriveKey(masterKey, salt)
  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)

  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()])
  return decrypted.toString('utf8')
}
