import test from 'node:test';
import assert from 'node:assert/strict';
import { LeoStore, type SupabaseStateClient } from './store.ts';

test('LeoStore registers, updates profile, creates feed posts with likes/comments/bookmarks', () => {
  const store = new LeoStore(null);

  const reg = store.register('nova_42', 'supersecret99');
  assert.equal(reg.user.id, 'nova_42');
  assert.ok(reg.token.length > 10);

  const login = store.login('nova_42', 'supersecret99');
  assert.equal(login.user.id, 'nova_42');

  const updated = store.updateProfile('nova_42', {
    displayName: 'Nova Starlight',
    bio: 'Building private channels',
    status: 'In the studio',
  });
  assert.equal(updated.displayName, 'Nova Starlight');
  assert.equal(updated.bio, 'Building private channels');

  const post = store.createPost('nova_42', {
    caption: 'Hello Leo Feed!',
    location: 'Observatory',
    visibility: 'friends',
  });
  assert.equal(post.authorName, 'Nova Starlight');
  assert.ok(store.getPosts('nova_42').some((p) => p.id === post.id));

  const likeRes = store.togglePostLike('astra_07', post.id);
  assert.ok(likeRes.post.likes.includes('astra_07'));
  assert.ok(likeRes.notification);
  assert.equal(likeRes.notification?.userId, 'nova_42');

  const bookmarked = store.togglePostBookmark('nova_42', post.id);
  assert.ok(bookmarked.bookmarks.includes('nova_42'));

  const commented = store.addPostComment('astra_07', post.id, 'Great shot!');
  assert.equal(commented.post.comments.length, 1);
  assert.equal(commented.post.comments[0].text, 'Great shot!');

  const profileView = store.getProfileView('astra_07', 'nova_42');
  assert.equal(profileView.postsCount, 1);
  assert.equal(profileView.totalLikes, 1);
});

test('LeoStore handles stories views, reactions, replies, vanishing snaps, read receipts, and groups', () => {
  const store = new LeoStore(null);
  store.register('nova_42', 'supersecret99');

  // Story view + reaction + reply -> DM
  const story = store.createStory('nova_42', { text: 'First patrol log', visibility: 'friends' });
  const viewed = store.markStoryViewed('astra_07', story.id);
  assert.ok(viewed?.viewedBy.includes('astra_07'));

  const reacted = store.reactToStory('astra_07', story.id, '🔥');
  assert.equal(reacted.reactions.length, 1);
  assert.equal(reacted.reactions[0].emoji, '🔥');

  const reply = store.replyToStory('astra_07', story.id, 'Awesome view!');
  assert.equal(reply.message.toId, 'nova_42');
  assert.ok(reply.message.replyPreview?.includes('Story:'));

  // DM + reaction + read receipt + view-once snap
  const dm = store.sendDirectMessage('nova_42', 'astra_07', {
    text: 'Hello Astra',
    replyToId: reply.message.id,
  });
  assert.equal(dm.message.text, 'Hello Astra');
  assert.ok(dm.message.replyPreview);

  const dmReacted = store.reactToDirectMessage('astra_07', dm.message.id, '❤️');
  assert.equal(dmReacted.reactions?.astra_07, '❤️');

  const readRes = store.markThreadRead('astra_07', 'nova_42');
  assert.equal(readRes.updated, true);

  const snap = store.sendDirectMessage('nova_42', 'astra_07', {
    text: 'Secret snap',
    mediaDataUrl: 'data:image/png;base64,AAAA',
    mediaType: 'image',
    isSnap: true,
  });
  const opened = store.openSnapMessage('astra_07', snap.message.id);
  assert.equal(opened.revealed.mediaDataUrl, 'data:image/png;base64,AAAA');
  assert.equal(opened.burned.mediaDataUrl, undefined);
  assert.throws(() => store.openSnapMessage('astra_07', snap.message.id), /already vanished/);

  // Groups + invite + reaction
  const group = store.createGroup('nova_42', 'Phoenix Squad');
  const invited = store.addGroupMember('nova_42', group.id, 'astra_07');
  assert.ok(invited.members.includes('astra_07'));

  const sentGroup = store.sendGroupMessage('nova_42', group.id, { text: 'Roll call' });
  const msgId = sentGroup.group.messages[0].id;
  const reactedGroup = store.reactToGroupMessage('astra_07', group.id, msgId, '👍');
  assert.equal(reactedGroup.messages[0].reactions?.astra_07, '👍');
});

test('LeoStore stores E2EE public keys and opaque ciphertext envelopes with zero plaintext', () => {
  const store = new LeoStore(null);
  const reg = store.register('cipher_user', 'supersecret99');
  assert.equal(reg.user.e2eePublicKey, undefined);

  const pubKey = 'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEFakePublicKeyMaterialForUnitTest1234567890==';
  const backup = {
    v: 1 as const,
    alg: 'PBKDF2-SHA256-AES-256-GCM' as const,
    iterations: 250_000,
    salt: 'AAAAAAAAAAAAAAAAAAAAAA==',
    iv: 'BBBBBBBBBBBBBBBB',
    ciphertext: 'ENCRYPTED_PKCS8_PRIVATE_KEY_MATERIAL_ONLY_CIPHERTEXT',
    publicKeySpki: pubKey,
    updatedAt: Date.now(),
  };
  const updated = store.setE2eePublicKey('cipher_user', pubKey, backup);
  assert.equal(updated.e2eePublicKey, pubKey);
  assert.equal(updated.e2eeKeyBackup?.ciphertext, backup.ciphertext);

  // Authenticated owner login/session gets e2eeKeyBackup; peers do NOT
  const loginAgain = store.login('cipher_user', 'supersecret99');
  assert.equal(loginAgain.user.e2eeKeyBackup?.ciphertext, backup.ciphertext);
  const byToken = store.getUserByToken(loginAgain.token);
  assert.equal(byToken?.e2eeKeyBackup?.ciphertext, backup.ciphertext);

  const peerSnapshot = store.getConnectSnapshot('astra_07');
  const cipherFriend = peerSnapshot.friends.find((f) => f.id === 'cipher_user');
  assert.ok(cipherFriend);
  assert.equal((cipherFriend as unknown as { e2eeKeyBackup?: unknown }).e2eeKeyBackup, undefined);

  const peerProfileView = store.getProfileView('astra_07', 'cipher_user');
  assert.equal(peerProfileView.user.e2eeKeyBackup, undefined);

  // Send E2EE DM (even if plaintext fields were somehow passed, store strips them)
  const dmRes = store.sendDirectMessage('cipher_user', 'astra_07', {
    text: 'SHOULD_BE_STRIPPED',
    mediaDataUrl: 'data:image/png;base64,STRIP',
    e2ee: {
      v: 1,
      alg: 'ECDH-P256-AES-256-GCM',
      iv: 'AAAAAAAAAAAA',
      ciphertext: 'CIPHERTEXT_BASE64',
      senderPublicKey: pubKey,
      recipientPublicKey: pubKey,
    },
  });
  assert.equal(dmRes.message.text, '');
  assert.equal(dmRes.message.mediaDataUrl, undefined);
  assert.equal(dmRes.message.e2ee?.ciphertext, 'CIPHERTEXT_BASE64');
  assert.match(dmRes.notification?.text || '', /end-to-end encrypted message/);

  // E2EE Snap burns e2ee envelope on recipient open
  const snapRes = store.sendDirectMessage('cipher_user', 'astra_07', {
    isSnap: true,
    e2ee: {
      v: 1,
      alg: 'ECDH-P256-AES-256-GCM',
      iv: 'BBBBBBBBBBBB',
      ciphertext: 'SNAP_CIPHERTEXT',
      senderPublicKey: pubKey,
      recipientPublicKey: pubKey,
    },
  });
  const opened = store.openSnapMessage('astra_07', snapRes.message.id);
  assert.equal(opened.revealed.e2ee?.ciphertext, 'SNAP_CIPHERTEXT');
  assert.equal(opened.burned.e2ee, undefined);

  // E2EE Group message
  const grp = store.createGroup('cipher_user', 'Cipher Circle');
  const grpRes = store.sendGroupMessage('cipher_user', grp.id, {
    text: 'STRIP_ME',
    e2ee: {
      v: 1,
      alg: 'ECDH-P256-AES-256-GCM-GROUP',
      iv: 'CCCCCCCCCCCC',
      ciphertext: 'GROUP_CIPHERTEXT',
      senderPublicKey: pubKey,
      wrappedKeys: {
        cipher_user: { iv: 'DDDDDDDDDDDD', wrappedKey: 'WRAPPED', recipientPublicKey: pubKey },
      },
    },
  });
  assert.equal(grpRes.group.messages[0].text, '');
  assert.equal(grpRes.group.messages[0].e2ee?.ciphertext, 'GROUP_CIPHERTEXT');
});

function createInMemorySupabaseMock(delayMs = 5): {
  client: SupabaseStateClient;
  rows: Map<string, unknown>;
  upsertCount: () => number;
} {
  const rows = new Map<string, unknown>();
  let upserts = 0;

  const client: SupabaseStateClient = {
    from(table: string) {
      assert.equal(table, 'leo_state');
      return {
        select(columns: string) {
          assert.equal(columns, 'data');
          return {
            eq(column: string, value: string) {
              assert.equal(column, 'id');
              return {
                async maybeSingle() {
                  await new Promise((r) => setTimeout(r, delayMs));
                  if (!rows.has(value)) {
                    return { data: null, error: null };
                  }
                  return { data: { data: JSON.parse(JSON.stringify(rows.get(value))) }, error: null };
                },
              };
            },
          };
        },
        async upsert(values, options) {
          assert.equal(values.id, 'main');
          assert.equal(options?.onConflict, 'id');
          await new Promise((r) => setTimeout(r, delayMs));
          upserts += 1;
          rows.set(values.id, JSON.parse(JSON.stringify(values.data)));
          return { error: null };
        },
      };
    },
  };

  return { client, rows, upsertCount: () => upserts };
}

test('LeoStore persists accounts, chats, and stories in Supabase leo_state across restarts', async () => {
  const mock = createInMemorySupabaseMock(5);

  const store1 = new LeoStore({ filePath: null, supabaseClient: mock.client });
  assert.equal(store1.isSupabaseEnabled(), true);
  await store1.init();
  assert.ok(mock.rows.has('main'));

  // Register account, send chat message, create story, and flush rapidly
  const reg = store1.register('persisted_leo', 'supersecret99');
  store1.sendDirectMessage('persisted_leo', 'astra_07', { text: 'Survives restart!' });
  const story = store1.createStory('persisted_leo', { text: 'Permanent story', visibility: 'friends' });
  await store1.flush();

  // Simulate full server restart with fresh LeoStore instance pointing to same Supabase leo_state row
  const store2 = new LeoStore({ filePath: null, supabaseClient: mock.client });
  await store2.init();

  const restoredUser = store2.getUserByToken(reg.token);
  assert.equal(restoredUser?.id, 'persisted_leo');

  const loginAfterRestart = store2.login('persisted_leo', 'supersecret99');
  assert.equal(loginAfterRestart.user.id, 'persisted_leo');

  const snap = store2.getConnectSnapshot('persisted_leo');
  assert.ok(snap.messages.some((m) => m.text === 'Survives restart!'));

  const stories = store2.getStories('persisted_leo');
  assert.ok(stories.some((s) => s.id === story.id && s.text === 'Permanent story'));
});

test('LeoStore ignores placeholder Supabase env values and falls back cleanly', async () => {
  const store = new LeoStore({
    filePath: null,
    supabaseUrl: 'MY_SUPABASE_URL',
    supabaseServiceRoleKey: 'MY_SUPABASE_SERVICE_ROLE_KEY',
  });
  assert.equal(store.isSupabaseEnabled(), false);
  await store.init();
  await store.flush();
});


