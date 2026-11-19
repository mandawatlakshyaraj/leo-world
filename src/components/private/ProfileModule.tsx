import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  Bookmark,
  Camera,
  Check,
  Cpu,
  Edit3,
  Heart,
  MessageCircle,
  MessageSquare,
  UserPlus,
  X,
} from 'lucide-react';
import type {
  ConnectTabId,
  FeedPostItem,
  GlimpseTabId,
  LeoUser,
  PrivateModuleId,
  UserProfileView,
} from '../../types/leo';
import {
  fetchUserProfile,
  sendFriendRequest,
  updateUserProfile,
} from '../../utils/apiClient';
import { ArcReactorCore } from './ArcReactorCore';
import { LeoAiAssistant } from './LeoAiAssistant';
import { UserAvatar } from './UserAvatar';

interface ProfileModuleProps {
  currentUser: LeoUser;
  targetUserId: string;
  allPosts: FeedPostItem[];
  friendsCount: number;
  storiesCount: number;
  vaultItemCount: number;
  onlineUserIds: Set<string>;
  onUserUpdated: (user: LeoUser) => void;
  onRefresh: () => Promise<void>;
  onBackToSelf: () => void;
  onOpenChat: (partnerId: string) => void;
  onNavigateModule: (module: PrivateModuleId, tab?: ConnectTabId | GlimpseTabId) => void;
}

export function ProfileModule({
  currentUser,
  targetUserId,
  allPosts,
  friendsCount,
  storiesCount,
  vaultItemCount,
  onlineUserIds,
  onUserUpdated,
  onRefresh,
  onBackToSelf,
  onOpenChat,
  onNavigateModule,
}: ProfileModuleProps) {
  const isSelf = targetUserId === currentUser.id;
  const [profileView, setProfileView] = useState<UserProfileView | null>(null);
  const [loading, setLoading] = useState(false);

  // Self Edit state
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState(currentUser.displayName);
  const [bio, setBio] = useState(currentUser.bio);
  const [statusText, setStatusText] = useState(currentUser.status);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');

  // Profile sub-tabs
  const [gridTab, setGridTab] = useState<'posts' | 'saved'>('posts');
  const [showCommandCore, setShowCommandCore] = useState(false);
  const [lightboxPost, setLightboxPost] = useState<FeedPostItem | null>(null);

  const avatarInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setNotice('');
    fetchUserProfile(targetUserId)
      .then((view) => {
        if (!active) return;
        setProfileView(view);
        if (view.user.id === currentUser.id) {
          setDisplayName(view.user.displayName);
          setBio(view.user.bio);
          setStatusText(view.user.status);
        }
      })
      .catch((err) => {
        if (active) setNotice((err as Error).message || 'Could not load profile.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [targetUserId, currentUser.id, allPosts.length]);

  async function handleSaveProfile(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setNotice('');
    try {
      const updated = await updateUserProfile({
        displayName: displayName.trim(),
        bio: bio.trim(),
        status: statusText.trim(),
      });
      onUserUpdated(updated);
      setEditing(false);
      setNotice('Profile saved.');
      await onRefresh();
    } catch (err) {
      setNotice((err as Error).message || 'Could not save profile.');
    } finally {
      setSaving(false);
    }
  }

  function handleAvatarFile(file: File | undefined) {
    if (!file) return;
    if (file.size > 2.5 * 1024 * 1024) {
      setNotice('Choose an avatar image under 2.5 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const updated = await updateUserProfile({
          avatarDataUrl: String(reader.result || ''),
        });
        onUserUpdated(updated);
        setNotice('Profile photo updated.');
        await onRefresh();
      } catch (err) {
        setNotice((err as Error).message || 'Could not update avatar.');
      }
    };
    reader.readAsDataURL(file);
  }

  async function handleConnectRequest() {
    try {
      await sendFriendRequest(targetUserId);
      const updatedView = await fetchUserProfile(targetUserId);
      setProfileView(updatedView);
      setNotice(`Circle request sent to @${targetUserId}.`);
      await onRefresh();
    } catch (err) {
      setNotice((err as Error).message || 'Could not send request.');
    }
  }

  const displayedUser = profileView?.user || (isSelf ? currentUser : null);
  const userPosts =
    profileView?.posts ||
    allPosts.filter((p) => p.authorId === targetUserId);
  const savedPosts = allPosts.filter((p) => p.bookmarks.includes(currentUser.id));
  const gridPosts = isSelf && gridTab === 'saved' ? savedPosts : userPosts;
  const isOnline = onlineUserIds.has(targetUserId);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {!isSelf && (
        <button
          type="button"
          onClick={onBackToSelf}
          className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-[#244e5e] bg-[#061421] px-3.5 py-1.5 text-xs font-medium text-[#b5f0fc] hover:border-[#42e8f5]"
        >
          <span>Back to My Profile</span>
        </button>
      )}

      {/* Profile Header Card */}
      <section className="rounded-2xl border border-[#1d4b5d] bg-[#071522] p-5 sm:p-7">
        {loading && !displayedUser ? (
          <p className="text-sm text-[#8db9c7]">Loading profile…</p>
        ) : displayedUser ? (
          <div className="space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-5">
              <div className="flex items-center gap-4 sm:gap-5">
                <div className="relative">
                  <UserAvatar
                    name={displayedUser.displayName}
                    avatarDataUrl={displayedUser.avatarDataUrl}
                    isOnline={isOnline}
                    size="lg"
                  />
                  {isSelf && (
                    <>
                      <input
                        ref={avatarInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        tabIndex={-1}
                        aria-hidden="true"
                        onChange={(e) => {
                          handleAvatarFile(e.target.files?.[0]);
                          e.target.value = '';
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => avatarInputRef.current?.click()}
                        aria-label="Change profile photo"
                        className="absolute -right-1 -bottom-1 grid h-8 w-8 place-items-center rounded-full border border-[#42e8f5] bg-[#0a3c4c] text-white shadow hover:bg-[#0e4d61]"
                      >
                        <Camera className="h-3.5 w-3.5" />
                      </button>
                    </>
                  )}
                </div>

                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-2xl font-bold text-[#e8fbff]">
                      {displayedUser.displayName}
                    </h2>
                    <span className="font-tech-mono text-xs text-[#65eaff]">
                      @{displayedUser.id}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-[#c7eef7]">
                    {displayedUser.bio || 'No bio set yet.'}
                  </p>
                  <p className="mt-1 text-xs text-[#8db9c7]">
                    {isOnline ? 'Online now' : displayedUser.status}
                  </p>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex flex-wrap items-center gap-2">
                {isSelf ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setEditing((v) => !v)}
                      className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-[#2b6275] bg-[#092332] px-4 py-2 text-xs font-semibold text-[#e6fcff] transition hover:border-[#42e8f5]"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                      <span>{editing ? 'Cancel Edit' : 'Edit Profile'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowCommandCore((v) => !v)}
                      className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border px-4 py-2 text-xs font-semibold transition ${
                        showCommandCore
                          ? 'border-[#42e8f5] bg-[#0e4355] text-white'
                          : 'border-[#2b6275] bg-[#092332] text-[#a5e7f2] hover:border-[#42e8f5]'
                      }`}
                    >
                      <Cpu className="h-3.5 w-3.5" />
                      <span>Command Core</span>
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => onOpenChat(displayedUser.id)}
                      className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-[#42e8f5] bg-[#0a3c4c] px-4 py-2 text-xs font-semibold text-[#e6fcff] hover:bg-[#0e4d61]"
                    >
                      <MessageSquare className="h-3.5 w-3.5" />
                      <span>Message</span>
                    </button>
                    {profileView && !profileView.isFriend && !profileView.hasPendingRequest && (
                      <button
                        type="button"
                        onClick={handleConnectRequest}
                        className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-[#2b6275] bg-[#092332] px-4 py-2 text-xs font-semibold text-[#e6fcff]"
                      >
                        <UserPlus className="h-3.5 w-3.5" />
                        <span>Add Friend</span>
                      </button>
                    )}
                    {profileView?.isFriend && (
                      <span className="inline-flex min-h-[40px] items-center gap-1 rounded-xl border border-emerald-500/40 bg-emerald-950/40 px-3 py-2 text-xs text-emerald-200">
                        <Check className="h-3.5 w-3.5" />
                        <span>Connected</span>
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Stats Row */}
            <dl className="grid grid-cols-3 divide-x divide-[#194254] rounded-xl border border-[#194254] bg-[#05101b] py-3 text-center">
              <div>
                <dd className="font-tech-mono text-lg font-bold text-[#e8fbff]">
                  {profileView?.postsCount ?? userPosts.length}
                </dd>
                <dt className="text-xs text-[#8db9c7]">Posts</dt>
              </div>
              <div>
                <dd className="font-tech-mono text-lg font-bold text-[#e8fbff]">
                  {profileView?.friendsCount ?? friendsCount}
                </dd>
                <dt className="text-xs text-[#8db9c7]">Circle</dt>
              </div>
              <div>
                <dd className="font-tech-mono text-lg font-bold text-[#e8fbff]">
                  {profileView?.totalLikes ?? userPosts.reduce((s, p) => s + p.likes.length, 0)}
                </dd>
                <dt className="text-xs text-[#8db9c7]">Likes</dt>
              </div>
            </dl>

            {editing && isSelf && (
              <form
                onSubmit={handleSaveProfile}
                className="space-y-4 rounded-xl border border-[#235468] bg-[#05101b] p-4"
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="edit-display-name"
                      className="mb-1 block text-xs font-medium uppercase text-[#8db9c7]"
                    >
                      Display Name
                    </label>
                    <input
                      id="edit-display-name"
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      maxLength={32}
                      className="min-h-[42px] w-full rounded-xl border border-[#225366] bg-[#040d16] px-3.5 py-2 text-sm text-[#e8fbff]"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="edit-status"
                      className="mb-1 block text-xs font-medium uppercase text-[#8db9c7]"
                    >
                      Status Line
                    </label>
                    <input
                      id="edit-status"
                      type="text"
                      value={statusText}
                      onChange={(e) => setStatusText(e.target.value)}
                      maxLength={80}
                      className="min-h-[42px] w-full rounded-xl border border-[#225366] bg-[#040d16] px-3.5 py-2 text-sm text-[#e8fbff]"
                    />
                  </div>
                </div>
                <div>
                  <label
                    htmlFor="edit-bio"
                    className="mb-1 block text-xs font-medium uppercase text-[#8db9c7]"
                  >
                    Bio
                  </label>
                  <textarea
                    id="edit-bio"
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    rows={2}
                    maxLength={160}
                    className="w-full rounded-xl border border-[#225366] bg-[#040d16] p-3 text-sm text-[#e8fbff]"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="submit"
                    disabled={saving}
                    className="min-h-[40px] rounded-xl border border-[#42e8f5] bg-[#0a3c4c] px-5 py-2 text-xs font-semibold text-white hover:bg-[#0e4d61] disabled:opacity-50"
                  >
                    {saving ? 'Saving…' : 'Save Changes'}
                  </button>
                </div>
              </form>
            )}

            {notice && (
              <p className="text-xs text-[#72f7c8]" aria-live="polite">
                {notice}
              </p>
            )}
          </div>
        ) : null}
      </section>

      {/* Command Core & Leo AI Drawer (Preserved & Accessible from Profile) */}
      {isSelf && showCommandCore && (
        <section className="space-y-6 rounded-2xl border border-[#214b5e] bg-[#071522] p-5 sm:p-6">
          <ArcReactorCore
            userId={currentUser.id}
            friendsCount={friendsCount}
            storiesCount={storiesCount}
            vaultItemCount={vaultItemCount}
          />
          <LeoAiAssistant userId={currentUser.id} onNavigateModule={onNavigateModule} />
        </section>
      )}

      {/* Profile Grid Tabs */}
      <section className="space-y-4">
        {isSelf && (
          <div className="flex items-center gap-2 border-b border-[#194254] pb-3">
            <button
              type="button"
              onClick={() => setGridTab('posts')}
              className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-xl px-4 py-1.5 text-xs font-semibold transition ${
                gridTab === 'posts'
                  ? 'bg-[#0e4355] text-white'
                  : 'border border-[#1d4b5d] text-[#8cbac7] hover:text-white'
              }`}
            >
              <span>Posts ({userPosts.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setGridTab('saved')}
              className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-xl px-4 py-1.5 text-xs font-semibold transition ${
                gridTab === 'saved'
                  ? 'bg-[#0e4355] text-white'
                  : 'border border-[#1d4b5d] text-[#8cbac7] hover:text-white'
              }`}
            >
              <Bookmark className="h-3.5 w-3.5" />
              <span>Saved ({savedPosts.length})</span>
            </button>
          </div>
        )}

        {gridPosts.length === 0 ? (
          <p className="rounded-2xl border border-[#1a4354] bg-[#071522] p-6 text-center text-sm text-[#8db9c7]">
            {isSelf && gridTab === 'saved'
              ? 'No bookmarked posts yet.'
              : 'No posts published yet.'}
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {gridPosts.map((post) => (
              <button
                key={post.id}
                type="button"
                onClick={() => setLightboxPost(post)}
                className="group relative aspect-square overflow-hidden rounded-xl border border-[#1c485a] bg-[#05101b] text-left"
              >
                {post.mediaDataUrl ? (
                  post.mediaType === 'video' ? (
                    <video src={post.mediaDataUrl} muted className="h-full w-full object-cover" />
                  ) : (
                    <img
                      src={post.mediaDataUrl}
                      alt={post.caption || 'Feed post'}
                      className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                    />
                  )
                ) : (
                  <div className="flex h-full items-center justify-center p-4 text-center text-xs text-[#cceef7]">
                    {post.caption}
                  </div>
                )}
                <div className="font-tech-mono absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/80 to-transparent px-2.5 py-2 text-[11px] text-white">
                  <span className="inline-flex items-center gap-1">
                    <Heart className="h-3 w-3" /> {post.likes.length}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <MessageCircle className="h-3 w-3" /> {post.comments.length}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      {lightboxPost && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/85 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Post detail"
        >
          <div className="w-full max-w-lg space-y-4 rounded-2xl border border-[#2c5d70] bg-[#071522] p-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <UserAvatar
                  name={lightboxPost.authorName}
                  avatarDataUrl={lightboxPost.authorAvatar}
                  size="sm"
                />
                <div>
                  <div className="text-sm font-semibold text-white">{lightboxPost.authorName}</div>
                  <div className="font-tech-mono text-xs text-[#8db9c7]">@{lightboxPost.authorId}</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setLightboxPost(null)}
                aria-label="Close post detail"
                className="grid h-9 w-9 place-items-center rounded-xl border border-[#244e5e] text-[#c7eef7]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {lightboxPost.mediaDataUrl && (
              <div className="overflow-hidden rounded-xl bg-black/50">
                {lightboxPost.mediaType === 'video' ? (
                  <video src={lightboxPost.mediaDataUrl} controls playsInline className="max-h-[55vh] w-full object-contain" />
                ) : (
                  <img src={lightboxPost.mediaDataUrl} alt={lightboxPost.caption} className="max-h-[55vh] w-full object-contain" />
                )}
              </div>
            )}
            {lightboxPost.caption && (
              <p className="text-sm leading-relaxed text-[#e8fbff]">{lightboxPost.caption}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
