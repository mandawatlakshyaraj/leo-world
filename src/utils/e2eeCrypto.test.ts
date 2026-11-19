import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeSafetyNumber,
  decryptDirectPayload,
  decryptGroupPayload,
  decryptPrivateKeyBackup,
  encryptDirectPayload,
  encryptGroupPayload,
  generateBackupableE2eeIdentity,
  generateE2eeKeyPair,
} from './e2eeCrypto';

test('ECDH P-256 + AES-256-GCM encrypts and decrypts DM messages for both sender and recipient only', async () => {
  const alice = await generateE2eeKeyPair();
  const bob = await generateE2eeKeyPair();
  const eve = await generateE2eeKeyPair();

  const envelope = await encryptDirectPayload(
    alice.keyPair.privateKey,
    alice.publicKeySpki,
    bob.publicKeySpki,
    'alice',
    'bob',
    { text: 'Top secret mission dispatch', replyPreview: 'Earlier note' }
  );

  // Server never receives plaintext
  assert.equal(envelope.alg, 'ECDH-P256-AES-256-GCM');
  assert.ok(!envelope.ciphertext.includes('Top secret'));

  // Bob decrypts with his private key
  const bobPlain = await decryptDirectPayload(
    bob.keyPair.privateKey,
    bob.publicKeySpki,
    'alice',
    'bob',
    envelope
  );
  assert.equal(bobPlain.text, 'Top secret mission dispatch');
  assert.equal(bobPlain.replyPreview, 'Earlier note');

  // Alice can also decrypt her own sent message from history
  const alicePlain = await decryptDirectPayload(
    alice.keyPair.privateKey,
    alice.publicKeySpki,
    'alice',
    'bob',
    envelope
  );
  assert.equal(alicePlain.text, 'Top secret mission dispatch');

  // Eavesdropper cannot decrypt
  await assert.rejects(() =>
    decryptDirectPayload(eve.keyPair.privateKey, eve.publicKeySpki, 'alice', 'bob', envelope)
  );
});

test('Group E2EE wraps per-message AES-256-GCM key per member and rejects outsiders', async () => {
  const alice = await generateE2eeKeyPair();
  const bob = await generateE2eeKeyPair();
  const charlie = await generateE2eeKeyPair();

  const envelope = await encryptGroupPayload(
    alice.keyPair.privateKey,
    alice.publicKeySpki,
    [
      { id: 'alice', publicKeySpki: alice.publicKeySpki },
      { id: 'bob', publicKeySpki: bob.publicKeySpki },
    ],
    { text: 'Night Owls encrypted broadcast' }
  );

  const bobRead = await decryptGroupPayload(
    'bob',
    bob.keyPair.privateKey,
    bob.publicKeySpki,
    envelope
  );
  assert.equal(bobRead.text, 'Night Owls encrypted broadcast');

  const aliceRead = await decryptGroupPayload(
    'alice',
    alice.keyPair.privateKey,
    alice.publicKeySpki,
    envelope
  );
  assert.equal(aliceRead.text, 'Night Owls encrypted broadcast');

  await assert.rejects(() =>
    decryptGroupPayload('charlie', charlie.keyPair.privateKey, charlie.publicKeySpki, envelope)
  );
});

test('Safety Numbers match symmetrically for both peers and change if key changes', async () => {
  const alice = await generateE2eeKeyPair();
  const bob = await generateE2eeKeyPair();
  const bobNew = await generateE2eeKeyPair();

  const fromAlice = await computeSafetyNumber('alice', alice.publicKeySpki, 'bob', bob.publicKeySpki);
  const fromBob = await computeSafetyNumber('bob', bob.publicKeySpki, 'alice', alice.publicKeySpki);

  assert.equal(fromAlice.length, 12);
  assert.deepEqual(fromAlice, fromBob);

  const afterKeyChange = await computeSafetyNumber(
    'alice',
    alice.publicKeySpki,
    'bob',
    bobNew.publicKeySpki
  );
  assert.notDeepEqual(fromAlice, afterKeyChange);
});

test('Zero-knowledge password-wrapped backup restores exact keypair across phones and rejects wrong passwords', async () => {
  const aliceDevice1 = await generateBackupableE2eeIdentity('my-secret-pass-99');
  const bob = await generateE2eeKeyPair();

  // Runtime privateKey handle is non-extractable
  assert.equal(aliceDevice1.keyPair.privateKey.extractable, false);

  // Encrypt a message on Device 1
  const envelope = await encryptDirectPayload(
    bob.keyPair.privateKey,
    bob.publicKeySpki,
    aliceDevice1.publicKeySpki,
    'bob',
    'alice',
    { text: 'Synced across devices without server knowing the key!' }
  );

  // Wrong password fails cleanly
  await assert.rejects(() =>
    decryptPrivateKeyBackup(aliceDevice1.keyBackup, 'wrong-password-123')
  );

  // Device 2 restores from backup using ID password
  const aliceDevice2 = await decryptPrivateKeyBackup(
    aliceDevice1.keyBackup,
    'my-secret-pass-99'
  );
  assert.equal(aliceDevice2.publicKeySpki, aliceDevice1.publicKeySpki);
  assert.equal(aliceDevice2.keyPair.privateKey.extractable, false);

  // Device 2 decrypts old message seamlessly & keeps identical safety number
  const decryptedOnPhone2 = await decryptDirectPayload(
    aliceDevice2.keyPair.privateKey,
    aliceDevice2.publicKeySpki,
    'bob',
    'alice',
    envelope
  );
  assert.equal(decryptedOnPhone2.text, 'Synced across devices without server knowing the key!');

  const sn1 = await computeSafetyNumber('alice', aliceDevice1.publicKeySpki, 'bob', bob.publicKeySpki);
  const sn2 = await computeSafetyNumber('alice', aliceDevice2.publicKeySpki, 'bob', bob.publicKeySpki);
  assert.deepEqual(sn1, sn2);
});
