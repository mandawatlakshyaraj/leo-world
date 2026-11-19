import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Camera,
  Download,
  Eye,
  Image as ImageIcon,
  Lock,
  Send,
  ShieldAlert,
  Sparkles,
  Trash2,
  Unlock,
  Upload,
  X,
} from 'lucide-react';
import type { EncryptedVaultRecord, GlimpseMediaItem, GlimpseTabId } from '../../types/leo';
import { createPost, createStory } from '../../utils/apiClient';
import { decryptVaultBytes, encryptVaultBytes } from '../../utils/cryptoVault';
import {
  deleteEclipseRecord,
  deleteGlimpseItem,
  getEclipseRecords,
  getGlimpseItems,
  putEclipseRecord,
  putGlimpseItem,
} from '../../utils/indexedDbStorage';

interface GlimpsesModuleProps {
  activeTab: GlimpseTabId;
  onChangeTab: (tab: GlimpseTabId) => void;
  onVaultCountChange: (count: number) => void;
  onSocialCreated?: () => Promise<void>;
}

type CameraFilterId = 'natural' | 'twilight' | 'amber' | 'mono';

const CAMERA_FILTERS: { id: CameraFilterId; label: string; css: string }[] = [
  { id: 'natural', label: 'Natural', css: 'none' },
  { id: 'twilight', label: 'Twilight', css: 'contrast(1.12) saturate(1.25) hue-rotate(-14deg)' },
  { id: 'amber', label: 'Amber', css: 'sepia(0.35) contrast(1.08) saturate(1.3)' },
  { id: 'mono', label: 'Noir', css: 'grayscale(1) contrast(1.22)' },
];

export function GlimpsesModule({
  activeTab,
  onChangeTab,
  onVaultCountChange,
  onSocialCreated,
}: GlimpsesModuleProps) {
  const [galleryItems, setGalleryItems] = useState<GlimpseMediaItem[]>([]);
  const [vaultRecords, setVaultRecords] = useState<EncryptedVaultRecord[]>([]);
  const [vaultPassphrase, setVaultPassphrase] = useState('');
  const [unlockedKey, setUnlockedKey] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<'environment' | 'user'>('environment');
  const [cameraFilter, setCameraFilter] = useState<CameraFilterId>('natural');
  const [lastSnapDataUrl, setLastSnapDataUrl] = useState<string | null>(null);
  const [snapCaption, setSnapCaption] = useState('');
  const [sharingSnap, setSharingSnap] = useState(false);

  const [previewModal, setPreviewModal] = useState<{
    name: string;
    mimeType: string;
    url: string;
    revokeOnClose: boolean;
  } | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  const vaultInputRef = useRef<HTMLInputElement | null>(null);

  const galleryUrls = useMemo(
    () =>
      galleryItems.map((item) => ({
        id: item.id,
        url: URL.createObjectURL(item.blob),
      })),
    [galleryItems]
  );

  useEffect(() => {
    return () => {
      galleryUrls.forEach((entry) => URL.revokeObjectURL(entry.url));
    };
  }, [galleryUrls]);

  const urlMap = useMemo(() => {
    const map = new Map<string, string>();
    galleryUrls.forEach((entry) => map.set(entry.id, entry.url));
    return map;
  }, [galleryUrls]);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  }, []);

  useEffect(() => {
    if (activeTab !== 'camera') {
      stopCamera();
    }
  }, [activeTab, stopCamera]);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  const refreshGallery = useCallback(async () => {
    try {
      const items = await getGlimpseItems();
      setGalleryItems(items);
    } catch {
      setStatus('Browser IndexedDB storage is unavailable.');
    }
  }, []);

  const refreshVaultCount = useCallback(async () => {
    try {
      const records = await getEclipseRecords();
      onVaultCountChange(records.length);
      if (unlockedKey) {
        setVaultRecords(records);
      }
    } catch {
      // Ignore count fetch error
    }
  }, [onVaultCountChange, unlockedKey]);

  useEffect(() => {
    refreshGallery();
    refreshVaultCount();
  }, [refreshGallery, refreshVaultCount]);

  async function handleImportFiles(fileList: FileList | null) {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    try {
      for (const file of files) {
        await putGlimpseItem({
          id: crypto.randomUUID(),
          name: file.name,
          mimeType: file.type || 'application/octet-stream',
          size: file.size,
          blob: file,
          source: 'import',
          createdAt: Date.now(),
        });
      }
      await refreshGallery();
      setStatus(`Saved ${files.length} item(s) into your persistent Glimpses gallery.`);
    } catch (err) {
      setStatus((err as Error).message || 'Could not import files.');
    }
  }

  async function startCamera(facing: 'environment' | 'user') {
    stopCamera();
    setCameraFacing(facing);
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus('Camera API requires HTTPS or localhost.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCameraActive(true);
      setStatus('Camera Studio is live.');
    } catch (err) {
      setStatus(
        `Camera unavailable: ${(err as Error).message || 'permission denied or no camera detected'}.`
      );
    }
  }

  async function capturePhoto() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) {
      setStatus('Start the camera and wait for the video frame first.');
      return;
    }
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const activeFilter = CAMERA_FILTERS.find((f) => f.id === cameraFilter);
    ctx.filter = activeFilter?.css || 'none';
    ctx.drawImage(video, 0, 0);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    setLastSnapDataUrl(dataUrl);

    canvas.toBlob(async (blob) => {
      if (!blob) {
        setStatus('Could not capture photo frame.');
        return;
      }
      await putGlimpseItem({
        id: crypto.randomUUID(),
        name: `snap-${Date.now()}.jpg`,
        mimeType: 'image/jpeg',
        size: blob.size,
        blob,
        source: 'camera',
        createdAt: Date.now(),
      });
      await refreshGallery();
      setStatus('Snap captured and saved to Glimpses Gallery. Share it below or keep it local.');
    }, 'image/jpeg', 0.9);
  }

  async function shareSnapTo(target: 'story' | 'feed') {
    if (!lastSnapDataUrl) return;
    setSharingSnap(true);
    try {
      if (target === 'story') {
        await createStory({
          text: snapCaption.trim(),
          mediaDataUrl: lastSnapDataUrl,
          mediaType: 'image',
          visibility: 'friends',
        });
        setStatus('Snap published to your 24h Story!');
      } else {
        await createPost({
          caption: snapCaption.trim() || 'Fresh from Camera Studio',
          mediaDataUrl: lastSnapDataUrl,
          mediaType: 'image',
          visibility: 'friends',
        });
        setStatus('Snap posted to your Feed!');
      }
      setSnapCaption('');
      setLastSnapDataUrl(null);
      if (onSocialCreated) await onSocialCreated();
    } catch (err) {
      setStatus((err as Error).message || 'Could not share capture.');
    } finally {
      setSharingSnap(false);
    }
  }

  async function shareGalleryItemTo(item: GlimpseMediaItem, target: 'story' | 'feed') {
    if (item.size > 6 * 1024 * 1024) {
      setStatus('Only media under 6 MB can be shared directly to the circle feed.');
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const dataUrl = String(reader.result || '');
        const mediaType = item.mimeType.startsWith('video/') ? 'video' : 'image';
        if (target === 'story') {
          await createStory({ text: '', mediaDataUrl: dataUrl, mediaType, visibility: 'friends' });
          setStatus(`Shared "${item.name}" to your 24h Story.`);
        } else {
          await createPost({
            caption: item.name.replace(/\.[^/.]+$/, ''),
            mediaDataUrl: dataUrl,
            mediaType,
            visibility: 'friends',
          });
          setStatus(`Posted "${item.name}" to your Feed.`);
        }
        if (onSocialCreated) await onSocialCreated();
      } catch (err) {
        setStatus((err as Error).message || 'Could not share media.');
      }
    };
    reader.readAsDataURL(item.blob);
  }

  async function handleRemoveGlimpse(id: string) {
    await deleteGlimpseItem(id);
    await refreshGallery();
    setStatus('Removed item from Gallery.');
  }

  async function moveGlimpseToVault(item: GlimpseMediaItem) {
    if (!unlockedKey) {
      setStatus('Unlock the Eclipse Vault tab first before encrypting gallery items.');
      onChangeTab('eclipse');
      return;
    }
    try {
      const bytes = await item.blob.arrayBuffer();
      const encrypted = await encryptVaultBytes(unlockedKey, bytes);
      await putEclipseRecord({
        id: crypto.randomUUID(),
        name: item.name,
        mimeType: item.mimeType,
        size: item.size,
        ...encrypted,
        createdAt: Date.now(),
      });
      await deleteGlimpseItem(item.id);
      await refreshGallery();
      await refreshVaultCount();
      setStatus(`Encrypted "${item.name}" and moved it into Eclipse Vault.`);
    } catch (err) {
      setStatus((err as Error).message || 'Encryption failed.');
    }
  }

  async function unlockVault() {
    if (vaultPassphrase.length < 10) {
      setStatus('Use a passphrase of at least 10 characters.');
      return;
    }
    try {
      const records = await getEclipseRecords();
      if (records.length > 0) {
        await decryptVaultBytes(vaultPassphrase, records[0]);
      }
      setUnlockedKey(vaultPassphrase);
      setVaultRecords(records);
      onVaultCountChange(records.length);
      setStatus(
        records.length > 0
          ? `Eclipse Vault unlocked (${records.length} encrypted items).`
          : 'New Eclipse Vault unlocked for this session.'
      );
    } catch {
      setUnlockedKey(null);
      setVaultRecords([]);
      setStatus('Passphrase check failed. Check your vault passphrase.');
    }
  }

  function lockVault() {
    setUnlockedKey(null);
    setVaultPassphrase('');
    setVaultRecords([]);
    if (previewModal?.revokeOnClose) {
      URL.revokeObjectURL(previewModal.url);
      setPreviewModal(null);
    }
    setStatus('Eclipse Vault locked.');
  }

  async function encryptFilesIntoVault(fileList: FileList | null) {
    if (!unlockedKey) {
      setStatus('Unlock the vault first.');
      return;
    }
    const files = Array.from(fileList || []);
    if (!files.length) return;
    try {
      for (const file of files) {
        const bytes = await file.arrayBuffer();
        const encrypted = await encryptVaultBytes(unlockedKey, bytes);
        await putEclipseRecord({
          id: crypto.randomUUID(),
          name: file.name,
          mimeType: file.type || 'application/octet-stream',
          size: file.size,
          ...encrypted,
          createdAt: Date.now(),
        });
      }
      const records = await getEclipseRecords();
      setVaultRecords(records);
      onVaultCountChange(records.length);
      setStatus(`Encrypted and saved ${files.length} file(s) in Eclipse Vault.`);
    } catch (err) {
      setStatus((err as Error).message || 'Could not encrypt files.');
    }
  }

  async function decryptAndPreviewVaultItem(record: EncryptedVaultRecord) {
    if (!unlockedKey) return;
    try {
      const plain = await decryptVaultBytes(unlockedKey, record);
      const blob = new Blob([plain], { type: record.mimeType });
      const url = URL.createObjectURL(blob);
      setPreviewModal({
        name: record.name,
        mimeType: record.mimeType,
        url,
        revokeOnClose: true,
      });
    } catch {
      setStatus('Decryption failed.');
    }
  }

  async function decryptAndDownloadVaultItem(record: EncryptedVaultRecord) {
    if (!unlockedKey) return;
    try {
      const plain = await decryptVaultBytes(unlockedKey, record);
      const blob = new Blob([plain], { type: record.mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = record.name;
      a.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1500);
      setStatus(`Decrypted download started for "${record.name}".`);
    } catch {
      setStatus('Decryption failed.');
    }
  }

  async function removeVaultItem(id: string) {
    await deleteEclipseRecord(id);
    const records = await getEclipseRecords();
    setVaultRecords(records);
    onVaultCountChange(records.length);
    setStatus('Encrypted item deleted permanently.');
  }

  function closeModal() {
    if (previewModal?.revokeOnClose) {
      URL.revokeObjectURL(previewModal.url);
    }
    setPreviewModal(null);
  }

  const activeFilterCss = CAMERA_FILTERS.find((f) => f.id === cameraFilter)?.css || 'none';

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div
        className="grid grid-cols-3 gap-2 rounded-2xl border border-[#1d4b5d] bg-[#05101b] p-1.5"
        role="tablist"
        aria-label="Camera, Gallery, and Eclipse Vault sections"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'camera'}
          onClick={() => onChangeTab('camera')}
          className={`flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl px-2 text-xs font-semibold whitespace-nowrap transition sm:gap-2 sm:px-3 sm:text-sm ${
            activeTab === 'camera' ? 'bg-[#0e4355] text-white shadow' : 'text-[#8cbac7] hover:text-white'
          }`}
        >
          <Camera className="h-4 w-4 shrink-0" />
          <span>Camera Studio</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'gallery'}
          onClick={() => onChangeTab('gallery')}
          className={`flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl px-2 text-xs font-semibold whitespace-nowrap transition sm:gap-2 sm:px-3 sm:text-sm ${
            activeTab === 'gallery' ? 'bg-[#0e4355] text-white shadow' : 'text-[#8cbac7] hover:text-white'
          }`}
        >
          <ImageIcon className="h-4 w-4 shrink-0" />
          <span>Gallery ({galleryItems.length})</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'eclipse'}
          onClick={() => onChangeTab('eclipse')}
          className={`flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl px-2 text-xs font-semibold whitespace-nowrap transition sm:gap-2 sm:px-3 sm:text-sm ${
            activeTab === 'eclipse' ? 'bg-[#0e4355] text-white shadow' : 'text-[#8cbac7] hover:text-white'
          }`}
        >
          {unlockedKey ? (
            <Unlock className="h-4 w-4 shrink-0 text-[#72f7c8]" />
          ) : (
            <Lock className="h-4 w-4 shrink-0" />
          )}
          <span>Eclipse</span>
        </button>
      </div>

      {status && (
        <p className="text-sm text-[#72f7c8]" aria-live="polite">
          {status}
        </p>
      )}

      {/* SNAPCHAT-STYLE CAMERA STUDIO */}
      {activeTab === 'camera' && (
        <div className="space-y-5 rounded-2xl border border-[#1d4b5d] bg-[#071522] p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-[#e6fcff]">Camera Studio</h2>
              <p className="mt-1 text-xs text-[#8db9c7]">
                Apply live filters, capture snaps to Gallery, or publish directly to Stories & Feed.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => startCamera('environment')}
                className="min-h-[42px] rounded-xl border border-[#42e8f5] bg-[#0a3c4c] px-4 py-2 text-xs font-semibold text-[#e8fbff]"
              >
                {cameraActive && cameraFacing === 'environment' ? 'Restart Rear' : 'Open Camera'}
              </button>
              <button
                type="button"
                onClick={() => startCamera('user')}
                className="min-h-[42px] rounded-xl border border-[#244e5e] px-4 py-2 text-xs text-[#c7f3fc] hover:border-[#42e8f5]"
              >
                Front Camera
              </button>
              <button
                type="button"
                disabled={!cameraActive}
                onClick={capturePhoto}
                className="min-h-[42px] rounded-xl border border-emerald-400/70 bg-emerald-950/60 px-4 py-2 text-xs font-semibold text-emerald-100 disabled:opacity-40"
              >
                Snap Photo
              </button>
              {cameraActive && (
                <button
                  type="button"
                  onClick={stopCamera}
                  className="min-h-[42px] rounded-xl border border-[#244e5e] px-4 py-2 text-xs text-[#95c3d1]"
                >
                  Stop
                </button>
              )}
            </div>
          </div>

          {/* Filter Presets */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 text-xs font-medium text-[#8db9c7]">
              <Sparkles className="h-3.5 w-3.5 text-[#42e8f5]" />
              <span>Filters:</span>
            </span>
            {CAMERA_FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setCameraFilter(f.id)}
                className={`min-h-[34px] rounded-xl border px-3 py-1 text-xs font-medium transition ${
                  cameraFilter === f.id
                    ? 'border-[#42e8f5] bg-[#0e4355] text-white'
                    : 'border-[#204c5e] bg-[#05101b] text-[#95c3d1] hover:text-white'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="overflow-hidden rounded-xl border border-[#1c4b5d] bg-[#030910]">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              style={{ filter: activeFilterCss }}
              className="aspect-video max-h-[380px] w-full object-cover"
            />
          </div>

          {/* Post-Capture Action Bar */}
          {lastSnapDataUrl && (
            <div className="space-y-3 rounded-xl border border-[#285e72] bg-[#05101b] p-4">
              <div className="flex flex-wrap items-start gap-4">
                <img
                  src={lastSnapDataUrl}
                  alt="Latest snap capture"
                  className="h-24 w-32 rounded-lg border border-[#2b6275] object-cover"
                />
                <div className="min-w-[200px] flex-1 space-y-2.5">
                  <label htmlFor="snap-caption-input" className="sr-only">
                    Snap caption
                  </label>
                  <input
                    id="snap-caption-input"
                    type="text"
                    value={snapCaption}
                    onChange={(e) => setSnapCaption(e.target.value)}
                    placeholder="Add a caption to share this snap…"
                    className="min-h-[40px] w-full rounded-xl border border-[#225366] bg-[#040d16] px-3.5 py-2 text-xs text-[#e8fbff]"
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={sharingSnap}
                      onClick={() => shareSnapTo('story')}
                      className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-[#42e8f5] bg-[#0a3c4c] px-3 py-1.5 text-xs font-semibold text-white"
                    >
                      <Send className="h-3.5 w-3.5" />
                      <span>Share to 24h Story</span>
                    </button>
                    <button
                      type="button"
                      disabled={sharingSnap}
                      onClick={() => shareSnapTo('feed')}
                      className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-[#2d6d82] bg-[#092938] px-3 py-1.5 text-xs font-semibold text-[#c7f3fc]"
                    >
                      <Send className="h-3.5 w-3.5" />
                      <span>Post to Feed</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setLastSnapDataUrl(null)}
                      className="min-h-[36px] rounded-lg border border-[#244e5e] px-3 py-1.5 text-xs text-[#8db9c7]"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* GALLERY */}
      {activeTab === 'gallery' && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#1d4b5d] bg-[#071522] p-5">
            <div>
              <h2 className="text-base font-semibold text-[#e6fcff]">Glimpses Gallery</h2>
              <p className="mt-1 text-xs text-[#8db9c7]">
                Imported photos and camera captures persist locally in IndexedDB and can be posted to Stories or Feed.
              </p>
            </div>
            <div>
              <input
                ref={galleryInputRef}
                type="file"
                accept="image/*,video/*"
                multiple
                className="hidden"
                tabIndex={-1}
                aria-hidden="true"
                onChange={(e) => {
                  handleImportFiles(e.target.files);
                  e.target.value = '';
                }}
              />
              <button
                type="button"
                onClick={() => galleryInputRef.current?.click()}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-[#42e8f5] bg-[#0a3c4c] px-4 py-2.5 text-sm font-semibold text-[#e8fbff] transition hover:bg-[#0e4d61]"
              >
                <Upload className="h-4 w-4" />
                <span>Import Media</span>
              </button>
            </div>
          </div>

          {galleryItems.length === 0 ? (
            <p className="rounded-2xl border border-[#1a4354] bg-[#06121e] p-6 text-sm text-[#8db9c7]">
              Your gallery is empty. Import photos or videos, or snap a photo from Camera Studio.
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {galleryItems.map((item) => {
                const url = urlMap.get(item.id) || '';
                const isVideo = item.mimeType.startsWith('video/');
                return (
                  <article
                    key={item.id}
                    className="overflow-hidden rounded-2xl border border-[#1c485a] bg-[#071522]"
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setPreviewModal({
                          name: item.name,
                          mimeType: item.mimeType,
                          url,
                          revokeOnClose: false,
                        })
                      }
                      aria-label={`Preview ${item.name}`}
                      className="block w-full bg-[#040c14]"
                    >
                      {isVideo ? (
                        <video src={url} className="aspect-video w-full object-cover" muted />
                      ) : (
                        <img
                          src={url}
                          alt={item.name}
                          className="aspect-video w-full object-cover"
                        />
                      )}
                    </button>
                    <div className="space-y-3 p-3.5">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-[#e8fbff]">{item.name}</div>
                        <div className="font-tech-mono text-xs text-[#8db9c7]">
                          {Math.max(1, Math.round(item.size / 1024))} KB · {item.source}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          onClick={() => shareGalleryItemTo(item, 'story')}
                          className="inline-flex min-h-[34px] items-center gap-1 rounded-lg border border-[#42e8f5]/60 bg-[#0a3c4c] px-2.5 py-1 text-xs text-[#e8fbff]"
                        >
                          <span>Story</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => shareGalleryItemTo(item, 'feed')}
                          className="inline-flex min-h-[34px] items-center gap-1 rounded-lg border border-[#2d6d82] bg-[#092938] px-2.5 py-1 text-xs text-[#b5f8ff]"
                        >
                          <span>Feed</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => moveGlimpseToVault(item)}
                          className="inline-flex min-h-[34px] items-center gap-1 rounded-lg border border-[#244e5e] px-2.5 py-1 text-xs text-[#c7f3fc] hover:border-[#42e8f5]"
                        >
                          <Lock className="h-3 w-3" />
                          <span>Vault</span>
                        </button>
                        <a
                          href={url}
                          download={item.name}
                          aria-label={`Download ${item.name}`}
                          className="grid h-8 w-8 place-items-center rounded-lg border border-[#244e5e] text-[#c7f3fc] hover:border-[#42e8f5]"
                        >
                          <Download className="h-3.5 w-3.5" />
                        </a>
                        <button
                          type="button"
                          onClick={() => handleRemoveGlimpse(item.id)}
                          aria-label={`Delete ${item.name}`}
                          className="ml-auto grid h-8 w-8 place-items-center rounded-lg text-[#8db9c7] hover:bg-white/5 hover:text-rose-300"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ECLIPSE AES-GCM VAULT */}
      {activeTab === 'eclipse' && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-[#27596d] bg-[#071522] p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="max-w-xl">
                <h2 className="text-lg font-bold text-[#e6fcff]">Eclipse Encrypted Vault</h2>
                <p className="mt-1.5 text-sm leading-relaxed text-[#95c3d1]">
                  Files are encrypted locally in your browser using PBKDF2 (250,000 iterations) and
                  AES-256-GCM before being stored in IndexedDB. Your passphrase is never stored or
                  transmitted.
                </p>
              </div>
              <span
                className={`font-tech-mono rounded-lg border px-3 py-1.5 text-xs ${
                  unlockedKey
                    ? 'border-emerald-400/60 bg-emerald-950/60 text-emerald-200'
                    : 'border-[#254e61] bg-[#05101b] text-[#95c3d1]'
                }`}
              >
                {unlockedKey ? 'Unlocked' : 'Locked'}
              </span>
            </div>

            <div className="mt-5 flex flex-wrap items-end gap-3">
              <div className="min-w-[220px] flex-1">
                <label
                  htmlFor="eclipse-passphrase-input"
                  className="mb-1.5 block text-xs font-medium tracking-wider uppercase text-[#8db9c7]"
                >
                  Vault Passphrase (min 10 chars)
                </label>
                <input
                  id="eclipse-passphrase-input"
                  type="password"
                  value={vaultPassphrase}
                  onChange={(e) => setVaultPassphrase(e.target.value)}
                  disabled={Boolean(unlockedKey)}
                  autoComplete="new-password"
                  placeholder="Enter a strong unique passphrase"
                  className="min-h-[44px] w-full rounded-xl border border-[#225366] bg-[#040d16] px-4 py-2.5 text-sm text-[#e8fbff] placeholder:text-[#4e7685] disabled:opacity-60"
                />
              </div>

              {!unlockedKey ? (
                <button
                  type="button"
                  onClick={unlockVault}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-[#42e8f5] bg-[#0a3c4c] px-5 py-2.5 text-sm font-semibold text-[#e8fbff] hover:bg-[#0e4d61]"
                >
                  <Unlock className="h-4 w-4" />
                  <span>Unlock / Create Vault</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={lockVault}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-amber-400/60 bg-amber-950/40 px-5 py-2.5 text-sm font-semibold text-amber-100 hover:bg-amber-950/70"
                >
                  <Lock className="h-4 w-4" />
                  <span>Lock Vault</span>
                </button>
              )}
            </div>

            {unlockedKey && (
              <div className="mt-5 border-t border-[#173f4f] pt-5">
                <input
                  ref={vaultInputRef}
                  type="file"
                  accept="image/*,video/*,.pdf,.txt"
                  multiple
                  className="hidden"
                  tabIndex={-1}
                  aria-hidden="true"
                  onChange={(e) => {
                    encryptFilesIntoVault(e.target.files);
                    e.target.value = '';
                  }}
                />
                <button
                  type="button"
                  onClick={() => vaultInputRef.current?.click()}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-[#42e8f5] bg-[#0a3c4c] px-5 py-2.5 text-sm font-semibold text-[#e8fbff] hover:bg-[#0e4d61]"
                >
                  <Upload className="h-4 w-4" />
                  <span>Encrypt & Store Files</span>
                </button>
              </div>
            )}
          </div>

          {unlockedKey ? (
            <div className="space-y-3">
              <h3 className="text-base font-semibold text-[#e6fcff]">
                Encrypted Vault Items ({vaultRecords.length})
              </h3>
              {vaultRecords.length === 0 ? (
                <p className="rounded-xl border border-[#1a4354] bg-[#06121e] p-5 text-sm text-[#8db9c7]">
                  Vault is empty. Encrypt files above or move items from your Glimpses Gallery.
                </p>
              ) : (
                vaultRecords.map((rec) => (
                  <article
                    key={rec.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#1c485a] bg-[#071522] p-4"
                  >
                    <div className="min-w-0">
                      <h4 className="flex items-center gap-2 text-sm font-semibold text-[#e8fbff]">
                        <Lock className="h-4 w-4 shrink-0 text-[#72f7c8]" />
                        <span className="truncate">{rec.name}</span>
                      </h4>
                      <p className="font-tech-mono mt-1 text-xs text-[#8db9c7]">
                        {Math.max(1, Math.round(rec.size / 1024))} KB · AES-256-GCM ·{' '}
                        {new Date(rec.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {(rec.mimeType.startsWith('image/') || rec.mimeType.startsWith('video/')) && (
                        <button
                          type="button"
                          onClick={() => decryptAndPreviewVaultItem(rec)}
                          className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-[#42e8f5]/70 bg-[#0a3c4c] px-3 py-1.5 text-xs font-semibold text-[#e8fbff]"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          <span>Decrypt & Preview</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => decryptAndDownloadVaultItem(rec)}
                        className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-[#244e5e] px-3 py-1.5 text-xs text-[#c7f3fc] hover:border-[#42e8f5]"
                      >
                        <Download className="h-3.5 w-3.5" />
                        <span>Download</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => removeVaultItem(rec.id)}
                        aria-label={`Delete encrypted item ${rec.name}`}
                        className="grid h-9 w-9 place-items-center rounded-lg text-[#8db9c7] hover:bg-white/5 hover:text-rose-300"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </article>
                ))
              )}
            </div>
          ) : (
            <div className="flex items-center gap-3 rounded-2xl border border-[#1a4354] bg-[#06121e] p-5 text-sm text-[#8db9c7]">
              <ShieldAlert className="h-5 w-5 shrink-0 text-[#f4d27a]" />
              <span>Unlock the vault with your passphrase to view or decrypt stored media.</span>
            </div>
          )}
        </div>
      )}

      {previewModal && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/85 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`Preview ${previewModal.name}`}
        >
          <div className="w-full max-w-2xl space-y-4 rounded-2xl border border-[#2b5e72] bg-[#071522] p-5 shadow-2xl">
            <div className="flex items-center justify-between gap-3">
              <h3 className="truncate text-sm font-semibold text-[#e6fcff]">{previewModal.name}</h3>
              <button
                type="button"
                onClick={closeModal}
                aria-label="Close media preview"
                className="grid h-10 w-10 place-items-center rounded-xl border border-[#244e5e] text-[#c7eef7] hover:bg-white/5"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="overflow-hidden rounded-xl bg-black/50">
              {previewModal.mimeType.startsWith('video/') ? (
                <video
                  src={previewModal.url}
                  controls
                  autoPlay
                  playsInline
                  className="max-h-[70vh] w-full object-contain"
                />
              ) : (
                <img
                  src={previewModal.url}
                  alt={previewModal.name}
                  className="max-h-[70vh] w-full object-contain"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
