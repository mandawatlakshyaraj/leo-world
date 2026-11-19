import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type {
  ConnectSnapshot,
  DirectMessageItem,
  E2eeDmEnvelope,
  E2eeEncryptedKeyBackup,
  E2eeGroupEnvelope,
  FeedPostItem,
  FriendRequestItem,
  GroupItem,
  LeoUser,
  NotificationItem,
  PostCommentItem,
  StoryItem,
  UserProfileView,
} from '../types/leo.js';

interface StoredUser {
  id: string;
  displayName: string;
  bio: string;
  avatarDataUrl?: string;
  e2eePublicKey?: string;
  e2eeKeyBackup?: E2eeEncryptedKeyBackup;
  passwordHash: string;
  salt: string;
  status: string;
  createdAt: number;
  lastActiveAt: number;
}

interface StoredFriendship {
  userA: string;
  userB: string;
  createdAt: number;
}

interface StoredRequest {
  id: string;
  fromId: string;
  toId: string;
  createdAt: number;
}

interface DatabaseSchema {
  users: StoredUser[];
  sessions: Record<string, { userId: string; createdAt: number }>;
  friendships: StoredFriendship[];
  requests: StoredRequest[];
  messages: DirectMessageItem[];
  groups: GroupItem[];
  stories: StoryItem[];
  posts: FeedPostItem[];
  notifications: NotificationItem[];
}

const VALID_ID_REGEX = /^[a-zA-Z0-9._-]{3,24}$/;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const MAX_MEDIA_LENGTH = 9_000_000;

const SEEDED_IMAGES = {
  rooftop: '/src/assets/images/social_rooftop_night_1795018521525.jpg',
  coffee: '/src/assets/images/social_coffee_desk_1795018521574.jpg',
  conservatory: '/src/assets/images/social_conservatory_glow_1795018522050.jpg',
};

function hashPassword(password: string, salt: string): string {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

function createSeedPosts(now: number): FeedPostItem[] {
  return [
    {
      id: 'post-seed-1',
      authorId: 'astra_07',
      authorName: 'Astra',
      caption:
        'Zero horizon haze tonight. Captured the twilight skyline right after midnight calibration.',
      mediaDataUrl: SEEDED_IMAGES.rooftop,
      mediaType: 'image',
      location: 'Sector 4 · Skyline',
      visibility: 'friends',
      likes: ['nox_dev'],
      bookmarks: [],
      comments: [
        {
          id: 'cmt-seed-1',
          authorId: 'nox_dev',
          authorName: 'Nox',
          text: 'Clean exposure — the cyan rim light looks crisp.',
          createdAt: now - 52 * 60_000,
        },
      ],
      createdAt: now - 95 * 60_000,
    },
    {
      id: 'post-seed-2',
      authorId: 'commander',
      authorName: 'Commander',
      caption:
        'Late-night espresso and cipher check at Desk 01 before syncing tonight’s private circle feed.',
      mediaDataUrl: SEEDED_IMAGES.coffee,
      mediaType: 'image',
      location: 'Command Core · Desk 01',
      visibility: 'friends',
      likes: ['astra_07', 'nox_dev'],
      bookmarks: ['commander'],
      comments: [
        {
          id: 'cmt-seed-2',
          authorId: 'astra_07',
          authorName: 'Astra',
          text: 'Keeping watch from Sector 4 while you ship!',
          createdAt: now - 28 * 60_000,
        },
      ],
      createdAt: now - 45 * 60_000,
    },
    {
      id: 'post-seed-3',
      authorId: 'nox_dev',
      authorName: 'Nox',
      caption:
        'Stopped by the West Wing glass conservatory after verifying tonight’s AES-GCM vault keys.',
      mediaDataUrl: SEEDED_IMAGES.conservatory,
      mediaType: 'image',
      location: 'West Wing Conservatory',
      visibility: 'friends',
      likes: ['astra_07'],
      bookmarks: [],
      comments: [],
      createdAt: now - 18 * 60_000,
    },
  ];
}

function createInitialDb(): DatabaseSchema {
  const now = Date.now();
  const cmdSalt = crypto.randomBytes(16).toString('hex');
  const memberSalt = crypto.randomBytes(16).toString('hex');

  return {
    users: [
      {
        id: 'commander',
        displayName: 'Commander',
        bio: 'Command Core architect · Private circle host',
        salt: cmdSalt,
        passwordHash: hashPassword('leoworld123', cmdSalt),
        status: 'Active in Command Center',
        createdAt: now - 86_400_000 * 5,
        lastActiveAt: now,
      },
      {
        id: 'astra_07',
        displayName: 'Astra',
        bio: 'Astrophotography, rooftop skylines & midnight dispatch',
        salt: memberSalt,
        passwordHash: hashPassword('leoworld123', memberSalt),
        status: 'Reviewing tonight’s starlight archives',
        createdAt: now - 86_400_000 * 12,
        lastActiveAt: now - 12 * 60_000,
      },
      {
        id: 'nox_dev',
        displayName: 'Nox',
        bio: 'Cryptography & Eclipse Vault engineer',
        salt: memberSalt,
        passwordHash: hashPassword('leoworld123', memberSalt),
        status: 'Testing Eclipse cipher',
        createdAt: now - 86_400_000 * 9,
        lastActiveAt: now - 35 * 60_000,
      },
      {
        id: 'lyra_v',
        displayName: 'Lyra',
        bio: 'Botanist & glass conservatory keeper',
        salt: memberSalt,
        passwordHash: hashPassword('leoworld123', memberSalt),
        status: 'In the conservatory',
        createdAt: now - 86_400_000 * 7,
        lastActiveAt: now - 3 * 60_000,
      },
      {
        id: 'kairo_9',
        displayName: 'Kairo',
        bio: 'Nocturnal field scout & ambient synth collector',
        salt: memberSalt,
        passwordHash: hashPassword('leoworld123', memberSalt),
        status: 'Offline until midnight',
        createdAt: now - 86_400_000 * 4,
        lastActiveAt: now - 4 * 3_600_000,
      },
    ],
    sessions: {},
    friendships: [
      { userA: 'commander', userB: 'astra_07', createdAt: now - 86_400_000 * 3 },
      { userA: 'commander', userB: 'nox_dev', createdAt: now - 86_400_000 * 2 },
    ],
    requests: [
      {
        id: 'req-lyra-commander',
        fromId: 'lyra_v',
        toId: 'commander',
        createdAt: now - 40 * 60_000,
      },
    ],
    messages: [
      {
        id: 'msg-seed-1',
        fromId: 'astra_07',
        toId: 'commander',
        text: 'Portal lock held steady all night. Ready when you want to sync the Night Owls group.',
        readAt: now - 46 * 60_000,
        createdAt: now - 48 * 60_000,
      },
      {
        id: 'msg-seed-2',
        fromId: 'nox_dev',
        toId: 'commander',
        text: 'Eclipse AES-GCM vault is verified. Passphrases stay local to your browser.',
        createdAt: now - 20 * 60_000,
      },
    ],
    groups: [
      {
        id: 'grp-night-owls',
        name: 'Night Owls',
        description: 'Late-night dispatch & private circle drops.',
        members: ['commander', 'astra_07', 'nox_dev'],
        createdAt: now - 86_400_000 * 2,
        messages: [
          {
            id: 'gmsg-1',
            authorId: 'astra_07',
            text: 'Welcome to the private channel. Drop tonight’s updates here.',
            createdAt: now - 90 * 60_000,
          },
        ],
      },
    ],
    stories: [
      {
        id: 'story-seed-astra',
        authorId: 'astra_07',
        authorName: 'Astra',
        text: 'Quiet rooftop skyline after midnight. All clear on Sector 4.',
        mediaDataUrl: SEEDED_IMAGES.rooftop,
        mediaType: 'image',
        visibility: 'friends',
        viewedBy: [],
        reactions: [],
        createdAt: now - 2 * 3_600_000,
      },
      {
        id: 'story-seed-nox',
        authorId: 'nox_dev',
        authorName: 'Nox',
        text: 'New cipher sweep complete — zero leaks.',
        visibility: 'friends',
        viewedBy: [],
        reactions: [],
        createdAt: now - 45 * 60_000,
      },
    ],
    posts: createSeedPosts(now),
    notifications: [
      {
        id: 'notif-seed-1',
        userId: 'commander',
        actorId: 'lyra_v',
        actorName: 'Lyra',
        kind: 'friend_request',
        text: 'sent you a circle request.',
        targetModule: 'connect',
        read: false,
        createdAt: now - 40 * 60_000,
      },
      {
        id: 'notif-seed-2',
        userId: 'commander',
        actorId: 'astra_07',
        actorName: 'Astra',
        kind: 'comment',
        text: 'commented on your post: "Keeping watch from Sector 4 while you ship!"',
        targetModule: 'feed',
        targetId: 'post-seed-2',
        read: false,
        createdAt: now - 28 * 60_000,
      },
    ],
  };
}

export class LeoStore {
  private filePath: string | null;
  private db: DatabaseSchema;

  constructor(filePath: string | null = path.resolve(process.cwd(), '.data/leoworld-db.json')) {
    this.filePath = filePath;
    if (this.filePath && fs.existsSync(this.filePath)) {
      try {
        const raw = fs.readFileSync(this.filePath, 'utf8');
        this.db = JSON.parse(raw) as DatabaseSchema;
        this.normalizeDb();
      } catch {
        this.db = createInitialDb();
        this.save();
      }
    } else {
      this.db = createInitialDb();
      this.save();
    }
  }

  private normalizeDb(): void {
    const now = Date.now();
    let changed = false;

    if (!Array.isArray(this.db.users)) {
      this.db.users = createInitialDb().users;
      changed = true;
    }
    for (const u of this.db.users) {
      if (typeof u.bio !== 'string') {
        u.bio = '';
        changed = true;
      }
      if (!u.status) {
        u.status = 'Active in Leo World';
        changed = true;
      }
    }
    if (!this.db.sessions) {
      this.db.sessions = {};
      changed = true;
    }
    if (!Array.isArray(this.db.friendships)) {
      this.db.friendships = [];
      changed = true;
    }
    if (!Array.isArray(this.db.requests)) {
      this.db.requests = [];
      changed = true;
    }
    if (!Array.isArray(this.db.messages)) {
      this.db.messages = [];
      changed = true;
    }
    if (!Array.isArray(this.db.groups)) {
      this.db.groups = [];
      changed = true;
    }
    if (!Array.isArray(this.db.stories)) {
      this.db.stories = [];
      changed = true;
    }
    for (const s of this.db.stories) {
      if (!Array.isArray(s.viewedBy)) {
        s.viewedBy = [];
        changed = true;
      }
      if (!Array.isArray(s.reactions)) {
        s.reactions = [];
        changed = true;
      }
      if (s.id === 'story-seed-astra' && !s.mediaDataUrl) {
        s.mediaDataUrl = SEEDED_IMAGES.rooftop;
        s.mediaType = 'image';
        changed = true;
      }
    }
    if (!Array.isArray(this.db.posts) || this.db.posts.length === 0) {
      this.db.posts = createSeedPosts(now);
      changed = true;
    }
    if (!Array.isArray(this.db.notifications)) {
      this.db.notifications = [];
      changed = true;
    }

    if (changed) {
      this.save();
    }
  }

  private save(): void {
    if (!this.filePath) return;
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(this.filePath, JSON.stringify(this.db, null, 2), 'utf8');
  }

  private pruneExpiredStories(): void {
    const cutoff = Date.now() - ONE_DAY_MS;
    const before = this.db.stories.length;
    this.db.stories = this.db.stories.filter((s) => s.createdAt >= cutoff);
    if (this.db.stories.length !== before) {
      this.save();
    }
  }

  private findUser(userId: string): StoredUser | undefined {
    const low = userId.trim().toLowerCase();
    return this.db.users.find((u) => u.id.toLowerCase() === low);
  }

  private toPublicUser(
    u: StoredUser,
    onlineIds?: Set<string>,
    includeSelfSecrets = false
  ): LeoUser {
    const out: LeoUser = {
      id: u.id,
      displayName: u.displayName,
      bio: u.bio || '',
      status: u.status,
      avatarDataUrl: u.avatarDataUrl,
      e2eePublicKey: u.e2eePublicKey,
      createdAt: u.createdAt,
      isOnline: onlineIds ? onlineIds.has(u.id) : false,
      lastActiveAt: u.lastActiveAt,
    };
    if (includeSelfSecrets && u.e2eeKeyBackup) {
      out.e2eeKeyBackup = u.e2eeKeyBackup;
    }
    return out;
  }

  setE2eePublicKey(
    userId: string,
    publicKeyRaw: string,
    keyBackup?: E2eeEncryptedKeyBackup,
    onlineIds?: Set<string>
  ): LeoUser {
    const publicKey = publicKeyRaw.trim();
    if (!publicKey || publicKey.length < 40 || publicKey.length > 512) {
      throw new Error('Invalid E2EE public key format.');
    }
    if (keyBackup !== undefined) {
      if (
        !keyBackup ||
        keyBackup.v !== 1 ||
        keyBackup.alg !== 'PBKDF2-SHA256-AES-256-GCM' ||
        typeof keyBackup.iterations !== 'number' ||
        keyBackup.iterations < 100_000 ||
        keyBackup.iterations > 2_000_000 ||
        typeof keyBackup.salt !== 'string' ||
        keyBackup.salt.length < 16 ||
        typeof keyBackup.iv !== 'string' ||
        keyBackup.iv.length < 12 ||
        typeof keyBackup.ciphertext !== 'string' ||
        keyBackup.ciphertext.length < 32 ||
        keyBackup.ciphertext.length > 8192 ||
        keyBackup.publicKeySpki !== publicKey
      ) {
        throw new Error('Invalid encrypted E2EE key backup payload.');
      }
    }
    const user = this.findUser(userId);
    if (!user) throw new Error('User not found.');
    user.e2eePublicKey = publicKey;
    if (keyBackup) {
      user.e2eeKeyBackup = {
        v: 1,
        alg: 'PBKDF2-SHA256-AES-256-GCM',
        iterations: keyBackup.iterations,
        salt: keyBackup.salt,
        iv: keyBackup.iv,
        ciphertext: keyBackup.ciphertext,
        publicKeySpki: keyBackup.publicKeySpki,
        updatedAt: typeof keyBackup.updatedAt === 'number' ? keyBackup.updatedAt : Date.now(),
      };
    }
    this.save();
    return this.toPublicUser(user, onlineIds, true);
  }

  private areFriends(a: string, b: string): boolean {
    const lowA = a.toLowerCase();
    const lowB = b.toLowerCase();
    return this.db.friendships.some(
      (f) =>
        (f.userA.toLowerCase() === lowA && f.userB.toLowerCase() === lowB) ||
        (f.userA.toLowerCase() === lowB && f.userB.toLowerCase() === lowA)
    );
  }

  getFriendIds(userId: string): string[] {
    return this.db.users
      .filter((u) => u.id !== userId && this.areFriends(userId, u.id))
      .map((u) => u.id);
  }

  private pushNotification(
    targetUserId: string,
    actorId: string,
    kind: NotificationItem['kind'],
    text: string,
    targetModule: NotificationItem['targetModule'],
    targetId?: string
  ): NotificationItem | null {
    if (targetUserId === actorId) return null;
    const actor = this.findUser(actorId);
    const notif: NotificationItem = {
      id: `notif-${crypto.randomUUID()}`,
      userId: targetUserId,
      actorId,
      actorName: actor?.displayName || actorId,
      kind,
      text,
      targetModule,
      targetId,
      read: false,
      createdAt: Date.now(),
    };
    this.db.notifications.unshift(notif);
    if (this.db.notifications.length > 200) {
      this.db.notifications = this.db.notifications.slice(0, 200);
    }
    return notif;
  }

  register(uniqueIdRaw: string, password: string): { token: string; user: LeoUser } {
    const id = uniqueIdRaw.trim();
    if (!VALID_ID_REGEX.test(id)) {
      throw new Error(
        'Unique ID must be 3–24 characters using letters, numbers, dots, underscores, or hyphens.'
      );
    }
    if (password.length < 8) {
      throw new Error('Password must be at least 8 characters long.');
    }
    if (this.db.users.some((u) => u.id.toLowerCase() === id.toLowerCase())) {
      throw new Error('That Unique ID is already registered.');
    }

    const salt = crypto.randomBytes(16).toString('hex');
    const now = Date.now();
    const user: StoredUser = {
      id,
      displayName: id,
      bio: 'Joined Leo World Private',
      salt,
      passwordHash: hashPassword(password, salt),
      status: 'Online in Leo World',
      createdAt: now,
      lastActiveAt: now,
    };
    this.db.users.push(user);

    // Starter circle so a brand-new user immediately sees friends, stories, feed, and Night Owls group
    this.db.friendships.push({ userA: id, userB: 'astra_07', createdAt: now });
    this.db.friendships.push({ userA: id, userB: 'nox_dev', createdAt: now });
    this.db.requests.push({
      id: `req-${crypto.randomUUID()}`,
      fromId: 'lyra_v',
      toId: id,
      createdAt: now,
    });
    this.db.messages.push({
      id: `msg-${crypto.randomUUID()}`,
      fromId: 'astra_07',
      toId: id,
      text: `Welcome to Leo World, ${id}. Your private feed, stories, and chat are ready.`,
      createdAt: now,
    });
    const owls = this.db.groups.find((g) => g.id === 'grp-night-owls');
    if (owls && !owls.members.includes(id)) {
      owls.members.push(id);
    }
    this.pushNotification(
      id,
      'lyra_v',
      'friend_request',
      'sent you a circle request.',
      'connect'
    );

    const token = crypto.randomBytes(24).toString('hex');
    this.db.sessions[token] = { userId: id, createdAt: now };
    this.save();
    return { token, user: this.toPublicUser(user, undefined, true) };
  }

  login(uniqueIdRaw: string, password: string): { token: string; user: LeoUser } {
    const id = uniqueIdRaw.trim();
    const user = this.findUser(id);
    if (!user) {
      throw new Error('Invalid Unique ID or password.');
    }
    const candidate = hashPassword(password, user.salt);
    if (
      !crypto.timingSafeEqual(Buffer.from(candidate, 'hex'), Buffer.from(user.passwordHash, 'hex'))
    ) {
      throw new Error('Invalid Unique ID or password.');
    }
    user.lastActiveAt = Date.now();
    const token = crypto.randomBytes(24).toString('hex');
    this.db.sessions[token] = { userId: user.id, createdAt: Date.now() };
    this.save();
    return { token, user: this.toPublicUser(user, undefined, true) };
  }

  getUserByToken(token: string | undefined, onlineIds?: Set<string>): LeoUser | null {
    if (!token) return null;
    const session = this.db.sessions[token];
    if (!session) return null;
    const user = this.db.users.find((u) => u.id === session.userId);
    return user ? this.toPublicUser(user, onlineIds, true) : null;
  }

  logout(token: string | undefined): void {
    if (token && this.db.sessions[token]) {
      delete this.db.sessions[token];
      this.save();
    }
  }

  updateProfile(
    userId: string,
    payload: {
      displayName?: string;
      bio?: string;
      status?: string;
      avatarDataUrl?: string | null;
    },
    onlineIds?: Set<string>
  ): LeoUser {
    const user = this.findUser(userId);
    if (!user) throw new Error('User not found.');

    if (typeof payload.displayName === 'string') {
      const clean = payload.displayName.trim().slice(0, 32);
      if (clean.length < 2) {
        throw new Error('Display name must be at least 2 characters.');
      }
      user.displayName = clean;
      // Keep authored story/post names fresh
      for (const s of this.db.stories) {
        if (s.authorId === user.id) {
          s.authorName = clean;
        }
      }
      for (const p of this.db.posts) {
        if (p.authorId === user.id) {
          p.authorName = clean;
        }
        for (const c of p.comments) {
          if (c.authorId === user.id) {
            c.authorName = clean;
          }
        }
      }
    }
    if (typeof payload.bio === 'string') {
      user.bio = payload.bio.trim().slice(0, 160);
    }
    if (typeof payload.status === 'string') {
      user.status = payload.status.trim().slice(0, 80) || 'Active in Leo World';
    }
    if (payload.avatarDataUrl === null) {
      user.avatarDataUrl = undefined;
      for (const s of this.db.stories) {
        if (s.authorId === user.id) s.authorAvatar = undefined;
      }
      for (const p of this.db.posts) {
        if (p.authorId === user.id) p.authorAvatar = undefined;
      }
    } else if (typeof payload.avatarDataUrl === 'string' && payload.avatarDataUrl.startsWith('data:image/')) {
      if (payload.avatarDataUrl.length > 3_500_000) {
        throw new Error('Avatar image exceeds size limit.');
      }
      user.avatarDataUrl = payload.avatarDataUrl;
      for (const s of this.db.stories) {
        if (s.authorId === user.id) s.authorAvatar = payload.avatarDataUrl;
      }
      for (const p of this.db.posts) {
        if (p.authorId === user.id) p.authorAvatar = payload.avatarDataUrl;
      }
    }

    user.lastActiveAt = Date.now();
    this.save();
    return this.toPublicUser(user, onlineIds, true);
  }

  getProfileView(
    viewerId: string,
    targetIdRaw: string,
    onlineIds?: Set<string>
  ): UserProfileView {
    const target = this.findUser(targetIdRaw);
    if (!target) throw new Error('User not found.');
    const isSelf = viewerId === target.id;
    const isFriend = !isSelf && this.areFriends(viewerId, target.id);
    const hasPendingRequest = this.db.requests.some(
      (r) =>
        (r.fromId === viewerId && r.toId === target.id) ||
        (r.fromId === target.id && r.toId === viewerId)
    );
    const visiblePosts = this.db.posts
      .filter((p) => {
        if (p.authorId !== target.id) return false;
        if (isSelf) return true;
        return p.visibility === 'friends' && isFriend;
      })
      .sort((a, b) => b.createdAt - a.createdAt);

    const totalLikes = visiblePosts.reduce((sum, p) => sum + p.likes.length, 0);

    return {
      user: this.toPublicUser(target, onlineIds),
      friendsCount: this.getFriendIds(target.id).length,
      postsCount: visiblePosts.length,
      totalLikes,
      isFriend,
      hasPendingRequest,
      posts: visiblePosts,
    };
  }

  // -------------------- Stories (Snapchat + IG Stories) --------------------

  getStories(userId: string): StoryItem[] {
    this.pruneExpiredStories();
    return this.db.stories
      .filter((s) => {
        if (s.authorId === userId) return true;
        if (s.visibility === 'private') return false;
        return this.areFriends(userId, s.authorId);
      })
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  createStory(
    userId: string,
    payload: {
      text?: string;
      mediaDataUrl?: string;
      mediaType?: 'image' | 'video';
      visibility?: 'friends' | 'private';
    }
  ): StoryItem {
    this.pruneExpiredStories();
    const user = this.findUser(userId);
    if (!user) throw new Error('User not found.');
    const text = (payload.text || '').trim().slice(0, 500);
    const mediaDataUrl = payload.mediaDataUrl;
    if (!text && !mediaDataUrl) {
      throw new Error('Add a caption or choose a photo/video first.');
    }
    if (mediaDataUrl && mediaDataUrl.length > MAX_MEDIA_LENGTH) {
      throw new Error('Media payload exceeds 6 MB limit.');
    }
    const story: StoryItem = {
      id: `story-${crypto.randomUUID()}`,
      authorId: user.id,
      authorName: user.displayName,
      authorAvatar: user.avatarDataUrl,
      text,
      mediaDataUrl,
      mediaType: payload.mediaType,
      visibility: payload.visibility === 'private' ? 'private' : 'friends',
      viewedBy: [user.id],
      reactions: [],
      createdAt: Date.now(),
    };
    this.db.stories.push(story);
    this.save();
    return story;
  }

  markStoryViewed(userId: string, storyId: string): StoryItem | null {
    const story = this.db.stories.find((s) => s.id === storyId);
    if (!story) return null;
    if (story.authorId !== userId && !this.areFriends(userId, story.authorId)) {
      return null;
    }
    if (!story.viewedBy.includes(userId)) {
      story.viewedBy.push(userId);
      this.save();
    }
    return story;
  }

  reactToStory(userId: string, storyId: string, emojiRaw: string): StoryItem {
    const emoji = emojiRaw.trim().slice(0, 8);
    if (!emoji) throw new Error('Pick an emoji reaction.');
    const story = this.db.stories.find((s) => s.id === storyId);
    if (!story) throw new Error('Story not found.');
    if (story.authorId !== userId && (story.visibility === 'private' || !this.areFriends(userId, story.authorId))) {
      throw new Error('You cannot react to this story.');
    }
    const existingIdx = story.reactions.findIndex((r) => r.userId === userId);
    if (existingIdx !== -1) {
      if (story.reactions[existingIdx].emoji === emoji) {
        story.reactions.splice(existingIdx, 1);
      } else {
        story.reactions[existingIdx].emoji = emoji;
      }
    } else {
      story.reactions.push({ userId, emoji });
    }
    this.save();
    return story;
  }

  replyToStory(
    userId: string,
    storyId: string,
    textRaw: string
  ): { message: DirectMessageItem; notification: NotificationItem | null } {
    const text = textRaw.trim().slice(0, 1000);
    if (!text) throw new Error('Write a reply first.');
    const story = this.db.stories.find((s) => s.id === storyId);
    if (!story) throw new Error('Story not found.');
    if (story.authorId === userId) {
      throw new Error('You cannot reply to your own story.');
    }
    if (story.visibility === 'private' || !this.areFriends(userId, story.authorId)) {
      throw new Error('You can only reply to friends’ stories.');
    }
    const preview = `Story: ${story.text ? story.text.slice(0, 48) : 'Shared moment'}`;
    const msg: DirectMessageItem = {
      id: `msg-${crypto.randomUUID()}`,
      fromId: userId,
      toId: story.authorId,
      text,
      replyToId: story.id,
      replyPreview: preview,
      createdAt: Date.now(),
    };
    this.db.messages.push(msg);
    const notification = this.pushNotification(
      story.authorId,
      userId,
      'story_reply',
      `replied to your story: "${text.slice(0, 60)}"`,
      'connect',
      userId
    );
    this.save();
    return { message: msg, notification };
  }

  deleteStory(userId: string, storyId: string): boolean {
    const idx = this.db.stories.findIndex((s) => s.id === storyId && s.authorId === userId);
    if (idx === -1) return false;
    this.db.stories.splice(idx, 1);
    this.save();
    return true;
  }

  // -------------------- Social Feed Posts (Instagram) --------------------

  getPosts(userId: string): FeedPostItem[] {
    return this.db.posts
      .filter((p) => {
        if (p.authorId === userId) return true;
        if (p.visibility === 'private') return false;
        return this.areFriends(userId, p.authorId);
      })
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  createPost(
    userId: string,
    payload: {
      caption?: string;
      mediaDataUrl?: string;
      mediaType?: 'image' | 'video';
      location?: string;
      visibility?: 'friends' | 'private';
    }
  ): FeedPostItem {
    const user = this.findUser(userId);
    if (!user) throw new Error('User not found.');
    const caption = (payload.caption || '').trim().slice(0, 1200);
    const location = (payload.location || '').trim().slice(0, 60);
    const mediaDataUrl = payload.mediaDataUrl;

    if (!caption && !mediaDataUrl) {
      throw new Error('Write a caption or attach a photo/video to post.');
    }
    if (mediaDataUrl && mediaDataUrl.length > MAX_MEDIA_LENGTH) {
      throw new Error('Media payload exceeds 6 MB limit.');
    }

    const post: FeedPostItem = {
      id: `post-${crypto.randomUUID()}`,
      authorId: user.id,
      authorName: user.displayName,
      authorAvatar: user.avatarDataUrl,
      caption,
      mediaDataUrl,
      mediaType: payload.mediaType,
      location: location || undefined,
      visibility: payload.visibility === 'private' ? 'private' : 'friends',
      likes: [],
      bookmarks: [],
      comments: [],
      createdAt: Date.now(),
    };
    this.db.posts.unshift(post);
    this.save();
    return post;
  }

  togglePostLike(
    userId: string,
    postId: string
  ): { post: FeedPostItem; notification: NotificationItem | null } {
    const post = this.db.posts.find((p) => p.id === postId);
    if (!post) throw new Error('Post not found.');
    if (post.authorId !== userId && (post.visibility === 'private' || !this.areFriends(userId, post.authorId))) {
      throw new Error('Post is not accessible.');
    }
    const idx = post.likes.indexOf(userId);
    let notification: NotificationItem | null = null;
    if (idx === -1) {
      post.likes.push(userId);
      notification = this.pushNotification(
        post.authorId,
        userId,
        'like',
        'liked your post.',
        'feed',
        post.id
      );
    } else {
      post.likes.splice(idx, 1);
    }
    this.save();
    return { post, notification };
  }

  togglePostBookmark(userId: string, postId: string): FeedPostItem {
    const post = this.db.posts.find((p) => p.id === postId);
    if (!post) throw new Error('Post not found.');
    if (post.authorId !== userId && (post.visibility === 'private' || !this.areFriends(userId, post.authorId))) {
      throw new Error('Post is not accessible.');
    }
    const idx = post.bookmarks.indexOf(userId);
    if (idx === -1) {
      post.bookmarks.push(userId);
    } else {
      post.bookmarks.splice(idx, 1);
    }
    this.save();
    return post;
  }

  addPostComment(
    userId: string,
    postId: string,
    textRaw: string
  ): { post: FeedPostItem; notification: NotificationItem | null } {
    const user = this.findUser(userId);
    if (!user) throw new Error('User not found.');
    const text = textRaw.trim().slice(0, 400);
    if (!text) throw new Error('Write a comment first.');
    const post = this.db.posts.find((p) => p.id === postId);
    if (!post) throw new Error('Post not found.');
    if (post.authorId !== userId && (post.visibility === 'private' || !this.areFriends(userId, post.authorId))) {
      throw new Error('Post is not accessible.');
    }
    const comment: PostCommentItem = {
      id: `cmt-${crypto.randomUUID()}`,
      authorId: user.id,
      authorName: user.displayName,
      text,
      createdAt: Date.now(),
    };
    post.comments.push(comment);
    const notification = this.pushNotification(
      post.authorId,
      userId,
      'comment',
      `commented: "${text.slice(0, 60)}"`,
      'feed',
      post.id
    );
    this.save();
    return { post, notification };
  }

  deletePost(userId: string, postId: string): boolean {
    const idx = this.db.posts.findIndex((p) => p.id === postId && p.authorId === userId);
    if (idx === -1) return false;
    this.db.posts.splice(idx, 1);
    this.save();
    return true;
  }

  // -------------------- Connect: Friends, DMs, Snaps, Groups --------------------

  getConnectSnapshot(userId: string, onlineIds?: Set<string>): ConnectSnapshot {
    const friends = this.db.users
      .filter((u) => u.id !== userId && this.areFriends(userId, u.id))
      .map((u) => ({
        id: u.id,
        displayName: u.displayName,
        status: u.status,
        bio: u.bio || '',
        avatarDataUrl: u.avatarDataUrl,
        e2eePublicKey: u.e2eePublicKey,
        lastActiveAt: u.lastActiveAt,
        isOnline: onlineIds ? onlineIds.has(u.id) : false,
      }));

    const requests: FriendRequestItem[] = this.db.requests
      .filter((r) => r.fromId === userId || r.toId === userId)
      .map((r) => ({
        id: r.id,
        fromId: r.fromId,
        toId: r.toId,
        createdAt: r.createdAt,
        direction: r.fromId === userId ? 'outgoing' : 'incoming',
      }));

    const pendingIds = new Set(requests.flatMap((r) => [r.fromId, r.toId]));
    const friendIds = new Set(friends.map((f) => f.id));

    const directory = this.db.users
      .filter((u) => u.id !== userId && !friendIds.has(u.id) && !pendingIds.has(u.id))
      .map((u) => ({
        id: u.id,
        displayName: u.displayName,
        status: u.status,
        bio: u.bio || '',
        avatarDataUrl: u.avatarDataUrl,
        e2eePublicKey: u.e2eePublicKey,
        isOnline: onlineIds ? onlineIds.has(u.id) : false,
      }));

    const messages = this.db.messages
      .filter((m) => m.fromId === userId || m.toId === userId)
      .sort((a, b) => a.createdAt - b.createdAt);

    const groups = this.db.groups
      .filter((g) => g.members.includes(userId))
      .sort((a, b) => b.createdAt - a.createdAt);

    return { friends, requests, directory, messages, groups };
  }

  sendFriendRequest(
    userId: string,
    targetIdRaw: string
  ): { request: FriendRequestItem; notification: NotificationItem | null } {
    const targetId = targetIdRaw.trim();
    if (!VALID_ID_REGEX.test(targetId)) {
      throw new Error('Use 3–24 letters, numbers, dots, underscores, or hyphens.');
    }
    const target = this.findUser(targetId);
    if (!target) {
      throw new Error(`No Leo World user found with ID "${targetId}".`);
    }
    if (target.id === userId) {
      throw new Error('You cannot send a friend request to yourself.');
    }
    if (this.areFriends(userId, target.id)) {
      throw new Error(`${target.id} is already in your friends list.`);
    }
    const existing = this.db.requests.find(
      (r) =>
        (r.fromId === userId && r.toId === target.id) ||
        (r.fromId === target.id && r.toId === userId)
    );
    if (existing) {
      throw new Error('A friend request is already pending with this user.');
    }
    const req: StoredRequest = {
      id: `req-${crypto.randomUUID()}`,
      fromId: userId,
      toId: target.id,
      createdAt: Date.now(),
    };
    this.db.requests.push(req);
    const notification = this.pushNotification(
      target.id,
      userId,
      'friend_request',
      'sent you a circle request.',
      'connect'
    );
    this.save();
    return { request: { ...req, direction: 'outgoing' }, notification };
  }

  respondFriendRequest(
    userId: string,
    targetId: string,
    action: 'accept' | 'decline' | 'remove'
  ): { notification: NotificationItem | null } {
    if (action === 'remove') {
      this.db.friendships = this.db.friendships.filter(
        (f) =>
          !(
            (f.userA === userId && f.userB === targetId) ||
            (f.userA === targetId && f.userB === userId)
          )
      );
      this.save();
      return { notification: null };
    }

    const reqIndex = this.db.requests.findIndex(
      (r) =>
        (r.fromId === targetId && r.toId === userId) ||
        (r.fromId === userId && r.toId === targetId)
    );
    if (reqIndex === -1) {
      throw new Error('Friend request not found.');
    }
    const [req] = this.db.requests.splice(reqIndex, 1);
    let notification: NotificationItem | null = null;
    if (action === 'accept' && req.toId === userId) {
      if (!this.areFriends(req.fromId, req.toId)) {
        this.db.friendships.push({
          userA: req.fromId,
          userB: req.toId,
          createdAt: Date.now(),
        });
      }
      notification = this.pushNotification(
        req.fromId,
        userId,
        'friend_accept',
        'accepted your circle request.',
        'connect'
      );
    }
    this.save();
    return { notification };
  }

  sendDirectMessage(
    userId: string,
    toIdRaw: string,
    payload: {
      text?: string;
      mediaDataUrl?: string;
      mediaType?: 'image' | 'video';
      e2ee?: E2eeDmEnvelope;
      isSnap?: boolean;
      replyToId?: string;
      sharedPostId?: string;
    }
  ): { message: DirectMessageItem; notification: NotificationItem | null } {
    const toId = toIdRaw.trim();
    const hasE2ee = Boolean(payload.e2ee && payload.e2ee.ciphertext && payload.e2ee.iv);
    const text = hasE2ee ? '' : (payload.text || '').trim().slice(0, 2000);
    const mediaDataUrl = hasE2ee ? undefined : payload.mediaDataUrl;

    if (!toId || (!hasE2ee && !text && !mediaDataUrl && !payload.sharedPostId)) {
      throw new Error('Enter a recipient and message or attach media.');
    }
    if (mediaDataUrl && mediaDataUrl.length > MAX_MEDIA_LENGTH) {
      throw new Error('Media attachment exceeds 6 MB limit.');
    }
    if (payload.e2ee && payload.e2ee.ciphertext.length > MAX_MEDIA_LENGTH * 1.4) {
      throw new Error('Encrypted payload exceeds size limit.');
    }
    const target = this.findUser(toId);
    if (!target) {
      throw new Error(`Recipient "${toId}" does not exist.`);
    }

    let replyPreview: string | undefined;
    if (!hasE2ee && payload.replyToId) {
      const parent = this.db.messages.find(
        (m) =>
          m.id === payload.replyToId &&
          ((m.fromId === userId && m.toId === target.id) ||
            (m.fromId === target.id && m.toId === userId))
      );
      if (parent) {
        replyPreview = parent.isSnap
          ? 'Vanishing Snap'
          : parent.text
            ? parent.text.slice(0, 80)
            : 'Media attachment';
      }
    }

    const msg: DirectMessageItem = {
      id: `msg-${crypto.randomUUID()}`,
      fromId: userId,
      toId: target.id,
      text: hasE2ee
        ? ''
        : text || (payload.isSnap ? 'Vanishing Snap' : payload.sharedPostId ? 'Shared a post' : ''),
      mediaDataUrl,
      mediaType: hasE2ee ? undefined : payload.mediaType,
      e2ee: hasE2ee ? payload.e2ee : undefined,
      isSnap: Boolean(payload.isSnap),
      snapOpenedBy: [],
      replyToId: payload.replyToId,
      replyPreview,
      reactions: {},
      sharedPostId: payload.sharedPostId,
      createdAt: Date.now(),
    };
    this.db.messages.push(msg);

    const notification = this.pushNotification(
      target.id,
      userId,
      'dm',
      payload.isSnap
        ? hasE2ee
          ? 'sent you an end-to-end encrypted Snap.'
          : 'sent you a vanishing Snap.'
        : hasE2ee
          ? 'sent you an end-to-end encrypted message.'
          : payload.sharedPostId
            ? 'shared a feed post with you.'
            : `sent a message: "${msg.text.slice(0, 50)}"`,
      'connect',
      userId
    );
    this.save();
    return { message: msg, notification };
  }

  markThreadRead(userId: string, partnerIdRaw: string): { updated: boolean; readAt: number; partnerId: string } {
    const partner = this.findUser(partnerIdRaw);
    if (!partner) return { updated: false, readAt: Date.now(), partnerId: partnerIdRaw };
    const now = Date.now();
    let updated = false;
    for (const m of this.db.messages) {
      if (m.fromId === partner.id && m.toId === userId && !m.readAt) {
        m.readAt = now;
        updated = true;
      }
    }
    if (updated) {
      this.save();
    }
    return { updated, readAt: now, partnerId: partner.id };
  }

  reactToDirectMessage(userId: string, messageId: string, emojiRaw: string): DirectMessageItem {
    const emoji = emojiRaw.trim().slice(0, 8);
    if (!emoji) throw new Error('Pick an emoji.');
    const msg = this.db.messages.find(
      (m) => m.id === messageId && (m.fromId === userId || m.toId === userId)
    );
    if (!msg) throw new Error('Message not found.');
    if (!msg.reactions) msg.reactions = {};
    if (msg.reactions[userId] === emoji) {
      delete msg.reactions[userId];
    } else {
      msg.reactions[userId] = emoji;
    }
    this.save();
    return msg;
  }

  openSnapMessage(
    userId: string,
    messageId: string
  ): { revealed: DirectMessageItem; burned: DirectMessageItem } {
    const msg = this.db.messages.find(
      (m) => m.id === messageId && (m.fromId === userId || m.toId === userId)
    );
    if (!msg) throw new Error('Snap not found.');
    if (!msg.isSnap) throw new Error('Message is not a snap.');

    const openedBy = msg.snapOpenedBy || [];
    if (openedBy.includes(userId)) {
      throw new Error('This Snap has already vanished.');
    }

    // Snapshot for one-time display in response
    const revealed: DirectMessageItem = { ...msg, snapOpenedBy: [...openedBy, userId] };

    // Only burn payload once the recipient opens it (sender can't accidentally burn it for recipient)
    if (msg.toId === userId) {
      msg.snapOpenedBy = [...openedBy, userId];
      msg.readAt = msg.readAt || Date.now();
      msg.mediaDataUrl = undefined;
      msg.e2ee = undefined;
      msg.text = 'Snap opened & vanished';
      this.save();
    }

    return { revealed, burned: msg };
  }

  createGroup(userId: string, nameRaw: string, descriptionRaw = ''): GroupItem {
    const name = nameRaw.trim().slice(0, 60);
    const description = descriptionRaw.trim().slice(0, 140) || 'Private circle group';
    if (!name) {
      throw new Error('Enter a group name.');
    }
    const group: GroupItem = {
      id: `grp-${crypto.randomUUID()}`,
      name,
      description,
      members: [userId],
      createdAt: Date.now(),
      messages: [],
    };
    this.db.groups.push(group);
    this.save();
    return group;
  }

  addGroupMember(userId: string, groupId: string, memberIdRaw: string): GroupItem {
    const group = this.db.groups.find((g) => g.id === groupId && g.members.includes(userId));
    if (!group) throw new Error('Group not found.');
    const member = this.findUser(memberIdRaw);
    if (!member) throw new Error(`User "${memberIdRaw}" does not exist.`);
    if (!this.areFriends(userId, member.id)) {
      throw new Error('Connect as friends first before inviting to a group.');
    }
    if (!group.members.includes(member.id)) {
      group.members.push(member.id);
      this.pushNotification(
        member.id,
        userId,
        'group',
        `added you to group "${group.name}".`,
        'connect',
        group.id
      );
      this.save();
    }
    return group;
  }

  sendGroupMessage(
    userId: string,
    groupId: string,
    payload: {
      text?: string;
      mediaDataUrl?: string;
      mediaType?: 'image' | 'video';
      e2ee?: E2eeGroupEnvelope;
    }
  ): { group: GroupItem; notifications: NotificationItem[] } {
    const hasE2ee = Boolean(payload.e2ee && payload.e2ee.ciphertext && payload.e2ee.iv);
    const text = hasE2ee ? '' : (payload.text || '').trim().slice(0, 1000);
    const mediaDataUrl = hasE2ee ? undefined : payload.mediaDataUrl;
    if (!hasE2ee && !text && !mediaDataUrl) {
      throw new Error('Write a group message or attach media first.');
    }
    if (mediaDataUrl && mediaDataUrl.length > MAX_MEDIA_LENGTH) {
      throw new Error('Media payload exceeds 6 MB limit.');
    }
    if (payload.e2ee && payload.e2ee.ciphertext.length > MAX_MEDIA_LENGTH * 1.4) {
      throw new Error('Encrypted payload exceeds size limit.');
    }
    const group = this.db.groups.find((g) => g.id === groupId && g.members.includes(userId));
    if (!group) {
      throw new Error('Group not found.');
    }
    group.messages.push({
      id: `gmsg-${crypto.randomUUID()}`,
      authorId: userId,
      text: hasE2ee ? '' : text || 'Shared media',
      mediaDataUrl,
      mediaType: hasE2ee ? undefined : payload.mediaType,
      e2ee: hasE2ee ? payload.e2ee : undefined,
      reactions: {},
      createdAt: Date.now(),
    });
    const notifications: NotificationItem[] = [];
    for (const memberId of group.members) {
      const n = this.pushNotification(
        memberId,
        userId,
        'group',
        hasE2ee
          ? `sent an encrypted message in ${group.name}.`
          : `posted in ${group.name}: "${(text || 'Media').slice(0, 48)}"`,
        'connect',
        group.id
      );
      if (n) notifications.push(n);
    }
    this.save();
    return { group, notifications };
  }

  reactToGroupMessage(
    userId: string,
    groupId: string,
    messageId: string,
    emojiRaw: string
  ): GroupItem {
    const emoji = emojiRaw.trim().slice(0, 8);
    if (!emoji) throw new Error('Pick an emoji.');
    const group = this.db.groups.find((g) => g.id === groupId && g.members.includes(userId));
    if (!group) throw new Error('Group not found.');
    const msg = group.messages.find((m) => m.id === messageId);
    if (!msg) throw new Error('Message not found.');
    if (!msg.reactions) msg.reactions = {};
    if (msg.reactions[userId] === emoji) {
      delete msg.reactions[userId];
    } else {
      msg.reactions[userId] = emoji;
    }
    this.save();
    return group;
  }

  deleteGroup(userId: string, groupId: string): { deleted: boolean; members: string[] } {
    const idx = this.db.groups.findIndex((g) => g.id === groupId && g.members.includes(userId));
    if (idx === -1) return { deleted: false, members: [] };
    const members = [...this.db.groups[idx].members];
    this.db.groups.splice(idx, 1);
    this.save();
    return { deleted: true, members };
  }

  // -------------------- Notifications --------------------

  getNotifications(userId: string): NotificationItem[] {
    return this.db.notifications
      .filter((n) => n.userId === userId)
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  markNotificationsRead(userId: string): void {
    let changed = false;
    for (const n of this.db.notifications) {
      if (n.userId === userId && !n.read) {
        n.read = true;
        changed = true;
      }
    }
    if (changed) {
      this.save();
    }
  }
}
