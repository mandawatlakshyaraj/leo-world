import { useCallback, useEffect, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, KeyRound, RotateCcw } from 'lucide-react';
import { countKeysInMaze, MAZE_LEVELS, moveMazePlayer } from '../../utils/games';
import {
  getGameProgress,
  recordLevelCompletion,
  type GameProgressEntry,
} from '../../utils/gameProgress';
import { calculateChallengeScore, recordLeaderboardScore } from '../../utils/leaderboard';
import { playErrorTone, playTone, playVictoryChime } from '../../utils/sound';
import { LevelBar } from './LevelBar';

interface EnchantedMazeGameProps {
  onProgressUpdated?: () => void;
}

export function EnchantedMazeGame({ onProgressUpdated }: EnchantedMazeGameProps) {
  const [progress, setProgress] = useState<GameProgressEntry>(() => getGameProgress('maze'));
  const [levelNum, setLevelNum] = useState(1);
  const level = MAZE_LEVELS[levelNum - 1];

  const [pos, setPos] = useState(level.start);
  const [collectedKeys, setCollectedKeys] = useState<string[]>([]);
  const [steps, setSteps] = useState(0);
  const [won, setWon] = useState(false);
  const [message, setMessage] = useState(
    'Navigate with Arrow keys, WASD, or the directional controls below.'
  );

  const totalKeys = countKeysInMaze(level);

  const resetLevel = useCallback(
    (targetLevel = levelNum) => {
      const target = MAZE_LEVELS[targetLevel - 1];
      setLevelNum(targetLevel);
      setPos(target.start);
      setCollectedKeys([]);
      setSteps(0);
      setWon(false);
      const keysCount = countKeysInMaze(target);
      setMessage(
        keysCount > 0
          ? `Collect the brass key to unlock the sealed gate (${target.name}).`
          : target.fogRadius
            ? `Torchlight illuminates ${target.fogRadius} tiles around you. Find the trophy!`
            : `Reach the trophy in ${target.name}.`
      );
    },
    [levelNum]
  );

  const attemptMove = useCallback(
    (dr: number, dc: number) => {
      if (won) return;
      const result = moveMazePlayer(level, pos, dr, dc, collectedKeys);
      if (result.blocked) {
        playErrorTone();
        setMessage(
          result.blockedReason === 'gate'
            ? 'The iron gate is locked — find the brass key first!'
            : 'Blocked by enchanted stone. Try another path.'
        );
        return;
      }

      if (result.moved) {
        const nextSteps = steps + 1;
        setPos(result.pos);
        setSteps(nextSteps);

        let nextKeys = collectedKeys;
        if (result.collectedKey) {
          const coordId = `${result.pos.r},${result.pos.c}`;
          nextKeys = [...collectedKeys, coordId];
          setCollectedKeys(nextKeys);
          playTone(740, 180, 'triangle', 0.06);
        }

        if (result.won) {
          setWon(true);
          playVictoryChime();
          const stars = nextSteps <= level.parSteps ? 3 : nextSteps <= level.parSteps + 6 ? 2 : 1;
          const nextProg = recordLevelCompletion('maze', levelNum, stars, MAZE_LEVELS.length);
          const points = calculateChallengeScore({
            gameId: 'maze',
            level: levelNum,
            stars,
            movesOrSteps: nextSteps,
            parValue: level.parSteps,
          });
          recordLeaderboardScore({
            gameId: 'maze',
            level: levelNum,
            score: points,
            stars,
            detail: `${nextSteps} steps`,
          });
          setProgress(nextProg);
          onProgressUpdated?.();
          setMessage(
            `Maze cleared in ${nextSteps} steps — ${stars} star${stars > 1 ? 's' : ''} · ${points} pts!`
          );
        } else if (result.collectedKey) {
          setMessage('Brass key collected! The sealed gate is now unlocked.');
        } else {
          playTone(360, 70, 'sine', 0.03);
          setMessage('Corridor clear. Keep moving.');
        }
      }
    },
    [collectedKeys, level, levelNum, onProgressUpdated, pos, steps, won]
  );

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const key = e.key.toLowerCase();
      if (key === 'arrowup' || key === 'w') {
        e.preventDefault();
        attemptMove(-1, 0);
      } else if (key === 'arrowdown' || key === 's') {
        e.preventDefault();
        attemptMove(1, 0);
      } else if (key === 'arrowleft' || key === 'a') {
        e.preventDefault();
        attemptMove(0, -1);
      } else if (key === 'arrowright' || key === 'd') {
        e.preventDefault();
        attemptMove(0, 1);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [attemptMove]);

  const tileSizePx = level.size >= 9 ? 34 : level.size >= 7 ? 42 : 52;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-purple-300/20 pb-4">
        <LevelBar
          totalLevels={MAZE_LEVELS.length}
          currentLevel={levelNum}
          progress={progress}
          onSelectLevel={resetLevel}
        />
        <button
          type="button"
          onClick={() => resetLevel(levelNum)}
          className="inline-flex min-h-[38px] items-center gap-2 rounded-lg border border-purple-300/30 bg-white/5 px-3.5 py-1.5 text-xs font-medium text-[#fff4d7] transition hover:bg-white/10"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          <span>Reset</span>
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-purple-100/90">
        <div>
          <strong className="font-magic-display text-[#f4d27a]">{level.name}</strong>
          <span className="ml-2 text-xs text-purple-200/75">
            {level.size}×{level.size} · Par {level.parSteps} steps
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {totalKeys > 0 && (
            <span className="inline-flex items-center gap-1.5 text-xs text-[#f4d27a]">
              <KeyRound className="h-3.5 w-3.5" />
              <span className="font-tech-mono">
                {collectedKeys.length}/{totalKeys} key
              </span>
            </span>
          )}
          <span>
            Steps: <strong className="font-tech-mono text-[#f4d27a]">{steps}</strong>
          </span>
        </div>
      </div>

      <div
        className="mx-auto grid gap-1"
        data-testid="maze-grid"
        style={{
          gridTemplateColumns: `repeat(${level.size}, minmax(30px, ${tileSizePx}px))`,
          width: 'fit-content',
        }}
      >
        {level.grid.map((row, r) =>
          row.map((cell, c) => {
            const isPlayer = pos.r === r && pos.c === c;
            const isGoal = cell === 'goal';
            const isWall = cell === 'wall';
            const coordId = `${r},${c}`;
            const isUncollectedKey = cell === 'key' && !collectedKeys.includes(coordId);
            const isLockedGate = cell === 'gate' && collectedKeys.length < totalKeys;
            const dist = Math.abs(pos.r - r) + Math.abs(pos.c - c);
            const inFog = level.fogRadius !== null && dist > level.fogRadius && !isGoal;

            return (
              <div
                key={coordId}
                aria-label={
                  isPlayer
                    ? 'Wizard position'
                    : isGoal
                      ? 'Exit trophy'
                      : isUncollectedKey
                        ? 'Brass key'
                        : isLockedGate
                          ? 'Locked gate'
                          : isWall
                            ? 'Blocked wall'
                            : 'Open tile'
                }
                className={`flex aspect-square items-center justify-center rounded-md border text-base transition sm:text-lg ${
                  inFog
                    ? 'border-purple-950/30 bg-[#07030e] text-transparent'
                    : isWall
                      ? 'border-purple-950/60 bg-[#0d0618]'
                      : isPlayer
                        ? 'border-[#f4d27a] bg-[#663d94] shadow-[0_0_16px_rgba(244,210,122,0.35)]'
                        : isGoal
                          ? 'border-amber-400/70 bg-[#3a2652]'
                          : isLockedGate
                            ? 'border-rose-400/60 bg-rose-950/40'
                            : 'border-purple-300/25 bg-[#311d4a]'
                }`}
              >
                {inFog
                  ? ''
                  : isPlayer
                    ? '🧙'
                    : isGoal
                      ? '🏆'
                      : isUncollectedKey
                        ? '🗝️'
                        : isLockedGate
                          ? '🔒'
                          : isWall
                            ? ''
                            : '·'}
              </div>
            );
          })
        )}
      </div>

      <div className="flex flex-col items-center gap-2">
        <button
          type="button"
          onClick={() => attemptMove(-1, 0)}
          aria-label="Move North"
          className="flex h-11 w-14 items-center justify-center rounded-lg border border-[#f4d27a]/70 bg-[#321b4f] text-[#fff4d7] transition hover:bg-[#46266d]"
        >
          <ArrowUp className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => attemptMove(0, -1)}
            aria-label="Move West"
            className="flex h-11 w-14 items-center justify-center rounded-lg border border-[#f4d27a]/70 bg-[#321b4f] text-[#fff4d7] transition hover:bg-[#46266d]"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => attemptMove(1, 0)}
            aria-label="Move South"
            className="flex h-11 w-14 items-center justify-center rounded-lg border border-[#f4d27a]/70 bg-[#321b4f] text-[#fff4d7] transition hover:bg-[#46266d]"
          >
            <ArrowDown className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => attemptMove(0, 1)}
            aria-label="Move East"
            className="flex h-11 w-14 items-center justify-center rounded-lg border border-[#f4d27a]/70 bg-[#321b4f] text-[#fff4d7] transition hover:bg-[#46266d]"
          >
            <ArrowRight className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <p className="text-sm text-[#f4d27a]" aria-live="polite">
          {message}
        </p>
        {won && levelNum < MAZE_LEVELS.length && (
          <button
            type="button"
            onClick={() => resetLevel(levelNum + 1)}
            className="inline-flex min-h-[42px] items-center gap-2 rounded-lg border border-[#f4d27a] bg-gradient-to-r from-[#68418b] to-[#341a53] px-4 py-2 text-sm font-semibold text-[#fff4d7] transition hover:brightness-110"
          >
            <span>Next Maze</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
