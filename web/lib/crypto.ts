/**
 * Envelope encryption for secrets vault.
 * AES-256-GCM. Master key from env. Per-tenant key derived via HKDF.
 *
 * Format stored: base64(iv[12] + authTag[16] + ciphertext)
 */

const MASTER_KEY_HEX = process.env.SECRETS_MASTER_KEY ?? ''
const KEY_VERSION = 1

function getMasterKey(): Uint8Array {
  if (!MASTER_KEY_HEX || MASTER_KEY_HEX.length < 64) {
    throw new Error('SECRETS_MASTER_KEY env var missing or too short (need 32 bytes hex)')
  }
  const buf = Buffer.from(MASTER_KEY_HEX, 'hex')
  if (buf.length !== 32) throw new Error('SECRETS_MASTER_KEY must be exactly 32 bytes (64 hex chars)')
  return buf
}

async function deriveKey(tenantId: string): Promise<CryptoKey> {
  const enc = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey('raw', getMasterKey() as BufferSource, 'HKDF', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: enc.encode(tenantId), info: enc.encode('ct-secret-v1') },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export async function encryptSecret(tenantId: string, plaintext: string): Promise<{ encrypted: string; keyVersion: number }> {
  const key = await deriveKey(tenantId)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const enc = new TextEncoder()
  const cipherBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(plaintext))
  // cipherBuf = ciphertext + 16-byte auth tag (Web Crypto appends it)
  const combined = new Uint8Array(iv.byteLength + cipherBuf.byteLength)
  combined.set(iv, 0)
  combined.set(new Uint8Array(cipherBuf), iv.byteLength)
  return { encrypted: Buffer.from(combined).toString('base64'), keyVersion: KEY_VERSION }
}

export async function decryptSecret(tenantId: string, encrypted: string): Promise<string> {
  const key = await deriveKey(tenantId)
  const combined = Buffer.from(encrypted, 'base64')
  const iv = combined.subarray(0, 12)
  const ciphertext = combined.subarray(12)
  const plainBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext)
  return new TextDecoder().decode(plainBuf)
}
