import type {
  ConnectSnapshot,
  ConnectTabId,
  DirectMessageItem,
  E2eeDmEnvelope,
  E2eeEncryptedKeyBackup,
  E2eeGroupEnvelope,
  FeedPostItem,
  FriendRequestItem,
  GlimpseTabId,
  GroupItem,
  LeoUser,
  NotificationItem,
  PrivateModuleId,
  StoryItem,
  UserProfileView,
} from '../types/leo';

const TOKEN_STORAGE_KEY = 'leoWorldSessionToken_v2';

export function getStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setStoredToken(token: string | null): void {
  try {
    if (token) {
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  } catch {
    // Ignore storage errors
  }
}

async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers = new Headers(init.headers);
  if (!headers.has('Content-Type') && init.body) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  const res = await fetch(path, { ...init, headers });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

export async function loginAccount(
  id: string,
  password: string
): Promise<{ token: string; user: LeoUser }> {
  const res = await apiFetch<{ token: string; user: LeoUser }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ id, password }),
  });
  setStoredToken(res.token);
  return res;
}

export async function registerAccount(
  id: string,
  password: string
): Promise<{ token: string; user: LeoUser }> {
  const res = await apiFetch<{ token: string; user: LeoUser }>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ id, password }),
  });
  setStoredToken(res.token);
  return res;
}

export async function fetchCurrentUser(): Promise<LeoUser | null> {
  const token = getStoredToken();
  if (!token) return null;
  try {
    const res = await apiFetch<{ user: LeoUser }>('/api/auth/me');
    return res.user;
  } catch {
    setStoredToken(null);
    return null;
  }
}

export async function logoutAccount(): Promise<void> {
  try {
    await apiFetch('/api/auth/logout', { method: 'POST' });
  } catch {
    // Ignore logout network issues
  } finally {
    setStoredToken(null);
  }
}

export async function updateUserProfile(payload: {
  displayName?: string;
  bio?: string;
  status?: string;
  avatarDataUrl?: string | null;
}): Promise<LeoUser> {
  const res = await apiFetch<{ user: LeoUser }>('/api/profile', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
  return res.user;
}

export async function publishE2eePublicKey(
  publicKey: string,
  keyBackup?: E2eeEncryptedKeyBackup
): Promise<LeoUser> {
  const res = await apiFetch<{ user: LeoUser }>('/api/e2ee/public-key', {
    method: 'POST',
    body: JSON.stringify({ publicKey, keyBackup }),
  });
  return res.user;
}

export async function fetchUserProfile(userId: string): Promise<UserProfileView> {
  return apiFetch<UserProfileView>(`/api/users/${encodeURIComponent(userId)}/profile`);
}

// Stories
export async function fetchStories(): Promise<StoryItem[]> {
  const res = await apiFetch<{ stories: StoryItem[] }>('/api/stories');
  return res.stories;
}

export async function createStory(payload: {
  text: string;
  mediaDataUrl?: string;
  mediaType?: 'image' | 'video';
  visibility: 'friends' | 'private';
}): Promise<StoryItem> {
  const res = await apiFetch<{ story: StoryItem }>('/api/stories', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return res.story;
}

export async function markStoryViewed(storyId: string): Promise<StoryItem> {
  const res = await apiFetch<{ story: StoryItem }>(`/api/stories/${encodeURIComponent(storyId)}/view`, {
    method: 'POST',
  });
  return res.story;
}

export async function reactToStory(storyId: string, emoji: string): Promise<StoryItem> {
  const res = await apiFetch<{ story: StoryItem }>(`/api/stories/${encodeURIComponent(storyId)}/react`, {
    method: 'POST',
    body: JSON.stringify({ emoji }),
  });
  return res.story;
}

export async function replyToStory(storyId: string, text: string): Promise<DirectMessageItem> {
  const res = await apiFetch<{ message: DirectMessageItem }>(
    `/api/stories/${encodeURIComponent(storyId)}/reply`,
    {
      method: 'POST',
      body: JSON.stringify({ text }),
    }
  );
  return res.message;
}

export async function deleteStory(id: string): Promise<void> {
  await apiFetch(`/api/stories/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

// Feed Posts
export async function fetchPosts(): Promise<FeedPostItem[]> {
  const res = await apiFetch<{ posts: FeedPostItem[] }>('/api/posts');
  return res.posts;
}

export async function createPost(payload: {
  caption: string;
  mediaDataUrl?: string;
  mediaType?: 'image' | 'video';
  location?: string;
  visibility?: 'friends' | 'private';
}): Promise<FeedPostItem> {
  const res = await apiFetch<{ post: FeedPostItem }>('/api/posts', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return res.post;
}

export async function togglePostLike(postId: string): Promise<FeedPostItem> {
  const res = await apiFetch<{ post: FeedPostItem }>(`/api/posts/${encodeURIComponent(postId)}/like`, {
    method: 'POST',
  });
  return res.post;
}

export async function togglePostBookmark(postId: string): Promise<FeedPostItem> {
  const res = await apiFetch<{ post: FeedPostItem }>(
    `/api/posts/${encodeURIComponent(postId)}/bookmark`,
    {
      method: 'POST',
    }
  );
  return res.post;
}

export async function addPostComment(postId: string, text: string): Promise<FeedPostItem> {
  const res = await apiFetch<{ post: FeedPostItem }>(
    `/api/posts/${encodeURIComponent(postId)}/comments`,
    {
      method: 'POST',
      body: JSON.stringify({ text }),
    }
  );
  return res.post;
}

export async function deletePost(postId: string): Promise<void> {
  await apiFetch(`/api/posts/${encodeURIComponent(postId)}`, { method: 'DELETE' });
}

// Connect & Messaging
export async function fetchConnect(): Promise<ConnectSnapshot> {
  return apiFetch<ConnectSnapshot>('/api/connect');
}

export async function sendFriendRequest(targetId: string): Promise<FriendRequestItem> {
  const res = await apiFetch<{ request: FriendRequestItem }>('/api/friends/request', {
    method: 'POST',
    body: JSON.stringify({ targetId }),
  });
  return res.request;
}

export async function respondFriendRequest(
  targetId: string,
  action: 'accept' | 'decline' | 'remove'
): Promise<void> {
  await apiFetch('/api/friends/respond', {
    method: 'POST',
    body: JSON.stringify({ targetId, action }),
  });
}

export async function sendDirectMessage(
  toId: string,
  payload:
    | string
    | {
        text?: string;
        mediaDataUrl?: string;
        mediaType?: 'image' | 'video';
        e2ee?: E2eeDmEnvelope;
        isSnap?: boolean;
        replyToId?: string;
        sharedPostId?: string;
      }
): Promise<DirectMessageItem> {
  const body = typeof payload === 'string' ? { toId, text: payload } : { toId, ...payload };
  const res = await apiFetch<{ message: DirectMessageItem }>('/api/messages', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return res.message;
}

export async function markThreadRead(partnerId: string): Promise<void> {
  await apiFetch('/api/messages/read', {
    method: 'POST',
    body: JSON.stringify({ partnerId }),
  });
}

export async function reactToDirectMessage(
  messageId: string,
  emoji: string
): Promise<DirectMessageItem> {
  const res = await apiFetch<{ message: DirectMessageItem }>(
    `/api/messages/${encodeURIComponent(messageId)}/react`,
    {
      method: 'POST',
      body: JSON.stringify({ emoji }),
    }
  );
  return res.message;
}

export async function openSnapMessage(messageId: string): Promise<DirectMessageItem> {
  const res = await apiFetch<{ message: DirectMessageItem }>(
    `/api/messages/${encodeURIComponent(messageId)}/open-snap`,
    {
      method: 'POST',
    }
  );
  return res.message;
}

export async function createGroup(name: string, description: string): Promise<GroupItem> {
  const res = await apiFetch<{ group: GroupItem }>('/api/groups', {
    method: 'POST',
    body: JSON.stringify({ name, description }),
  });
  return res.group;
}

export async function addGroupMember(groupId: string, memberId: string): Promise<GroupItem> {
  const res = await apiFetch<{ group: GroupItem }>(
    `/api/groups/${encodeURIComponent(groupId)}/members`,
    {
      method: 'POST',
      body: JSON.stringify({ memberId }),
    }
  );
  return res.group;
}

export async function sendGroupMessage(
  groupId: string,
  payload:
    | string
    | {
        text?: string;
        mediaDataUrl?: string;
        mediaType?: 'image' | 'video';
        e2ee?: E2eeGroupEnvelope;
      }
): Promise<GroupItem> {
  const body = typeof payload === 'string' ? { text: payload } : payload;
  const res = await apiFetch<{ group: GroupItem }>(
    `/api/groups/${encodeURIComponent(groupId)}/messages`,
    {
      method: 'POST',
      body: JSON.stringify(body),
    }
  );
  return res.group;
}

export async function reactToGroupMessage(
  groupId: string,
  msgId: string,
  emoji: string
): Promise<GroupItem> {
  const res = await apiFetch<{ group: GroupItem }>(
    `/api/groups/${encodeURIComponent(groupId)}/messages/${encodeURIComponent(msgId)}/react`,
    {
      method: 'POST',
      body: JSON.stringify({ emoji }),
    }
  );
  return res.group;
}

export async function deleteGroup(groupId: string): Promise<void> {
  await apiFetch(`/api/groups/${encodeURIComponent(groupId)}`, { method: 'DELETE' });
}

// Notifications
export async function fetchNotifications(): Promise<NotificationItem[]> {
  const res = await apiFetch<{ notifications: NotificationItem[] }>('/api/notifications');
  return res.notifications;
}

export async function markNotificationsRead(): Promise<void> {
  await apiFetch('/api/notifications/read', { method: 'POST' });
}

// Leo AI
export async function askLeoAi(prompt: string): Promise<{
  reply: string;
  suggestedModule?: PrivateModuleId;
  suggestedTab?: ConnectTabId | GlimpseTabId;
}> {
  return apiFetch('/api/leo-ai', {
    method: 'POST',
    body: JSON.stringify({ prompt }),
  });
}
