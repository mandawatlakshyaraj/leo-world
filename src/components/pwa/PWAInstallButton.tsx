import { useState } from 'react';
import { Download, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '../../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  variant?: 'public' | 'private';
}

export function PWAInstallButton({ variant = 'public' }: PWAInstallButtonProps) {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  const buttonClasses =
    variant === 'private'
      ? 'inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-[#2b6679] bg-[#072131] px-3 py-2 text-xs font-semibold whitespace-nowrap text-[#9ef2ff] transition hover:border-[#42e8f5] hover:text-white'
      : 'inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-[#d7b76c]/50 bg-[#241140]/90 px-3 py-1.5 text-xs font-semibold whitespace-nowrap text-[#f4d27a] transition hover:border-[#f4d27a] hover:bg-[#311857]';

  async function handleClick() {
    if (isInstallable) {
      await install();
      return;
    }
    setShowGuide(true);
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        aria-label={isIOS ? 'Install Leo World on iOS' : 'Install Leo World App'}
        className={buttonClasses}
      >
        {isIOS ? <Smartphone className="h-3.5 w-3.5" /> : <Download className="h-3.5 w-3.5" />}
        <span>{isIOS ? 'Install on iOS' : 'Install App'}</span>
      </button>

      {showGuide && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Install Leo World on any device"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
        >
          <div className="w-full max-w-md rounded-2xl border border-[#27586b] bg-[#071522] p-6 text-left shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-[#e8fbff]">
                  {isIOS ? 'Install on iPhone / iPad' : 'Install Leo World App'}
                </h3>
                <p className="mt-1 text-xs text-[#8db9c7]">
                  Sign in with your Unique ID &amp; password on any phone or browser — your E2EE
                  keys sync end-to-end encrypted.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                aria-label="Close install guide"
                className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-[#1d4b5d] text-[#95c3d1] hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {isIOS ? (
              <ol className="mt-4 space-y-2 rounded-xl border border-[#194254] bg-[#040d17] p-4 text-sm text-[#d4f4fc]">
                <li>
                  1. Open this link in <strong>Safari</strong> and tap the{' '}
                  <strong>Share</strong> button.
                </li>
                <li>
                  2. Scroll down and tap <strong>Add to Home Screen</strong>.
                </li>
                <li>3. Launch Leo World like a native app and sign in with your ID &amp; password.</li>
              </ol>
            ) : (
              <ol className="mt-4 space-y-2 rounded-xl border border-[#194254] bg-[#040d17] p-4 text-sm text-[#d4f4fc]">
                <li>
                  1. Open your browser menu (<strong>⋮</strong> on Android Chrome or the install icon
                  in desktop address bar).
                </li>
                <li>
                  2. Choose <strong>Install app</strong> or <strong>Add to Home screen</strong>.
                </li>
                <li>
                  3. Open the installed app and enter your Unique ID &amp; password to unlock your
                  E2EE chats.
                </li>
              </ol>
            )}

            <button
              type="button"
              onClick={() => setShowGuide(false)}
              className="mt-4 w-full rounded-xl border border-[#42e8f5]/60 bg-[#0a3c4c] py-2.5 text-sm font-semibold text-[#e8fbff] transition hover:bg-[#0e4d61]"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
}
