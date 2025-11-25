import { webcrypto } from 'crypto';

const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;
const IV_LENGTH = 12; // 96 bits for GCM
const MIN_SECRET_LENGTH = 32; // Minimum 32 characters for adequate entropy

// Cache the derived key to avoid re-derivation on every operation
let cachedKey: CryptoKey | null = null;

/**
 * Validates the encryption secret for adequate strength
 */
function validateSecret(secret: string): void {
  // Validate minimum length (32 characters minimum for 256-bit entropy)
  if (secret.length < MIN_SECRET_LENGTH) {
    throw new Error(
      `ENCRYPTION_SECRET must be at least ${MIN_SECRET_LENGTH} characters long (current: ${secret.length})`
    );
  }

  // Warn about weak secrets (optional but recommended)
  if (process.env.NODE_ENV !== 'production') {
    if (/^[a-zA-Z0-9]{32,}$/.test(secret)) {
      console.warn('[crypto] WARNING: ENCRYPTION_SECRET should include special characters for better entropy');
    }
    if (/^(.)\1+$/.test(secret)) {
      console.warn('[crypto] WARNING: ENCRYPTION_SECRET should not be repetitive');
    }
  }
}

/**
 * Derives a CryptoKey from the encryption secret in env
 */
async function getKey(): Promise<CryptoKey> {
  // Return cached key if available
  if (cachedKey) {
    return cachedKey;
  }

  const secret = process.env.ENCRYPTION_SECRET;
  if (!secret) {
    throw new Error('ENCRYPTION_SECRET is not set');
  }

  // Validate secret strength
  validateSecret(secret);

  // Hash the secret to get a consistent 256-bit key
  const encoder = new TextEncoder();
  const keyMaterial = await webcrypto.subtle.digest('SHA-256', encoder.encode(secret));

  cachedKey = await webcrypto.subtle.importKey(
    'raw',
    keyMaterial,
    { name: ALGORITHM, length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  ) as unknown as CryptoKey;

  return cachedKey;
}

// Startup validation in production
if (typeof process !== 'undefined' && process.env.NODE_ENV === 'production') {
  const secret = process.env.ENCRYPTION_SECRET;
  if (!secret) {
    throw new Error('ENCRYPTION_SECRET must be set in production');
  }
  if (secret.length < MIN_SECRET_LENGTH) {
    throw new Error(
      `ENCRYPTION_SECRET must be at least ${MIN_SECRET_LENGTH} characters in production (current: ${secret.length})`
    );
  }
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
