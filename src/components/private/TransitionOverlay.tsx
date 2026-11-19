import { useEffect } from 'react';

interface TransitionOverlayProps {
  onComplete: () => void;
}

export function TransitionOverlay({ onComplete }: TransitionOverlayProps) {
  useEffect(() => {
    const timer = window.setTimeout(onComplete, 2200);
    return () => window.clearTimeout(timer);
  }, [onComplete]);

  return (
    <div
      className="private-world-bg font-private-ui fixed inset-0 z-50 grid place-items-center p-6 text-center text-[#d8fbff]"
      role="status"
      aria-live="polite"
    >
      <div className="w-full max-w-md space-y-6">
        <div className="text-3xl font-bold tracking-[0.18em] text-[#e5fbff] sm:text-4xl">
          LEO WORLD <span className="text-[#42e8f5]">PRIVATE</span>
        </div>
        <p className="text-xs tracking-[0.2em] uppercase text-[#7fe6f2]">
          Verifying access · Initializing interface
        </p>
        <div className="mx-auto h-1 w-full max-w-xs overflow-hidden rounded-full bg-[#13333d]">
          <div className="boot-bar-fill h-full w-full bg-[#42e8f5]" />
        </div>
        <button
          type="button"
          onClick={onComplete}
          className="text-xs tracking-[0.14em] uppercase text-[#7ad9e6] underline-offset-4 hover:text-white hover:underline"
        >
          Enter immediately
        </button>
      </div>
    </div>
  );
}
