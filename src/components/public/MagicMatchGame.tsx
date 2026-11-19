import { useEffect, useRef, useState } from 'react';
import { ArrowRight, RotateCcw, Sparkles } from 'lucide-react';
import {
  calculateMatchStars,
  createMatchDeck,
  MATCH_LEVELS,
  type MatchCard,
} from '../../utils/games';
import {
  getGameProgress,
  recordLevelCompletion,
  type GameProgressEntry,
} from '../../utils/gameProgress';
import { calculateChallengeScore, recordLeaderboardScore } from '../../utils/leaderboard';
import { playErrorTone, playTone, playVictoryChime } from '../../utils/sound';
import { LevelBar } from './LevelBar';

interface MagicMatchGameProps {
  onProgressUpdated?: () => void;
}

export function MagicMatchGame({ onProgressUpdated }: MagicMatchGameProps) {
  const [progress, setProgress] = useState<GameProgressEntry>(() => getGameProgress('match'));
  const [levelNum, setLevelNum] = useState(1);
  const config = MATCH_LEVELS[levelNum - 1];

  const [cards, setCards] = useState<MatchCard[]>(() => createMatchDeck(config.pairs));
  const [firstIndex, setFirstIndex] = useState<number | null>(null);
  const [locked, setLocked] = useState(false);
  const [moves, setMoves] = useState(0);
  const [statusMessage, setStatusMessage] = useState(
    `Level 1 (${config.name}): match all ${config.pairs} pairs.`
  );
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    };
  }, []);

  const matchedPairs = cards.filter((c) => c.matched).length / 2;
  const won = matchedPairs === config.pairs;
  const outOfMoves = !won && config.maxMoves !== null && moves >= config.maxMoves;

  function startLevel(targetLevel: number) {
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    const nextCfg = MATCH_LEVELS[targetLevel - 1];
    setLevelNum(targetLevel);
    setCards(createMatchDeck(nextCfg.pairs));
    setFirstIndex(null);
    setLocked(false);
    setMoves(0);
    setStatusMessage(
      `Level ${targetLevel} (${nextCfg.name}): match ${nextCfg.pairs} pairs${
        nextCfg.maxMoves ? ` within ${nextCfg.maxMoves} moves` : ''
      }.`
    );
  }

  function handleFlip(index: number) {
    if (locked || won || outOfMoves) return;
    const target = cards[index];
    if (target.flipped || target.matched) return;

    playTone(460 + index * 12, 85, 'sine', 0.04);
    const updated = cards.map((c, idx) => (idx === index ? { ...c, flipped: true } : c));
    setCards(updated);

    if (firstIndex === null) {
      setFirstIndex(index);
      return;
    }

    const nextMoves = moves + 1;
    setMoves(nextMoves);
    const firstCard = updated[firstIndex];

    if (firstCard.key === target.key) {
      const withMatch = updated.map((c, idx) =>
        idx === firstIndex || idx === index ? { ...c, matched: true } : c
      );
      setCards(withMatch);
      setFirstIndex(null);
      const newPairs = withMatch.filter((c) => c.matched).length / 2;

      if (newPairs === config.pairs) {
        playVictoryChime();
        const stars = calculateMatchStars(nextMoves, config.parMoves);
        const nextProg = recordLevelCompletion('match', levelNum, stars, MATCH_LEVELS.length);
        const points = calculateChallengeScore({
          gameId: 'match',
          level: levelNum,
          stars,
          movesOrSteps: nextMoves,
          parValue: config.parMoves,
        });
        recordLeaderboardScore({
          gameId: 'match',
          level: levelNum,
          score: points,
          stars,
          detail: `${nextMoves} moves`,
        });
        setProgress(nextProg);
        onProgressUpdated?.();
        setStatusMessage(
          `Level ${levelNum} cleared in ${nextMoves} moves — ${stars} star${stars > 1 ? 's' : ''} · ${points} pts!`
        );
      } else {
        playTone(660, 140, 'triangle', 0.05);
        setStatusMessage(`Matched ${firstCard.label}! ${config.pairs - newPairs} pairs left.`);
      }
      return;
    }

    setLocked(true);
    const prevIdx = firstIndex;
    if (config.maxMoves !== null && nextMoves >= config.maxMoves) {
      setStatusMessage(`Out of moves (${nextMoves}/${config.maxMoves}). Try this level again!`);
    } else {
      setStatusMessage('Not a match — remember their positions.');
    }

    timeoutRef.current = window.setTimeout(() => {
      playErrorTone();
      setCards((curr) =>
        curr.map((c, idx) => (idx === prevIdx || idx === index ? { ...c, flipped: false } : c))
      );
      setFirstIndex(null);
      setLocked(false);
    }, 580);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-purple-300/20 pb-4">
        <LevelBar
          totalLevels={MATCH_LEVELS.length}
          currentLevel={levelNum}
          progress={progress}
          onSelectLevel={startLevel}
        />
        <button
          type="button"
          onClick={() => startLevel(levelNum)}
          className="inline-flex min-h-[38px] items-center gap-2 rounded-lg border border-purple-300/30 bg-white/5 px-3.5 py-1.5 text-xs font-medium text-[#fff4d7] transition hover:bg-white/10"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          <span>Restart</span>
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-purple-100/90">
        <div>
          <strong className="font-magic-display text-[#f4d27a]">{config.name}</strong>
          <span className="ml-2 text-xs text-purple-200/75">Par {config.parMoves} moves</span>
        </div>
        <div className="flex items-center gap-3">
          <span>
            Moves:{' '}
            <strong className="font-tech-mono text-[#f4d27a]">
              {moves}
              {config.maxMoves ? `/${config.maxMoves}` : ''}
            </strong>
          </span>
          <span aria-hidden="true" className="text-purple-300/40">
            ·
          </span>
          <span>
            Pairs:{' '}
            <strong className="font-tech-mono text-[#f4d27a]">
              {matchedPairs}/{config.pairs}
            </strong>
          </span>
        </div>
      </div>

      <div
        className={`grid grid-cols-3 gap-2.5 sm:gap-3 ${
          config.columns === 4
            ? 'sm:grid-cols-4'
            : config.columns === 5
              ? 'sm:grid-cols-5'
              : 'sm:grid-cols-6'
        }`}
        data-testid="match-grid"
      >
        {cards.map((card) => {
          const revealed = card.flipped || card.matched;
          return (
            <button
              key={card.index}
              type="button"
              disabled={revealed || locked || outOfMoves}
              onClick={() => handleFlip(card.index)}
              aria-label={revealed ? `${card.label} revealed` : `Face-down card ${card.index + 1}`}
              className={`flex min-h-[82px] flex-col items-center justify-center rounded-xl border p-2.5 transition duration-200 ${
                card.matched
                  ? 'border-[#f4d27a] bg-[#361c5a] text-[#fff4d7]'
                  : revealed
                    ? 'border-purple-300/70 bg-[#2d164a] text-[#fff4d7]'
                    : 'border-purple-400/35 bg-gradient-to-br from-[#3b205c] to-[#1e0f34] text-[#f4d27a] hover:-translate-y-0.5 hover:border-[#f4d27a]/70'
              }`}
            >
              <span className="text-2xl leading-none sm:text-3xl">{revealed ? card.glyph : '✦'}</span>
              {revealed && (
                <span className="mt-1.5 truncate text-[11px] text-purple-100/85">
                  {card.label}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <p className="text-sm text-[#f4d27a]" aria-live="polite">
          {statusMessage}
        </p>
        <div className="flex items-center gap-2">
          {outOfMoves && (
            <button
              type="button"
              onClick={() => startLevel(levelNum)}
              className="inline-flex min-h-[42px] items-center gap-2 rounded-lg border border-[#f4d27a] bg-[#3a1c5c] px-4 py-2 text-sm font-semibold text-[#fff4d7]"
            >
              <RotateCcw className="h-4 w-4" />
              <span>Retry Level</span>
            </button>
          )}
          {won && levelNum < MATCH_LEVELS.length && (
            <button
              type="button"
              onClick={() => startLevel(levelNum + 1)}
              className="inline-flex min-h-[42px] items-center gap-2 rounded-lg border border-[#f4d27a] bg-gradient-to-r from-[#68418b] to-[#3a1c5c] px-5 py-2 text-sm font-semibold text-[#fff4d7] transition hover:brightness-110"
            >
              <span>Next Level</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          )}
          {won && levelNum === MATCH_LEVELS.length && (
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-300">
              <Sparkles className="h-4 w-4" />
              <span>All 5 chambers mastered</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
