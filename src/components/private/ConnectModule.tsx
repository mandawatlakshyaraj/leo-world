import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  ArrowLeft,
  Check,
  CheckCheck,
  CheckCircle2,
  Copy,
  Flame,
  ImagePlus,
  Lock,
  MessageSquare,
  Plus,
  Reply,
  Send,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserMinus,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import type {
  ConnectSnapshot,
  ConnectTabId,
  DirectMessageItem,
  GroupMessageItem,
} from '../../types/leo';
import {
  addGroupMember,
  createGroup,
  deleteGroup,
  markThreadRead,
  openSnapMessage,
  reactToDirectMessage,
  reactToGroupMessage,
  respondFriendRequest,
  sendDirectMessage,
  sendFriendRequest,
  sendGroupMessage,
} from '../../utils/apiClient';
import {
  computeSafetyNumber,
  decryptDirectPayload,
  decryptGroupPayload,
  encryptDirectPayload,
  encryptGroupPayload,
  type E2eeIdentity,
} from '../../utils/e2eeCrypto';
import { UserAvatar } from './UserAvatar';

interface ConnectModuleProps {
  currentUserId: string;
  e2eeIdentity: E2eeIdentity | null;
  activeTab: ConnectTabId;
  onChangeTab: (tab: ConnectTabId) => void;
  snapshot: ConnectSnapshot;
  selectedPartner: string;
  onSelectPartner: (partnerId: string) => void;
  onlineUserIds: Set<string>;
  typingUsers: Record<string, number>;
  onSendTyping: (threadType: 'dm' | 'group', targetId: string, isTyping: boolean) => void;
  onViewProfile: (userId: string) => void;
  onRefresh: () => Promise<void>;
}

interface DecryptedDmEntry {
  status: 'ok' | 'locked';
  text: string;
  mediaDataUrl?: string;
  mediaType?: 'image' | 'video';
  replyPreview?: string;
}

interface DecryptedGroupEntry {
  status: 'ok' | 'locked';
  text: string;
  mediaDataUrl?: string;
  mediaType?: 'image' | 'video';
}

const CHAT_EMOJIS = ['❤️', '😂', '👍', '🔥'];
const VERIFIED_SAFETY_STORAGE_KEY = 'leoWorldVerifiedSafetyNumbers_v1';

function loadVerifiedSafetyMap(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(VERIFIED_SAFETY_STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, boolean>;
  } catch {
    return {};
  }
}

function saveVerifiedSafetyMap(next: Record<string, boolean>): void {
  try {
    localStorage.setItem(VERIFIED_SAFETY_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Ignore storage quota errors
  }
}

function makeSafetyStorageKey(userA: string, userB: string, codeJoined: string): string {
  const pair = [userA.toLowerCase(), userB.toLowerCase()].sort().join(':');
  return `${pair}:${codeJoined}`;
}

export function ConnectModule({
  currentUserId,
  e2eeIdentity,
  activeTab,
  onChangeTab,
  snapshot,
  selectedPartner,
  onSelectPartner,
  onlineUserIds,
  typingUsers,
  onSendTyping,
  onViewProfile,
  onRefresh,
}: ConnectModuleProps) {
  const [friendIdInput, setFriendIdInput] = useState('');
  const [mobileShowingThread, setMobileShowingThread] = useState(false);

  // DM Composer
  const [dmInput, setDmInput] = useState('');
  const [dmMediaDataUrl, setDmMediaDataUrl] = useState<string | undefined>(undefined);
  const [dmMediaType, setDmMediaType] = useState<'image' | 'video' | undefined>(undefined);
  const [dmIsSnap, setDmIsSnap] = useState(false);
  const [replyingTo, setReplyingTo] = useState<DirectMessageItem | null>(null);
  const [openedSnapModal, setOpenedSnapModal] = useState<DirectMessageItem | null>(null);

  // Group State
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState<string>(
    () => snapshot.groups[0]?.id || ''
  );
  const [groupMsgInput, setGroupMsgInput] = useState('');
  const [groupMediaDataUrl, setGroupMediaDataUrl] = useState<string | undefined>(undefined);
  const [groupMediaType, setGroupMediaType] = useState<'image' | 'video' | undefined>(undefined);
  const [inviteFriendId, setInviteFriendId] = useState('');

  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  // E2EE local decryption & Safety Number state
  const [decryptedDmMap, setDecryptedDmMap] = useState<Record<string, DecryptedDmEntry>>({});
  const [decryptedGroupMap, setDecryptedGroupMap] = useState<Record<string, DecryptedGroupEntry>>({});
  const [safetyModalOpen, setSafetyModalOpen] = useState(false);
  const [safetyBlocks, setSafetyBlocks] = useState<string[]>([]);
  const [safetyCopied, setSafetyCopied] = useState(false);
  const [verifiedSafetyMap, setVerifiedSafetyMap] = useState<Record<string, boolean>>(() =>
    loadVerifiedSafetyMap()
  );

  const dmFileInputRef = useRef<HTMLInputElement | null>(null);
  const groupFileInputRef = useRef<HTMLInputElement | null>(null);
  const typingTimerRef = useRef<number | null>(null);

  const conversationPartners = Array.from(
    new Set([
      ...snapshot.friends.map((f) => f.id),
      ...snapshot.messages.map((m) => (m.fromId === currentUserId ? m.toId : m.fromId)),
    ])
  );

  const activePartner =
    selectedPartner && conversationPartners.includes(selectedPartner)
      ? selectedPartner
      : conversationPartners[0] || '';

  const partnerInfo =
    snapshot.friends.find((f) => f.id === activePartner) ||
    snapshot.directory.find((d) => d.id === activePartner);

  const canEncryptDm = Boolean(e2eeIdentity && partnerInfo?.e2eePublicKey);

  const activeThreadMessages = snapshot.messages.filter(
    (m) =>
      (m.fromId === currentUserId && m.toId === activePartner) ||
      (m.fromId === activePartner && m.toId === currentUserId)
  );

  const activeGroup =
    snapshot.groups.find((g) => g.id === selectedGroupId) || snapshot.groups[0] || null;

  const invitableFriends = activeGroup
    ? snapshot.friends.filter((f) => !activeGroup.members.includes(f.id))
    : [];

  const activeGroupKeyedMembers = useMemo(() => {
    if (!activeGroup || !e2eeIdentity) return [];
    const recipients: { id: string; publicKeySpki: string }[] = [];
    for (const memberId of activeGroup.members) {
      if (memberId === currentUserId) {
        recipients.push({ id: currentUserId, publicKeySpki: e2eeIdentity.publicKeySpki });
        continue;
      }
      const peer =
        snapshot.friends.find((f) => f.id === memberId) ||
        snapshot.directory.find((d) => d.id === memberId);
      if (peer?.e2eePublicKey) {
        recipients.push({ id: memberId, publicKeySpki: peer.e2eePublicKey });
      }
    }
    return recipients;
  }, [activeGroup, e2eeIdentity, currentUserId, snapshot.friends, snapshot.directory]);

  // Decrypt E2EE direct and group messages locally in browser memory
  useEffect(() => {
    if (!e2eeIdentity) {
      setDecryptedDmMap({});
      setDecryptedGroupMap({});
      return;
    }

    let cancelled = false;
    const identity = e2eeIdentity;

    async function decryptAll() {
      const dmEntries: Record<string, DecryptedDmEntry> = {};
      for (const msg of snapshot.messages) {
        if (!msg.e2ee || msg.isSnap) continue;
        try {
          const plain = await decryptDirectPayload(
            identity.keyPair.privateKey,
            identity.publicKeySpki,
            msg.fromId,
            msg.toId,
            msg.e2ee
          );
          dmEntries[msg.id] = {
            status: 'ok',
            text: plain.text,
            mediaDataUrl: plain.mediaDataUrl,
            mediaType: plain.mediaType,
            replyPreview: plain.replyPreview,
          };
        } catch {
          dmEntries[msg.id] = {
            status: 'locked',
            text: 'Encrypted with an earlier device key',
          };
        }
      }

      const grpEntries: Record<string, DecryptedGroupEntry> = {};
      for (const grp of snapshot.groups) {
        for (const gm of grp.messages) {
          if (!gm.e2ee) continue;
          try {
            const plain = await decryptGroupPayload(
              currentUserId,
              identity.keyPair.privateKey,
              identity.publicKeySpki,
              gm.e2ee
            );
            grpEntries[gm.id] = {
              status: 'ok',
              text: plain.text,
              mediaDataUrl: plain.mediaDataUrl,
              mediaType: plain.mediaType,
            };
          } catch {
            grpEntries[gm.id] = {
              status: 'locked',
              text: 'Encrypted for a previous device key',
            };
          }
        }
      }

      if (!cancelled) {
        setDecryptedDmMap(dmEntries);
        setDecryptedGroupMap(grpEntries);
      }
    }

    decryptAll();
    return () => {
      cancelled = true;
    };
  }, [snapshot.messages, snapshot.groups, e2eeIdentity, currentUserId]);

  // Compute 60-digit WhatsApp-style Safety Number for active DM partner
  useEffect(() => {
    if (!e2eeIdentity || !activePartner || !partnerInfo?.e2eePublicKey) {
      setSafetyBlocks([]);
      return;
    }
    let cancelled = false;
    computeSafetyNumber(
      currentUserId,
      e2eeIdentity.publicKeySpki,
      activePartner,
      partnerInfo.e2eePublicKey
    ).then((blocks) => {
      if (!cancelled) setSafetyBlocks(blocks);
    });
    return () => {
      cancelled = true;
    };
  }, [currentUserId, e2eeIdentity, activePartner, partnerInfo?.e2eePublicKey]);

  const safetyCodeJoined = safetyBlocks.join(' ');
  const activeSafetyKey =
    activePartner && safetyCodeJoined
      ? makeSafetyStorageKey(currentUserId, activePartner, safetyCodeJoined)
      : '';
  const isSafetyVerified = Boolean(activeSafetyKey && verifiedSafetyMap[activeSafetyKey]);

  function resolveDmDisplay(msg: DirectMessageItem): {
    text: string;
    mediaDataUrl?: string;
    mediaType?: 'image' | 'video';
    replyPreview?: string;
    isE2ee: boolean;
    isLocked: boolean;
  } {
    if (!msg.e2ee) {
      return {
        text: msg.text,
        mediaDataUrl: msg.mediaDataUrl,
        mediaType: msg.mediaType,
        replyPreview: msg.replyPreview,
        isE2ee: false,
        isLocked: false,
      };
    }
    const dec = decryptedDmMap[msg.id];
    if (!dec) {
      return {
        text: msg.isSnap ? 'Vanishing Snap' : 'Decrypting message…',
        isE2ee: true,
        isLocked: false,
      };
    }
    return {
      text: dec.text,
      mediaDataUrl: dec.mediaDataUrl,
      mediaType: dec.mediaType,
      replyPreview: dec.replyPreview || msg.replyPreview,
      isE2ee: true,
      isLocked: dec.status === 'locked',
    };
  }

  function resolveGroupMsgDisplay(msg: GroupMessageItem): {
    text: string;
    mediaDataUrl?: string;
    mediaType?: 'image' | 'video';
    isE2ee: boolean;
    isLocked: boolean;
  } {
    if (!msg.e2ee) {
      return {
        text: msg.text,
        mediaDataUrl: msg.mediaDataUrl,
        mediaType: msg.mediaType,
        isE2ee: false,
        isLocked: false,
      };
    }
    const dec = decryptedGroupMap[msg.id];
    if (!dec) {
      return {
        text: 'Decrypting message…',
        isE2ee: true,
        isLocked: false,
      };
    }
    return {
      text: dec.text,
      mediaDataUrl: dec.mediaDataUrl,
      mediaType: dec.mediaType,
      isE2ee: true,
      isLocked: dec.status === 'locked',
    };
  }

  // Mark incoming messages in active thread as read
  useEffect(() => {
    if (activeTab !== 'chats' || !activePartner) return;
    const hasUnread = activeThreadMessages.some(
      (m) => m.fromId === activePartner && m.toId === currentUserId && !m.readAt
    );
    if (hasUnread) {
      markThreadRead(activePartner).catch(() => {});
    }
  }, [activeTab, activePartner, activeThreadMessages.length, currentUserId]);

  const totalUnreadDms = snapshot.messages.filter(
    (m) => m.toId === currentUserId && !m.readAt
  ).length;

  function triggerTyping(threadType: 'dm' | 'group', targetId: string) {
    if (!targetId) return;
    onSendTyping(threadType, targetId, true);
    if (typingTimerRef.current !== null) {
      window.clearTimeout(typingTimerRef.current);
    }
    typingTimerRef.current = window.setTimeout(() => {
      onSendTyping(threadType, targetId, false);
    }, 1800);
  }

  function handleAttachMedia(
    file: File | undefined,
    setUrl: (v: string | undefined) => void,
    setType: (v: 'image' | 'video' | undefined) => void
  ) {
    if (!file) return;
    if (file.size > 6 * 1024 * 1024) {
      setStatus('Choose a photo or video under 6 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setUrl(String(reader.result || ''));
      setType(file.type.startsWith('video/') ? 'video' : 'image');
      setStatus('');
    };
    reader.readAsDataURL(file);
  }

  async function handleAddFriend(targetId: string) {
    if (!targetId.trim()) {
      setStatus('Enter a Unique ID to send a friend request.');
      return;
    }
    setBusy(true);
    setStatus('');
    try {
      await sendFriendRequest(targetId.trim());
      setFriendIdInput('');
      await onRefresh();
      setStatus(`Friend request sent to ${targetId.trim()}.`);
    } catch (err) {
      setStatus((err as Error).message || 'Could not send request.');
    } finally {
      setBusy(false);
    }
  }

  async function handleFriendAction(targetId: string, action: 'accept' | 'decline' | 'remove') {
    setBusy(true);
    setStatus('');
    try {
      await respondFriendRequest(targetId, action);
      await onRefresh();
      setStatus(
        action === 'accept'
          ? `Connected with ${targetId}.`
          : action === 'decline'
            ? `Declined request from ${targetId}.`
            : `Removed ${targetId} from friends.`
      );
    } catch (err) {
      setStatus((err as Error).message || 'Action failed.');
    } finally {
      setBusy(false);
    }
  }

  async function handleSendDm(e: FormEvent) {
    e.preventDefault();
    if (!activePartner) {
      setStatus('Select a friend first.');
      return;
    }
    if (!dmInput.trim() && !dmMediaDataUrl) return;
    setBusy(true);
    setStatus('');
    try {
      const replyPreview = replyingTo
        ? replyingTo.isSnap
          ? 'Vanishing Snap'
          : resolveDmDisplay(replyingTo).text.slice(0, 80) || 'Media attachment'
        : undefined;

      if (e2eeIdentity && partnerInfo?.e2eePublicKey) {
        const envelope = await encryptDirectPayload(
          e2eeIdentity.keyPair.privateKey,
          e2eeIdentity.publicKeySpki,
          partnerInfo.e2eePublicKey,
          currentUserId,
          activePartner,
          {
            text: dmInput.trim(),
            mediaDataUrl: dmMediaDataUrl,
            mediaType: dmMediaType,
            replyPreview,
          }
        );
        await sendDirectMessage(activePartner, {
          e2ee: envelope,
          isSnap: dmIsSnap,
          replyToId: replyingTo?.id,
        });
      } else {
        await sendDirectMessage(activePartner, {
          text: dmInput.trim(),
          mediaDataUrl: dmMediaDataUrl,
          mediaType: dmMediaType,
          isSnap: dmIsSnap,
          replyToId: replyingTo?.id,
        });
      }
      setDmInput('');
      setDmMediaDataUrl(undefined);
      setDmMediaType(undefined);
      setDmIsSnap(false);
      setReplyingTo(null);
      onSendTyping('dm', activePartner, false);
      await onRefresh();
    } catch (err) {
      setStatus((err as Error).message || 'Could not send message.');
    } finally {
      setBusy(false);
    }
  }

  async function handleOpenSnap(msg: DirectMessageItem) {
    try {
      const revealed = await openSnapMessage(msg.id);
      if (revealed.e2ee) {
        if (!e2eeIdentity) {
          setStatus('Local E2EE key is not ready to decrypt this Snap.');
          return;
        }
        try {
          const plain = await decryptDirectPayload(
            e2eeIdentity.keyPair.privateKey,
            e2eeIdentity.publicKeySpki,
            revealed.fromId,
            revealed.toId,
            revealed.e2ee
          );
          setOpenedSnapModal({
            ...revealed,
            text: plain.text,
            mediaDataUrl: plain.mediaDataUrl,
            mediaType: plain.mediaType,
          });
        } catch {
          setOpenedSnapModal({
            ...revealed,
            text: 'Encrypted with an earlier device key — cannot decrypt.',
          });
        }
      } else {
        setOpenedSnapModal(revealed);
      }
      await onRefresh();
    } catch (err) {
      setStatus((err as Error).message || 'Snap could not be opened.');
    }
  }

  async function handleDmReact(messageId: string, emoji: string) {
    try {
      await reactToDirectMessage(messageId, emoji);
      await onRefresh();
    } catch {
      // Ignore transient react error
    }
  }

  async function handleCreateGroup(e: FormEvent) {
    e.preventDefault();
    if (!newGroupName.trim()) {
      setStatus('Enter a group name.');
      return;
    }
    setBusy(true);
    setStatus('');
    try {
      const created = await createGroup(newGroupName.trim(), newGroupDesc.trim());
      setNewGroupName('');
      setNewGroupDesc('');
      setSelectedGroupId(created.id);
      await onRefresh();
      setStatus(`Group "${created.name}" created.`);
    } catch (err) {
      setStatus((err as Error).message || 'Could not create group.');
    } finally {
      setBusy(false);
    }
  }

  async function handleInviteToGroup() {
    if (!activeGroup || !inviteFriendId) return;
    setBusy(true);
    try {
      await addGroupMember(activeGroup.id, inviteFriendId);
      setInviteFriendId('');
      await onRefresh();
      setStatus(`Invited @${inviteFriendId} to ${activeGroup.name}.`);
    } catch (err) {
      setStatus((err as Error).message || 'Could not invite member.');
    } finally {
      setBusy(false);
    }
  }

  async function handleSendGroupMsg(e: FormEvent) {
    e.preventDefault();
    if (!activeGroup || (!groupMsgInput.trim() && !groupMediaDataUrl)) return;
    setBusy(true);
    setStatus('');
    try {
      if (e2eeIdentity && activeGroupKeyedMembers.length > 0) {
        const envelope = await encryptGroupPayload(
          e2eeIdentity.keyPair.privateKey,
          e2eeIdentity.publicKeySpki,
          activeGroupKeyedMembers,
          {
            text: groupMsgInput.trim(),
            mediaDataUrl: groupMediaDataUrl,
            mediaType: groupMediaType,
          }
        );
        await sendGroupMessage(activeGroup.id, { e2ee: envelope });
      } else {
        await sendGroupMessage(activeGroup.id, {
          text: groupMsgInput.trim(),
          mediaDataUrl: groupMediaDataUrl,
          mediaType: groupMediaType,
        });
      }
      setGroupMsgInput('');
      setGroupMediaDataUrl(undefined);
      setGroupMediaType(undefined);
      onSendTyping('group', activeGroup.id, false);
      await onRefresh();
    } catch (err) {
      setStatus((err as Error).message || 'Could not send group message.');
    } finally {
      setBusy(false);
    }
  }

  async function handleGroupReact(msgId: string, emoji: string) {
    if (!activeGroup) return;
    try {
      await reactToGroupMessage(activeGroup.id, msgId, emoji);
      await onRefresh();
    } catch {
      // Ignore
    }
  }

  async function handleDeleteGroup(groupId: string) {
    setBusy(true);
    setStatus('');
    try {
      await deleteGroup(groupId);
      setSelectedGroupId('');
      await onRefresh();
      setStatus('Group deleted.');
    } catch (err) {
      setStatus((err as Error).message || 'Could not delete group.');
    } finally {
      setBusy(false);
    }
  }

  const isPartnerTyping = Boolean(
    activePartner && typingUsers[`dm:${activePartner}`] && typingUsers[`dm:${activePartner}`] > Date.now() - 4000
  );

  const activeGroupTypingIds = activeGroup
    ? Object.entries(typingUsers)
        .filter(([key, ts]) => key.startsWith(`group:${activeGroup.id}:`) && ts > Date.now() - 4000)
        .map(([key]) => key.split(':')[2])
    : [];

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      {/* Sub-Tabs */}
      <div
        className="grid grid-cols-3 gap-2 rounded-2xl border border-[#1d4b5d] bg-[#05101b] p-1.5"
        role="tablist"
        aria-label="Messaging and circle sections"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'chats'}
          onClick={() => onChangeTab('chats')}
          className={`flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl px-2 text-xs font-semibold whitespace-nowrap transition sm:gap-2 sm:px-3 sm:text-sm ${
            activeTab === 'chats' ? 'bg-[#0e4355] text-white shadow' : 'text-[#8cbac7] hover:text-white'
          }`}
        >
          <MessageSquare className="h-4 w-4 shrink-0" />
          <span>Chats{totalUnreadDms > 0 ? ` (${totalUnreadDms})` : ''}</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'groups'}
          onClick={() => onChangeTab('groups')}
          className={`flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl px-2 text-xs font-semibold whitespace-nowrap transition sm:gap-2 sm:px-3 sm:text-sm ${
            activeTab === 'groups' ? 'bg-[#0e4355] text-white shadow' : 'text-[#8cbac7] hover:text-white'
          }`}
        >
          <Users className="h-4 w-4 shrink-0" />
          <span>Groups ({snapshot.groups.length})</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'circle'}
          onClick={() => onChangeTab('circle')}
          className={`flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl px-2 text-xs font-semibold whitespace-nowrap transition sm:gap-2 sm:px-3 sm:text-sm ${
            activeTab === 'circle' ? 'bg-[#0e4355] text-white shadow' : 'text-[#8cbac7] hover:text-white'
          }`}
        >
          <UserCheck className="h-4 w-4 shrink-0" />
          <span>
            Circle ({snapshot.friends.length}
            {snapshot.requests.filter((r) => r.direction === 'incoming').length > 0
              ? ` · +${snapshot.requests.filter((r) => r.direction === 'incoming').length}`
              : ''}
            )
          </span>
        </button>
      </div>

      {status && (
        <p className="text-xs text-[#72f7c8]" aria-live="polite">
          {status}
        </p>
      )}

      {/* WHATSAPP + SNAPCHAT DIRECT CHATS */}
      {activeTab === 'chats' && (
        <div className="grid min-h-[500px] grid-cols-1 gap-4 md:grid-cols-[260px_1fr]">
          {/* Thread List */}
          <aside
            className={`min-w-0 space-y-2 overflow-hidden rounded-2xl border border-[#1d4b5d] bg-[#071522] p-3 ${
              mobileShowingThread ? 'hidden md:block' : 'block'
            }`}
          >
            <div className="px-2 py-1 text-xs font-medium tracking-wider uppercase text-[#7eb3c2]">
              Direct Threads
            </div>
            {conversationPartners.length === 0 ? (
              <p className="px-2 py-3 text-xs text-[#8db9c7]">
                Connect with friends in Circle to start chatting.
              </p>
            ) : (
              conversationPartners.map((partnerId) => {
                const isSelected = partnerId === activePartner;
                const friend = snapshot.friends.find((f) => f.id === partnerId);
                const threadMsgs = snapshot.messages.filter(
                  (m) =>
                    (m.fromId === currentUserId && m.toId === partnerId) ||
                    (m.fromId === partnerId && m.toId === currentUserId)
                );
                const lastMsg = threadMsgs[threadMsgs.length - 1];
                const unreadCount = threadMsgs.filter(
                  (m) => m.fromId === partnerId && m.toId === currentUserId && !m.readAt
                ).length;

                return (
                  <button
                    key={partnerId}
                    type="button"
                    onClick={() => {
                      onSelectPartner(partnerId);
                      setMobileShowingThread(true);
                    }}
                    className={`flex w-full min-w-0 items-center gap-3 overflow-hidden rounded-xl px-3 py-2.5 text-left transition ${
                      isSelected ? 'bg-[#0e4355] text-white' : 'text-[#a8dce8] hover:bg-white/5'
                    }`}
                  >
                    <UserAvatar
                      name={friend?.displayName || partnerId}
                      avatarDataUrl={friend?.avatarDataUrl}
                      isOnline={onlineUserIds.has(partnerId)}
                      size="sm"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-semibold">
                          {friend?.displayName || `@${partnerId}`}
                        </span>
                        {unreadCount > 0 && (
                          <span className="font-tech-mono rounded-full bg-[#42e8f5] px-1.5 py-0.5 text-[10px] font-bold text-[#031018]">
                            {unreadCount}
                          </span>
                        )}
                      </div>
                      <div className="truncate text-xs text-[#8db9c7]">
                        {lastMsg
                          ? lastMsg.isSnap
                            ? 'Vanishing Snap'
                            : resolveDmDisplay(lastMsg).text || 'Encrypted media'
                          : `@${partnerId}`}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </aside>

          {/* Active Chat Pane */}
          <div
            className={`min-w-0 flex-col justify-between rounded-2xl border border-[#1d4b5d] bg-[#071522] p-4 sm:p-5 ${
              !mobileShowingThread && conversationPartners.length > 0 ? 'hidden md:flex' : 'flex'
            }`}
          >
            {/* Chat Header */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#173e4e] pb-3">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setMobileShowingThread(false)}
                  aria-label="Back to chat list"
                  className="grid h-9 w-9 place-items-center rounded-xl border border-[#225366] text-[#b5f0fc] md:hidden"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
                {activePartner ? (
                  <button
                    type="button"
                    onClick={() => onViewProfile(activePartner)}
                    className="flex items-center gap-3 text-left"
                  >
                    <UserAvatar
                      name={partnerInfo?.displayName || activePartner}
                      avatarDataUrl={partnerInfo?.avatarDataUrl}
                      isOnline={onlineUserIds.has(activePartner)}
                      size="sm"
                    />
                    <div>
                      <div className="text-sm font-semibold text-[#e6fcff] hover:text-[#42e8f5]">
                        {partnerInfo?.displayName || `@${activePartner}`}
                      </div>
                      <div className="font-tech-mono text-[11px] text-[#7ed6e6]">
                        {isPartnerTyping
                          ? 'typing…'
                          : onlineUserIds.has(activePartner)
                            ? 'Online'
                            : `@${activePartner}`}
                      </div>
                    </div>
                  </button>
                ) : (
                  <span className="text-sm font-semibold text-[#e6fcff]">Select a conversation</span>
                )}
              </div>

              {activePartner && (
                <div>
                  {canEncryptDm ? (
                    <button
                      type="button"
                      onClick={() => {
                        setSafetyCopied(false);
                        setSafetyModalOpen(true);
                      }}
                      aria-label="Verify end-to-end encryption safety number"
                      className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-xl border px-2.5 py-1 text-xs font-semibold transition ${
                        isSafetyVerified
                          ? 'border-emerald-400/60 bg-emerald-950/50 text-emerald-200 hover:bg-emerald-900/60'
                          : 'border-[#2b7a6f] bg-[#072624] text-[#7cf7d4] hover:border-[#42e8f5]'
                      }`}
                    >
                      {isSafetyVerified ? (
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                      ) : (
                        <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                      )}
                      <span>{isSafetyVerified ? 'Verified E2EE' : 'E2EE · Safety Code'}</span>
                    </button>
                  ) : (
                    <span className="inline-flex min-h-[34px] items-center gap-1.5 rounded-xl border border-[#244e5e] bg-[#05111c] px-2.5 py-1 text-[11px] text-[#8db9c7]">
                      <Lock className="h-3 w-3 shrink-0 opacity-75" />
                      <span>Waiting for peer key</span>
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* E2EE Channel Banner */}
            {activePartner && (
              <div className="mt-3">
                {canEncryptDm ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSafetyCopied(false);
                      setSafetyModalOpen(true);
                    }}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-500/25 bg-[#061d22] px-3 py-2 text-center text-[11px] text-[#9df5dc] transition hover:border-emerald-400/50"
                  >
                    <Lock className="h-3 w-3 shrink-0 text-emerald-300" />
                    <span>
                      Messages &amp; Snaps are end-to-end encrypted (ECDH P-256 · AES-256-GCM). Tap to verify safety number.
                    </span>
                  </button>
                ) : (
                  <div className="flex items-center justify-center gap-2 rounded-xl border border-[#1d4b5d] bg-[#05111c] px-3 py-2 text-center text-[11px] text-[#8db9c7]">
                    <ShieldAlert className="h-3.5 w-3.5 shrink-0 text-amber-300/80" />
                    <span>
                      Standard relay active until @{activePartner} opens Private World to register a browser E2EE device key.
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Messages Stream */}
            <div className="my-4 max-h-[380px] flex-1 space-y-3 overflow-y-auto pr-1">
              {activeThreadMessages.length === 0 ? (
                <p className="text-sm text-[#8db9c7]">
                  No messages yet. Say hello or send a vanishing Snap below.
                </p>
              ) : (
                activeThreadMessages.map((msg) => {
                  const isMine = msg.fromId === currentUserId;
                  const reactionValues = Object.values(msg.reactions || {});
                  const alreadyOpened = (msg.snapOpenedBy || []).length > 0;
                  const resolved = resolveDmDisplay(msg);

                  return (
                    <div
                      key={msg.id}
                      className={`group flex flex-col ${isMine ? 'items-end' : 'items-start'}`}
                    >
                      <div
                        className={`max-w-[84%] space-y-2 rounded-2xl border px-4 py-2.5 text-sm ${
                          isMine
                            ? 'border-[#2d6e84] bg-[#0b3445] text-[#ecfcff]'
                            : 'border-[#1c4657] bg-[#05101b] text-[#cceef7]'
                        }`}
                      >
                        {resolved.replyPreview && (
                          <div className="rounded-lg border-l-2 border-[#42e8f5] bg-black/25 px-2.5 py-1 text-xs text-[#9bd6e3]">
                            {resolved.replyPreview}
                          </div>
                        )}

                        {msg.isSnap ? (
                          <div className="flex items-center gap-2.5">
                            <Flame
                              className={`h-4 w-4 shrink-0 ${
                                alreadyOpened ? 'text-[#7398a6]' : 'text-amber-400'
                              }`}
                            />
                            {alreadyOpened ? (
                              <span className="text-xs text-[#8db9c7]">Snap opened & vanished</span>
                            ) : isMine ? (
                              <span className="text-xs text-[#b5f8ff]">
                                Vanishing Snap delivered (unopened)
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleOpenSnap(msg)}
                                className="rounded-lg border border-amber-400/60 bg-amber-950/50 px-3 py-1.5 text-xs font-semibold text-amber-100 hover:bg-amber-900/60"
                              >
                                Tap to Open Snap (View Once)
                              </button>
                            )}
                          </div>
                        ) : (
                          <>
                            {resolved.mediaDataUrl && (
                              <div className="overflow-hidden rounded-xl bg-black/40">
                                {resolved.mediaType === 'video' ? (
                                  <video
                                    src={resolved.mediaDataUrl}
                                    controls
                                    playsInline
                                    className="max-h-56 rounded-xl object-cover"
                                  />
                                ) : (
                                  <img
                                    src={resolved.mediaDataUrl}
                                    alt="Chat attachment"
                                    className="max-h-56 rounded-xl object-cover"
                                  />
                                )}
                              </div>
                            )}
                            {resolved.text && (
                              <p
                                className={`leading-relaxed ${
                                  resolved.isLocked ? 'italic text-[#8db9c7]' : ''
                                }`}
                              >
                                {resolved.text}
                              </p>
                            )}
                          </>
                        )}

                        <div className="font-tech-mono flex items-center justify-end gap-1.5 text-[10px] text-[#7db2c2]">
                          {resolved.isE2ee && (
                            <Lock
                              className="h-2.5 w-2.5 text-emerald-300"
                              aria-label="End-to-end encrypted"
                            />
                          )}
                          <span>
                            {new Date(msg.createdAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                          {isMine &&
                            (msg.readAt ? (
                              <CheckCheck className="h-3.5 w-3.5 text-[#42e8f5]" aria-label="Read" />
                            ) : (
                              <Check className="h-3.5 w-3.5 text-[#7db2c2]" aria-label="Sent" />
                            ))}
                        </div>
                      </div>

                      {/* Reactions + Reply Controls */}
                      <div className="mt-1 flex flex-wrap items-center gap-1 px-1">
                        {reactionValues.length > 0 && (
                          <span className="rounded-lg border border-[#1d4b5d] bg-[#05101b] px-2 py-0.5 text-xs">
                            {reactionValues.join(' ')}
                          </span>
                        )}
                        <div className="flex items-center gap-0.5 opacity-80 transition group-hover:opacity-100">
                          {CHAT_EMOJIS.map((emoji) => (
                            <button
                              key={emoji}
                              type="button"
                              onClick={() => handleDmReact(msg.id, emoji)}
                              aria-label={`React with ${emoji}`}
                              className="rounded px-1 text-xs hover:bg-white/10"
                            >
                              {emoji}
                            </button>
                          ))}
                          <button
                            type="button"
                            onClick={() => setReplyingTo(msg)}
                            aria-label="Reply to message"
                            className="ml-1 inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[11px] text-[#8db9c7] hover:bg-white/10 hover:text-white"
                          >
                            <Reply className="h-3 w-3" />
                            <span>Reply</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Composer */}
            <div className="space-y-2 border-t border-[#173e4e] pt-3">
              {replyingTo && (
                <div className="flex items-center justify-between rounded-xl border border-[#245669] bg-[#05101b] px-3 py-2 text-xs text-[#9ce5f2]">
                  <span className="truncate">
                    Replying to:{' '}
                    {replyingTo.isSnap ? 'Vanishing Snap' : resolveDmDisplay(replyingTo).text}
                  </span>
                  <button
                    type="button"
                    onClick={() => setReplyingTo(null)}
                    aria-label="Cancel reply"
                    className="ml-2 text-[#8db9c7] hover:text-white"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}

              {dmMediaDataUrl && (
                <div className="relative inline-block overflow-hidden rounded-xl border border-[#2b6275]">
                  {dmMediaType === 'video' ? (
                    <video src={dmMediaDataUrl} className="max-h-28 rounded-xl" />
                  ) : (
                    <img src={dmMediaDataUrl} alt="Selected attachment" className="max-h-28 rounded-xl object-cover" />
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setDmMediaDataUrl(undefined);
                      setDmMediaType(undefined);
                    }}
                    aria-label="Remove media"
                    className="absolute top-1 right-1 grid h-6 w-6 place-items-center rounded-full bg-black/75 text-white"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}

              <form onSubmit={handleSendDm} className="flex flex-wrap items-center gap-2">
                <input
                  ref={dmFileInputRef}
                  type="file"
                  accept="image/*,video/*"
                  className="hidden"
                  tabIndex={-1}
                  aria-hidden="true"
                  onChange={(e) => {
                    handleAttachMedia(e.target.files?.[0], setDmMediaDataUrl, setDmMediaType);
                    e.target.value = '';
                  }}
                />
                <button
                  type="button"
                  disabled={!activePartner}
                  onClick={() => dmFileInputRef.current?.click()}
                  aria-label="Attach photo or video"
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-[#225366] bg-[#05111c] text-[#9ce5f2] hover:border-[#42e8f5] disabled:opacity-40"
                >
                  <ImagePlus className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  disabled={!activePartner}
                  onClick={() => setDmIsSnap((v) => !v)}
                  aria-pressed={dmIsSnap}
                  title="Toggle View-Once Vanishing Snap"
                  className={`inline-flex h-11 shrink-0 items-center gap-1 rounded-xl border px-3 text-xs font-semibold transition ${
                    dmIsSnap
                      ? 'border-amber-400 bg-amber-950/60 text-amber-200'
                      : 'border-[#225366] bg-[#05111c] text-[#95c3d1] hover:border-amber-400/50'
                  }`}
                >
                  <Flame className="h-4 w-4" />
                  <span className="hidden sm:inline">Snap</span>
                </button>
                <label htmlFor="dm-message-input" className="sr-only">
                  Direct message text
                </label>
                <input
                  id="dm-message-input"
                  type="text"
                  value={dmInput}
                  onChange={(e) => {
                    setDmInput(e.target.value);
                    triggerTyping('dm', activePartner);
                  }}
                  disabled={!activePartner || busy}
                  placeholder={
                    dmIsSnap
                      ? canEncryptDm
                        ? `Send an E2EE view-once Snap to @${activePartner}…`
                        : `Send a view-once Snap to @${activePartner}…`
                      : activePartner
                        ? canEncryptDm
                          ? `Encrypted message to @${activePartner}…`
                          : `Message @${activePartner}…`
                        : 'Select a friend first'
                  }
                  className="min-h-[44px] min-w-[140px] flex-1 rounded-xl border border-[#225366] bg-[#040d16] px-4 py-2.5 text-sm text-[#e8fbff] placeholder:text-[#4e7685] disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={!activePartner || busy || (!dmInput.trim() && !dmMediaDataUrl)}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-[#42e8f5] bg-[#0a3c4c] px-4 py-2.5 text-sm font-semibold text-[#e8fbff] transition hover:bg-[#0e4d61] disabled:opacity-50"
                >
                  <Send className="h-4 w-4" />
                  <span className="hidden sm:inline">{dmIsSnap ? 'Send Snap' : 'Send'}</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* WHATSAPP GROUPS */}
      {activeTab === 'groups' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[0.85fr_1.15fr]">
          <div className="min-w-0 space-y-5">
            <form
              onSubmit={handleCreateGroup}
              className="space-y-3 rounded-2xl border border-[#1d4b5d] bg-[#071522] p-5"
            >
              <h3 className="text-base font-semibold text-[#e6fcff]">Create a Group</h3>
              <div>
                <label htmlFor="new-group-name" className="sr-only">
                  Group name
                </label>
                <input
                  id="new-group-name"
                  type="text"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  maxLength={60}
                  placeholder="Group name (e.g. Hogwarts Crew)"
                  className="min-h-[44px] w-full rounded-xl border border-[#225366] bg-[#040d16] px-4 py-2.5 text-sm text-[#e8fbff] placeholder:text-[#4e7685]"
                />
              </div>
              <div>
                <label htmlFor="new-group-desc" className="sr-only">
                  Group description
                </label>
                <input
                  id="new-group-desc"
                  type="text"
                  value={newGroupDesc}
                  onChange={(e) => setNewGroupDesc(e.target.value)}
                  maxLength={140}
                  placeholder="Short topic (optional)"
                  className="min-h-[44px] w-full rounded-xl border border-[#225366] bg-[#040d16] px-4 py-2.5 text-sm text-[#e8fbff] placeholder:text-[#4e7685]"
                />
              </div>
              <button
                type="submit"
                disabled={busy}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-[#42e8f5] bg-[#0a3c4c] px-4 py-2.5 text-sm font-semibold text-[#e8fbff] hover:bg-[#0e4d61]"
              >
                <Plus className="h-4 w-4" />
                <span>Create Group</span>
              </button>
            </form>

            <div className="space-y-2 rounded-2xl border border-[#1d4b5d] bg-[#071522] p-4">
              <h3 className="px-1 text-sm font-semibold text-[#e6fcff]">Your Groups</h3>
              {snapshot.groups.length === 0 ? (
                <p className="px-1 py-2 text-sm text-[#8db9c7]">No groups yet.</p>
              ) : (
                snapshot.groups.map((grp) => (
                  <button
                    key={grp.id}
                    type="button"
                    onClick={() => setSelectedGroupId(grp.id)}
                    className={`flex min-h-[48px] w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-left transition ${
                      activeGroup?.id === grp.id
                        ? 'bg-[#0e4355] text-white'
                        : 'text-[#a8dce8] hover:bg-white/5'
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">{grp.name}</span>
                      <span className="font-tech-mono block text-xs text-[#8db9c7]">
                        {grp.members.length} members · {grp.messages.length} msgs
                      </span>
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="flex min-w-0 flex-col justify-between rounded-2xl border border-[#1d4b5d] bg-[#071522] p-5">
            {activeGroup ? (
              <>
                <div className="space-y-3 border-b border-[#173e4e] pb-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-bold text-[#e6fcff]">{activeGroup.name}</h3>
                        {e2eeIdentity && (
                          <span className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/40 bg-[#062225] px-2 py-0.5 text-[11px] font-medium text-emerald-200">
                            <Lock className="h-3 w-3" />
                            <span>
                              {activeGroupKeyedMembers.length === activeGroup.members.length
                                ? 'E2EE Group'
                                : `E2EE (${activeGroupKeyedMembers.length}/${activeGroup.members.length} keyed)`}
                            </span>
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[#8db9c7]">
                        {activeGroup.description} · Members:{' '}
                        <span className="font-tech-mono">{activeGroup.members.join(', ')}</span>
                      </p>
                      {activeGroupTypingIds.length > 0 && (
                        <p className="font-tech-mono mt-1 text-[11px] text-[#42e8f5]">
                          {activeGroupTypingIds.map((id) => `@${id}`).join(', ')} typing…
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleDeleteGroup(activeGroup.id)}
                      aria-label={`Delete group ${activeGroup.name}`}
                      className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-[#244e5e] px-3 py-1.5 text-xs text-[#95c3d1] hover:border-rose-400/60 hover:text-rose-200"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Delete</span>
                    </button>
                  </div>

                  {invitableFriends.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2">
                      <label htmlFor="invite-member-select" className="sr-only">
                        Invite friend to group
                      </label>
                      <select
                        id="invite-member-select"
                        value={inviteFriendId}
                        onChange={(e) => setInviteFriendId(e.target.value)}
                        className="min-h-[36px] rounded-lg border border-[#225366] bg-[#040d16] px-3 py-1 text-xs text-[#e8fbff]"
                      >
                        <option value="">Invite circle friend…</option>
                        {invitableFriends.map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.displayName} (@{f.id})
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        disabled={!inviteFriendId || busy}
                        onClick={handleInviteToGroup}
                        className="min-h-[36px] rounded-lg border border-[#2d6d82] bg-[#092938] px-3 py-1 text-xs font-medium text-[#b5f8ff] disabled:opacity-40"
                      >
                        Add Member
                      </button>
                    </div>
                  )}
                </div>

                <div className="my-4 max-h-80 flex-1 space-y-3 overflow-y-auto pr-1">
                  {activeGroup.messages.length === 0 ? (
                    <p className="text-sm text-[#8db9c7]">No messages in this group yet.</p>
                  ) : (
                    activeGroup.messages.map((m) => {
                      const resolvedGroup = resolveGroupMsgDisplay(m);
                      return (
                        <div
                          key={m.id}
                          className="rounded-xl border border-[#1b4657] bg-[#05101b] px-4 py-2.5 text-sm"
                        >
                          <div className="flex items-center justify-between gap-2 text-xs">
                            <button
                              type="button"
                              onClick={() => onViewProfile(m.authorId)}
                              className="font-tech-mono font-semibold text-[#65eaff] hover:underline"
                            >
                              {m.authorId === currentUserId ? 'You' : `@${m.authorId}`}
                            </button>
                            <span className="font-tech-mono inline-flex items-center gap-1.5 text-[#76a5b5]">
                              {resolvedGroup.isE2ee && (
                                <Lock
                                  className="h-2.5 w-2.5 text-emerald-300"
                                  aria-label="End-to-end encrypted"
                                />
                              )}
                              <span>
                                {new Date(m.createdAt).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                            </span>
                          </div>
                          {resolvedGroup.mediaDataUrl && (
                            <div className="mt-2 overflow-hidden rounded-lg bg-black/40">
                              {resolvedGroup.mediaType === 'video' ? (
                                <video
                                  src={resolvedGroup.mediaDataUrl}
                                  controls
                                  playsInline
                                  className="max-h-48 rounded-lg"
                                />
                              ) : (
                                <img
                                  src={resolvedGroup.mediaDataUrl}
                                  alt="Group media"
                                  className="max-h-48 rounded-lg object-cover"
                                />
                              )}
                            </div>
                          )}
                          <p
                            className={`mt-1 ${
                              resolvedGroup.isLocked ? 'italic text-[#8db9c7]' : 'text-[#e8fbff]'
                            }`}
                          >
                            {resolvedGroup.text}
                          </p>
                          <div className="mt-1.5 flex items-center gap-1">
                            {Object.values(m.reactions || {}).length > 0 && (
                              <span className="mr-1 rounded border border-[#1d4b5d] px-1.5 py-0.5 text-xs">
                                {Object.values(m.reactions || {}).join(' ')}
                              </span>
                            )}
                            {CHAT_EMOJIS.map((emoji) => (
                              <button
                                key={emoji}
                                type="button"
                                onClick={() => handleGroupReact(m.id, emoji)}
                                aria-label={`React with ${emoji}`}
                                className="rounded px-1 text-xs opacity-75 hover:bg-white/10 hover:opacity-100"
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {groupMediaDataUrl && (
                  <div className="relative mb-2 inline-block overflow-hidden rounded-xl border border-[#2b6275]">
                    {groupMediaType === 'video' ? (
                      <video src={groupMediaDataUrl} className="max-h-24 rounded-xl" />
                    ) : (
                      <img src={groupMediaDataUrl} alt="Group attachment" className="max-h-24 rounded-xl object-cover" />
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setGroupMediaDataUrl(undefined);
                        setGroupMediaType(undefined);
                      }}
                      aria-label="Remove group media"
                      className="absolute top-1 right-1 grid h-6 w-6 place-items-center rounded-full bg-black/75 text-white"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}

                <form onSubmit={handleSendGroupMsg} className="flex gap-2">
                  <input
                    ref={groupFileInputRef}
                    type="file"
                    accept="image/*,video/*"
                    className="hidden"
                    tabIndex={-1}
                    aria-hidden="true"
                    onChange={(e) => {
                      handleAttachMedia(e.target.files?.[0], setGroupMediaDataUrl, setGroupMediaType);
                      e.target.value = '';
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => groupFileInputRef.current?.click()}
                    aria-label="Attach photo or video to group"
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-[#225366] bg-[#05111c] text-[#9ce5f2] hover:border-[#42e8f5]"
                  >
                    <ImagePlus className="h-4 w-4" />
                  </button>
                  <label htmlFor="group-msg-input" className="sr-only">
                    Group message
                  </label>
                  <input
                    id="group-msg-input"
                    type="text"
                    value={groupMsgInput}
                    onChange={(e) => {
                      setGroupMsgInput(e.target.value);
                      triggerTyping('group', activeGroup.id);
                    }}
                    placeholder={`Message ${activeGroup.name}…`}
                    className="min-h-[44px] flex-1 rounded-xl border border-[#225366] bg-[#040d16] px-4 py-2.5 text-sm text-[#e8fbff] placeholder:text-[#4e7685]"
                  />
                  <button
                    type="submit"
                    disabled={busy || (!groupMsgInput.trim() && !groupMediaDataUrl)}
                    className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-[#42e8f5] bg-[#0a3c4c] px-4 py-2.5 text-sm font-semibold text-[#e8fbff] hover:bg-[#0e4d61] disabled:opacity-50"
                  >
                    <Send className="h-4 w-4" />
                    <span className="hidden sm:inline">Send</span>
                  </button>
                </form>
              </>
            ) : (
              <p className="text-sm text-[#8db9c7]">Create or select a group to start chatting.</p>
            )}
          </div>
        </div>
      )}

      {/* CIRCLE: FRIENDS, REQUESTS, DISCOVERY */}
      {activeTab === 'circle' && (
        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-6">
            <div className="rounded-2xl border border-[#1d4b5d] bg-[#071522] p-5">
              <h2 className="text-base font-semibold text-[#e6fcff]">Add Friend by Unique ID</h2>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleAddFriend(friendIdInput);
                }}
                className="mt-3 flex flex-wrap gap-2"
              >
                <label htmlFor="add-friend-input" className="sr-only">
                  Friend Unique ID
                </label>
                <input
                  id="add-friend-input"
                  type="text"
                  value={friendIdInput}
                  onChange={(e) => setFriendIdInput(e.target.value)}
                  maxLength={24}
                  placeholder="e.g. kairo_9 or lyra_v"
                  className="min-h-[44px] min-w-[180px] flex-1 rounded-xl border border-[#225366] bg-[#040d16] px-4 py-2.5 text-sm text-[#e8fbff] placeholder:text-[#4e7685]"
                />
                <button
                  type="submit"
                  disabled={busy}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-[#42e8f5] bg-[#0a3c4c] px-4 py-2.5 text-sm font-semibold text-[#e8fbff] transition hover:bg-[#0e4d61] disabled:opacity-60"
                >
                  <UserPlus className="h-4 w-4" />
                  <span>Send Request</span>
                </button>
              </form>
            </div>

            <div className="space-y-3">
              <h3 className="text-base font-semibold text-[#e6fcff]">Your Circle</h3>
              {snapshot.friends.length === 0 ? (
                <p className="rounded-xl border border-[#1a4354] bg-[#06121e] p-4 text-sm text-[#8db9c7]">
                  No connected friends yet. Accept a pending request or invite someone from the directory.
                </p>
              ) : (
                snapshot.friends.map((friend) => (
                  <article
                    key={friend.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#1c485a] bg-[#071522] p-4"
                  >
                    <div className="flex items-center gap-3">
                      <UserAvatar
                        name={friend.displayName}
                        avatarDataUrl={friend.avatarDataUrl}
                        isOnline={onlineUserIds.has(friend.id)}
                        onClick={() => onViewProfile(friend.id)}
                      />
                      <div>
                        <button
                          type="button"
                          onClick={() => onViewProfile(friend.id)}
                          className="font-semibold text-[#e8fbff] hover:text-[#42e8f5]"
                        >
                          {friend.displayName}
                        </button>
                        <p className="text-xs text-[#8db9c7]">
                          <span className="font-tech-mono">@{friend.id}</span> ·{' '}
                          {onlineUserIds.has(friend.id) ? 'Online' : friend.status}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          onSelectPartner(friend.id);
                          onChangeTab('chats');
                          setMobileShowingThread(true);
                        }}
                        className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-[#42e8f5]/70 bg-[#0a3c4c] px-3.5 py-2 text-xs font-semibold text-[#e8fbff] hover:bg-[#0e4d61]"
                      >
                        <MessageSquare className="h-3.5 w-3.5" />
                        <span>Open Chat</span>
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleFriendAction(friend.id, 'remove')}
                        aria-label={`Remove ${friend.displayName}`}
                        className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-[#244e5e] px-3 py-2 text-xs text-[#95c3d1] hover:border-rose-400/50 hover:text-rose-200"
                      >
                        <UserMinus className="h-3.5 w-3.5" />
                        <span>Remove</span>
                      </button>
                    </div>
                  </article>
                ))
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div className="space-y-3 rounded-2xl border border-[#1d4b5d] bg-[#071522] p-5">
              <h3 className="text-base font-semibold text-[#e6fcff]">
                Pending Requests ({snapshot.requests.length})
              </h3>
              {snapshot.requests.length === 0 ? (
                <p className="text-sm text-[#8db9c7]">No pending requests right now.</p>
              ) : (
                snapshot.requests.map((req) => {
                  const otherId = req.direction === 'incoming' ? req.fromId : req.toId;
                  return (
                    <div
                      key={req.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#1a4354] bg-[#05101b] p-3.5"
                    >
                      <button
                        type="button"
                        onClick={() => onViewProfile(otherId)}
                        className="text-left"
                      >
                        <div className="font-tech-mono text-sm font-medium text-[#e8fbff] hover:text-[#42e8f5]">
                          @{otherId}
                        </div>
                        <div className="text-xs text-[#8db9c7]">
                          {req.direction === 'incoming' ? 'Incoming invite' : 'Sent invite'}
                        </div>
                      </button>
                      <div className="flex items-center gap-2">
                        {req.direction === 'incoming' && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => handleFriendAction(otherId, 'accept')}
                            className="inline-flex min-h-[38px] items-center gap-1 rounded-lg border border-emerald-400/60 bg-emerald-950/60 px-3 py-1.5 text-xs font-semibold text-emerald-100 hover:bg-emerald-900/70"
                          >
                            <Check className="h-3.5 w-3.5" />
                            <span>Accept</span>
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => handleFriendAction(otherId, 'decline')}
                          className="inline-flex min-h-[38px] items-center gap-1 rounded-lg border border-[#244e5e] px-3 py-1.5 text-xs text-[#95c3d1] hover:text-white"
                        >
                          <X className="h-3.5 w-3.5" />
                          <span>{req.direction === 'incoming' ? 'Decline' : 'Cancel'}</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {snapshot.directory.length > 0 && (
              <div className="space-y-3 rounded-2xl border border-[#1d4b5d] bg-[#071522] p-5">
                <h3 className="text-base font-semibold text-[#e6fcff]">Discover People</h3>
                <div className="space-y-2.5">
                  {snapshot.directory.map((person) => (
                    <div
                      key={person.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-[#183e4e] bg-[#05101b] p-3"
                    >
                      <button
                        type="button"
                        onClick={() => onViewProfile(person.id)}
                        className="flex min-w-0 items-center gap-2.5 text-left"
                      >
                        <UserAvatar
                          name={person.displayName}
                          avatarDataUrl={person.avatarDataUrl}
                          isOnline={onlineUserIds.has(person.id)}
                          size="sm"
                        />
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-[#e8fbff]">
                            {person.displayName}
                          </div>
                          <div className="truncate text-xs text-[#8db9c7]">
                            <span className="font-tech-mono">@{person.id}</span> · {person.status}
                          </div>
                        </div>
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleAddFriend(person.id)}
                        className="inline-flex min-h-[38px] shrink-0 items-center gap-1 rounded-lg border border-[#2d6d82] bg-[#0b2a38] px-3 py-1.5 text-xs font-medium text-[#c7f3fc] hover:border-[#42e8f5]"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>Add</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* View-Once Snap Modal */}
      {openedSnapModal && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/90 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Vanishing Snap"
        >
          <div className="w-full max-w-md space-y-4 rounded-2xl border border-amber-400/50 bg-[#071522] p-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-amber-200">
                <Flame className="h-5 w-5 text-amber-400" />
                <span className="text-sm font-semibold">Vanishing Snap from @{openedSnapModal.fromId}</span>
              </div>
              <button
                type="button"
                onClick={() => setOpenedSnapModal(null)}
                aria-label="Close snap"
                className="grid h-9 w-9 place-items-center rounded-xl border border-[#244e5e] text-[#c7eef7]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {openedSnapModal.mediaDataUrl && (
              <div className="overflow-hidden rounded-xl bg-black/50">
                {openedSnapModal.mediaType === 'video' ? (
                  <video src={openedSnapModal.mediaDataUrl} controls autoPlay playsInline className="max-h-[60vh] w-full object-contain" />
                ) : (
                  <img src={openedSnapModal.mediaDataUrl} alt="Vanishing snap" className="max-h-[60vh] w-full object-contain" />
                )}
              </div>
            )}
            {openedSnapModal.text && (
              <p className="text-sm leading-relaxed text-[#e8fbff]">{openedSnapModal.text}</p>
            )}
            <p className="font-tech-mono text-xs text-amber-300/80">
              This Snap has been burned on the server and cannot be re-opened after closing.
            </p>
          </div>
        </div>
      )}

      {/* WhatsApp-style Safety Number Verification Modal */}
      {safetyModalOpen && activePartner && canEncryptDm && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/85 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Verify end-to-end encryption safety number"
        >
          <div className="w-full max-w-md space-y-4 rounded-2xl border border-[#2b7a6f] bg-[#071522] p-5 shadow-2xl">
            <div className="flex items-center justify-between gap-3 border-b border-[#194254] pb-3">
              <div className="flex items-center gap-2 text-emerald-200">
                <ShieldCheck className="h-5 w-5 text-emerald-300" />
                <h3 className="text-base font-bold text-[#e6fcff]">Verify Safety Number</h3>
              </div>
              <button
                type="button"
                onClick={() => setSafetyModalOpen(false)}
                aria-label="Close safety number modal"
                className="grid h-9 w-9 place-items-center rounded-xl border border-[#244e5e] text-[#c7eef7] hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs leading-relaxed text-[#9ad2df]">
              Compare this 60-digit Safety Number with{' '}
              <span className="font-semibold text-[#e8fbff]">
                {partnerInfo?.displayName || `@${activePartner}`}
              </span>{' '}
              (<span className="font-tech-mono">@{activePartner}</span>). Identical numbers confirm your
              ECDH P-256 + AES-256-GCM key exchange has no intermediary.
            </p>

            <div
              data-testid="safety-number-grid"
              className="grid grid-cols-3 gap-2 rounded-xl border border-[#1a4b58] bg-[#040e17] p-4 text-center sm:grid-cols-4"
            >
              {safetyBlocks.map((block, idx) => (
                <div
                  key={`${block}-${idx}`}
                  className="font-tech-mono rounded-lg border border-[#163a47] bg-[#071826] py-1.5 text-sm font-semibold tracking-wider text-[#8ef7de] tabular-nums"
                >
                  {block}
                </div>
              ))}
            </div>

            <div className="space-y-1 rounded-xl border border-[#183e4e] bg-[#05101b] px-3 py-2 text-[11px] text-[#8db9c7]">
              <div className="font-tech-mono">Cipher: ECDH P-256 · HKDF-SHA-256 · AES-256-GCM</div>
              <div className="text-[#7cf7d4]">
                Cross-device key sync: log in with ID &amp; password on any phone or browser to keep this exact keypair.
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  if (!safetyCodeJoined) return;
                  navigator.clipboard?.writeText(safetyCodeJoined).catch(() => {});
                  setSafetyCopied(true);
                }}
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-[#244e5e] bg-[#061824] px-3.5 py-2 text-xs font-semibold text-[#c7f3fc] hover:border-[#42e8f5]"
              >
                <Copy className="h-3.5 w-3.5" />
                <span>{safetyCopied ? 'Copied' : 'Copy Code'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (!activeSafetyKey) return;
                  const next = { ...verifiedSafetyMap, [activeSafetyKey]: !isSafetyVerified };
                  if (!next[activeSafetyKey]) {
                    delete next[activeSafetyKey];
                  }
                  setVerifiedSafetyMap(next);
                  saveVerifiedSafetyMap(next);
                }}
                className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border px-4 py-2 text-xs font-semibold transition ${
                  isSafetyVerified
                    ? 'border-emerald-400 bg-emerald-950/70 text-emerald-100'
                    : 'border-[#42e8f5] bg-[#0a3c4c] text-[#e8fbff] hover:bg-[#0e4d61]'
                }`}
              >
                <CheckCircle2 className="h-4 w-4" />
                <span>{isSafetyVerified ? 'Verified Contact' : 'Mark as Verified'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
