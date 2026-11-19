import { useState } from 'react';
import {
  ArrowLeft,
  Compass,
  FlaskConical,
  GitBranch,
  KeyRound,
  ScrollText,
  Sparkles,
  Star,
  Swords,
  Trophy,
  Wand2,
} from 'lucide-react';
import type { PublicGameId } from '../../types/leo';
import { countTotalStars, loadAllGameProgress } from '../../utils/gameProgress';
import {
  countTotalBestScore,
  getBestScoresByGame,
  loadLeaderboard,
  type LeaderboardEntry,
} from '../../utils/leaderboard';
import { PWAInstallButton } from '../pwa/PWAInstallButton';
import { ArcaneConduitsGame } from './ArcaneConduitsGame';
import { BirthdayChallengeGame } from './BirthdayChallengeGame';
import { EnchantedMazeGame } from './EnchantedMazeGame';
import { LeaderboardPanel } from './LeaderboardPanel';
import { MagicMatchGame } from './MagicMatchGame';
import { PotionPuzzleGame } from './PotionPuzzleGame';
import { RuneCipherGame } from './RuneCipherGame';
import { SpellChallengeGame } from './SpellChallengeGame';
import { WandDuelGame } from './WandDuelGame';

interface PublicWorldProps {
  activeGame: PublicGameId | null;
  onSelectGame: (game: PublicGameId | null) => void;
  onSecretCodeEntered: () => void;
}

const GAMES: {
  id: PublicGameId;
  title: string;
  subtitle: string;
  levelsLabel: string;
  maxStars: number;
  description: string;
  icon: typeof Wand2;
}[] = [
  {
    id: 'match',
    title: 'Magic Match',
    subtitle: 'Memory Pairs',
    levelsLabel: '5 Levels',
    maxStars: 15,
    description: 'Uncover matching wizarding crests from 6-pair vaults up to timed 12-pair decks.',
    icon: Wand2,
  },
  {
    id: 'birthday',
    title: 'Character Birthday Challenge',
    subtitle: 'Wizarding Archives',
    levelsLabel: '2 Chapters',
    maxStars: 6,
    description: 'Name the birthdays of ten iconic Hogwarts heroes, rivals, and professors.',
    icon: ScrollText,
  },
  {
    id: 'spell',
    title: 'Spell Challenge',
    subtitle: 'Arcane Lore',
    levelsLabel: '3 Tiers',
    maxStars: 9,
    description: 'Advance from First-Year Charms through O.W.L. and N.E.W.T. wizarding trials.',
    icon: Sparkles,
  },
  {
    id: 'maze',
    title: 'Enchanted Maze',
    subtitle: 'Labyrinth',
    levelsLabel: '6 Levels',
    maxStars: 18,
    description: 'Navigate shifting corridors, collect brass keys, and brave torchlight catacombs.',
    icon: Compass,
  },
  {
    id: 'potion',
    title: 'Potion Puzzle',
    subtitle: 'Alchemy',
    levelsLabel: '6 Levels',
    maxStars: 18,
    description: 'Memorize glowing cauldron sequences scaling up to 6 vials and 8-step brews.',
    icon: FlaskConical,
  },
  {
    id: 'rune',
    title: 'Rune Cipher',
    subtitle: 'Word Decoder',
    levelsLabel: '6 Levels',
    maxStars: 18,
    description: 'Unscramble ancient incantations and artifacts rune by rune.',
    icon: KeyRound,
  },
  {
    id: 'duel',
    title: 'Wand Duel',
    subtitle: 'Tactical Combat',
    levelsLabel: '5 Duelists',
    maxStars: 15,
    description: 'Outsmart five escalating sorcerers using Stupefy, Protego shields, and Focus.',
    icon: Swords,
  },
  {
    id: 'conduits',
    title: 'Arcane Conduits',
    subtitle: 'Energy Grid',
    levelsLabel: '5 Levels',
    maxStars: 15,
    description: 'Rotate crystal pipes to channel golden starlight from source to pedestal.',
    icon: GitBranch,
  },
];

export function PublicWorld({
  activeGame,
  onSelectGame,
  onSecretCodeEntered,
}: PublicWorldProps) {
  const [hubTab, setHubTab] = useState<'challenges' | 'leaderboard'>('challenges');
  const [progressMap, setProgressMap] = useState(() => loadAllGameProgress());
  const [leaderboardEntries, setLeaderboardEntries] = useState<LeaderboardEntry[]>(() =>
    loadLeaderboard()
  );

  const totalStars = countTotalStars(progressMap);
  const maxTotalStars = GAMES.reduce((sum, g) => sum + g.maxStars, 0);
  const bestByGame = getBestScoresByGame(leaderboardEntries);
  const totalBestScore = countTotalBestScore(leaderboardEntries);

  function refreshProgress() {
    setProgressMap(loadAllGameProgress());
    setLeaderboardEntries(loadLeaderboard());
  }

  const activeMeta = GAMES.find((g) => g.id === activeGame) || null;

  return (
    <div className="public-world-bg font-magic-body flex min-h-screen flex-col text-[#fff4d7]">
      <header className="relative border-b border-purple-300/25 bg-[#12081f]/80 px-6 py-7 text-center backdrop-blur-sm">
        <div className="mx-auto mb-3 flex max-w-6xl items-center justify-end sm:mb-0 sm:justify-end">
          <PWAInstallButton variant="public" />
        </div>
        <p className="text-xs tracking-[0.22em] uppercase text-purple-200/80">
          A magical world of puzzles and mystery
        </p>
        <h1 className="font-magic-display mt-2.5 text-4xl font-bold tracking-wide text-[#f4d27a] drop-shadow-[0_0_24px_rgba(163,111,229,0.45)] sm:text-5xl">
          Leo World
        </h1>
        <p className="mx-auto mt-2 max-w-xl text-sm text-purple-100/80 sm:text-base">
          Eight multi-level wizarding trials, arcane duels, and hidden secrets.
        </p>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
        {!activeGame ? (
          <section className="rounded-3xl border border-purple-300/30 bg-[#170c2b]/80 p-6 shadow-2xl sm:p-9">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-purple-300/15 pb-4">
              <div
                className="inline-flex rounded-xl border border-purple-300/25 bg-[#120820] p-1"
                role="tablist"
                aria-label="Public World views"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={hubTab === 'challenges'}
                  onClick={() => setHubTab('challenges')}
                  className={`min-h-[38px] rounded-lg px-4 py-1.5 text-xs font-semibold tracking-wide transition sm:text-sm ${
                    hubTab === 'challenges'
                      ? 'bg-[#45236f] text-[#f4d27a]'
                      : 'text-purple-100/75 hover:text-white'
                  }`}
                >
                  Challenges
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={hubTab === 'leaderboard'}
                  onClick={() => {
                    refreshProgress();
                    setHubTab('leaderboard');
                  }}
                  className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-lg px-4 py-1.5 text-xs font-semibold tracking-wide transition sm:text-sm ${
                    hubTab === 'leaderboard'
                      ? 'bg-[#45236f] text-[#f4d27a]'
                      : 'text-purple-100/75 hover:text-white'
                  }`}
                >
                  <Trophy className="h-3.5 w-3.5" />
                  <span>Leaderboard</span>
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-4 text-sm text-[#f4d27a]">
                <div className="inline-flex items-center gap-1.5">
                  <Star className="h-4 w-4 fill-[#f4d27a]" />
                  <span className="font-tech-mono font-semibold">
                    {totalStars} / {maxTotalStars} Stars
                  </span>
                </div>
                <span aria-hidden="true" className="text-purple-300/35">
                  ·
                </span>
                <div className="inline-flex items-center gap-1.5">
                  <Trophy className="h-4 w-4" />
                  <span className="font-tech-mono font-semibold">
                    {totalBestScore.toLocaleString()} pts
                  </span>
                </div>
              </div>
            </div>

            {hubTab === 'leaderboard' ? (
              <LeaderboardPanel
                games={GAMES.map((g) => ({ id: g.id, title: g.title }))}
                entries={leaderboardEntries}
                totalStars={totalStars}
                maxTotalStars={maxTotalStars}
                onLeaderboardCleared={(next) => setLeaderboardEntries(next)}
              />
            ) : (
              <>
                <div className="mb-6">
                  <h2 className="font-magic-display text-2xl font-bold text-[#f4d27a] sm:text-3xl">
                    Choose Your Magical Challenge
                  </h2>
                  <p className="mt-1.5 text-sm text-purple-100/80 sm:text-base">
                    Clear levels to unlock deeper chambers, earn up to three stars per stage, and
                    set local high scores.
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {GAMES.map((game) => {
                    const Icon = game.icon;
                    const prog = progressMap[game.id];
                    const earnedStars = prog
                      ? Object.values(prog.starsByLevel).reduce((a, b) => a + b, 0)
                      : 0;
                    const best = bestByGame[game.id];
                    return (
                      <button
                        key={game.id}
                        type="button"
                        onClick={() => onSelectGame(game.id)}
                        className="group flex min-h-[196px] flex-col items-start justify-between rounded-2xl border border-[#d7b76c]/55 bg-gradient-to-br from-[#3d2160]/95 to-[#1b0e31]/95 p-5 text-left transition duration-200 hover:-translate-y-1 hover:border-[#f4d27a] hover:shadow-[0_14px_30px_rgba(88,28,135,0.45)]"
                      >
                        <div className="flex w-full items-center justify-between gap-2">
                          <Icon className="h-6 w-6 shrink-0 text-[#f4d27a]" />
                          <span className="font-tech-mono text-[11px] tracking-wider uppercase text-purple-200/75">
                            {game.levelsLabel} · {earnedStars}/{game.maxStars}★
                          </span>
                        </div>
                        <div className="mt-4 w-full">
                          <span className="block text-[11px] tracking-[0.14em] uppercase text-purple-200/70">
                            {game.subtitle}
                          </span>
                          <strong className="font-magic-display mt-0.5 block text-lg leading-snug text-[#fff4d7] group-hover:text-[#f4d27a]">
                            {game.title}
                          </strong>
                          <span className="mt-1.5 block text-xs leading-relaxed text-purple-100/80 sm:text-sm">
                            {game.description}
                          </span>
                          {best && (
                            <span className="font-tech-mono mt-2.5 block border-t border-purple-300/20 pt-2 text-[11px] text-[#f4d27a]">
                              Best: {best.score.toLocaleString()} pts ({best.playerName})
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </section>
        ) : (
          <section className="rounded-3xl border border-purple-300/30 bg-[#170c2b]/85 p-6 shadow-2xl sm:p-9">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-purple-300/20 pb-4">
              <div>
                <div className="text-xs tracking-[0.18em] uppercase text-purple-200/75">
                  {activeMeta?.subtitle} · {activeMeta?.levelsLabel}
                </div>
                <h2 className="font-magic-display mt-1 text-2xl font-bold text-[#f4d27a] sm:text-3xl">
                  {activeMeta?.title}
                </h2>
              </div>

              <button
                type="button"
                onClick={() => {
                  refreshProgress();
                  onSelectGame(null);
                }}
                className="inline-flex min-h-[42px] items-center gap-2 rounded-xl border border-purple-300/35 bg-white/5 px-4 py-2 text-sm text-[#fff4d7] transition hover:bg-white/10"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>All Games</span>
              </button>
            </div>

            {activeGame === 'match' && <MagicMatchGame onProgressUpdated={refreshProgress} />}
            {activeGame === 'spell' && <SpellChallengeGame onProgressUpdated={refreshProgress} />}
            {activeGame === 'maze' && <EnchantedMazeGame onProgressUpdated={refreshProgress} />}
            {activeGame === 'potion' && <PotionPuzzleGame onProgressUpdated={refreshProgress} />}
            {activeGame === 'rune' && <RuneCipherGame onProgressUpdated={refreshProgress} />}
            {activeGame === 'duel' && <WandDuelGame onProgressUpdated={refreshProgress} />}
            {activeGame === 'conduits' && (
              <ArcaneConduitsGame onProgressUpdated={refreshProgress} />
            )}
            {activeGame === 'birthday' && (
              <BirthdayChallengeGame
                onSecretCodeEntered={onSecretCodeEntered}
                onProgressUpdated={refreshProgress}
              />
            )}
          </section>
        )}
      </main>

      <footer className="px-6 py-6 text-center text-xs text-purple-200/55">
        Leo World · Magical puzzles and wizarding mystery
      </footer>
    </div>
  );
}
