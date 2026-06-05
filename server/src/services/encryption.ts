import crypto from 'crypto'

const KEY: Buffer = (() => {
  const raw = process.env.PAUL_SECRET_KEY ?? 'insecure_default_do_not_use_in_production'
  return crypto.scryptSync(raw, 'paul_salt', 32) as Buffer
})()

/**
 * Encrypts a plaintext string using AES-256-GCM.
 * @returns Colon-delimited hex string: `iv:authTag:ciphertext`
 */
export function encryptValue(value: string): string {
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv('aes-256-gcm', KEY, iv)
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted.toString('hex')
}

/** Decrypts a value produced by `encryptValue`. Throws if tampered or key mismatch. */
export function decryptValue(stored: string): string {
  const parts = stored.split(':')
  const iv = Buffer.from(parts[0], 'hex')
  const authTag = Buffer.from(parts[1], 'hex')
  const ciphertext = Buffer.from(parts[2], 'hex')
  const decipher = crypto.createDecipheriv('aes-256-gcm', KEY, iv)
  decipher.setAuthTag(authTag)
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
}
