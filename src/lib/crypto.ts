import { webcrypto } from 'crypto';

const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;
const IV_LENGTH = 12; // 96 bits for GCM

/**
 * Derives a CryptoKey from the encryption secret in env
 */
async function getKey(): Promise<CryptoKey> {
  const secret = process.env.ENCRYPTION_SECRET;
  if (!secret) {
    throw new Error('ENCRYPTION_SECRET is not set');
  }

  // Hash the secret to get a consistent 256-bit key
  const encoder = new TextEncoder();
  const keyMaterial = await webcrypto.subtle.digest('SHA-256', encoder.encode(secret));

  return webcrypto.subtle.importKey(
    'raw',
    keyMaterial,
    { name: ALGORITHM, length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypts plaintext using AES-256-GCM
 * @param plaintext - The text to encrypt
 * @returns Base64-encoded string: "iv:ciphertext"
 */
export async function encrypt(plaintext: string): Promise<string> {
  const key = await getKey();
  const encoder = new TextEncoder();
  const data = encoder.encode(plaintext);

  // Generate random IV
  const iv = webcrypto.getRandomValues(new Uint8Array(IV_LENGTH));

  const ciphertext = await webcrypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    key,
    data
  );

  // Combine iv and ciphertext: "base64(iv):base64(ciphertext)"
  const ivB64 = Buffer.from(iv).toString('base64');
  const ciphertextB64 = Buffer.from(ciphertext).toString('base64');

  return `${ivB64}:${ciphertextB64}`;
}

/**
 * Decrypts a value encrypted with encrypt()
 * @param encrypted - Base64-encoded string: "iv:ciphertext"
 * @returns The original plaintext
 */
export async function decrypt(encrypted: string): Promise<string> {
  const key = await getKey();
  const [ivB64, ciphertextB64] = encrypted.split(':');

  if (!ivB64 || !ciphertextB64) {
    throw new Error('Invalid encrypted format');
  }

  const iv = Buffer.from(ivB64, 'base64');
  const ciphertext = Buffer.from(ciphertextB64, 'base64');

  const decrypted = await webcrypto.subtle.decrypt(
    { name: ALGORITHM, iv },
    key,
    ciphertext
  );

  const decoder = new TextDecoder();
  return decoder.decode(decrypted);
}
