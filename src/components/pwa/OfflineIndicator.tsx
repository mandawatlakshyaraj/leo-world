import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';

export function OfflineIndicator() {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-xl border border-amber-400/50 bg-[#1f1304]/95 px-3.5 py-2 text-xs font-medium text-amber-100 shadow-xl backdrop-blur-md"
    >
      <WifiOff className="h-3.5 w-3.5 text-amber-400" />
      <span>Offline Mode — Cached data is being used.</span>
    </div>
  );
}
