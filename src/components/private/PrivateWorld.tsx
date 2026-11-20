import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import {
  ArrowLeft,
  Bell,
  Camera,
  Check,
  Home,
  KeyRound,
  LogOut,
  MessageSquare,
  User as UserIcon,
} from 'lucide-react';
import type {
  ConnectSnapshot,
  ConnectTabId,
  FeedPostItem,
  GlimpseTabId,
  LeoUser,
  NotificationItem,
  PrivateModuleId,
  RealtimeEventPayload,
  StoryItem,
} from '../../types/leo';
import {
  fetchConnect,
  fetchNotifications,
  fetchPosts,
  fetchStories,
  logoutAccount,
  markNotificationsRead,
  publishE2eePublicKey,
} from '../../utils/apiClient';
import { generateE2eeKeyPair, type E2eeIdentity } from '../../utils/e2eeCrypto';
import { syncE2eeOnPasswordAuth } from '../../utils/e2eeSessionSync';
import {
  getEclipseRecords,
  getStoredE2eeIdentity,
  saveStoredE2eeIdentity,
} from '../../utils/indexedDbStorage';
import { RealtimeClient } from '../../utils/realtimeClient';
import { PWAInstallButton } from '../pwa/PWAInstallButton';
import { ConnectModule } from './ConnectModule';
import { GlimpsesModule } from './GlimpsesModule';
import { PrivateAuth } from './PrivateAuth';
import { ProfileModule } from './ProfileModule';
import { SocialFeedModule } from './SocialFeedModule';

interface PrivateWorldProps {
  user: LeoUser | null;
  onUserChange: (user: LeoUser | null) => void;
  onReturnPublic: () => void;
}

const EMPTY_CONNECT: ConnectSnapshot = {
  friends: [],
  requests: [],
  directory: [],
  messages: [],
  groups: [],
};

export function PrivateWorld({
  user,
  onUserChange,
  onReturnPublic,
}: PrivateWorldProps) {
  const [activeModule, setActiveModule] = useState<PrivateModuleId>('feed');
  const [connectTab, setConnectTab] = useState<ConnectTabId>('chats');
  const [glimpseTab, setGlimpseTab] = useState<GlimpseTabId>('camera');
  const [selectedChatPartner, setSelectedChatPartner] = useState<string>('');
  const [inspectedProfileId, setInspectedProfileId] = useState<string>('');

  const [stories, setStories] = useState<StoryItem[]>([]);
  const [posts, setPosts] = useState<FeedPostItem[]>([]);
  const [connectSnapshot, setConnectSnapshot] = useState<ConnectSnapshot>(EMPTY_CONNECT);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [vaultItemCount, setVaultItemCount] = useState(0);

  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(() => new Set());
  const [typingUsers, setTypingUsers] = useState<Record<string, number>>({});
  const [notifOpen, setNotifOpen] = useState(false);
  const [e2eeIdentity, setE2eeIdentity] = useState<E2eeIdentity | null>(null);
  const [needsKeyUnlock, setNeedsKeyUnlock] = useState(false);
  const [unlockPassword, setUnlockPassword] = useState('');
  const [unlockStatus, setUnlockStatus] = useState('');
  const [unlockBusy, setUnlockBusy] = useState(false);

  const realtimeRef = useRef<RealtimeClient | null>(null);
  const userRef = useRef<LeoUser | null>(user);
  userRef.current = user;

  const loadWorkspaceData = useCallback(async () => {
    if (!user) return;
    try {
      const [storiesData, postsData, connectData, notifsData, vaultRecords] = await Promise.all([
        fetchStories(),
        fetchPosts(),
        fetchConnect(),
        fetchNotifications(),
        getEclipseRecords().catch(() => []),
      ]);
      setStories(storiesData);
      setPosts(postsData);
      setConnectSnapshot(connectData);
      setNotifications(notifsData);
      setVaultItemCount(vaultRecords.length);

      // Sync online IDs from connect snapshot
      const seededOnline = new Set<string>([user.id]);
      for (const f of connectData.friends) {
        if (f.isOnline) seededOnline.add(f.id);
      }
      setOnlineUserIds((prev) => new Set([...prev, ...seededOnline]));
    } catch {
      // Keep existing state if a refresh call fails transiently
    }
  }, [user]);

  useEffect(() => {
    loadWorkspaceData();
  }, [loadWorkspaceData]);

  // Provision or verify local ECDH P-256 E2EE identity per user
  useEffect(() => {
    const activeUserId = user?.id;
    const activePublicKey = user?.e2eePublicKey;
    const hasBackup = Boolean(user?.e2eeKeyBackup);

    if (!activeUserId) {
      setE2eeIdentity(null);
      setNeedsKeyUnlock(false);
      return;
    }

    let cancelled = false;
    async function initE2eeIdentity() {
      try {
        let record = await getStoredE2eeIdentity(activeUserId!).catch(() => null);
        const matchesAccountKey =
          Boolean(record) && (!activePublicKey || record!.publicKeySpki === activePublicKey);

        if (record && matchesAccountKey) {
          if (cancelled) return;
          setNeedsKeyUnlock(false);
          setE2eeIdentity({
            userId: activeUserId!,
            keyPair: record.keyPair,
            publicKeySpki: record.publicKeySpki,
            createdAt: record.createdAt,
          });
          if (!activePublicKey) {
            const updatedUser = await publishE2eePublicKey(record.publicKeySpki);
            if (!cancelled) {
              onUserChange(updatedUser);
            }
          }
          return;
        }

        // If user has an encrypted cross-device backup on server, wait for password unlock
        // instead of generating a conflicting new keypair.
        if (hasBackup) {
          if (!cancelled) {
            setE2eeIdentity(null);
            setNeedsKeyUnlock(true);
          }
          return;
        }

        // Fallback for pre-sync sessions with no backup yet
        const generated = await generateE2eeKeyPair();
        record = {
          id: activeUserId!,
          keyPair: generated.keyPair,
          publicKeySpki: generated.publicKeySpki,
          createdAt: Date.now(),
        };
        await saveStoredE2eeIdentity(record).catch(() => {});
        if (cancelled) return;
        setNeedsKeyUnlock(false);
        setE2eeIdentity({
          userId: activeUserId!,
          keyPair: record.keyPair,
          publicKeySpki: record.publicKeySpki,
          createdAt: record.createdAt,
        });

        if (userRef.current?.e2eePublicKey !== record.publicKeySpki) {
          const updatedUser = await publishE2eePublicKey(record.publicKeySpki);
          if (!cancelled) {
            onUserChange(updatedUser);
          }
        }
      } catch {
        // Fallback cleanly if WebCrypto subtle is unavailable
      }
    }

    initE2eeIdentity();
    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.e2eePublicKey, user?.e2eeKeyBackup, onUserChange]);

  async function handleUnlockKeyBackup(e: FormEvent) {
    e.preventDefault();
    if (!user || !unlockPassword) return;
    setUnlockBusy(true);
    setUnlockStatus('');
    try {
      const syncedUser = await syncE2eeOnPasswordAuth(user, unlockPassword);
      const stored = await getStoredE2eeIdentity(user.id);
      if (stored) {
        setE2eeIdentity({
          userId: user.id,
          keyPair: stored.keyPair,
          publicKeySpki: stored.publicKeySpki,
          createdAt: stored.createdAt,
        });
      }
      setNeedsKeyUnlock(false);
      setUnlockPassword('');
      onUserChange(syncedUser);
    } catch (err) {
      setUnlockStatus((err as Error).message || 'Wrong password for encrypted E2EE backup.');
    } finally {
      setUnlockBusy(false);
    }
  }

  // Real-time WebSocket lifecycle
  useEffect(() => {
    if (!user) {
      realtimeRef.current?.disconnect();
      realtimeRef.current = null;
      return;
    }

    const client = new RealtimeClient();
    realtimeRef.current = client;

    const unsubscribe = client.subscribe((event: RealtimeEventPayload) => {
      switch (event.type) {
        case 'presence:update':
          setOnlineUserIds(new Set(event.onlineUserIds));
          break;
        case 'typing': {
          const key =
            event.threadType === 'dm'
              ? `dm:${event.fromId}`
              : `group:${event.targetId}:${event.fromId}`;
          setTypingUsers((prev) => {
            const next = { ...prev };
            if (event.isTyping) {
              next[key] = Date.now();
            } else {
              delete next[key];
            }
            return next;
          });
          break;
        }
        case 'dm:new':
          setConnectSnapshot((prev) => {
            if (prev.messages.some((m) => m.id === event.message.id)) return prev;
            return { ...prev, messages: [...prev.messages, event.message] };
          });
          break;
        case 'dm:updated':
          setConnectSnapshot((prev) => ({
            ...prev,
            messages: prev.messages.map((m) =>
              m.id === event.message.id ? event.message : m
            ),
          }));
          break;
        case 'dm:read':
          setConnectSnapshot((prev) => ({
            ...prev,
            messages: prev.messages.map((m) =>
              m.fromId === event.fromId && m.toId === event.toId && !m.readAt
                ? { ...m, readAt: event.readAt }
                : m
            ),
          }));
          break;
        case 'group:updated':
          setConnectSnapshot((prev) => {
            const exists = prev.groups.some((g) => g.id === event.group.id);
            return {
              ...prev,
              groups: exists
                ? prev.groups.map((g) => (g.id === event.group.id ? event.group : g))
                : [event.group, ...prev.groups],
            };
          });
          break;
        case 'group:deleted':
          setConnectSnapshot((prev) => ({
            ...prev,
            groups: prev.groups.filter((g) => g.id !== event.groupId),
          }));
          break;
        case 'post:new':
          setPosts((prev) =>
            prev.some((p) => p.id === event.post.id) ? prev : [event.post, ...prev]
          );
          break;
        case 'post:updated':
          setPosts((prev) => prev.map((p) => (p.id === event.post.id ? event.post : p)));
          break;
        case 'post:deleted':
          setPosts((prev) => prev.filter((p) => p.id !== event.postId));
          break;
        case 'story:new':
          setStories((prev) =>
            prev.some((s) => s.id === event.story.id) ? prev : [event.story, ...prev]
          );
          break;
        case 'story:updated':
          setStories((prev) => prev.map((s) => (s.id === event.story.id ? event.story : s)));
          break;
        case 'story:deleted':
          setStories((prev) => prev.filter((s) => s.id !== event.storyId));
          break;
        case 'notification:new':
          setNotifications((prev) => [event.notification, ...prev]);
          break;
        case 'friend:update':
        case 'profile:updated':
          if (event.type === 'profile:updated' && event.user.id === user.id) {
            onUserChange(event.user);
          }
          loadWorkspaceData();
          break;
        case 'e2ee:key-updated':
          setConnectSnapshot((prev) => ({
            ...prev,
            friends: prev.friends.map((f) =>
              f.id === event.userId ? { ...f, e2eePublicKey: event.publicKey } : f
            ),
            directory: prev.directory.map((d) =>
              d.id === event.userId ? { ...d, e2eePublicKey: event.publicKey } : d
            ),
          }));
          break;
      }
    });

    client.connect();

    // Clear stale typing entries periodically
    const cleanupTimer = window.setInterval(() => {
      const cutoff = Date.now() - 4000;
      setTypingUsers((prev) => {
        const keys = Object.keys(prev);
        if (keys.every((k) => prev[k] > cutoff)) return prev;
        const next: Record<string, number> = {};
        for (const k of keys) {
          if (prev[k] > cutoff) next[k] = prev[k];
        }
        return next;
      });
    }, 2000);

    return () => {
      window.clearInterval(cleanupTimer);
      unsubscribe();
      client.disconnect();
      realtimeRef.current = null;
    };
  }, [user?.id, loadWorkspaceData, onUserChange]);

  function navigateToModule(module: PrivateModuleId, tab?: ConnectTabId | GlimpseTabId) {
    setActiveModule(module);
    setNotifOpen(false);
    if (module === 'profile') {
      setInspectedProfileId(user?.id || '');
    }
    if (module === 'connect' && (tab === 'chats' || tab === 'groups' || tab === 'circle')) {
      setConnectTab(tab);
    }
    if (module === 'glimpses' && (tab === 'camera' || tab === 'gallery' || tab === 'eclipse')) {
      setGlimpseTab(tab);
    }
  }

  function handleOpenProfile(targetUserId: string) {
    setInspectedProfileId(targetUserId);
    setActiveModule('profile');
    setNotifOpen(false);
  }

  function handleOpenChatWith(partnerId: string) {
    setSelectedChatPartner(partnerId);
    setConnectTab('chats');
    setActiveModule('connect');
    setNotifOpen(false);
  }

  function handleSendTyping(threadType: 'dm' | 'group', targetId: string, isTyping: boolean) {
    realtimeRef.current?.sendTyping(threadType, targetId, isTyping);
  }

  async function handleMarkNotificationsRead() {
    await markNotificationsRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }

  async function handleLogout() {
    realtimeRef.current?.disconnect();
    await logoutAccount();
    setActiveModule('feed');
    onUserChange(null);
  }

  const unreadNotifCount = notifications.filter((n) => !n.read).length;
  const unreadChatsCount = user
    ? connectSnapshot.messages.filter((m) => m.toId === user.id && !m.readAt).length
    : 0;

  return (
    <div className="private-world-bg font-private-ui relative min-h-screen text-[#d8fbff]">
      <div className="private-grid-overlay pointer-events-none fixed inset-0" aria-hidden="true" />

      {/* Top Bar: Brand | 4 Nav Links | Notifications + Sign Out */}
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#040a14]/92 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <button
            type="button"
            onClick={() => (user ? navigateToModule('feed') : onReturnPublic())}
            className="shrink-0 text-base font-bold tracking-[0.14em] whitespace-nowrap text-[#e6fcff] sm:text-lg"
          >
            LEO WORLD <span className="text-[#42e8f5]">PRIVATE</span>
          </button>

          {user && (
            <nav className="hidden items-center gap-6 text-sm font-medium text-[#9cc8d6] md:flex">
              <button
                type="button"
                onClick={() => navigateToModule('feed')}
                className={`whitespace-nowrap shrink-0 transition hover:text-white ${
                  activeModule === 'feed' ? 'text-[#42e8f5]' : ''
                }`}
              >
                Feed
              </button>
              <button
                type="button"
                onClick={() => navigateToModule('connect', 'chats')}
                className={`whitespace-nowrap shrink-0 transition hover:text-white ${
                  activeModule === 'connect' ? 'text-[#42e8f5]' : ''
                }`}
              >
                Chats{unreadChatsCount > 0 ? ` (${unreadChatsCount})` : ''}
              </button>
              <button
                type="button"
                onClick={() => navigateToModule('glimpses')}
                className={`whitespace-nowrap shrink-0 transition hover:text-white ${
                  activeModule === 'glimpses' ? 'text-[#42e8f5]' : ''
                }`}
              >
                Camera &amp; Vault
              </button>
              <button
                type="button"
                onClick={() => navigateToModule('profile')}
                className={`whitespace-nowrap shrink-0 transition hover:text-white ${
                  activeModule === 'profile' ? 'text-[#42e8f5]' : ''
                }`}
              >
                Profile
              </button>
            </nav>
          )}

          <div className="relative flex shrink-0 items-center gap-2.5">
            <PWAInstallButton variant="private" />
            {user ? (
              <>
                <button
                  type="button"
                  onClick={() => setNotifOpen((v) => !v)}
                  aria-label={`Notifications (${unreadNotifCount} unread)`}
                  className="relative grid h-10 w-10 place-items-center rounded-xl border border-[#244e5e] bg-[#081927] text-[#c7f3fc] transition hover:border-[#42e8f5] hover:text-white"
                >
                  <Bell className="h-4 w-4" />
                  {unreadNotifCount > 0 && (
                    <span className="font-tech-mono absolute -top-1 -right-1 grid min-h-[18px] min-w-[18px] place-items-center rounded-full bg-[#42e8f5] px-1 text-[10px] font-bold text-[#04101a]">
                      {unreadNotifCount}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleLogout}
                  aria-label="Sign out"
                  className="inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-[#244e5e] bg-[#081927] px-3.5 py-2 text-xs font-semibold whitespace-nowrap text-[#c7f3fc] transition hover:border-[#42e8f5] hover:text-white"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Sign Out</span>
                </button>

                {/* Notifications Dropdown */}
                {notifOpen && (
                  <div
                    role="region"
                    aria-label="Activity notifications"
                    className="absolute top-12 right-0 z-50 w-80 max-w-[calc(100vw-2rem)] space-y-3 rounded-2xl border border-[#27586b] bg-[#071522] p-4 shadow-2xl"
                  >
                    <div className="flex items-center justify-between border-b border-[#194254] pb-2">
                      <span className="text-sm font-semibold text-[#e8fbff]">Activity</span>
                      {unreadNotifCount > 0 && (
                        <button
                          type="button"
                          onClick={handleMarkNotificationsRead}
                          className="inline-flex items-center gap-1 text-xs text-[#42e8f5] hover:underline"
                        >
                          <Check className="h-3.5 w-3.5" />
                          <span>Mark all read</span>
                        </button>
                      )}
                    </div>
                    <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                      {notifications.length === 0 ? (
                        <p className="py-3 text-xs text-[#8db9c7]">No notifications yet.</p>
                      ) : (
                        notifications.slice(0, 15).map((n) => (
                          <button
                            key={n.id}
                            type="button"
                            onClick={() => {
                              if (n.kind === 'dm' || n.kind === 'story_reply') {
                                handleOpenChatWith(n.actorId);
                              } else if (n.kind === 'friend_request' || n.kind === 'friend_accept') {
                                navigateToModule('connect', 'circle');
                              } else if (n.kind === 'group') {
                                navigateToModule('connect', 'groups');
                              } else {
                                navigateToModule('feed');
                              }
                            }}
                            className={`w-full rounded-xl border p-2.5 text-left text-xs transition ${
                              n.read
                                ? 'border-[#183d4d] bg-[#05101b] text-[#95c3d1]'
                                : 'border-[#2c6b82] bg-[#0a2636] text-[#e8fbff]'
                            }`}
                          >
                            <span className="font-semibold text-[#65eaff]">{n.actorName}</span>{' '}
                            <span>{n.text}</span>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <button
                type="button"
                onClick={onReturnPublic}
                className="inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-[#244e5e] bg-[#081927] px-3.5 py-2 text-xs font-semibold whitespace-nowrap text-[#c7f3fc] transition hover:border-[#42e8f5] hover:text-white"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Public Games</span>
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-6xl px-4 pt-6 pb-28 sm:px-6 md:pb-14">
        {!user ? (
          <PrivateAuth onAuthenticated={onUserChange} onReturnPublic={onReturnPublic} />
        ) : (
          <>
            {needsKeyUnlock && (
              <section
                aria-label="Unlock cross-device E2EE key"
                className="mb-6 rounded-2xl border border-emerald-400/40 bg-[#061e26]/95 p-4 shadow-lg sm:p-5"
              >
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="max-w-xl">
                    <div className="flex items-center gap-2 text-xs font-semibold tracking-wider uppercase text-emerald-300">
                      <KeyRound className="h-4 w-4" />
                      <span>Cross-Device E2EE Key Locked</span>
                    </div>
                    <p className="mt-1 text-sm text-[#d4f4fc]">
                      Enter your account password once to decrypt your synced ECDH P-256 key on this
                      device and read encrypted chats.
                    </p>
                  </div>
                  <form
                    onSubmit={handleUnlockKeyBackup}
                    className="flex flex-wrap items-center gap-2"
                  >
                    <label htmlFor="unlock-e2ee-password" className="sr-only">
                      Account password to unlock E2EE key
                    </label>
                    <input
                      id="unlock-e2ee-password"
                      type="password"
                      value={unlockPassword}
                      onChange={(e) => setUnlockPassword(e.target.value)}
                      placeholder="Enter account password"
                      className="min-h-[40px] rounded-xl border border-[#245669] bg-[#040d17] px-3 py-2 text-sm text-white placeholder:text-[#5c8696]"
                    />
                    <button
                      type="submit"
                      disabled={unlockBusy || !unlockPassword}
                      className="min-h-[40px] rounded-xl border border-emerald-400/60 bg-emerald-950/70 px-4 py-2 text-xs font-semibold text-emerald-100 hover:bg-emerald-900/70 disabled:opacity-50"
                    >
                      {unlockBusy ? 'Unlocking…' : 'Unlock Keys'}
                    </button>
                  </form>
                </div>
                {unlockStatus && (
                  <p className="mt-2 text-xs text-rose-300" aria-live="polite">
                    {unlockStatus}
                  </p>
                )}
              </section>
            )}

            {activeModule === 'feed' && (
              <SocialFeedModule
                currentUserId={user.id}
                currentUserName={user.displayName}
                currentUserAvatar={user.avatarDataUrl}
                stories={stories}
                posts={posts}
                friends={connectSnapshot.friends}
                onlineUserIds={onlineUserIds}
                onRefresh={loadWorkspaceData}
                onViewProfile={handleOpenProfile}
                onOpenChat={handleOpenChatWith}
              />
            )}

            {activeModule === 'connect' && (
              <ConnectModule
                currentUserId={user.id}
                e2eeIdentity={e2eeIdentity}
                activeTab={connectTab}
                onChangeTab={setConnectTab}
                snapshot={connectSnapshot}
                selectedPartner={selectedChatPartner}
                onSelectPartner={setSelectedChatPartner}
                onlineUserIds={onlineUserIds}
                typingUsers={typingUsers}
                onSendTyping={handleSendTyping}
                onViewProfile={handleOpenProfile}
                onRefresh={loadWorkspaceData}
              />
            )}

            {activeModule === 'glimpses' && (
              <GlimpsesModule
                activeTab={glimpseTab}
                onChangeTab={setGlimpseTab}
                onVaultCountChange={setVaultItemCount}
                onSocialCreated={loadWorkspaceData}
              />
            )}

            {activeModule === 'profile' && (
              <ProfileModule
                currentUser={user}
                targetUserId={inspectedProfileId || user.id}
                allPosts={posts}
                friendsCount={connectSnapshot.friends.length}
                storiesCount={stories.length}
                vaultItemCount={vaultItemCount}
                onlineUserIds={onlineUserIds}
                onUserUpdated={onUserChange}
                onRefresh={loadWorkspaceData}
                onBackToSelf={() => setInspectedProfileId(user.id)}
                onOpenChat={handleOpenChatWith}
                onNavigateModule={navigateToModule}
              />
            )}

            <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-5 text-xs text-[#79a8b8]">
              <span>Signed in as @{user.id}</span>
              <button
                type="button"
                onClick={onReturnPublic}
                className="underline-offset-4 hover:text-white hover:underline"
              >
                Switch back to Wizarding Front
              </button>
            </div>
          </>
        )}
      </main>

      {/* Mobile-only bottom dock */}
      {user && (
        <nav
          aria-label="Mobile private navigation"
          className="fixed inset-x-3 bottom-3 z-40 grid grid-cols-4 gap-1 rounded-2xl border border-white/15 bg-[#060f1d]/95 p-1.5 shadow-2xl backdrop-blur-lg md:hidden"
        >
          <button
            type="button"
            onClick={() => navigateToModule('feed')}
            className={`flex min-h-[48px] flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-medium transition ${
              activeModule === 'feed' ? 'bg-[#0e4355] text-white' : 'text-[#8cbac7]'
            }`}
          >
            <Home className="h-4 w-4" />
            <span>Feed</span>
          </button>
          <button
            type="button"
            onClick={() => navigateToModule('connect', 'chats')}
            className={`flex min-h-[48px] flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-medium transition ${
              activeModule === 'connect' ? 'bg-[#0e4355] text-white' : 'text-[#8cbac7]'
            }`}
          >
            <MessageSquare className="h-4 w-4" />
            <span>Chats{unreadChatsCount > 0 ? ` (${unreadChatsCount})` : ''}</span>
          </button>
          <button
            type="button"
            onClick={() => navigateToModule('glimpses')}
            className={`flex min-h-[48px] flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-medium transition ${
              activeModule === 'glimpses' ? 'bg-[#0e4355] text-white' : 'text-[#8cbac7]'
            }`}
          >
            <Camera className="h-4 w-4" />
            <span>Camera</span>
          </button>
          <button
            type="button"
            onClick={() => navigateToModule('profile')}
            className={`flex min-h-[48px] flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-medium transition ${
              activeModule === 'profile' ? 'bg-[#0e4355] text-white' : 'text-[#8cbac7]'
            }`}
          >
            <UserIcon className="h-4 w-4" />
            <span>Profile</span>
          </button>
        </nav>
      )}
    </div>
  );
}
