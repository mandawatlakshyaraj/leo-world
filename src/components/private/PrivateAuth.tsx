import { useState, type FormEvent } from 'react';
import { ArrowLeft, ArrowRight, KeyRound, ShieldCheck, UserPlus } from 'lucide-react';
import type { LeoUser } from '../../types/leo';
import { loginAccount, registerAccount } from '../../utils/apiClient';
import { syncE2eeOnPasswordAuth } from '../../utils/e2eeSessionSync';

interface PrivateAuthProps {
  onAuthenticated: (user: LeoUser) => void;
  onReturnPublic: () => void;
}

export function PrivateAuth({ onAuthenticated, onReturnPublic }: PrivateAuthProps) {
  const [step, setStep] = useState<'welcome' | 'auth'>('welcome');
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [uniqueId, setUniqueId] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const id = uniqueId.trim();
    if (!id || !password) {
      setMessage('Enter both your Unique ID and password.');
      return;
    }
    setSubmitting(true);
    setMessage('');
    try {
      const res =
        mode === 'login'
          ? await loginAccount(id, password)
          : await registerAccount(id, password);
      const syncedUser = await syncE2eeOnPasswordAuth(res.user, password);
      onAuthenticated(syncedUser);
    } catch (err) {
      setMessage((err as Error).message || 'Authentication failed.');
    } finally {
      setSubmitting(false);
    }
  }

  function fillDemoCredentials() {
    setMode('login');
    setUniqueId('commander');
    setPassword('leoworld123');
    setMessage('Demo Commander credentials filled — click Sign In to continue.');
  }

  return (
    <div className="mx-auto flex min-h-[calc(100vh-140px)] max-w-2xl items-center justify-center px-4 py-10">
      {step === 'welcome' ? (
        <section className="w-full rounded-3xl border border-[#24485e] bg-[#081523]/95 p-8 shadow-2xl sm:p-10">
          <div className="text-xs font-medium tracking-[0.16em] uppercase text-[#65eaff]">
            Access Granted · Private Environment
          </div>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-[#e8fbff] sm:text-4xl">
            Welcome to Leo World
          </h1>
          <p className="mt-3 max-w-lg text-base leading-relaxed text-[#9ac6d4]">
            Your private command center, circle feed, messaging, and encrypted Eclipse vault are
            ready. Sign in with your Unique ID to continue.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setStep('auth')}
              className="inline-flex min-h-[46px] items-center gap-2 rounded-xl border border-[#42e8f5] bg-[#0a3c4c] px-6 py-3 text-sm font-semibold text-[#e6fcff] transition hover:bg-[#0e4d61]"
            >
              <span>Continue to Login</span>
              <ArrowRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onReturnPublic}
              className="inline-flex min-h-[46px] items-center gap-2 rounded-xl border border-[#24485e] bg-transparent px-5 py-3 text-sm font-medium text-[#9ac6d4] transition hover:border-[#42e8f5]/50 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Return to Games</span>
            </button>
          </div>
        </section>
      ) : (
        <section className="w-full rounded-3xl border border-[#24485e] bg-[#081523]/95 p-8 shadow-2xl sm:p-10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs font-medium tracking-[0.16em] uppercase text-[#65eaff]">
                Identity Verification
              </div>
              <h1 className="mt-1.5 text-2xl font-bold text-[#e8fbff] sm:text-3xl">
                {mode === 'login' ? 'Account Sign In' : 'Create Private Account'}
              </h1>
            </div>

            <div className="flex rounded-xl border border-[#1d3e52] bg-[#050d17] p-1">
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setMessage('');
                }}
                className={`rounded-lg px-3.5 py-2 text-xs font-semibold transition ${
                  mode === 'login'
                    ? 'bg-[#0e4355] text-white'
                    : 'text-[#8db9c7] hover:text-white'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('register');
                  setMessage('');
                }}
                className={`rounded-lg px-3.5 py-2 text-xs font-semibold transition ${
                  mode === 'register'
                    ? 'bg-[#0e4355] text-white'
                    : 'text-[#8db9c7] hover:text-white'
                }`}
              >
                Create Account
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label
                htmlFor="leo-unique-id"
                className="mb-1.5 block text-xs font-medium tracking-wider uppercase text-[#8db9c7]"
              >
                Unique ID
              </label>
              <input
                id="leo-unique-id"
                type="text"
                value={uniqueId}
                onChange={(e) => setUniqueId(e.target.value)}
                placeholder="e.g. commander or nova_01"
                autoComplete="username"
                className="min-h-[46px] w-full rounded-xl border border-[#215266] bg-[#040a12] px-4 py-3 text-sm text-[#e8fbff] placeholder:text-[#4e7685] focus:border-[#42e8f5]"
              />
            </div>

            <div>
              <label
                htmlFor="leo-password"
                className="mb-1.5 block text-xs font-medium tracking-wider uppercase text-[#8db9c7]"
              >
                Password
              </label>
              <input
                id="leo-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === 'register' ? 'Minimum 8 characters' : 'Enter password'}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                className="min-h-[46px] w-full rounded-xl border border-[#215266] bg-[#040a12] px-4 py-3 text-sm text-[#e8fbff] placeholder:text-[#4e7685] focus:border-[#42e8f5]"
              />
              <p className="mt-1.5 text-xs text-[#7fb2c2]">
                Log in from any phone or browser with your Unique ID &amp; password — your E2EE chat
                key stays encrypted client-side and syncs automatically.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex min-h-[46px] items-center gap-2 rounded-xl border border-[#42e8f5] bg-[#0a3c4c] px-6 py-3 text-sm font-semibold text-[#e6fcff] transition hover:bg-[#0e4d61] disabled:opacity-60"
              >
                {mode === 'login' ? (
                  <>
                    <ShieldCheck className="h-4 w-4" />
                    <span>{submitting ? 'Signing in…' : 'Sign In'}</span>
                  </>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4" />
                    <span>{submitting ? 'Creating…' : 'Create Account'}</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={fillDemoCredentials}
                className="inline-flex min-h-[46px] items-center gap-2 rounded-xl border border-[#254b61] bg-[#0b1b2b] px-4 py-3 text-xs font-medium text-[#9ce5f2] transition hover:border-[#42e8f5]/60 hover:text-white"
              >
                <KeyRound className="h-4 w-4" />
                <span>Use Demo Commander</span>
              </button>

              <button
                type="button"
                onClick={() => setStep('welcome')}
                className="min-h-[46px] rounded-xl border border-[#1d3e52] px-4 py-3 text-sm text-[#8db9c7] transition hover:text-white"
              >
                Back
              </button>
            </div>

            <p className="min-h-[22px] text-sm text-[#72f7c8]" aria-live="polite">
              {message}
            </p>
          </form>
        </section>
      )}
    </div>
  );
}
