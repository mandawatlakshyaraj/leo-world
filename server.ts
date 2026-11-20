import 'dotenv/config';
import express, { type Request, type Response, type NextFunction } from 'express';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { GoogleGenAI } from '@google/genai';
import { WebSocketServer, WebSocket } from 'ws';
import { LeoStore } from './src/server/store.ts';
import type {
  ConnectTabId,
  E2eeDmEnvelope,
  E2eeEncryptedKeyBackup,
  E2eeGroupEnvelope,
  GlimpseTabId,
  PrivateModuleId,
  RealtimeEventPayload,
} from './src/types/leo.ts';

const PORT = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === 'production';

const store = new LeoStore();
const onlineSockets = new Map<string, Set<WebSocket>>();

function getOnlineUserIds(): Set<string> {
  const active = new Set<string>();
  for (const [userId, sockets] of onlineSockets.entries()) {
    if (sockets.size > 0) active.add(userId);
  }
  return active;
}

function broadcastToUsers(userIds: Iterable<string>, event: RealtimeEventPayload): void {
  const raw = JSON.stringify(event);
  const visited = new Set<string>();
  for (const userId of userIds) {
    if (visited.has(userId)) continue;
    visited.add(userId);
    const sockets = onlineSockets.get(userId);
    if (!sockets) continue;
    for (const sock of sockets) {
      if (sock.readyState === WebSocket.OPEN) {
        sock.send(raw);
      }
    }
  }
}

function broadcastPresence(): void {
  const payload: RealtimeEventPayload = {
    type: 'presence:update',
    onlineUserIds: Array.from(getOnlineUserIds()),
  };
  const raw = JSON.stringify(payload);
  for (const sockets of onlineSockets.values()) {
    for (const sock of sockets) {
      if (sock.readyState === WebSocket.OPEN) {
        sock.send(raw);
      }
    }
  }
}

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function extractBearerToken(req: Request): string | undefined {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return undefined;
  return header.slice(7).trim();
}

interface AuthedRequest extends Request {
  leoUserId?: string;
}

function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): void {
  const token = extractBearerToken(req);
  const user = store.getUserByToken(token, getOnlineUserIds());
  if (!user) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }
  req.leoUserId = user.id;
  next();
}

function buildLocalAiReply(
  prompt: string,
  userId: string
): {
  reply: string;
  suggestedModule?: PrivateModuleId;
  suggestedTab?: ConnectTabId | GlimpseTabId;
} {
  const lower = prompt.toLowerCase();
  const stories = store.getStories(userId);
  const posts = store.getPosts(userId);
  const connect = store.getConnectSnapshot(userId, getOnlineUserIds());

  if (lower.includes('story') || lower.includes('stories') || lower.includes('feed') || lower.includes('post')) {
    return {
      reply: `Your social Feed has ${posts.length} circle posts and ${stories.length} active 24-hour stories. Open Feed to share moments, react to stories, or bookmark posts.`,
      suggestedModule: 'feed',
    };
  }
  if (lower.includes('vault') || lower.includes('eclipse') || lower.includes('encrypt')) {
    return {
      reply:
        'Eclipse uses local PBKDF2 (250k iterations) + AES-256-GCM encryption directly in your browser IndexedDB. Your passphrase never touches the server.',
      suggestedModule: 'glimpses',
      suggestedTab: 'eclipse',
    };
  }
  if (lower.includes('camera') || lower.includes('snap') || lower.includes('photo') || lower.includes('glimpse')) {
    return {
      reply:
        'Camera & Glimpses lets you apply live studio filters, save captures to IndexedDB, or share directly to your 24h Story and Feed.',
      suggestedModule: 'glimpses',
      suggestedTab: lower.includes('camera') || lower.includes('snap') ? 'camera' : 'gallery',
    };
  }
  if (lower.includes('friend') || lower.includes('message') || lower.includes('chat') || lower.includes('group')) {
    return {
      reply: `Connect summary for ${userId}: ${connect.friends.length} friends, ${connect.requests.length} pending requests, ${connect.messages.length} direct messages, and ${connect.groups.length} active groups.`,
      suggestedModule: 'connect',
      suggestedTab: lower.includes('group') ? 'groups' : lower.includes('friend') ? 'circle' : 'chats',
    };
  }
  return {
    reply: `Command Core standing by, ${userId}. Active circle: ${connect.friends.length} friends, ${posts.length} feed posts, ${stories.length} live 24h stories, ${connect.groups.length} groups. Ask me to open Feed, Chats, Camera Studio, or Eclipse Vault.`,
  };
}

async function startServer() {
  await store.init();

  const app = express();
  app.use(express.json({ limit: '10mb' }));

  // Auth
  app.post('/api/auth/register', async (req, res) => {
    try {
      const { id, password } = req.body as { id?: string; password?: string };
      const result = store.register(id || '', password || '');
      await store.flush();
      res.status(201).json(result);
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  app.post('/api/auth/login', async (req, res) => {
    try {
      const { id, password } = req.body as { id?: string; password?: string };
      const result = store.login(id || '', password || '');
      await store.flush();
      res.json(result);
    } catch (err) {
      res.status(401).json({ error: (err as Error).message });
    }
  });

  app.get('/api/auth/me', (req, res) => {
    const user = store.getUserByToken(extractBearerToken(req), getOnlineUserIds());
    if (!user) {
      res.status(401).json({ error: 'Not authenticated.' });
      return;
    }
    res.json({ user });
  });

  app.post('/api/auth/logout', async (req, res) => {
    store.logout(extractBearerToken(req));
    await store.flush();
    res.json({ ok: true });
  });

  // Profile
  app.patch('/api/profile', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const user = store.updateProfile(req.leoUserId!, req.body || {}, getOnlineUserIds());
      await store.flush();
      const targets = [user.id, ...store.getFriendIds(user.id)];
      const { e2eeKeyBackup: _omitted, ...publicBroadcastUser } = user;
      broadcastToUsers(targets, { type: 'profile:updated', user: publicBroadcastUser });
      res.json({ user });
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  app.post('/api/e2ee/public-key', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const { publicKey, keyBackup } = req.body as {
        publicKey?: string;
        keyBackup?: E2eeEncryptedKeyBackup;
      };
      const onlineIds = getOnlineUserIds();
      const user = store.setE2eePublicKey(req.leoUserId!, publicKey || '', keyBackup, onlineIds);
      await store.flush();
      const targets = new Set<string>([user.id, ...onlineIds, ...store.getFriendIds(user.id)]);
      broadcastToUsers(targets, {
        type: 'e2ee:key-updated',
        userId: user.id,
        publicKey: user.e2eePublicKey || '',
      });
      res.json({ user });
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  app.get('/api/users/:id/profile', requireAuth, (req: AuthedRequest, res) => {
    try {
      const profile = store.getProfileView(
        req.leoUserId!,
        String(req.params.id),
        getOnlineUserIds()
      );
      res.json(profile);
    } catch (err) {
      res.status(404).json({ error: (err as Error).message });
    }
  });

  // Stories
  app.get('/api/stories', requireAuth, async (req: AuthedRequest, res) => {
    const stories = store.getStories(req.leoUserId!);
    await store.flush();
    res.json({ stories });
  });

  app.post('/api/stories', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const story = store.createStory(req.leoUserId!, req.body || {});
      await store.flush();
      const targets =
        story.visibility === 'private'
          ? [story.authorId]
          : [story.authorId, ...store.getFriendIds(story.authorId)];
      broadcastToUsers(targets, { type: 'story:new', story });
      res.status(201).json({ story });
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  app.post('/api/stories/:id/view', requireAuth, async (req: AuthedRequest, res) => {
    const story = store.markStoryViewed(req.leoUserId!, String(req.params.id));
    if (!story) {
      res.status(404).json({ error: 'Story not found.' });
      return;
    }
    await store.flush();
    broadcastToUsers([story.authorId, req.leoUserId!], { type: 'story:updated', story });
    res.json({ story });
  });

  app.post('/api/stories/:id/react', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const { emoji } = req.body as { emoji?: string };
      const story = store.reactToStory(req.leoUserId!, String(req.params.id), emoji || '');
      await store.flush();
      const targets = [story.authorId, ...store.getFriendIds(story.authorId)];
      broadcastToUsers(targets, { type: 'story:updated', story });
      res.json({ story });
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  app.post('/api/stories/:id/reply', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const { text } = req.body as { text?: string };
      const { message, notification } = store.replyToStory(
        req.leoUserId!,
        String(req.params.id),
        text || ''
      );
      await store.flush();
      broadcastToUsers([message.fromId, message.toId], { type: 'dm:new', message });
      if (notification) {
        broadcastToUsers([notification.userId], { type: 'notification:new', notification });
      }
      res.status(201).json({ message });
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  app.delete('/api/stories/:id', requireAuth, async (req: AuthedRequest, res) => {
    const storyId = String(req.params.id);
    const removed = store.deleteStory(req.leoUserId!, storyId);
    if (!removed) {
      res.status(404).json({ error: 'Story not found.' });
      return;
    }
    await store.flush();
    broadcastToUsers([req.leoUserId!, ...store.getFriendIds(req.leoUserId!)], {
      type: 'story:deleted',
      storyId,
    });
    res.json({ ok: true });
  });

  // Social Feed Posts
  app.get('/api/posts', requireAuth, (req: AuthedRequest, res) => {
    res.json({ posts: store.getPosts(req.leoUserId!) });
  });

  app.post('/api/posts', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const post = store.createPost(req.leoUserId!, req.body || {});
      await store.flush();
      const targets =
        post.visibility === 'private'
          ? [post.authorId]
          : [post.authorId, ...store.getFriendIds(post.authorId)];
      broadcastToUsers(targets, { type: 'post:new', post });
      res.status(201).json({ post });
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  app.post('/api/posts/:id/like', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const { post, notification } = store.togglePostLike(req.leoUserId!, String(req.params.id));
      await store.flush();
      const targets =
        post.visibility === 'private'
          ? [post.authorId]
          : [post.authorId, ...store.getFriendIds(post.authorId)];
      broadcastToUsers(targets, { type: 'post:updated', post });
      if (notification) {
        broadcastToUsers([notification.userId], { type: 'notification:new', notification });
      }
      res.json({ post });
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  app.post('/api/posts/:id/bookmark', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const post = store.togglePostBookmark(req.leoUserId!, String(req.params.id));
      await store.flush();
      res.json({ post });
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  app.post('/api/posts/:id/comments', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const { text } = req.body as { text?: string };
      const { post, notification } = store.addPostComment(
        req.leoUserId!,
        String(req.params.id),
        text || ''
      );
      await store.flush();
      const targets =
        post.visibility === 'private'
          ? [post.authorId]
          : [post.authorId, ...store.getFriendIds(post.authorId)];
      broadcastToUsers(targets, { type: 'post:updated', post });
      if (notification) {
        broadcastToUsers([notification.userId], { type: 'notification:new', notification });
      }
      res.status(201).json({ post });
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  app.delete('/api/posts/:id', requireAuth, async (req: AuthedRequest, res) => {
    const postId = String(req.params.id);
    const removed = store.deletePost(req.leoUserId!, postId);
    if (!removed) {
      res.status(404).json({ error: 'Post not found.' });
      return;
    }
    await store.flush();
    broadcastToUsers([req.leoUserId!, ...store.getFriendIds(req.leoUserId!)], {
      type: 'post:deleted',
      postId,
    });
    res.json({ ok: true });
  });

  // Connect: Friends, DMs, Groups
  app.get('/api/connect', requireAuth, (req: AuthedRequest, res) => {
    res.json(store.getConnectSnapshot(req.leoUserId!, getOnlineUserIds()));
  });

  app.post('/api/friends/request', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const { targetId } = req.body as { targetId?: string };
      const { request, notification } = store.sendFriendRequest(req.leoUserId!, targetId || '');
      await store.flush();
      broadcastToUsers([req.leoUserId!, request.toId], { type: 'friend:update' });
      if (notification) {
        broadcastToUsers([notification.userId], { type: 'notification:new', notification });
      }
      res.status(201).json({ request });
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  app.post('/api/friends/respond', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const { targetId, action } = req.body as {
        targetId?: string;
        action?: 'accept' | 'decline' | 'remove';
      };
      if (!targetId || !action) {
        res.status(400).json({ error: 'Missing targetId or action.' });
        return;
      }
      const { notification } = store.respondFriendRequest(req.leoUserId!, targetId, action);
      await store.flush();
      broadcastToUsers([req.leoUserId!, targetId], { type: 'friend:update' });
      if (notification) {
        broadcastToUsers([notification.userId], { type: 'notification:new', notification });
      }
      res.json({ ok: true });
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  app.post('/api/messages', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const { toId, text, mediaDataUrl, mediaType, e2ee, isSnap, replyToId, sharedPostId } =
        req.body as {
          toId?: string;
          text?: string;
          mediaDataUrl?: string;
          mediaType?: 'image' | 'video';
          e2ee?: E2eeDmEnvelope;
          isSnap?: boolean;
          replyToId?: string;
          sharedPostId?: string;
        };
      const { message, notification } = store.sendDirectMessage(req.leoUserId!, toId || '', {
        text,
        mediaDataUrl,
        mediaType,
        e2ee,
        isSnap,
        replyToId,
        sharedPostId,
      });
      await store.flush();
      broadcastToUsers([message.fromId, message.toId], { type: 'dm:new', message });
      if (notification) {
        broadcastToUsers([notification.userId], { type: 'notification:new', notification });
      }
      res.status(201).json({ message });
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  app.post('/api/messages/read', requireAuth, async (req: AuthedRequest, res) => {
    const { partnerId } = req.body as { partnerId?: string };
    if (!partnerId) {
      res.status(400).json({ error: 'Missing partnerId.' });
      return;
    }
    const result = store.markThreadRead(req.leoUserId!, partnerId);
    if (result.updated) {
      await store.flush();
      broadcastToUsers([req.leoUserId!, result.partnerId], {
        type: 'dm:read',
        fromId: result.partnerId,
        toId: req.leoUserId!,
        readAt: result.readAt,
      });
    }
    res.json({ ok: true, readAt: result.readAt });
  });

  app.post('/api/messages/:id/react', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const { emoji } = req.body as { emoji?: string };
      const message = store.reactToDirectMessage(req.leoUserId!, String(req.params.id), emoji || '');
      await store.flush();
      broadcastToUsers([message.fromId, message.toId], { type: 'dm:updated', message });
      res.json({ message });
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  app.post('/api/messages/:id/open-snap', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const { revealed, burned } = store.openSnapMessage(req.leoUserId!, String(req.params.id));
      await store.flush();
      broadcastToUsers([burned.fromId, burned.toId], { type: 'dm:updated', message: burned });
      res.json({ message: revealed });
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  app.post('/api/groups', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const { name, description } = req.body as { name?: string; description?: string };
      const group = store.createGroup(req.leoUserId!, name || '', description || '');
      await store.flush();
      broadcastToUsers(group.members, { type: 'group:updated', group });
      res.status(201).json({ group });
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  app.post('/api/groups/:id/members', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const { memberId } = req.body as { memberId?: string };
      const group = store.addGroupMember(req.leoUserId!, String(req.params.id), memberId || '');
      await store.flush();
      broadcastToUsers(group.members, { type: 'group:updated', group });
      res.json({ group });
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  app.post('/api/groups/:id/messages', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const { text, mediaDataUrl, mediaType, e2ee } = req.body as {
        text?: string;
        mediaDataUrl?: string;
        mediaType?: 'image' | 'video';
        e2ee?: E2eeGroupEnvelope;
      };
      const { group, notifications } = store.sendGroupMessage(req.leoUserId!, String(req.params.id), {
        text,
        mediaDataUrl,
        mediaType,
        e2ee,
      });
      await store.flush();
      broadcastToUsers(group.members, { type: 'group:updated', group });
      for (const n of notifications) {
        broadcastToUsers([n.userId], { type: 'notification:new', notification: n });
      }
      res.status(201).json({ group });
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  app.post('/api/groups/:id/messages/:msgId/react', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const { emoji } = req.body as { emoji?: string };
      const group = store.reactToGroupMessage(
        req.leoUserId!,
        String(req.params.id),
        String(req.params.msgId),
        emoji || ''
      );
      await store.flush();
      broadcastToUsers(group.members, { type: 'group:updated', group });
      res.json({ group });
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  app.delete('/api/groups/:id', requireAuth, async (req: AuthedRequest, res) => {
    const groupId = String(req.params.id);
    const { deleted, members } = store.deleteGroup(req.leoUserId!, groupId);
    if (!deleted) {
      res.status(404).json({ error: 'Group not found.' });
      return;
    }
    await store.flush();
    broadcastToUsers(members, { type: 'group:deleted', groupId });
    res.json({ ok: true });
  });

  // Notifications
  app.get('/api/notifications', requireAuth, (req: AuthedRequest, res) => {
    res.json({ notifications: store.getNotifications(req.leoUserId!) });
  });

  app.post('/api/notifications/read', requireAuth, async (req: AuthedRequest, res) => {
    store.markNotificationsRead(req.leoUserId!);
    await store.flush();
    res.json({ ok: true });
  });

  // Leo AI Assistant
  app.post('/api/leo-ai', requireAuth, async (req: AuthedRequest, res) => {
    const { prompt } = req.body as { prompt?: string };
    const cleanPrompt = (prompt || '').trim();
    if (!cleanPrompt) {
      res.status(400).json({ error: 'Enter a message for Leo AI.' });
      return;
    }

    const fallback = buildLocalAiReply(cleanPrompt, req.leoUserId!);
    const ai = getGeminiClient();
    if (!ai) {
      res.json(fallback);
      return;
    }

    try {
      const connect = store.getConnectSnapshot(req.leoUserId!, getOnlineUserIds());
      const stories = store.getStories(req.leoUserId!);
      const posts = store.getPosts(req.leoUserId!);
      const systemContext = [
        'You are Leo AI, the concise social and tactical assistant inside Leo World Private.',
        `Authenticated user: ${req.leoUserId}.`,
        `Current stats: ${connect.friends.length} friends, ${connect.requests.length} pending requests, ${posts.length} feed posts, ${stories.length} active 24h stories, ${connect.groups.length} groups.`,
        'Modules available: Feed & Stories (Instagram + Snapchat 24h stories), Chats & Circle (WhatsApp messaging + vanishing snaps + groups), Camera Studio & Eclipse Vault (live filters + local AES-256-GCM vault), Profile & Command Core.',
        'Keep replies concise (2-3 sentences max), practical, and grounded in actual features.',
      ].join(' ');

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `${systemContext}\n\nUser: ${cleanPrompt}`,
      });
      const text = response.text?.trim() || fallback.reply;
      res.json({
        reply: text,
        suggestedModule: fallback.suggestedModule,
        suggestedTab: fallback.suggestedTab,
      });
    } catch {
      res.json(fallback);
    }
  });

  const server = http.createServer(app);

  if (!isProduction) {
    const hmrDisabled = process.env.DISABLE_HMR === 'true';
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        ws: { server },
        ...(hmrDisabled ? { hmr: false } : {}),
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      const indexHtml = path.join(distDir, 'index.html');
      if (fs.existsSync(indexHtml)) {
        res.sendFile(indexHtml);
      } else {
        res.status(404).send('Build output not found.');
      }
    });
  }

  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    try {
      const url = new URL(request.url || '/', 'http://localhost');
      if (url.pathname !== '/ws') {
        if (request.headers['sec-websocket-protocol']?.includes('vite-hmr')) {
          return;
        }
        socket.destroy();
        return;
      }
      const token = url.searchParams.get('token') || undefined;
      const user = store.getUserByToken(token);
      if (!user) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, user.id);
      });
    } catch {
      socket.destroy();
    }
  });

  wss.on('connection', (ws: WebSocket, userId: string) => {
    let set = onlineSockets.get(userId);
    if (!set) {
      set = new Set();
      onlineSockets.set(userId, set);
    }
    set.add(ws);
    broadcastPresence();

    ws.on('message', (rawData) => {
      try {
        const parsed = JSON.parse(String(rawData)) as {
          type?: string;
          threadType?: 'dm' | 'group';
          targetId?: string;
          isTyping?: boolean;
        };
        if (parsed.type === 'typing' && parsed.targetId && (parsed.threadType === 'dm' || parsed.threadType === 'group')) {
          const event: RealtimeEventPayload = {
            type: 'typing',
            threadType: parsed.threadType,
            targetId: parsed.targetId,
            fromId: userId,
            isTyping: Boolean(parsed.isTyping),
          };
          if (parsed.threadType === 'dm') {
            broadcastToUsers([parsed.targetId], event);
          } else {
            const snap = store.getConnectSnapshot(userId);
            const grp = snap.groups.find((g) => g.id === parsed.targetId);
            if (grp) {
              broadcastToUsers(
                grp.members.filter((m) => m !== userId),
                event
              );
            }
          }
        }
      } catch {
        // Ignore malformed socket frames
      }
    });

    ws.on('close', () => {
      const sockets = onlineSockets.get(userId);
      if (sockets) {
        sockets.delete(ws);
        if (sockets.size === 0) {
          onlineSockets.delete(userId);
        }
      }
      broadcastPresence();
    });
  });

  const shutdown = async () => {
    await store.flush();
    server.close(() => {
      process.exit(0);
    });
  };
  process.on('SIGTERM', () => {
    void shutdown();
  });
  process.on('SIGINT', () => {
    void shutdown();
  });

  server.listen(PORT, '0.0.0.0', () => {
    console.log(
      `Leo World server running on http://0.0.0.0:${PORT} (storage: ${store.isSupabaseEnabled() ? 'Supabase leo_state' : 'local file'})`
    );
  });
}

startServer();
