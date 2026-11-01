// Security-critical: key derivation and authenticated encryption.
// - PBKDF2-SHA-256 with a random 16-byte salt and a high iteration count turns the
//   passphrase into a 256-bit AES-GCM key. The key is NON-extractable: page code can
//   use it but can never read its bytes.
// - Every encryption uses a fresh random 12-byte IV (never reused with the same key).
// - Optional "additional authenticated data" (AAD) binds a ciphertext to its record
//   location, so encrypted records cannot be silently swapped between slots.
// Nothing here logs plaintext, keys or passphrases.

/** OWASP (2023+) recommendation for PBKDF2-HMAC-SHA256. */
export const PBKDF2_ITERATIONS = 600_000;
export const SALT_BYTES = 16;
export const IV_BYTES = 12;

export interface Sealed {
  /** base64 IV */
  iv: string;
  /** base64 ciphertext (includes the GCM auth tag) */
  ct: string;
}

const enc = new TextEncoder();
const dec = new TextDecoder();

export function randomBytes(n: number): Uint8Array<ArrayBuffer> {
  return crypto.getRandomValues(new Uint8Array(n));
}

export function toB64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]!);
  return btoa(s);
}

export function fromB64(b64: string): Uint8Array<ArrayBuffer> {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

/** Derive a non-extractable AES-GCM-256 key from a passphrase. */
export async function deriveKey(
  passphrase: string,
  salt: Uint8Array<ArrayBuffer>,
  iterations: number = PBKDF2_ITERATIONS,
): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey("raw", enc.encode(passphrase.normalize("NFC")), "PBKDF2", false, [
    "deriveKey",
  ]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

/** Encrypt any JSON-serialisable value. */
export async function encryptJson(key: CryptoKey, value: unknown, aad?: string): Promise<Sealed> {
  const iv = randomBytes(IV_BYTES);
  const params: AesGcmParams = { name: "AES-GCM", iv };
  if (aad) params.additionalData = enc.encode(aad);
  const ct = await crypto.subtle.encrypt(params, key, enc.encode(JSON.stringify(value)));
  return { iv: toB64(iv), ct: toB64(new Uint8Array(ct)) };
}

/**
 * Decrypt a sealed value. Throws if the key is wrong, the data was tampered with,
 * or the AAD does not match — callers must treat any throw as "cannot open".
 */
export async function decryptJson<T = unknown>(key: CryptoKey, sealed: Sealed, aad?: string): Promise<T> {
  const params: AesGcmParams = { name: "AES-GCM", iv: fromB64(sealed.iv) };
  if (aad) params.additionalData = enc.encode(aad);
  const pt = await crypto.subtle.decrypt(params, key, fromB64(sealed.ct));
  return JSON.parse(dec.decode(pt)) as T;
}
