import type { EncryptedVaultRecord, GlimpseMediaItem } from '../types/leo';

const ECLIPSE_DB = 'leoWorldEclipseVault_v2';
const GLIMPSES_DB = 'leoWorldGlimpses_v2';

function openDb(dbName: string, storeName: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(dbName, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(storeName)) {
        db.createObjectStore(storeName, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getEclipseRecords(): Promise<EncryptedVaultRecord[]> {
  const db = await openDb(ECLIPSE_DB, 'items');
  return new Promise((resolve, reject) => {
    const tx = db.transaction('items', 'readonly');
    const req = tx.objectStore('items').getAll();
    req.onsuccess = () =>
      resolve(((req.result as EncryptedVaultRecord[]) || []).sort((a, b) => b.createdAt - a.createdAt));
    req.onerror = () => reject(req.error);
  });
}

export async function putEclipseRecord(record: EncryptedVaultRecord): Promise<void> {
  const db = await openDb(ECLIPSE_DB, 'items');
  return new Promise((resolve, reject) => {
    const tx = db.transaction('items', 'readwrite');
    tx.objectStore('items').put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function deleteEclipseRecord(id: string): Promise<void> {
  const db = await openDb(ECLIPSE_DB, 'items');
  return new Promise((resolve, reject) => {
    const tx = db.transaction('items', 'readwrite');
    tx.objectStore('items').delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getGlimpseItems(): Promise<GlimpseMediaItem[]> {
  const db = await openDb(GLIMPSES_DB, 'media');
  return new Promise((resolve, reject) => {
    const tx = db.transaction('media', 'readonly');
    const req = tx.objectStore('media').getAll();
    req.onsuccess = () =>
      resolve(((req.result as GlimpseMediaItem[]) || []).sort((a, b) => b.createdAt - a.createdAt));
    req.onerror = () => reject(req.error);
  });
}

export async function putGlimpseItem(item: GlimpseMediaItem): Promise<void> {
  const db = await openDb(GLIMPSES_DB, 'media');
  return new Promise((resolve, reject) => {
    const tx = db.transaction('media', 'readwrite');
    tx.objectStore('media').put(item);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function deleteGlimpseItem(id: string): Promise<void> {
  const db = await openDb(GLIMPSES_DB, 'media');
  return new Promise((resolve, reject) => {
    const tx = db.transaction('media', 'readwrite');
    tx.objectStore('media').delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

const E2EE_KEYS_DB = 'leoWorldE2eeKeys_v1';

export interface StoredE2eeIdentityRecord {
  id: string;
  keyPair: CryptoKeyPair;
  publicKeySpki: string;
  createdAt: number;
}

export async function getStoredE2eeIdentity(
  userId: string
): Promise<StoredE2eeIdentityRecord | null> {
  const db = await openDb(E2EE_KEYS_DB, 'keys');
  return new Promise((resolve, reject) => {
    const tx = db.transaction('keys', 'readonly');
    const req = tx.objectStore('keys').get(userId);
    req.onsuccess = () => resolve((req.result as StoredE2eeIdentityRecord) || null);
    req.onerror = () => reject(req.error);
  });
}

export async function saveStoredE2eeIdentity(
  record: StoredE2eeIdentityRecord
): Promise<void> {
  const db = await openDb(E2EE_KEYS_DB, 'keys');
  return new Promise((resolve, reject) => {
    const tx = db.transaction('keys', 'readwrite');
    tx.objectStore('keys').put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
