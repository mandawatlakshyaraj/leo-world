import { useState, type FormEvent } from 'react';
import { ArrowUpRight, Send, Sparkles } from 'lucide-react';
import type { ConnectTabId, GlimpseTabId, LeoAiMessage, PrivateModuleId } from '../../types/leo';
import { askLeoAi } from '../../utils/apiClient';

interface LeoAiAssistantProps {
  userId: string;
  onNavigateModule: (module: PrivateModuleId, tab?: ConnectTabId | GlimpseTabId) => void;
}

const QUICK_PROMPTS = [
  'Give me a circle & vault briefing',
  'Check my feed & stories',
  'How does Eclipse Vault encryption work?',
];

export function LeoAiAssistant({ userId, onNavigateModule }: LeoAiAssistantProps) {
  const [messages, setMessages] = useState<LeoAiMessage[]>([
    {
      id: 'leo-welcome',
      role: 'assistant',
      text: `Good evening, ${userId}. All private social modules are live — ask for a circle summary or jump directly to Feed, Chats, Camera Studio, or Eclipse Vault.`,
      createdAt: Date.now(),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  async function submitPrompt(promptText: string) {
    const trimmed = promptText.trim();
    if (!trimmed || loading) return;

    const userMsg: LeoAiMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      text: trimmed,
      createdAt: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await askLeoAi(trimmed);
      const aiMsg: LeoAiMessage = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        text: res.reply,
        suggestedModule: res.suggestedModule,
        suggestedTab: res.suggestedTab,
        createdAt: Date.now(),
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'assistant',
          text: (err as Error).message || 'Unable to reach Leo AI right now.',
          createdAt: Date.now(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleFormSubmit(e: FormEvent) {
    e.preventDefault();
    submitPrompt(input);
  }

  function getButtonLabel(mod: PrivateModuleId, tab?: ConnectTabId | GlimpseTabId): string {
    if (mod === 'feed') return 'Open Feed & Stories';
    if (mod === 'connect') {
      if (tab === 'groups') return 'Open Group Channels';
      if (tab === 'circle') return 'Open Circle Directory';
      return 'Open Chats';
    }
    if (mod === 'glimpses') {
      if (tab === 'eclipse') return 'Open Eclipse Vault';
      if (tab === 'camera') return 'Open Camera Studio';
      return 'Open Glimpses Gallery';
    }
    return 'Open Profile';
  }

  return (
    <div className="rounded-2xl border border-[#1d5466] bg-[#05121d]/90 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#143c4a] pb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-[#42e8f5]" />
          <h2 className="text-base font-semibold text-[#e6fcff]">Leo AI Assistant</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          {QUICK_PROMPTS.map((q) => (
            <button
              key={q}
              type="button"
              disabled={loading}
              onClick={() => submitPrompt(q)}
              className="rounded-lg border border-[#22586b] bg-[#092130] px-3 py-1.5 text-xs text-[#a5e7f2] transition hover:border-[#42e8f5] hover:text-white disabled:opacity-50"
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 max-h-56 space-y-3 overflow-y-auto pr-1">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`rounded-xl border px-4 py-3 text-sm leading-relaxed ${
              msg.role === 'user'
                ? 'ml-auto max-w-[85%] border-[#2e6c82] bg-[#0a2c3d] text-[#e8fbff]'
                : 'mr-auto max-w-[92%] border-[#1a4859] bg-[#071926] text-[#c7eef7]'
            }`}
          >
            <p>{msg.text}</p>
            {msg.suggestedModule && msg.suggestedModule !== 'profile' && (
              <button
                type="button"
                onClick={() => onNavigateModule(msg.suggestedModule!, msg.suggestedTab)}
                className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-[#42e8f5]/50 bg-[#0b3545] px-3 py-1.5 text-xs font-medium text-[#b5f8ff] transition hover:bg-[#10475c]"
              >
                <span>{getButtonLabel(msg.suggestedModule, msg.suggestedTab)}</span>
                <ArrowUpRight className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        ))}
        {loading && (
          <p className="text-xs text-[#79d7e6]" aria-live="polite">
            Leo AI is thinking…
          </p>
        )}
      </div>

      <form onSubmit={handleFormSubmit} className="mt-4 flex gap-2">
        <label htmlFor="leo-ai-input" className="sr-only">
          Ask Leo AI
        </label>
        <input
          id="leo-ai-input"
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask Leo AI for a briefing or shortcut…"
          className="min-h-[44px] flex-1 rounded-xl border border-[#205163] bg-[#030b14] px-4 py-2.5 text-sm text-[#e8fbff] placeholder:text-[#4e7685] focus:border-[#42e8f5]"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          aria-label="Send message to Leo AI"
          className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-[#42e8f5] bg-[#0a3c4c] px-4 py-2.5 text-sm font-semibold text-[#e8fbff] transition hover:bg-[#0e4d61] disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
          <span className="hidden sm:inline">Send</span>
        </button>
      </form>
    </div>
  );
}
