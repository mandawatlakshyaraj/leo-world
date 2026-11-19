import { useEffect, useRef, useState } from 'react';
import { ArrowRight, RotateCcw } from 'lucide-react';
import { SPELL_TIERS } from '../../utils/games';
import {
  getGameProgress,
  recordLevelCompletion,
  type GameProgressEntry,
} from '../../utils/gameProgress';
import { calculateChallengeScore, recordLeaderboardScore } from '../../utils/leaderboard';
import { playErrorTone, playTone, playVictoryChime } from '../../utils/sound';
import { LevelBar } from './LevelBar';

interface SpellChallengeGameProps {
  onProgressUpdated?: () => void;
}

export function SpellChallengeGame({ onProgressUpdated }: SpellChallengeGameProps) {
  const [progress, setProgress] = useState<GameProgressEntry>(() => getGameProgress('spell'));
  const [tierNum, setTierNum] = useState(1);
  const tier = SPELL_TIERS[tierNum - 1];

  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [feedback, setFeedback] = useState('');
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, []);

  const finished = index >= tier.questions.length;
  const passed = score >= tier.passScore;
  const current = tier.questions[index];
  const progressPct = Math.round(
    (Math.min(index, tier.questions.length) / tier.questions.length) * 100
  );

  function selectTier(nextTier: number) {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    setTierNum(nextTier);
    setIndex(0);
    setScore(0);
    setSelectedOption(null);
    setFeedback('');
  }

  function chooseAnswer(optionIdx: number) {
    if (selectedOption !== null || finished) return;
    setSelectedOption(optionIdx);
    const isCorrect = optionIdx === current.correctIndex;
    const nextScore = isCorrect ? score + 1 : score;
    if (isCorrect) {
      setScore(nextScore);
      setFeedback(`Correct — ${current.note}`);
      playTone(620, 150, 'triangle', 0.05);
    } else {
      setFeedback(`Not quite. The answer is ${current.options[current.correctIndex]}.`);
      playErrorTone();
    }

    timerRef.current = window.setTimeout(() => {
      const next = index + 1;
      setIndex(next);
      setSelectedOption(null);
      setFeedback('');
      if (next >= tier.questions.length) {
        if (nextScore >= tier.passScore) {
          playVictoryChime();
          const stars = nextScore === tier.questions.length ? 3 : nextScore >= tier.passScore + 1 ? 2 : 1;
          const nextProg = recordLevelCompletion('spell', tierNum, stars, SPELL_TIERS.length);
          const points = calculateChallengeScore({
            gameId: 'spell',
            level: tierNum,
            stars,
            correctCount: nextScore,
          });
          recordLeaderboardScore({
            gameId: 'spell',
            level: tierNum,
            score: points,
            stars,
            detail: `${nextScore}/${tier.questions.length} correct`,
          });
          setProgress(nextProg);
          onProgressUpdated?.();
        }
      }
    }, 850);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-purple-300/20 pb-4">
        <LevelBar
          totalLevels={SPELL_TIERS.length}
          currentLevel={tierNum}
          progress={progress}
          onSelectLevel={selectTier}
          levelLabel="Tier"
        />
        <span className="text-xs text-purple-200/80">
          <strong className="text-[#f4d27a]">{tier.name}</strong> · Pass {tier.passScore}/
          {tier.questions.length}
        </span>
      </div>

      <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full bg-[#f4d27a] transition-all duration-300"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {finished ? (
        <div className="space-y-5 rounded-xl border border-purple-300/25 bg-white/5 p-6">
          <div className="text-xs tracking-[0.18em] uppercase text-purple-200/80">
            {tier.name} Complete
          </div>
          <h3 className="font-magic-display text-2xl text-[#f4d27a]">
            Final Score:{' '}
            <span className="font-tech-mono">
              {score} / {tier.questions.length}
            </span>
          </h3>
          <p className="text-purple-100/85">
            {passed
              ? 'Examination passed — the next wizarding tier is unlocked.'
              : `You needed ${tier.passScore} correct answers to advance. Try this tier again!`}
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => selectTier(tierNum)}
              className="inline-flex min-h-[42px] items-center gap-2 rounded-lg border border-purple-300/35 bg-white/5 px-4 py-2 text-sm font-medium text-[#fff4d7] hover:bg-white/10"
            >
              <RotateCcw className="h-4 w-4" />
              <span>Retry Tier</span>
            </button>
            {passed && tierNum < SPELL_TIERS.length && (
              <button
                type="button"
                onClick={() => selectTier(tierNum + 1)}
                className="inline-flex min-h-[42px] items-center gap-2 rounded-lg border border-[#f4d27a] bg-gradient-to-r from-[#68418b] to-[#2e1647] px-5 py-2 text-sm font-semibold text-[#fff4d7] transition hover:brightness-110"
              >
                <span>Next Tier</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="flex items-center justify-between text-xs tracking-[0.16em] uppercase text-purple-200/80">
            <span>
              Question <span className="font-tech-mono">{index + 1}</span> of{' '}
              <span className="font-tech-mono">{tier.questions.length}</span>
            </span>
            <span>
              Score: <span className="font-tech-mono text-[#f4d27a]">{score}</span>
            </span>
          </div>

          <h3 className="font-magic-display text-xl text-[#fff4d7] sm:text-2xl">
            {current.question}
          </h3>

          <div className="grid gap-3 sm:grid-cols-3">
            {current.options.map((opt, idx) => {
              const isPicked = selectedOption === idx;
              const isAnswer = idx === current.correctIndex;
              let stateStyle =
                'border-purple-300/35 bg-[#24113b] text-white hover:border-[#f4d27a]/70 hover:bg-[#311850]';
              if (selectedOption !== null) {
                if (isAnswer) {
                  stateStyle = 'border-emerald-400 bg-emerald-950/60 text-emerald-100';
                } else if (isPicked) {
                  stateStyle = 'border-rose-400 bg-rose-950/60 text-rose-100';
                } else {
                  stateStyle = 'border-purple-300/20 bg-[#1a0d2b] text-purple-200/60';
                }
              }

              return (
                <button
                  key={opt}
                  type="button"
                  disabled={selectedOption !== null}
                  onClick={() => chooseAnswer(idx)}
                  className={`min-h-[48px] rounded-xl border px-4 py-3 text-left text-sm font-medium transition ${stateStyle}`}
                >
                  {opt}
                </button>
              );
            })}
          </div>

          <p className="min-h-[24px] text-sm text-[#f4d27a]" aria-live="polite">
            {feedback}
          </p>
        </div>
      )}
    </div>
  );
}
