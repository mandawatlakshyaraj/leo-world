import test from 'node:test';
import assert from 'node:assert/strict';
import { decryptVaultBytes, encryptVaultBytes } from './cryptoVault';

test('encryptVaultBytes and decryptVaultBytes round-trip binary payload', async () => {
  const secretText = 'Eclipse secret payload 125268';
  const plain = new TextEncoder().encode(secretText);
  const encrypted = await encryptVaultBytes('correct-horse-battery-staple', plain);

  assert.ok(encrypted.salt.length > 0);
  assert.ok(encrypted.iv.length > 0);
  assert.ok(encrypted.cipher.length > 0);

  const decrypted = await decryptVaultBytes('correct-horse-battery-staple', encrypted);
  const decoded = new TextDecoder().decode(decrypted);
  assert.equal(decoded, secretText);
});

test('decryptVaultBytes rejects wrong passphrase', async () => {
  const plain = new TextEncoder().encode('classified media bytes');
  const encrypted = await encryptVaultBytes('right-passphrase-123', plain);

  await assert.rejects(() => decryptVaultBytes('wrong-passphrase-123', encrypted));
});
