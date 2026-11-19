import { useState } from 'react';
import { ArrowRight, Delete, Lightbulb, RotateCcw } from 'lucide-react';
import {
  getGameProgress,
  recordLevelCompletion,
  type GameProgressEntry,
} from '../../utils/gameProgress';
import { RUNE_CIPHER_LEVELS, scrambleWord } from '../../utils/newGames';
import { calculateChallengeScore, recordLeaderboardScore } from '../../utils/leaderboard';
import { playErrorTone, playTone, playVictoryChime } from '../../utils/sound';
import { LevelBar } from './LevelBar';

interface RuneCipherGameProps {
  onProgressUpdated?: () => void;
}

export function RuneCipherGame({ onProgressUpdated }: RuneCipherGameProps) {
  const [progress, setProgress] = useState<GameProgressEntry>(() => getGameProgress('rune'));
  const [levelNum, setLevelNum] = useState(1);
  const config = RUNE_CIPHER_LEVELS[levelNum - 1];

  const [tiles, setTiles] = useState(() => scrambleWord(config.word));
  const [pickedIndices, setPickedIndices] = useState<number[]>([]);
  const [mistakes, setMistakes] = useState(0);
  const [won, setWon] = useState(false);
  const [message, setMessage] = useState(`Decode the ${config.word.length}-letter incantation.`);

  function startLevel(targetLevel: number) {
    const cfg = RUNE_CIPHER_LEVELS[targetLevel - 1];
    setLevelNum(targetLevel);
    setTiles(scrambleWord(cfg.word));
    setPickedIndices([]);
    setMistakes(0);
    setWon(false);
    setMessage(`Level ${targetLevel} (${cfg.name}): arrange the ${cfg.word.length} runes.`);
  }

  function handleTilePick(tilePos: number) {
    if (won || pickedIndices.includes(tilePos)) return;
    const nextPicked = [...pickedIndices, tilePos];
    setPickedIndices(nextPicked);
    playTone(480 + nextPicked.length * 32, 85, 'sine', 0.04);

    if (nextPicked.length === config.word.length) {
      const attempt = nextPicked.map((i) => tiles[i].letter).join('');
      if (attempt === config.word) {
        setWon(true);
        playVictoryChime();
        const stars = mistakes === 0 ? 3 : mistakes <= config.parMistakes ? 2 : 1;
        const nextProg = recordLevelCompletion('rune', levelNum, stars, RUNE_CIPHER_LEVELS.length);
        const points = calculateChallengeScore({
          gameId: 'rune',
          level: levelNum,
          stars,
          replaysOrMistakes: mistakes,
        });
        recordLeaderboardScore({
          gameId: 'rune',
          level: levelNum,
          score: points,
          stars,
          detail: mistakes === 0 ? 'Flawless' : `${mistakes} hint/miss`,
        });
        setProgress(nextProg);
        onProgressUpdated?.();
        setMessage(`Decoded "${config.word}" — ${stars} star${stars > 1 ? 's' : ''} · ${points} pts!`);
      } else {
        playErrorTone();
        setMistakes((m) => m + 1);
        setMessage(`"${attempt}" is not quite right — tap Backspace or Clear to adjust.`);
      }
    }
  }

  function handleBackspace() {
    if (won || pickedIndices.length === 0) return;
    setPickedIndices((prev) => prev.slice(0, -1));
  }

  function handleClear() {
    if (won) return;
    setPickedIndices([]);
    setMessage('Runes cleared. Try arranging them again.');
  }

  function handleHint() {
    if (won) return;
    const nextSlot = pickedIndices.length;
    if (nextSlot >= config.word.length) return;
    const neededLetter = config.word[nextSlot];
    const matchPos = tiles.findIndex(
      (t, idx) => t.letter === neededLetter && !pickedIndices.includes(idx)
    );
    if (matchPos !== -1) {
      setMistakes((m) => m + 1);
      handleTilePick(matchPos);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-purple-300/20 pb-4">
        <LevelBar
          totalLevels={RUNE_CIPHER_LEVELS.length}
          currentLevel={levelNum}
          progress={progress}
          onSelectLevel={startLevel}
        />
        <button
          type="button"
          onClick={() => startLevel(levelNum)}
          className="inline-flex min-h-[38px] items-center gap-2 rounded-lg border border-purple-300/30 bg-white/5 px-3.5 py-1.5 text-xs font-medium text-[#fff4d7] hover:bg-white/10"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          <span>Reshuffle</span>
        </button>
      </div>

      <div className="space-y-1">
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <strong className="font-magic-display text-[#f4d27a]">{config.name}</strong>
          <span className="font-tech-mono text-xs text-purple-200/80">
            Mistakes/Hints: {mistakes}
          </span>
        </div>
        <p className="text-sm text-purple-100/85">{config.clue}</p>
      </div>

      {/* Answer slots */}
      <div className="flex flex-wrap justify-center gap-2" aria-label="Decoded word slots">
        {Array.from({ length: config.word.length }, (_, slotIdx) => {
          const tilePos = pickedIndices[slotIdx];
          const letter = tilePos !== undefined ? tiles[tilePos].letter : '';
          return (
            <div
              key={slotIdx}
              className={`font-magic-display flex h-12 w-10 items-center justify-center rounded-xl border text-lg font-bold transition sm:h-14 sm:w-12 sm:text-xl ${
                won
                  ? 'border-emerald-400 bg-emerald-950/60 text-emerald-100'
                  : letter
                    ? 'border-[#f4d27a] bg-[#3b205f] text-[#fff4d7]'
                    : 'border-purple-300/30 bg-[#150a24] text-purple-300/40'
              }`}
            >
              {letter || '·'}
            </div>
          );
        })}
      </div>

      {/* Scrambled rune tiles */}
      <div className="flex flex-wrap justify-center gap-2.5">
        {tiles.map((tile, idx) => {
          const used = pickedIndices.includes(idx);
          return (
            <button
              key={`${tile.index}-${idx}`}
              type="button"
              disabled={used || won}
              onClick={() => handleTilePick(idx)}
              aria-label={`Rune ${tile.letter}`}
              className={`font-magic-display flex h-12 w-12 items-center justify-center rounded-xl border text-lg font-bold transition ${
                used
                  ? 'border-purple-300/15 bg-black/20 text-purple-300/25'
                  : 'border-purple-300/45 bg-gradient-to-br from-[#45246b] to-[#221039] text-[#f4d27a] hover:-translate-y-0.5 hover:border-[#f4d27a]'
              }`}
            >
              {tile.letter}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2.5">
        <button
          type="button"
          disabled={won || pickedIndices.length === 0}
          onClick={handleBackspace}
          className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-purple-300/30 bg-white/5 px-3.5 py-2 text-xs font-medium text-[#fff4d7] disabled:opacity-40"
        >
          <Delete className="h-3.5 w-3.5" />
          <span>Backspace</span>
        </button>
        <button
          type="button"
          disabled={won || pickedIndices.length === 0}
          onClick={handleClear}
          className="min-h-[40px] rounded-lg border border-purple-300/30 bg-white/5 px-3.5 py-2 text-xs font-medium text-[#fff4d7] disabled:opacity-40"
        >
          Clear
        </button>
        <button
          type="button"
          disabled={won}
          onClick={handleHint}
          className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-[#f4d27a]/60 bg-[#321b4f] px-3.5 py-2 text-xs font-medium text-[#f4d27a] disabled:opacity-40"
        >
          <Lightbulb className="h-3.5 w-3.5" />
          <span>Hint Next Letter</span>
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <p className="text-sm text-[#f4d27a]" aria-live="polite">
          {message}
        </p>
        {won && levelNum < RUNE_CIPHER_LEVELS.length && (
          <button
            type="button"
            onClick={() => startLevel(levelNum + 1)}
            className="inline-flex min-h-[42px] items-center gap-2 rounded-lg border border-[#f4d27a] bg-gradient-to-r from-[#68418b] to-[#341a53] px-5 py-2 text-sm font-semibold text-[#fff4d7] transition hover:brightness-110"
          >
            <span>Next Cipher</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
