import { useEffect, useRef, useState } from 'react';
import { ArrowRight, FlaskConical, Play, RotateCcw } from 'lucide-react';
import {
  evaluatePotionAttempt,
  generatePotionSequence,
  POTION_LEVELS,
  POTION_VIALS,
} from '../../utils/games';
import {
  getGameProgress,
  recordLevelCompletion,
  type GameProgressEntry,
} from '../../utils/gameProgress';
import { calculateChallengeScore, recordLeaderboardScore } from '../../utils/leaderboard';
import { playErrorTone, playTone, playVictoryChime } from '../../utils/sound';
import { LevelBar } from './LevelBar';

interface PotionPuzzleGameProps {
  onProgressUpdated?: () => void;
}

export function PotionPuzzleGame({ onProgressUpdated }: PotionPuzzleGameProps) {
  const [progress, setProgress] = useState<GameProgressEntry>(() => getGameProgress('potion'));
  const [levelNum, setLevelNum] = useState(1);
  const config = POTION_LEVELS[levelNum - 1];

  const [sequence, setSequence] = useState<number[]>(() =>
    generatePotionSequence(config.sequenceLength, config.vialCount)
  );
  const [playerInput, setPlayerInput] = useState<number[]>([]);
  const [activeVial, setActiveVial] = useState<number | null>(null);
  const [phase, setPhase] = useState<'ready' | 'showing' | 'input' | 'won' | 'failed'>('ready');
  const [replaysUsed, setReplaysUsed] = useState(0);
  const [message, setMessage] = useState(
    `Level 1 (${config.name}): press Reveal Sequence to watch ${config.sequenceLength} glowing vials.`
  );
  const timersRef = useRef<number[]>([]);

  function clearTimers() {
    timersRef.current.forEach((id) => window.clearTimeout(id));
    timersRef.current = [];
  }

  useEffect(() => {
    return () => clearTimers();
  }, []);

  function startLevel(targetLevel: number) {
    clearTimers();
    const cfg = POTION_LEVELS[targetLevel - 1];
    setLevelNum(targetLevel);
    setSequence(generatePotionSequence(cfg.sequenceLength, cfg.vialCount));
    setPlayerInput([]);
    setActiveVial(null);
    setPhase('ready');
    setReplaysUsed(0);
    setMessage(
      `Level ${targetLevel} (${cfg.name}): press Reveal Sequence to watch ${cfg.sequenceLength} steps.`
    );
  }

  function playSequence(seq: number[], isReplay = false) {
    clearTimers();
    if (isReplay) setReplaysUsed((r) => r + 1);
    setPhase('showing');
    setPlayerInput([]);
    setMessage('Watch the cauldron vials illuminate in order…');

    seq.forEach((vialId, idx) => {
      const startAt = idx * config.stepMs + 180;
      const onTimer = window.setTimeout(() => {
        setActiveVial(vialId);
        playTone(POTION_VIALS[vialId].freq, Math.round(config.stepMs * 0.45), 'triangle', 0.055);
      }, startAt);
      const offTimer = window.setTimeout(() => {
        setActiveVial(null);
      }, startAt + Math.round(config.stepMs * 0.62));
      timersRef.current.push(onTimer, offTimer);
    });

    const endTimer = window.setTimeout(() => {
      setActiveVial(null);
      setPhase('input');
      setMessage(`Now repeat all ${seq.length} potion steps in exact order.`);
    }, seq.length * config.stepMs + 260);
    timersRef.current.push(endTimer);
  }

  function handleVialClick(vialId: number) {
    if (phase !== 'input') return;
    setActiveVial(vialId);
    playTone(POTION_VIALS[vialId].freq, 170, 'triangle', 0.05);
    const clearGlow = window.setTimeout(() => setActiveVial(null), 170);
    timersRef.current.push(clearGlow);

    const nextInput = [...playerInput, vialId];
    setPlayerInput(nextInput);

    const verdict = evaluatePotionAttempt(sequence, nextInput);
    if (verdict === 'wrong') {
      playErrorTone();
      setPhase('failed');
      setMessage('The cauldron fizzled — wrong ingredient order. Retry this level!');
      return;
    }

    if (verdict === 'correct') {
      playVictoryChime();
      setPhase('won');
      const stars = replaysUsed === 0 ? 3 : replaysUsed === 1 ? 2 : 1;
      const nextProg = recordLevelCompletion('potion', levelNum, stars, POTION_LEVELS.length);
      const points = calculateChallengeScore({
        gameId: 'potion',
        level: levelNum,
        stars,
        replaysOrMistakes: replaysUsed,
      });
      recordLeaderboardScore({
        gameId: 'potion',
        level: levelNum,
        score: points,
        stars,
        detail: replaysUsed === 0 ? 'No replays' : `${replaysUsed} replay${replaysUsed > 1 ? 's' : ''}`,
      });
      setProgress(nextProg);
      onProgressUpdated?.();
      setMessage(
        `${config.name} brewed cleanly — ${stars} star${stars > 1 ? 's' : ''} · ${points} pts!`
      );
    }
  }

  const visibleVials = POTION_VIALS.slice(0, config.vialCount);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-purple-300/20 pb-4">
        <LevelBar
          totalLevels={POTION_LEVELS.length}
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
          <span>New Sequence</span>
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="text-sm text-purple-100/90">
          <strong className="font-magic-display text-[#f4d27a]">{config.name}</strong>
          <span className="ml-2 text-xs text-purple-200/75">
            {config.vialCount} vials · {config.sequenceLength} steps · Entered{' '}
            <span className="font-tech-mono">
              {playerInput.length}/{sequence.length}
            </span>
          </span>
        </div>

        <button
          type="button"
          disabled={phase === 'showing' || phase === 'won'}
          onClick={() => playSequence(sequence, phase !== 'ready')}
          className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-[#f4d27a] bg-gradient-to-r from-[#68418b] to-[#341954] px-4 py-2 text-sm font-semibold text-[#fff4d7] transition hover:brightness-110 disabled:opacity-50"
        >
          <Play className="h-4 w-4" />
          <span>
            {phase === 'showing'
              ? 'Brewing…'
              : phase === 'ready'
                ? 'Reveal Sequence'
                : 'Replay Sequence'}
          </span>
        </button>
      </div>

      <div
        className={`grid grid-cols-2 gap-3 sm:gap-4 ${
          config.vialCount <= 4
            ? 'sm:grid-cols-4'
            : config.vialCount === 5
              ? 'sm:grid-cols-5'
              : 'sm:grid-cols-3 lg:grid-cols-6'
        }`}
      >
        {visibleVials.map((vial) => {
          const isLit = activeVial === vial.id;
          return (
            <button
              key={vial.id}
              type="button"
              disabled={phase !== 'input'}
              onClick={() => handleVialClick(vial.id)}
              style={{
                borderColor: isLit ? '#fff4d7' : vial.color,
                boxShadow: isLit ? `0 0 28px ${vial.glow}` : undefined,
              }}
              className={`flex min-h-[112px] flex-col items-center justify-center gap-2.5 rounded-2xl border-2 bg-[#1c0f31] p-3.5 transition duration-150 ${
                isLit ? 'scale-[1.03] bg-[#301955]' : 'hover:bg-[#271444]'
              } disabled:cursor-default`}
            >
              <FlaskConical className="h-8 w-8" style={{ color: vial.color }} />
              <span className="text-center text-xs font-medium text-[#fff4d7] sm:text-sm">
                {vial.name}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <p className="min-h-[24px] text-sm text-[#f4d27a]" aria-live="polite">
          {message}
        </p>
        {phase === 'won' && levelNum < POTION_LEVELS.length && (
          <button
            type="button"
            onClick={() => startLevel(levelNum + 1)}
            className="inline-flex min-h-[42px] items-center gap-2 rounded-lg border border-[#f4d27a] bg-gradient-to-r from-[#68418b] to-[#341a53] px-5 py-2 text-sm font-semibold text-[#fff4d7] transition hover:brightness-110"
          >
            <span>Next Level</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
