import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowRight, RotateCcw } from 'lucide-react';
import { CHARACTER_BIRTHDAYS, checkBirthdaySubmission } from '../../utils/games';
import {
  getGameProgress,
  recordLevelCompletion,
  type GameProgressEntry,
} from '../../utils/gameProgress';
import { calculateChallengeScore, recordLeaderboardScore } from '../../utils/leaderboard';
import { playErrorTone, playTone, playVictoryChime } from '../../utils/sound';
import { LevelBar } from './LevelBar';

interface BirthdayChallengeGameProps {
  onSecretCodeEntered: () => void;
  onProgressUpdated?: () => void;
}

export function BirthdayChallengeGame({
  onSecretCodeEntered,
  onProgressUpdated,
}: BirthdayChallengeGameProps) {
  const [progress, setProgress] = useState<GameProgressEntry>(() => getGameProgress('birthday'));
  const [chapter, setChapter] = useState(1);
  const chapterCharacters = CHARACTER_BIRTHDAYS.filter((c) => c.chapter === chapter);

  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [answer, setAnswer] = useState('');
  const [feedback, setFeedback] = useState('');
  const [imageError, setImageError] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, []);

  const finished = index >= chapterCharacters.length;
  const current = chapterCharacters[index];
  const progressPct = Math.round(
    (Math.min(index, chapterCharacters.length) / chapterCharacters.length) * 100
  );

  function selectChapter(targetChapter: number) {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    setChapter(targetChapter);
    setIndex(0);
    setScore(0);
    setAnswer('');
    setImageError(false);
    setFeedback('');
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (finished) return;

    const result = checkBirthdaySubmission(answer, current.date);
    if (result === 'secret') {
      playTone(880, 180, 'sine', 0.05);
      onSecretCodeEntered();
      return;
    }
    if (result === 'empty') {
      setFeedback('Enter a month and day first (e.g. July 31).');
      return;
    }

    const nextScore = result === 'correct' ? score + 1 : score;
    if (result === 'correct') {
      setScore(nextScore);
      setFeedback(`Correct — ${current.name} was born on ${current.date}.`);
      playTone(659.25, 160, 'triangle', 0.05);
    } else {
      setFeedback(`Not quite. ${current.name}’s birthday is ${current.date}.`);
      playErrorTone();
    }

    timerRef.current = window.setTimeout(() => {
      const next = index + 1;
      setIndex(next);
      setAnswer('');
      setImageError(false);
      setFeedback('');
      if (next >= chapterCharacters.length) {
        playVictoryChime();
        const stars = nextScore >= 5 ? 3 : nextScore >= 3 ? 2 : 1;
        const nextProg = recordLevelCompletion('birthday', chapter, stars, 2);
        const points = calculateChallengeScore({
          gameId: 'birthday',
          level: chapter,
          stars,
          correctCount: nextScore,
        });
        recordLeaderboardScore({
          gameId: 'birthday',
          level: chapter,
          score: points,
          stars,
          detail: `${nextScore}/${chapterCharacters.length} dates`,
        });
        setProgress(nextProg);
        onProgressUpdated?.();
      }
    }, 900);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-purple-300/20 pb-4">
        <LevelBar
          totalLevels={2}
          currentLevel={chapter}
          progress={progress}
          onSelectLevel={selectChapter}
          levelLabel="Chapter"
        />
        <span className="text-xs text-purple-200/80">
          {chapter === 1 ? 'Gryffindor & Rivals' : 'Professors & Legends'}
        </span>
      </div>

      <div className="space-y-2">
        <p className="text-sm text-purple-100/80">
          When is this character’s birthday? Enter the month and day only — no year or weekday.
        </p>
        <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full bg-[#f4d27a] transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {finished ? (
        <div className="space-y-5 rounded-xl border border-purple-300/25 bg-white/5 p-6">
          <div className="text-xs tracking-[0.18em] uppercase text-purple-200/80">
            Chapter {chapter} Complete
          </div>
          <h3 className="font-magic-display text-2xl text-[#f4d27a]">
            Final Score:{' '}
            <span className="font-tech-mono">
              {score} / {chapterCharacters.length}
            </span>
          </h3>
          <p className="text-purple-100/85">
            You completed all five character birthday archives in Chapter {chapter}.
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => selectChapter(chapter)}
              className="inline-flex min-h-[42px] items-center gap-2 rounded-lg border border-purple-300/35 bg-white/5 px-4 py-2 text-sm font-medium text-[#fff4d7] hover:bg-white/10"
            >
              <RotateCcw className="h-4 w-4" />
              <span>Play Again</span>
            </button>
            {chapter === 1 && (
              <button
                type="button"
                onClick={() => selectChapter(2)}
                className="inline-flex min-h-[42px] items-center gap-2 rounded-lg border border-[#f4d27a] bg-gradient-to-r from-[#68418b] to-[#2e1647] px-5 py-2 text-sm font-semibold text-[#fff4d7] transition hover:brightness-110"
              >
                <span>Chapter 2: Legends</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="grid items-center gap-6 md:grid-cols-[260px_1fr]">
          <div className="overflow-hidden rounded-2xl border border-purple-300/40 bg-[#1a0d2b]">
            {current.image && !imageError ? (
              <img
                src={current.image}
                alt={`${current.name} wizarding portrait`}
                referrerPolicy="no-referrer"
                onError={() => setImageError(true)}
                className="aspect-[3/4] w-full scale-[1.04] object-cover"
              />
            ) : (
              <div
                className={`flex aspect-[3/4] w-full flex-col items-center justify-center bg-gradient-to-b ${current.houseTone} p-6 text-center`}
              >
                <div className="grid h-24 w-24 place-items-center rounded-full border-2 border-[#f4d27a]/60 bg-black/35">
                  <span className="font-magic-display text-3xl font-bold text-[#f4d27a]">
                    {current.monogram}
                  </span>
                </div>
                <span className="font-magic-display mt-5 text-lg font-semibold text-[#fff4d7]">
                  {current.name}
                </span>
                <span className="mt-1 text-xs tracking-wider uppercase text-purple-200/75">
                  {current.title}
                </span>
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="text-xs tracking-[0.18em] uppercase text-purple-200/80">
              Chapter {chapter} · Question{' '}
              <span className="font-tech-mono">{index + 1}</span> of{' '}
              <span className="font-tech-mono">{chapterCharacters.length}</span>
            </div>

            <div>
              <h3 className="font-magic-display text-2xl text-[#f4d27a] sm:text-3xl">
                {current.name}
              </h3>
              <p className="mt-0.5 text-xs text-purple-200/75">{current.title}</p>
            </div>

            <p className="text-purple-100/85">When is this character’s birthday?</p>

            <div>
              <label htmlFor="birthday-date-input" className="sr-only">
                Character birthday date
              </label>
              <input
                id="birthday-date-input"
                type="text"
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder={`e.g. ${current.hintExample}`}
                autoComplete="off"
                className="w-full max-w-sm rounded-xl border border-purple-300/45 bg-[#150b26] px-4 py-3 text-base text-white placeholder:text-purple-300/40 focus:border-[#f4d27a]"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                className="min-h-[44px] rounded-xl border border-[#f4d27a] bg-gradient-to-r from-[#68418b] to-[#2e1647] px-6 py-2.5 text-sm font-semibold text-[#fff4d7] transition hover:brightness-110"
              >
                Submit Answer
              </button>
            </div>

            <p className="min-h-[24px] text-sm text-[#f4d27a]" aria-live="polite">
              {feedback}
            </p>
            <p className="text-xs text-purple-200/60">Dates only · No year or weekday</p>
          </form>
        </div>
      )}
    </div>
  );
}
