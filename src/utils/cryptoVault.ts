const PBKDF2_ITERATIONS = 250_000;

export function toBase64(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < arr.length; i += chunkSize) {
    const chunk = arr.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

export function fromBase64(encoded: string): Uint8Array<ArrayBuffer> {
  const binary = atob(encoded);
  const buffer = new ArrayBuffer(binary.length);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export async function deriveVaultKey(
  passphrase: string,
  salt: Uint8Array<ArrayBuffer>
): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await globalThis.crypto.subtle.importKey(
    'raw',
    enc.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return globalThis.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptVaultBytes(
  passphrase: string,
  plainBytes: ArrayBuffer | Uint8Array
): Promise<{ salt: string; iv: string; cipher: string }> {
  const saltBuf = new ArrayBuffer(16);
  const salt = new Uint8Array(saltBuf);
  globalThis.crypto.getRandomValues(salt);

  const ivBuf = new ArrayBuffer(12);
  const iv = new Uint8Array(ivBuf);
  globalThis.crypto.getRandomValues(iv);

  const key = await deriveVaultKey(passphrase, salt);
  const input =
    plainBytes instanceof Uint8Array
      ? new Uint8Array(plainBytes).buffer
      : plainBytes;

  const cipherBuffer = await globalThis.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    input
  );

  return {
    salt: toBase64(salt),
    iv: toBase64(iv),
    cipher: toBase64(cipherBuffer),
  };
}

export async function decryptVaultBytes(
  passphrase: string,
  payload: { salt: string; iv: string; cipher: string }
): Promise<ArrayBuffer> {
  const salt = fromBase64(payload.salt);
  const iv = fromBase64(payload.iv);
  const cipher = fromBase64(payload.cipher);
  const key = await deriveVaultKey(passphrase, salt);
  return globalThis.crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipher);
}
