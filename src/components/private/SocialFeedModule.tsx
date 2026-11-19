import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  Bookmark,
  ChevronLeft,
  ChevronRight,
  Eye,
  Heart,
  ImagePlus,
  MapPin,
  MessageCircle,
  Pause,
  Play,
  Plus,
  Send,
  Share2,
  Trash2,
  X,
} from 'lucide-react';
import type { FeedPostItem, FriendItem, StoryItem } from '../../types/leo';
import {
  addPostComment,
  createPost,
  createStory,
  deletePost,
  deleteStory,
  markStoryViewed,
  reactToStory,
  replyToStory,
  sendDirectMessage,
  togglePostBookmark,
  togglePostLike,
} from '../../utils/apiClient';
import { UserAvatar } from './UserAvatar';

interface SocialFeedModuleProps {
  currentUserId: string;
  currentUserName: string;
  currentUserAvatar?: string;
  stories: StoryItem[];
  posts: FeedPostItem[];
  friends: FriendItem[];
  onlineUserIds: Set<string>;
  onRefresh: () => Promise<void>;
  onViewProfile: (userId: string) => void;
  onOpenChat: (partnerId: string) => void;
}

const STORY_EMOJIS = ['❤️', '🔥', '😂', '👏', '✨'];

function formatRelativeAge(createdAt: number): string {
  const secs = Math.max(1, Math.floor((Date.now() - createdAt) / 1000));
  if (secs < 60) return 'just now';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function SocialFeedModule({
  currentUserId,
  currentUserName,
  currentUserAvatar,
  stories,
  posts,
  friends,
  onlineUserIds,
  onRefresh,
  onViewProfile,
  onOpenChat,
}: SocialFeedModuleProps) {
  // Composer state
  const [composerMode, setComposerMode] = useState<'post' | 'story'>('post');
  const [caption, setCaption] = useState('');
  const [location, setLocation] = useState('');
  const [visibility, setVisibility] = useState<'friends' | 'private'>('friends');
  const [mediaDataUrl, setMediaDataUrl] = useState<string | undefined>(undefined);
  const [mediaType, setMediaType] = useState<'image' | 'video' | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState('');

  // Feed filter & interactions
  const [feedFilter, setFeedFilter] = useState<'all' | 'saved'>('all');
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({});
  const [shareModalPost, setShareModalPost] = useState<FeedPostItem | null>(null);

  // Story viewer state
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [storyPaused, setStoryPaused] = useState(false);
  const [storyProgress, setStoryProgress] = useState(0);
  const [storyReplyText, setStoryReplyText] = useState('');
  const [showViewersList, setShowViewersList] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);

  const activeStory = viewerIndex !== null ? stories[viewerIndex] || null : null;

  // Mark story viewed whenever viewer switches
  useEffect(() => {
    if (!activeStory) return;
    if (!activeStory.viewedBy.includes(currentUserId)) {
      markStoryViewed(activeStory.id).catch(() => {});
    }
  }, [activeStory?.id, currentUserId]);

  // Auto-advance timer for Story Viewer
  useEffect(() => {
    if (viewerIndex === null || !activeStory || storyPaused || storyReplyText.trim().length > 0) {
      return;
    }
    setStoryProgress(0);
    const intervalMs = 60;
    const durationMs = 6000;
    const startedAt = Date.now();

    const timer = window.setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const pct = Math.min(100, (elapsed / durationMs) * 100);
      setStoryProgress(pct);
      if (pct >= 100) {
        window.clearInterval(timer);
        setViewerIndex((prev) => {
          if (prev === null) return null;
          return prev < stories.length - 1 ? prev + 1 : null;
        });
      }
    }, intervalMs);

    return () => window.clearInterval(timer);
  }, [viewerIndex, activeStory?.id, storyPaused, storyReplyText, stories.length]);

  function handleFileChange(file: File | undefined) {
    if (!file) return;
    if (file.size > 6 * 1024 * 1024) {
      setStatus('Choose a photo or video under 6 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setMediaDataUrl(String(reader.result || ''));
      setMediaType(file.type.startsWith('video/') ? 'video' : 'image');
      setStatus('');
    };
    reader.onerror = () => setStatus('Could not read that media file.');
    reader.readAsDataURL(file);
  }

  function clearSelectedMedia() {
    setMediaDataUrl(undefined);
    setMediaType(undefined);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function handlePublish(e: FormEvent) {
    e.preventDefault();
    if (!caption.trim() && !mediaDataUrl) {
      setStatus('Write something or attach a photo/video first.');
      return;
    }
    setSubmitting(true);
    setStatus('');
    try {
      if (composerMode === 'story') {
        await createStory({
          text: caption.trim(),
          mediaDataUrl,
          mediaType,
          visibility,
        });
        setStatus('Story published to your 24h rail.');
      } else {
        await createPost({
          caption: caption.trim(),
          mediaDataUrl,
          mediaType,
          location: location.trim() || undefined,
          visibility,
        });
        setStatus('Post shared to your circle feed.');
      }
      setCaption('');
      setLocation('');
      clearSelectedMedia();
      await onRefresh();
    } catch (err) {
      setStatus((err as Error).message || 'Could not publish.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleLike(postId: string) {
    try {
      await togglePostLike(postId);
      await onRefresh();
    } catch (err) {
      setStatus((err as Error).message || 'Could not update like.');
    }
  }

  async function handleBookmark(postId: string) {
    try {
      await togglePostBookmark(postId);
      await onRefresh();
    } catch (err) {
      setStatus((err as Error).message || 'Could not update saved state.');
    }
  }

  async function handleAddComment(e: FormEvent, postId: string) {
    e.preventDefault();
    const text = (commentInputs[postId] || '').trim();
    if (!text) return;
    try {
      await addPostComment(postId, text);
      setCommentInputs((prev) => ({ ...prev, [postId]: '' }));
      setExpandedComments((prev) => ({ ...prev, [postId]: true }));
      await onRefresh();
    } catch (err) {
      setStatus((err as Error).message || 'Could not add comment.');
    }
  }

  async function handleDeletePost(postId: string) {
    try {
      await deletePost(postId);
      await onRefresh();
      setStatus('Post removed.');
    } catch (err) {
      setStatus((err as Error).message || 'Could not delete post.');
    }
  }

  async function handleSharePostToFriend(friendId: string) {
    if (!shareModalPost) return;
    try {
      await sendDirectMessage(friendId, {
        text: `Shared a post from @${shareModalPost.authorId}: "${shareModalPost.caption.slice(0, 80)}"`,
        mediaDataUrl: shareModalPost.mediaDataUrl,
        mediaType: shareModalPost.mediaType,
        sharedPostId: shareModalPost.id,
      });
      setShareModalPost(null);
      setStatus(`Post sent to @${friendId}.`);
      onOpenChat(friendId);
    } catch (err) {
      setStatus((err as Error).message || 'Could not share post.');
    }
  }

  async function handleStoryReaction(storyId: string, emoji: string) {
    try {
      await reactToStory(storyId, emoji);
      await onRefresh();
    } catch (err) {
      setStatus((err as Error).message || 'Could not react to story.');
    }
  }

  async function handleStoryReply(e: FormEvent, story: StoryItem) {
    e.preventDefault();
    const text = storyReplyText.trim();
    if (!text) return;
    try {
      await replyToStory(story.id, text);
      setStoryReplyText('');
      setViewerIndex(null);
      await onRefresh();
      setStatus(`Replied directly to ${story.authorName}'s story.`);
      onOpenChat(story.authorId);
    } catch (err) {
      setStatus((err as Error).message || 'Could not send story reply.');
    }
  }

  async function handleDeleteStory(storyId: string) {
    try {
      await deleteStory(storyId);
      setViewerIndex(null);
      await onRefresh();
      setStatus('Story removed.');
    } catch (err) {
      setStatus((err as Error).message || 'Could not delete story.');
    }
  }

  const visiblePosts =
    feedFilter === 'saved'
      ? posts.filter((p) => p.bookmarks.includes(currentUserId))
      : posts;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* 24h Stories Rail (Snapchat + Instagram) */}
      <section aria-label="24-hour stories" className="rounded-2xl border border-[#1d4b5d] bg-[#071522] p-4 sm:p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold tracking-wide text-[#e6fcff]">24h Stories</h2>
          <span className="font-tech-mono text-xs text-[#79b7c7]">{stories.length} active</span>
        </div>

        <div className="flex items-start gap-3.5 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => {
              setComposerMode('story');
              composerRef.current?.focus();
            }}
            className="flex w-18 shrink-0 flex-col items-center gap-1.5 text-center"
          >
            <span className="grid h-15 w-15 place-items-center rounded-full border border-dashed border-[#42e8f5]/80 bg-[#0b2333] text-[#8cefff] transition hover:bg-[#103247]">
              <Plus className="h-6 w-6" />
            </span>
            <span className="w-full truncate text-xs text-[#c7eef7]">Your Story</span>
          </button>

          {stories.map((story, idx) => {
            const seen = story.viewedBy.includes(currentUserId);
            return (
              <button
                key={story.id}
                type="button"
                onClick={() => {
                  setViewerIndex(idx);
                  setStoryPaused(false);
                  setShowViewersList(false);
                }}
                aria-label={`View story by ${story.authorName}`}
                className="flex w-18 shrink-0 flex-col items-center gap-1.5 text-center"
              >
                <span
                  className={`rounded-full p-[2.5px] ${
                    seen
                      ? 'bg-[#2a4a59]'
                      : 'bg-gradient-to-tr from-[#f4d27a] via-[#e26be6] to-[#42e8f5]'
                  }`}
                >
                  <span className="grid h-14 w-14 place-items-center overflow-hidden rounded-full border-2 border-[#071522] bg-[#13263a] text-base font-semibold text-[#f4d27a]">
                    {story.mediaDataUrl && story.mediaType !== 'video' ? (
                      <img
                        src={story.mediaDataUrl}
                        alt={`${story.authorName} story`}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      story.authorName.slice(0, 1).toUpperCase()
                    )}
                  </span>
                </span>
                <span className="w-full truncate text-xs text-[#dff7ff]">{story.authorName}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Post & Story Composer */}
      <form
        onSubmit={handlePublish}
        className="space-y-4 rounded-2xl border border-[#1d4b5d] bg-[#071522] p-4 sm:p-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <UserAvatar name={currentUserName} avatarDataUrl={currentUserAvatar} size="sm" />
            <span className="text-sm font-semibold text-[#e6fcff]">{currentUserName}</span>
          </div>

          <div className="flex rounded-xl border border-[#1c4657] bg-[#040d16] p-1">
            <button
              type="button"
              onClick={() => setComposerMode('post')}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                composerMode === 'post' ? 'bg-[#0e4355] text-white' : 'text-[#8cbac7] hover:text-white'
              }`}
            >
              Feed Post
            </button>
            <button
              type="button"
              onClick={() => setComposerMode('story')}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                composerMode === 'story' ? 'bg-[#0e4355] text-white' : 'text-[#8cbac7] hover:text-white'
              }`}
            >
              24h Story
            </button>
          </div>
        </div>

        <div>
          <label htmlFor="feed-caption-input" className="sr-only">
            {composerMode === 'story' ? 'Story caption' : 'Post caption'}
          </label>
          <textarea
            ref={composerRef}
            id="feed-caption-input"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            maxLength={composerMode === 'story' ? 500 : 1200}
            rows={2}
            placeholder={
              composerMode === 'story'
                ? 'Share a 24-hour story with your circle…'
                : 'Share a photo, update, or thought to the circle feed…'
            }
            className="w-full rounded-xl border border-[#225366] bg-[#040d16] p-3.5 text-sm text-[#e8fbff] placeholder:text-[#4e7685] focus:border-[#42e8f5]"
          />
        </div>

        {mediaDataUrl && (
          <div className="relative inline-block max-w-xs overflow-hidden rounded-xl border border-[#2b6275]">
            {mediaType === 'video' ? (
              <video src={mediaDataUrl} controls playsInline className="max-h-56 rounded-xl" />
            ) : (
              <img src={mediaDataUrl} alt="Attachment preview" className="max-h-56 rounded-xl object-cover" />
            )}
            <button
              type="button"
              onClick={clearSelectedMedia}
              aria-label="Remove attached media"
              className="absolute top-2 right-2 grid h-7 w-7 place-items-center rounded-full bg-black/75 text-white hover:bg-black"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              className="hidden"
              tabIndex={-1}
              aria-hidden="true"
              onChange={(e) => handleFileChange(e.target.files?.[0])}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-[#25596d] bg-[#061826] px-3.5 py-2 text-xs font-medium text-[#b5effa] transition hover:border-[#42e8f5]"
            >
              <ImagePlus className="h-4 w-4 text-[#42e8f5]" />
              <span>Photo / Video</span>
            </button>

            {composerMode === 'post' && (
              <div className="relative flex items-center">
                <MapPin className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-[#75aebf]" />
                <label htmlFor="post-location-input" className="sr-only">
                  Location
                </label>
                <input
                  id="post-location-input"
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  maxLength={60}
                  placeholder="Location"
                  className="min-h-[40px] w-36 rounded-xl border border-[#225366] bg-[#040d16] py-1.5 pr-3 pl-8 text-xs text-[#e8fbff] placeholder:text-[#4e7685]"
                />
              </div>
            )}

            <label className="sr-only" htmlFor="post-visibility-select">
              Audience
            </label>
            <select
              id="post-visibility-select"
              value={visibility}
              onChange={(e) => setVisibility(e.target.value as 'friends' | 'private')}
              className="min-h-[40px] rounded-xl border border-[#225366] bg-[#040d16] px-3 py-1.5 text-xs text-[#e8fbff]"
            >
              <option value="friends">Circle Friends</option>
              <option value="private">Only Me</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="inline-flex min-h-[42px] items-center gap-2 rounded-xl border border-[#42e8f5] bg-[#0a3c4c] px-5 py-2 text-sm font-semibold text-[#e6fcff] transition hover:bg-[#0e4d61] disabled:opacity-60"
          >
            <Send className="h-4 w-4" />
            <span>{submitting ? 'Publishing…' : composerMode === 'story' ? 'Share Story' : 'Post'}</span>
          </button>
        </div>

        {status && (
          <p className="text-xs text-[#72f7c8]" aria-live="polite">
            {status}
          </p>
        )}
      </form>

      {/* Feed Filter Bar */}
      <div className="flex items-center justify-between border-b border-[#194254] pb-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setFeedFilter('all')}
            className={`min-h-[38px] rounded-xl px-4 py-1.5 text-xs font-semibold transition ${
              feedFilter === 'all'
                ? 'bg-[#0e4355] text-white'
                : 'border border-[#1d4b5d] text-[#8cbac7] hover:text-white'
            }`}
          >
            All Posts ({posts.length})
          </button>
          <button
            type="button"
            onClick={() => setFeedFilter('saved')}
            className={`min-h-[38px] rounded-xl px-4 py-1.5 text-xs font-semibold transition ${
              feedFilter === 'saved'
                ? 'bg-[#0e4355] text-white'
                : 'border border-[#1d4b5d] text-[#8cbac7] hover:text-white'
            }`}
          >
            Saved ({posts.filter((p) => p.bookmarks.includes(currentUserId)).length})
          </button>
        </div>
      </div>

      {/* Instagram-style Feed Cards */}
      {visiblePosts.length === 0 ? (
        <div className="rounded-2xl border border-[#1a4354] bg-[#071522] p-8 text-center text-sm text-[#8db9c7]">
          {feedFilter === 'saved'
            ? 'No saved posts yet. Tap the bookmark icon on any post to keep it here.'
            : 'No posts yet. Share the first moment above!'}
        </div>
      ) : (
        <div className="space-y-6">
          {visiblePosts.map((post) => {
            const isLiked = post.likes.includes(currentUserId);
            const isSaved = post.bookmarks.includes(currentUserId);
            const showComments = expandedComments[post.id] ?? post.comments.length > 0;
            const authorOnline = onlineUserIds.has(post.authorId);

            return (
              <article
                key={post.id}
                className="overflow-hidden rounded-2xl border border-[#1d4b5d] bg-[#071522] shadow-lg"
              >
                {/* Header */}
                <div className="flex items-center justify-between gap-3 px-4 py-3.5 sm:px-5">
                  <div className="flex min-w-0 items-center gap-3">
                    <UserAvatar
                      name={post.authorName}
                      avatarDataUrl={post.authorAvatar}
                      isOnline={authorOnline}
                      onClick={() => onViewProfile(post.authorId)}
                    />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => onViewProfile(post.authorId)}
                          className="truncate text-sm font-semibold text-[#e8fbff] hover:text-[#42e8f5]"
                        >
                          {post.authorName}
                        </button>
                        <span className="font-tech-mono text-xs text-[#79a8b8]">@{post.authorId}</span>
                      </div>
                      <div className="text-xs text-[#8db9c7]">
                        {post.location ? `${post.location} · ` : ''}
                        {formatRelativeAge(post.createdAt)}
                        {post.visibility === 'private' ? ' · Private' : ''}
                      </div>
                    </div>
                  </div>

                  {post.authorId === currentUserId && (
                    <button
                      type="button"
                      onClick={() => handleDeletePost(post.id)}
                      aria-label="Delete post"
                      className="grid h-9 w-9 place-items-center rounded-lg text-[#8db9c7] transition hover:bg-white/5 hover:text-rose-300"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>

                {/* Media */}
                {post.mediaDataUrl && (
                  <div className="bg-[#030912]">
                    {post.mediaType === 'video' ? (
                      <video
                        src={post.mediaDataUrl}
                        controls
                        playsInline
                        className="max-h-[480px] w-full object-cover"
                      />
                    ) : (
                      <img
                        src={post.mediaDataUrl}
                        alt={post.caption || `Post by ${post.authorName}`}
                        className="max-h-[480px] w-full object-cover"
                      />
                    )}
                  </div>
                )}

                {/* Action row */}
                <div className="space-y-3 px-4 py-3.5 sm:px-5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-4">
                      <button
                        type="button"
                        onClick={() => handleLike(post.id)}
                        aria-label={isLiked ? 'Unlike post' : 'Like post'}
                        aria-pressed={isLiked}
                        className={`inline-flex items-center gap-1.5 text-sm font-medium transition ${
                          isLiked ? 'text-rose-400' : 'text-[#c7eef7] hover:text-white'
                        }`}
                      >
                        <Heart className={`h-5 w-5 ${isLiked ? 'fill-rose-400' : ''}`} />
                        <span className="font-tech-mono text-xs">{post.likes.length}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          setExpandedComments((prev) => ({
                            ...prev,
                            [post.id]: !showComments,
                          }))
                        }
                        aria-label="Toggle comments"
                        className="inline-flex items-center gap-1.5 text-sm font-medium text-[#c7eef7] transition hover:text-white"
                      >
                        <MessageCircle className="h-5 w-5" />
                        <span className="font-tech-mono text-xs">{post.comments.length}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setShareModalPost(post)}
                        aria-label="Share post to chat"
                        className="inline-flex items-center gap-1.5 text-sm font-medium text-[#c7eef7] transition hover:text-white"
                      >
                        <Share2 className="h-5 w-5" />
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleBookmark(post.id)}
                      aria-label={isSaved ? 'Remove bookmark' : 'Save post'}
                      aria-pressed={isSaved}
                      className={`grid h-9 w-9 place-items-center rounded-lg transition ${
                        isSaved ? 'text-[#f4d27a]' : 'text-[#c7eef7] hover:text-white'
                      }`}
                    >
                      <Bookmark className={`h-5 w-5 ${isSaved ? 'fill-[#f4d27a]' : ''}`} />
                    </button>
                  </div>

                  {/* Caption */}
                  {post.caption && (
                    <p className="text-sm leading-relaxed text-[#e8fbff]">
                      <button
                        type="button"
                        onClick={() => onViewProfile(post.authorId)}
                        className="mr-2 font-semibold text-white hover:text-[#42e8f5]"
                      >
                        {post.authorName}
                      </button>
                      {post.caption}
                    </p>
                  )}

                  {/* Comments */}
                  {showComments && (
                    <div className="space-y-2.5 border-t border-[#163b4b] pt-3">
                      {post.comments.map((cmt) => (
                        <div key={cmt.id} className="text-sm text-[#cceef7]">
                          <button
                            type="button"
                            onClick={() => onViewProfile(cmt.authorId)}
                            className="mr-2 font-semibold text-[#8cefff] hover:underline"
                          >
                            {cmt.authorName}
                          </button>
                          <span>{cmt.text}</span>
                          <span className="font-tech-mono ml-2 text-[11px] text-[#6d9cad]">
                            {formatRelativeAge(cmt.createdAt)}
                          </span>
                        </div>
                      ))}

                      <form onSubmit={(e) => handleAddComment(e, post.id)} className="flex gap-2 pt-1">
                        <label htmlFor={`comment-${post.id}`} className="sr-only">
                          Add a comment
                        </label>
                        <input
                          id={`comment-${post.id}`}
                          type="text"
                          value={commentInputs[post.id] || ''}
                          onChange={(e) =>
                            setCommentInputs((prev) => ({ ...prev, [post.id]: e.target.value }))
                          }
                          maxLength={400}
                          placeholder="Add a comment…"
                          className="min-h-[38px] flex-1 rounded-xl border border-[#204c5e] bg-[#040d16] px-3 py-1.5 text-xs text-[#e8fbff] placeholder:text-[#4e7685]"
                        />
                        <button
                          type="submit"
                          disabled={!(commentInputs[post.id] || '').trim()}
                          className="min-h-[38px] rounded-xl border border-[#2b6378] bg-[#0a3140] px-3.5 py-1.5 text-xs font-semibold text-[#e6fcff] hover:border-[#42e8f5] disabled:opacity-40"
                        >
                          Reply
                        </button>
                      </form>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Share Post to Chat Modal */}
      {shareModalPost && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Share post to chat"
        >
          <div className="w-full max-w-sm space-y-4 rounded-2xl border border-[#2c5d70] bg-[#071522] p-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-[#e6fcff]">Send Post to Chat</h3>
              <button
                type="button"
                onClick={() => setShareModalPost(null)}
                aria-label="Close share dialog"
                className="grid h-9 w-9 place-items-center rounded-xl border border-[#244e5e] text-[#c7eef7]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {friends.length === 0 ? (
              <p className="text-sm text-[#8db9c7]">Add friends in Circle to share posts directly.</p>
            ) : (
              <div className="space-y-2">
                {friends.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => handleSharePostToFriend(f.id)}
                    className="flex w-full items-center justify-between rounded-xl border border-[#1d4b5d] bg-[#05101b] p-3 text-left transition hover:border-[#42e8f5]"
                  >
                    <div className="flex items-center gap-3">
                      <UserAvatar
                        name={f.displayName}
                        avatarDataUrl={f.avatarDataUrl}
                        isOnline={onlineUserIds.has(f.id)}
                        size="sm"
                      />
                      <div>
                        <div className="text-sm font-semibold text-[#e8fbff]">{f.displayName}</div>
                        <div className="font-tech-mono text-xs text-[#8db9c7]">@{f.id}</div>
                      </div>
                    </div>
                    <Send className="h-4 w-4 text-[#42e8f5]" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Full Interactive Snapchat/IG Story Viewer */}
      {activeStory && viewerIndex !== null && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/90 p-3 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`Story by ${activeStory.authorName}`}
        >
          <div className="relative flex w-full max-w-md flex-col gap-3 rounded-2xl border border-[#2c5d70] bg-[#071522] p-4 shadow-2xl sm:p-5">
            {/* Progress Segments */}
            <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${stories.length}, 1fr)` }}>
              {stories.map((s, idx) => {
                const widthPct =
                  idx < viewerIndex ? 100 : idx === viewerIndex ? storyProgress : 0;
                return (
                  <div key={s.id} className="h-1 overflow-hidden rounded-full bg-white/20">
                    <div
                      className="h-full bg-[#42e8f5] transition-[width] duration-75"
                      style={{ width: `${widthPct}%` }}
                    />
                  </div>
                );
              })}
            </div>

            {/* Header */}
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => {
                  setViewerIndex(null);
                  onViewProfile(activeStory.authorId);
                }}
                className="flex items-center gap-2.5 text-left"
              >
                <UserAvatar
                  name={activeStory.authorName}
                  avatarDataUrl={activeStory.authorAvatar}
                  size="sm"
                />
                <div>
                  <div className="text-sm font-semibold text-[#e6fcff]">{activeStory.authorName}</div>
                  <div className="font-tech-mono text-[11px] text-[#8db9c7]">
                    {formatRelativeAge(activeStory.createdAt)} ·{' '}
                    {activeStory.visibility === 'private' ? 'Only Me' : 'Circle'}
                  </div>
                </div>
              </button>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setStoryPaused((p) => !p)}
                  aria-label={storyPaused ? 'Resume story' : 'Pause story'}
                  className="grid h-9 w-9 place-items-center rounded-xl border border-[#244e5e] text-[#c7eef7] hover:bg-white/5"
                >
                  {storyPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                </button>
                {activeStory.authorId === currentUserId && (
                  <button
                    type="button"
                    onClick={() => handleDeleteStory(activeStory.id)}
                    aria-label="Delete story"
                    className="grid h-9 w-9 place-items-center rounded-xl border border-[#244e5e] text-[#c7eef7] hover:border-rose-400/50 hover:text-rose-300"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setViewerIndex(null)}
                  aria-label="Close story viewer"
                  className="grid h-9 w-9 place-items-center rounded-xl border border-[#244e5e] text-[#c7eef7] hover:bg-white/5"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Story Canvas */}
            <div className="relative overflow-hidden rounded-xl bg-black/50">
              {activeStory.mediaDataUrl ? (
                activeStory.mediaType === 'video' ? (
                  <video
                    src={activeStory.mediaDataUrl}
                    controls
                    autoPlay
                    playsInline
                    className="max-h-[54vh] w-full object-contain"
                  />
                ) : (
                  <img
                    src={activeStory.mediaDataUrl}
                    alt={`${activeStory.authorName} story`}
                    className="max-h-[54vh] w-full object-cover"
                  />
                )
              ) : (
                <div className="grid min-h-[220px] place-items-center bg-gradient-to-br from-[#0e2a3f] via-[#091829] to-[#1a1333] p-6 text-center">
                  <p className="text-lg font-medium leading-relaxed text-[#e8fbff]">
                    {activeStory.text}
                  </p>
                </div>
              )}

              {/* Prev / Next touch overlays */}
              <div className="mt-2 flex items-center justify-between px-1 pb-1">
                <button
                  type="button"
                  disabled={viewerIndex === 0}
                  onClick={() => setViewerIndex((i) => (i !== null && i > 0 ? i - 1 : i))}
                  aria-label="Previous story"
                  className="inline-flex min-h-[36px] items-center gap-1 rounded-lg border border-[#234d5e] bg-[#071522]/90 px-2.5 py-1 text-xs text-[#c7eef7] disabled:opacity-35"
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span>Prev</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowViewersList((v) => !v)}
                  className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-[#234d5e] bg-[#071522]/90 px-2.5 py-1 text-xs text-[#95c3d1]"
                >
                  <Eye className="h-3.5 w-3.5" />
                  <span className="font-tech-mono">Seen by {activeStory.viewedBy.length}</span>
                </button>

                <button
                  type="button"
                  disabled={viewerIndex >= stories.length - 1}
                  onClick={() =>
                    setViewerIndex((i) => (i !== null && i < stories.length - 1 ? i + 1 : i))
                  }
                  aria-label="Next story"
                  className="inline-flex min-h-[36px] items-center gap-1 rounded-lg border border-[#234d5e] bg-[#071522]/90 px-2.5 py-1 text-xs text-[#c7eef7] disabled:opacity-35"
                >
                  <span>Next</span>
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            {activeStory.mediaDataUrl && activeStory.text && (
              <p className="text-sm leading-relaxed text-[#e8fbff]">{activeStory.text}</p>
            )}

            {showViewersList && (
              <div className="rounded-xl border border-[#1d4b5d] bg-[#05101b] p-3 text-xs text-[#95c3d1]">
                <span className="font-semibold text-[#e6fcff]">Viewers: </span>
                <span className="font-tech-mono">
                  {activeStory.viewedBy.map((id) => `@${id}`).join(', ') || 'None yet'}
                </span>
              </div>
            )}

            {/* Emoji Reactions */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                {STORY_EMOJIS.map((emoji) => {
                  const reacted = activeStory.reactions.some(
                    (r) => r.userId === currentUserId && r.emoji === emoji
                  );
                  const count = activeStory.reactions.filter((r) => r.emoji === emoji).length;
                  return (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => handleStoryReaction(activeStory.id, emoji)}
                      className={`inline-flex min-h-[36px] items-center gap-1 rounded-xl border px-2.5 py-1 text-sm transition ${
                        reacted
                          ? 'border-[#42e8f5] bg-[#0d3b4d]'
                          : 'border-[#204c5e] bg-[#05101b] hover:border-[#42e8f5]/60'
                      }`}
                    >
                      <span>{emoji}</span>
                      {count > 0 && (
                        <span className="font-tech-mono text-xs text-[#c7f3fc]">{count}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Reply directly to author */}
            {activeStory.authorId !== currentUserId && (
              <form
                onSubmit={(e) => handleStoryReply(e, activeStory)}
                className="flex gap-2 pt-1"
              >
                <label htmlFor="story-reply-input" className="sr-only">
                  Reply to story
                </label>
                <input
                  id="story-reply-input"
                  type="text"
                  value={storyReplyText}
                  onChange={(e) => setStoryReplyText(e.target.value)}
                  placeholder={`Reply to ${activeStory.authorName}…`}
                  className="min-h-[42px] flex-1 rounded-xl border border-[#225366] bg-[#040d16] px-3.5 py-2 text-sm text-[#e8fbff] placeholder:text-[#4e7685]"
                />
                <button
                  type="submit"
                  disabled={!storyReplyText.trim()}
                  aria-label="Send story reply"
                  className="inline-flex min-h-[42px] items-center gap-1.5 rounded-xl border border-[#42e8f5] bg-[#0a3c4c] px-4 py-2 text-xs font-semibold text-[#e6fcff] disabled:opacity-40"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>Send</span>
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
