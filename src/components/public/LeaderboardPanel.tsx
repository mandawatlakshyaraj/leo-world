import { useState, type FormEvent } from 'react';
import { Award, Check, Star, Trash2, Trophy, User } from 'lucide-react';
import type { PublicGameId } from '../../types/leo';
import {
  clearLeaderboard,
  countTotalBestScore,
  getBestScoresByGame,
  loadChallengerName,
  saveChallengerName,
  type LeaderboardEntry,
} from '../../utils/leaderboard';

export interface LeaderboardGameMeta {
  id: PublicGameId;
  title: string;
}

interface LeaderboardPanelProps {
  games: LeaderboardGameMeta[];
  entries: LeaderboardEntry[];
  totalStars: number;
  maxTotalStars: number;
  onLeaderboardCleared: (next: LeaderboardEntry[]) => void;
}

export function LeaderboardPanel({
  games,
  entries,
  totalStars,
  maxTotalStars,
  onLeaderboardCleared,
}: LeaderboardPanelProps) {
  const [filterGame, setFilterGame] = useState<PublicGameId | 'all'>('all');
  const [challengerInput, setChallengerInput] = useState(() => loadChallengerName());
  const [savedNotice, setSavedNotice] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  const bestByGame = getBestScoresByGame(entries);
  const totalBestScore = countTotalBestScore(entries);
  const visibleEntries =
    filterGame === 'all' ? entries : entries.filter((item) => item.gameId === filterGame);

  const gameTitleMap = new Map(games.map((g) => [g.id, g.title]));

  function handleSaveName(e: FormEvent) {
    e.preventDefault();
    const saved = saveChallengerName(challengerInput);
    setChallengerInput(saved);
    setSavedNotice(true);
    window.setTimeout(() => setSavedNotice(false), 1800);
  }

  function handleClear() {
    const next = clearLeaderboard();
    onLeaderboardCleared(next);
    setConfirmClear(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-purple-300/20 pb-5">
        <div>
          <h2 className="font-magic-display text-2xl font-bold text-[#f4d27a] sm:text-3xl">
            Wizarding Hall of Records
          </h2>
          <p className="mt-1.5 text-sm text-purple-100/80 sm:text-base">
            Local high scores saved in your browser across all eight challenges.
          </p>
        </div>

        <form onSubmit={handleSaveName} className="flex flex-wrap items-end gap-2">
          <div>
            <label
              htmlFor="challenger-name-input"
              className="mb-1 block text-[11px] tracking-[0.14em] uppercase text-purple-200/75"
            >
              Active Challenger
            </label>
            <div className="relative">
              <User className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[#f4d27a]/75" />
              <input
                id="challenger-name-input"
                type="text"
                maxLength={24}
                value={challengerInput}
                onChange={(e) => setChallengerInput(e.target.value)}
                placeholder="Wizard name"
                className="min-h-[40px] w-44 rounded-lg border border-purple-300/35 bg-[#120820] py-2 pr-3 pl-9 text-sm text-[#fff4d7] placeholder:text-purple-300/40 focus:border-[#f4d27a]"
              />
            </div>
          </div>
          <button
            type="submit"
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-[#f4d27a]/70 bg-[#2d1649] px-3.5 py-2 text-xs font-semibold text-[#f4d27a] transition hover:bg-[#3c1e60]"
          >
            {savedNotice ? <Check className="h-3.5 w-3.5" /> : null}
            <span>{savedNotice ? 'Saved' : 'Save Name'}</span>
          </button>
        </form>
      </div>

      {/* Summary metrics */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-[#d7b76c]/40 bg-[#24123d]/80 p-4">
          <div className="flex items-center gap-2 text-xs tracking-wider uppercase text-purple-200/75">
            <Trophy className="h-4 w-4 text-[#f4d27a]" />
            <span>Combined Best Score</span>
          </div>
          <div className="font-tech-mono mt-1.5 text-2xl font-bold text-[#f4d27a]">
            {totalBestScore.toLocaleString()}
          </div>
        </div>

        <div className="rounded-2xl border border-purple-300/25 bg-[#24123d]/80 p-4">
          <div className="flex items-center gap-2 text-xs tracking-wider uppercase text-purple-200/75">
            <Star className="h-4 w-4 text-[#f4d27a]" />
            <span>Total Stars Earned</span>
          </div>
          <div className="font-tech-mono mt-1.5 text-2xl font-bold text-[#fff4d7]">
            {totalStars} / {maxTotalStars}
          </div>
        </div>

        <div className="rounded-2xl border border-purple-300/25 bg-[#24123d]/80 p-4">
          <div className="flex items-center gap-2 text-xs tracking-wider uppercase text-purple-200/75">
            <Award className="h-4 w-4 text-[#f4d27a]" />
            <span>Challenges Ranked</span>
          </div>
          <div className="font-tech-mono mt-1.5 text-2xl font-bold text-[#fff4d7]">
            {Object.keys(bestByGame).length} / {games.length}
          </div>
        </div>
      </div>

      {/* Filter tabs + Clear button */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter scores by game">
          <button
            type="button"
            onClick={() => setFilterGame('all')}
            aria-pressed={filterGame === 'all'}
            className={`min-h-[36px] rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
              filterGame === 'all'
                ? 'border-[#f4d27a] bg-[#3f2066] text-[#f4d27a]'
                : 'border-purple-300/25 bg-white/5 text-purple-100/80 hover:bg-white/10'
            }`}
          >
            All Challenges
          </button>
          {games.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => setFilterGame(g.id)}
              aria-pressed={filterGame === g.id}
              className={`min-h-[36px] rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                filterGame === g.id
                  ? 'border-[#f4d27a] bg-[#3f2066] text-[#f4d27a]'
                  : 'border-purple-300/25 bg-white/5 text-purple-100/80 hover:bg-white/10'
              }`}
            >
              {g.title}
            </button>
          ))}
        </div>

        {entries.length > 0 && (
          <div className="flex items-center gap-2">
            {!confirmClear ? (
              <button
                type="button"
                onClick={() => setConfirmClear(true)}
                className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-rose-400/35 bg-rose-950/30 px-3 py-1.5 text-xs font-medium text-rose-200 transition hover:bg-rose-950/60"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Clear Scores</span>
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleClear}
                  className="min-h-[36px] rounded-lg border border-rose-400 bg-rose-900/70 px-3 py-1.5 text-xs font-semibold text-white"
                >
                  Confirm Reset
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmClear(false)}
                  className="min-h-[36px] rounded-lg border border-purple-300/30 bg-white/5 px-3 py-1.5 text-xs text-purple-100"
                >
                  Cancel
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* High scores list */}
      {visibleEntries.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-purple-300/30 bg-[#130924]/70 p-8 text-center">
          <Trophy className="mx-auto h-8 w-8 text-[#f4d27a]/70" />
          <h3 className="font-magic-display mt-3 text-lg text-[#f4d27a]">
            No High Scores Recorded Yet
          </h3>
          <p className="mx-auto mt-1.5 max-w-md text-sm text-purple-100/75">
            {filterGame === 'all'
              ? 'Complete any level, duel, or chapter to post your score on the local leaderboard.'
              : `Clear a stage in ${gameTitleMap.get(filterGame) ?? 'this challenge'} to set the #1 local record.`}
          </p>
        </div>
      ) : (
        <div className="space-y-2" data-testid="leaderboard-rows">
          {visibleEntries.map((entry, idx) => {
            const rank = idx + 1;
            const rankTone =
              rank === 1
                ? 'border-[#f4d27a] bg-[#4a2875]/75 text-[#f4d27a]'
                : rank === 2
                  ? 'border-slate-300/60 bg-slate-800/40 text-slate-200'
                  : rank === 3
                    ? 'border-amber-600/60 bg-amber-950/35 text-amber-300'
                    : 'border-purple-300/20 bg-white/5 text-purple-200/80';

            return (
              <div
                key={entry.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-purple-300/20 bg-[#1e0f36]/90 px-4 py-3"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className={`font-tech-mono grid h-8 w-8 shrink-0 place-items-center rounded-lg border text-xs font-bold ${rankTone}`}
                  >
                    #{rank}
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <strong className="truncate text-sm text-[#fff4d7]">
                        {entry.playerName}
                      </strong>
                      <span className="text-xs text-[#f4d27a]/90">
                        {gameTitleMap.get(entry.gameId) ?? entry.gameId} · L{entry.level}
                      </span>
                    </div>
                    <div className="text-xs text-purple-200/70">{entry.detail}</div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <span
                    className="font-tech-mono text-xs text-[#f4d27a]"
                    aria-label={`${entry.stars} stars`}
                  >
                    {'★'.repeat(entry.stars)}
                    {'☆'.repeat(3 - entry.stars)}
                  </span>
                  <span className="font-tech-mono min-w-[74px] text-right text-base font-bold text-[#f4d27a]">
                    {entry.score.toLocaleString()}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
