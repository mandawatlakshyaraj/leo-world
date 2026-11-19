import type {
  E2eeDmEnvelope,
  E2eeEncryptedKeyBackup,
  E2eeGroupEnvelope,
} from '../types/leo';
import { fromBase64, toBase64 } from './cryptoVault';

export interface E2eeIdentity {
  userId: string;
  keyPair: CryptoKeyPair;
  publicKeySpki: string;
  createdAt: number;
}

export interface PlainMessageContent {
  text: string;
  mediaDataUrl?: string;
  mediaType?: 'image' | 'video';
  replyPreview?: string;
}

const DM_CONTEXT_PREFIX = 'leo-world-e2ee-dm-v1';
const GROUP_WRAP_CONTEXT = 'leo-world-e2ee-group-wrap-v1';
const KEY_BACKUP_ITERATIONS = 250_000;
const KEY_BACKUP_AAD_PREFIX = 'leo-world-e2ee-key-backup-v1:';

export async function generateE2eeKeyPair(): Promise<{
  keyPair: CryptoKeyPair;
  publicKeySpki: string;
}> {
  const keyPair = await globalThis.crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    ['deriveBits']
  );
  const spkiBuffer = await globalThis.crypto.subtle.exportKey('spki', keyPair.publicKey);
  return {
    keyPair,
    publicKeySpki: toBase64(spkiBuffer),
  };
}

async function deriveKeyBackupWrappingKey(
  password: string,
  salt: Uint8Array<ArrayBuffer>,
  iterations: number
): Promise<CryptoKey> {
  const keyMaterial = await globalThis.crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return globalThis.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptPrivateKeyBackup(
  pkcs8Bytes: ArrayBuffer,
  publicKeySpki: string,
  password: string,
  iterations = KEY_BACKUP_ITERATIONS
): Promise<E2eeEncryptedKeyBackup> {
  const saltBuf = new ArrayBuffer(16);
  const salt = new Uint8Array(saltBuf);
  globalThis.crypto.getRandomValues(salt);

  const ivBuf = new ArrayBuffer(12);
  const iv = new Uint8Array(ivBuf);
  globalThis.crypto.getRandomValues(iv);

  const wrapKey = await deriveKeyBackupWrappingKey(password, salt, iterations);
  const aad = new TextEncoder().encode(`${KEY_BACKUP_AAD_PREFIX}${publicKeySpki}`);
  const cipherBuf = await globalThis.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: aad },
    wrapKey,
    pkcs8Bytes
  );

  return {
    v: 1,
    alg: 'PBKDF2-SHA256-AES-256-GCM',
    iterations,
    salt: toBase64(salt),
    iv: toBase64(iv),
    ciphertext: toBase64(cipherBuf),
    publicKeySpki,
    updatedAt: Date.now(),
  };
}

export async function decryptPrivateKeyBackup(
  backup: E2eeEncryptedKeyBackup,
  password: string
): Promise<{
  keyPair: CryptoKeyPair;
  publicKeySpki: string;
}> {
  if (
    backup.v !== 1 ||
    backup.alg !== 'PBKDF2-SHA256-AES-256-GCM' ||
    backup.iterations < 100_000
  ) {
    throw new Error('Unsupported encrypted key backup format.');
  }

  const salt = fromBase64(backup.salt);
  const iv = fromBase64(backup.iv);
  const cipher = fromBase64(backup.ciphertext);
  const wrapKey = await deriveKeyBackupWrappingKey(password, salt, backup.iterations);
  const aad = new TextEncoder().encode(`${KEY_BACKUP_AAD_PREFIX}${backup.publicKeySpki}`);

  let pkcs8Buf: ArrayBuffer;
  try {
    pkcs8Buf = await globalThis.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv, additionalData: aad },
      wrapKey,
      cipher
    );
  } catch {
    throw new Error('Could not unlock encrypted key backup with that password.');
  }

  // Re-import restored private key as non-extractable for local IndexedDB safety
  const privateKey = await globalThis.crypto.subtle.importKey(
    'pkcs8',
    pkcs8Buf,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    ['deriveBits']
  );
  const publicKey = await globalThis.crypto.subtle.importKey(
    'spki',
    fromBase64(backup.publicKeySpki),
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    []
  );

  return {
    keyPair: { publicKey, privateKey },
    publicKeySpki: backup.publicKeySpki,
  };
}

export async function generateBackupableE2eeIdentity(password: string): Promise<{
  keyPair: CryptoKeyPair;
  publicKeySpki: string;
  keyBackup: E2eeEncryptedKeyBackup;
}> {
  const tempPair = await globalThis.crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits']
  );
  const [spkiBuf, pkcs8Buf] = await Promise.all([
    globalThis.crypto.subtle.exportKey('spki', tempPair.publicKey),
    globalThis.crypto.subtle.exportKey('pkcs8', tempPair.privateKey),
  ]);
  const publicKeySpki = toBase64(spkiBuf);
  const keyBackup = await encryptPrivateKeyBackup(pkcs8Buf, publicKeySpki, password);

  // Store a non-extractable runtime handle in IndexedDB so XSS cannot export raw bytes later
  const nonExtractablePrivateKey = await globalThis.crypto.subtle.importKey(
    'pkcs8',
    pkcs8Buf,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    ['deriveBits']
  );

  return {
    keyPair: {
      publicKey: tempPair.publicKey,
      privateKey: nonExtractablePrivateKey,
    },
    publicKeySpki,
    keyBackup,
  };
}

export async function importPublicKeySpki(spkiBase64: string): Promise<CryptoKey> {
  const bytes = fromBase64(spkiBase64);
  return globalThis.crypto.subtle.importKey(
    'spki',
    bytes,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    []
  );
}

async function deriveSharedAesKey(
  myPrivateKey: CryptoKey,
  peerPublicKeySpki: string,
  infoString: string
): Promise<CryptoKey> {
  const peerPubKey = await importPublicKeySpki(peerPublicKeySpki);
  const sharedBits = await globalThis.crypto.subtle.deriveBits(
    { name: 'ECDH', public: peerPubKey },
    myPrivateKey,
    256
  );

  const hkdfKey = await globalThis.crypto.subtle.importKey(
    'raw',
    sharedBits,
    'HKDF',
    false,
    ['deriveKey']
  );

  const enc = new TextEncoder();
  return globalThis.crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: enc.encode('leo-world-hkdf-salt-v1'),
      info: enc.encode(infoString),
    },
    hkdfKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

function canonicalPairInfo(userA: string, userB: string): string {
  const sorted = [userA.toLowerCase(), userB.toLowerCase()].sort();
  return `${DM_CONTEXT_PREFIX}:${sorted[0]}:${sorted[1]}`;
}

export async function encryptDirectPayload(
  myPrivateKey: CryptoKey,
  myPublicKeySpki: string,
  recipientPublicKeySpki: string,
  senderId: string,
  recipientId: string,
  payload: PlainMessageContent
): Promise<E2eeDmEnvelope> {
  const sharedKey = await deriveSharedAesKey(
    myPrivateKey,
    recipientPublicKeySpki,
    canonicalPairInfo(senderId, recipientId)
  );

  const ivBuf = new ArrayBuffer(12);
  const iv = new Uint8Array(ivBuf);
  globalThis.crypto.getRandomValues(iv);

  const encoded = new TextEncoder().encode(JSON.stringify(payload));
  const cipherBuf = await globalThis.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    sharedKey,
    encoded
  );

  return {
    v: 1,
    alg: 'ECDH-P256-AES-256-GCM',
    iv: toBase64(iv),
    ciphertext: toBase64(cipherBuf),
    senderPublicKey: myPublicKeySpki,
    recipientPublicKey: recipientPublicKeySpki,
  };
}

export async function decryptDirectPayload(
  myPrivateKey: CryptoKey,
  myPublicKeySpki: string,
  senderId: string,
  recipientId: string,
  envelope: E2eeDmEnvelope
): Promise<PlainMessageContent> {
  let peerPubKey: string;
  if (myPublicKeySpki === envelope.senderPublicKey) {
    peerPubKey = envelope.recipientPublicKey;
  } else if (myPublicKeySpki === envelope.recipientPublicKey) {
    peerPubKey = envelope.senderPublicKey;
  } else {
    throw new Error('Encrypted with a different device key');
  }

  const sharedKey = await deriveSharedAesKey(
    myPrivateKey,
    peerPubKey,
    canonicalPairInfo(senderId, recipientId)
  );

  const iv = fromBase64(envelope.iv);
  const cipher = fromBase64(envelope.ciphertext);
  const plainBuf = await globalThis.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    sharedKey,
    cipher
  );
  const json = new TextDecoder().decode(plainBuf);
  return JSON.parse(json) as PlainMessageContent;
}

export async function encryptGroupPayload(
  myPrivateKey: CryptoKey,
  myPublicKeySpki: string,
  recipients: { id: string; publicKeySpki: string }[],
  payload: PlainMessageContent
): Promise<E2eeGroupEnvelope> {
  const msgKey = await globalThis.crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );

  const ivBuf = new ArrayBuffer(12);
  const iv = new Uint8Array(ivBuf);
  globalThis.crypto.getRandomValues(iv);

  const encoded = new TextEncoder().encode(JSON.stringify(payload));
  const cipherBuf = await globalThis.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    msgKey,
    encoded
  );

  const rawMsgKey = await globalThis.crypto.subtle.exportKey('raw', msgKey);
  const wrappedKeys: E2eeGroupEnvelope['wrappedKeys'] = {};

  for (const r of recipients) {
    const pairKey = await deriveSharedAesKey(
      myPrivateKey,
      r.publicKeySpki,
      GROUP_WRAP_CONTEXT
    );
    const wrapIvBuf = new ArrayBuffer(12);
    const wrapIv = new Uint8Array(wrapIvBuf);
    globalThis.crypto.getRandomValues(wrapIv);
    const wrappedBuf = await globalThis.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: wrapIv },
      pairKey,
      rawMsgKey
    );
    wrappedKeys[r.id] = {
      iv: toBase64(wrapIv),
      wrappedKey: toBase64(wrappedBuf),
      recipientPublicKey: r.publicKeySpki,
    };
  }

  return {
    v: 1,
    alg: 'ECDH-P256-AES-256-GCM-GROUP',
    iv: toBase64(iv),
    ciphertext: toBase64(cipherBuf),
    senderPublicKey: myPublicKeySpki,
    wrappedKeys,
  };
}

export async function decryptGroupPayload(
  myUserId: string,
  myPrivateKey: CryptoKey,
  myPublicKeySpki: string,
  envelope: E2eeGroupEnvelope
): Promise<PlainMessageContent> {
  const entry = envelope.wrappedKeys[myUserId];
  if (!entry) {
    throw new Error('No key wrapped for this member');
  }
  if (entry.recipientPublicKey !== myPublicKeySpki) {
    throw new Error('Encrypted for a previous device key');
  }

  const pairKey = await deriveSharedAesKey(
    myPrivateKey,
    envelope.senderPublicKey,
    GROUP_WRAP_CONTEXT
  );
  const rawMsgKeyBuf = await globalThis.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64(entry.iv) },
    pairKey,
    fromBase64(entry.wrappedKey)
  );
  const msgKey = await globalThis.crypto.subtle.importKey(
    'raw',
    rawMsgKeyBuf,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );

  const plainBuf = await globalThis.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64(envelope.iv) },
    msgKey,
    fromBase64(envelope.ciphertext)
  );
  const json = new TextDecoder().decode(plainBuf);
  return JSON.parse(json) as PlainMessageContent;
}

/**
 * Computes a WhatsApp-style deterministic 60-digit Safety Number (12 groups of 5 digits)
 * from both parties' identity IDs and ECDH P-256 public keys.
 */
export async function computeSafetyNumber(
  userA: string,
  pubA: string,
  userB: string,
  pubB: string
): Promise<string[]> {
  const entries = [`${userA.toLowerCase()}:${pubA}`, `${userB.toLowerCase()}:${pubB}`].sort();
  const data = new TextEncoder().encode(entries.join('|'));
  const digest = await globalThis.crypto.subtle.digest('SHA-256', data);
  const bytes = new Uint8Array(digest);

  // Produce 12 deterministic 5-digit blocks (60 digits total)
  const blocks: string[] = [];
  for (let i = 0; i < 12; i++) {
    const b0 = bytes[(i * 2) % bytes.length];
    const b1 = bytes[(i * 2 + 1) % bytes.length];
    const b2 = bytes[(i * 3 + 7) % bytes.length];
    const num = ((b0 << 16) | (b1 << 8) | b2) % 100_000;
    blocks.push(String(num).padStart(5, '0'));
  }
  return blocks;
}
