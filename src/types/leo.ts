export type PublicGameId =
  | 'match'
  | 'spell'
  | 'maze'
  | 'potion'
  | 'birthday'
  | 'rune'
  | 'duel'
  | 'conduits';

export type PrivateModuleId = 'feed' | 'connect' | 'glimpses' | 'profile';
export type ConnectTabId = 'chats' | 'groups' | 'circle';
export type GlimpseTabId = 'camera' | 'gallery' | 'eclipse';

export interface E2eeDmEnvelope {
  v: 1;
  alg: 'ECDH-P256-AES-256-GCM';
  iv: string;
  ciphertext: string;
  senderPublicKey: string;
  recipientPublicKey: string;
}

export interface E2eeGroupEnvelope {
  v: 1;
  alg: 'ECDH-P256-AES-256-GCM-GROUP';
  iv: string;
  ciphertext: string;
  senderPublicKey: string;
  wrappedKeys: Record<string, { iv: string; wrappedKey: string; recipientPublicKey: string }>;
}

export interface E2eeEncryptedKeyBackup {
  v: 1;
  alg: 'PBKDF2-SHA256-AES-256-GCM';
  iterations: number;
  salt: string;
  iv: string;
  ciphertext: string;
  publicKeySpki: string;
  updatedAt: number;
}

export interface LeoUser {
  id: string;
  displayName: string;
  bio: string;
  status: string;
  avatarDataUrl?: string;
  e2eePublicKey?: string;
  e2eeKeyBackup?: E2eeEncryptedKeyBackup;
  createdAt: number;
  isOnline?: boolean;
  lastActiveAt?: number;
}

export interface StoryReaction {
  userId: string;
  emoji: string;
}

export interface StoryItem {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  text: string;
  mediaDataUrl?: string;
  mediaType?: 'image' | 'video';
  visibility: 'friends' | 'private';
  viewedBy: string[];
  reactions: StoryReaction[];
  createdAt: number;
}

export interface PostCommentItem {
  id: string;
  authorId: string;
  authorName: string;
  text: string;
  createdAt: number;
}

export interface FeedPostItem {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  caption: string;
  mediaDataUrl?: string;
  mediaType?: 'image' | 'video';
  location?: string;
  visibility: 'friends' | 'private';
  likes: string[];
  bookmarks: string[];
  comments: PostCommentItem[];
  createdAt: number;
}

export interface FriendItem {
  id: string;
  displayName: string;
  status: string;
  bio: string;
  avatarDataUrl?: string;
  e2eePublicKey?: string;
  lastActiveAt: number;
  isOnline?: boolean;
}

export interface FriendRequestItem {
  id: string;
  fromId: string;
  toId: string;
  createdAt: number;
  direction: 'incoming' | 'outgoing';
}

export interface DirectMessageItem {
  id: string;
  fromId: string;
  toId: string;
  text: string;
  mediaDataUrl?: string;
  mediaType?: 'image' | 'video';
  e2ee?: E2eeDmEnvelope;
  isSnap?: boolean;
  snapOpenedBy?: string[];
  replyToId?: string;
  replyPreview?: string;
  reactions?: Record<string, string>;
  readAt?: number;
  sharedPostId?: string;
  createdAt: number;
}

export interface GroupMessageItem {
  id: string;
  authorId: string;
  text: string;
  mediaDataUrl?: string;
  mediaType?: 'image' | 'video';
  e2ee?: E2eeGroupEnvelope;
  reactions?: Record<string, string>;
  createdAt: number;
}

export interface GroupItem {
  id: string;
  name: string;
  description: string;
  members: string[];
  createdAt: number;
  messages: GroupMessageItem[];
}

export interface NotificationItem {
  id: string;
  userId: string;
  actorId: string;
  actorName: string;
  kind: 'like' | 'comment' | 'friend_request' | 'friend_accept' | 'story_reply' | 'dm' | 'group';
  text: string;
  targetModule: PrivateModuleId;
  targetId?: string;
  read: boolean;
  createdAt: number;
}

export interface ConnectSnapshot {
  friends: FriendItem[];
  requests: FriendRequestItem[];
  directory: {
    id: string;
    displayName: string;
    status: string;
    bio: string;
    avatarDataUrl?: string;
    e2eePublicKey?: string;
    isOnline?: boolean;
  }[];
  messages: DirectMessageItem[];
  groups: GroupItem[];
}

export interface UserProfileView {
  user: LeoUser;
  friendsCount: number;
  postsCount: number;
  totalLikes: number;
  isFriend: boolean;
  hasPendingRequest: boolean;
  posts: FeedPostItem[];
}

export interface LeoAiMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  suggestedModule?: PrivateModuleId;
  suggestedTab?: ConnectTabId | GlimpseTabId;
  createdAt: number;
}

export interface GlimpseMediaItem {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  blob: Blob;
  source: 'import' | 'camera';
  createdAt: number;
}

export interface EncryptedVaultRecord {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  salt: string;
  iv: string;
  cipher: string;
  createdAt: number;
}

export type RealtimeEventPayload =
  | { type: 'presence:update'; onlineUserIds: string[] }
  | {
      type: 'typing';
      threadType: 'dm' | 'group';
      targetId: string;
      fromId: string;
      isTyping: boolean;
    }
  | { type: 'dm:new'; message: DirectMessageItem }
  | { type: 'dm:updated'; message: DirectMessageItem }
  | { type: 'dm:read'; fromId: string; toId: string; readAt: number }
  | { type: 'group:updated'; group: GroupItem }
  | { type: 'group:deleted'; groupId: string }
  | { type: 'post:new'; post: FeedPostItem }
  | { type: 'post:updated'; post: FeedPostItem }
  | { type: 'post:deleted'; postId: string }
  | { type: 'story:new'; story: StoryItem }
  | { type: 'story:updated'; story: StoryItem }
  | { type: 'story:deleted'; storyId: string }
  | { type: 'notification:new'; notification: NotificationItem }
  | { type: 'friend:update' }
  | { type: 'profile:updated'; user: LeoUser }
  | { type: 'e2ee:key-updated'; userId: string; publicKey: string };
