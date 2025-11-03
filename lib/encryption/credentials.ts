import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

/**
 * Encryption configuration for AES-256-GCM
 *
 * AES-256-GCM provides:
 * - Confidentiality (encryption)
 * - Authenticity (authentication tag prevents tampering)
 * - Industry standard security
 */
const ALGORITHM = 'aes-256-gcm'
const KEY_LENGTH = 32 // 256 bits
const IV_LENGTH = 12 // 96 bits (recommended for GCM)
const AUTH_TAG_LENGTH = 16 // 128 bits

/**
 * Get encryption key from environment variables
 * Key must be 32 bytes (256 bits) encoded in base64
 */
function getEncryptionKey(): Buffer {
  const key = process.env.CREDENTIALS_ENCRYPTION_KEY

  if (!key) {
    throw new Error(
      'CREDENTIALS_ENCRYPTION_KEY is not configured in environment variables. ' +
        'Generate one with: openssl rand -base64 32'
    )
  }

  try {
    const keyBuffer = Buffer.from(key, 'base64')

    if (keyBuffer.length !== KEY_LENGTH) {
      throw new Error(
        `Encryption key must be exactly ${KEY_LENGTH} bytes (256 bits). ` +
          `Current key is ${keyBuffer.length} bytes. ` +
          'Generate a new one with: openssl rand -base64 32'
      )
    }

    return keyBuffer
  } catch (error) {
    throw new Error(
      'Invalid encryption key format. Key must be base64 encoded. ' +
        'Generate one with: openssl rand -base64 32'
    )
  }
}

/**
 * Encrypt a password using AES-256-GCM
 *
 * @param password - Plain text password to encrypt
 * @returns Base64 encoded string containing: IV + encrypted data + authentication tag
 *
 * @example
 * const encrypted = encryptPassword('mySecretPassword123')
 * // Returns something like: "k3j2h1g4f5d6s7a8q9w0e1r2t3y4u5i6o7p8a9s0..."
 */
export function encryptPassword(password: string): string {
  if (!password || typeof password !== 'string') {
    throw new Error('Password must be a non-empty string')
  }

  const key = getEncryptionKey()

  // Generate a unique IV for this encryption
  // CRITICAL: Never reuse IVs with the same key
  const iv = randomBytes(IV_LENGTH)

  // Create cipher
  const cipher = createCipheriv(ALGORITHM, key, iv)

  // Encrypt the password
  const encrypted = Buffer.concat([cipher.update(password, 'utf8'), cipher.final()])

  // Get authentication tag (proves data hasn't been tampered with)
  const authTag = cipher.getAuthTag()

  // Package everything together: IV + encrypted data + auth tag
  // This format allows us to decrypt later
  const combined = Buffer.concat([iv, encrypted, authTag])

  // Return as base64 string for storage in database
  return combined.toString('base64')
}

/**
 * Decrypt a password that was encrypted with encryptPassword
 *
 * @param encryptedData - Base64 encoded encrypted password
 * @returns Decrypted plain text password
 *
 * @throws Error if data has been tampered with or encryption key is wrong
 *
 * @example
 * const decrypted = decryptPassword('k3j2h1g4f5d6s7a8q9w0e1r2t3y4u5i6o7p8a9s0...')
 * // Returns: "mySecretPassword123"
 */
export function decryptPassword(encryptedData: string): string {
  if (!encryptedData || typeof encryptedData !== 'string') {
    throw new Error('Encrypted data must be a non-empty string')
  }

  const key = getEncryptionKey()

  try {
    // Convert from base64 back to binary
    const buffer = Buffer.from(encryptedData, 'base64')

    // Extract the components
    const iv = buffer.subarray(0, IV_LENGTH)
    const authTag = buffer.subarray(buffer.length - AUTH_TAG_LENGTH)
    const encrypted = buffer.subarray(IV_LENGTH, buffer.length - AUTH_TAG_LENGTH)

    // Create decipher
    const decipher = createDecipheriv(ALGORITHM, key, iv)

    // Set authentication tag
    // If data has been tampered with, this will cause final() to throw
    decipher.setAuthTag(authTag)

    // Decrypt
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()])

    return decrypted.toString('utf8')
  } catch (error) {
    // This could mean:
    // 1. Wrong encryption key
    // 2. Data has been tampered with
    // 3. Corrupted data
    throw new Error('Failed to decrypt password. Data may be corrupted or encryption key is incorrect.')
  }
}

/**
 * Validate that encryption/decryption is working correctly
 * Used for testing and setup verification
 */
export function validateEncryption(): { success: boolean; error?: string } {
  try {
    const testPassword = 'test-password-123'
    const encrypted = encryptPassword(testPassword)
    const decrypted = decryptPassword(encrypted)

    if (decrypted !== testPassword) {
      return {
        success: false,
        error: 'Decrypted password does not match original',
      }
    }

    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
