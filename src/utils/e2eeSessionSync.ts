import type { LeoUser } from '../types/leo';
import { publishE2eePublicKey } from './apiClient';
import {
  decryptPrivateKeyBackup,
  generateBackupableE2eeIdentity,
} from './e2eeCrypto';
import { saveStoredE2eeIdentity } from './indexedDbStorage';

/**
 * Ensures the signed-in device holds the user's exact ECDH P-256 E2EE identity:
 * - If an encrypted key backup exists on the server, unwraps it locally using the
 *   user's password (PBKDF2-SHA-256 + AES-256-GCM) and stores the non-extractable
 *   keypair into this device's IndexedDB.
 * - If no backup exists yet (brand new account or pre-sync legacy account), generates
 *   a backupable ECDH P-256 identity, encrypts its PKCS#8 private key client-side
 *   with the user's password, uploads `{ publicKey, keyBackup }`, and persists locally.
 */
export async function syncE2eeOnPasswordAuth(
  user: LeoUser,
  password: string
): Promise<LeoUser> {
  if (typeof globalThis.crypto?.subtle === 'undefined') {
    return user;
  }

  if (user.e2eeKeyBackup) {
    const restored = await decryptPrivateKeyBackup(user.e2eeKeyBackup, password);
    await saveStoredE2eeIdentity({
      id: user.id,
      keyPair: restored.keyPair,
      publicKeySpki: restored.publicKeySpki,
      createdAt: user.e2eeKeyBackup.updatedAt || Date.now(),
    });
    if (user.e2eePublicKey !== restored.publicKeySpki) {
      return publishE2eePublicKey(restored.publicKeySpki);
    }
    return user;
  }

  const provisioned = await generateBackupableE2eeIdentity(password);
  await saveStoredE2eeIdentity({
    id: user.id,
    keyPair: provisioned.keyPair,
    publicKeySpki: provisioned.publicKeySpki,
    createdAt: provisioned.keyBackup.updatedAt,
  });
  return publishE2eePublicKey(provisioned.publicKeySpki, provisioned.keyBackup);
}
