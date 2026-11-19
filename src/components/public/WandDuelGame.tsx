import { useState } from 'react';
import { ArrowRight, RotateCcw, Shield, Sparkles, Swords, Zap } from 'lucide-react';
import {
  getGameProgress,
  recordLevelCompletion,
  type GameProgressEntry,
} from '../../utils/gameProgress';
import {
  chooseEnemyDuelSpell,
  DUEL_LEVELS,
  DUEL_SPELLS,
  resolveDuelTurn,
  type DuelSpellId,
} from '../../utils/newGames';
import { calculateChallengeScore, recordLeaderboardScore } from '../../utils/leaderboard';
import { playErrorTone, playTone, playVictoryChime } from '../../utils/sound';
import { LevelBar } from './LevelBar';

interface WandDuelGameProps {
  onProgressUpdated?: () => void;
}

export function WandDuelGame({ onProgressUpdated }: WandDuelGameProps) {
  const [progress, setProgress] = useState<GameProgressEntry>(() => getGameProgress('duel'));
  const [levelNum, setLevelNum] = useState(1);
  const opponent = DUEL_LEVELS[levelNum - 1];

  const [playerHp, setPlayerHp] = useState(opponent.playerMaxHp);
  const [enemyHp, setEnemyHp] = useState(opponent.maxHp);
  const [playerFocus, setPlayerFocus] = useState(2);
  const [enemyFocus, setEnemyFocus] = useState(2);
  const [turn, setTurn] = useState(1);
  const [log, setLog] = useState<string[]>([
    `Duel started against ${opponent.name} (${opponent.title}). Choose your opening spell.`,
  ]);

  const outcome =
    enemyHp <= 0 ? 'won' : playerHp <= 0 ? 'lost' : 'playing';

  function startLevel(targetLevel: number) {
    const opp = DUEL_LEVELS[targetLevel - 1];
    setLevelNum(targetLevel);
    setPlayerHp(opp.playerMaxHp);
    setEnemyHp(opp.maxHp);
    setPlayerFocus(2);
    setEnemyFocus(2);
    setTurn(1);
    setLog([`Duel started against ${opp.name} (${opp.title}). Choose your opening spell.`]);
  }

  function castSpell(spellId: DuelSpellId) {
    if (outcome !== 'playing') return;
    const spell = DUEL_SPELLS.find((s) => s.id === spellId)!;
    if (playerFocus < spell.cost) return;

    const enemyChoice = chooseEnemyDuelSpell(opponent, enemyHp, enemyFocus, turn);
    const result = resolveDuelTurn(
      playerHp,
      enemyHp,
      playerFocus,
      enemyFocus,
      spellId,
      enemyChoice,
      opponent.playerMaxHp,
      opponent.maxHp
    );

    setPlayerHp(result.playerHp);
    setEnemyHp(result.enemyHp);
    setPlayerFocus(result.playerFocus);
    setEnemyFocus(result.enemyFocus);
    setTurn((t) => t + 1);
    setLog((prev) => [`Turn ${turn}: ${result.summary}`, ...prev.slice(0, 4)]);

    if (result.enemyHp <= 0) {
      playVictoryChime();
      const hpRatio = result.playerHp / opponent.playerMaxHp;
      const stars = hpRatio >= 0.6 ? 3 : hpRatio >= 0.3 ? 2 : 1;
      const nextProg = recordLevelCompletion('duel', levelNum, stars, DUEL_LEVELS.length);
      const points = calculateChallengeScore({
        gameId: 'duel',
        level: levelNum,
        stars,
        hpRemaining: result.playerHp,
        hpMax: opponent.playerMaxHp,
      });
      recordLeaderboardScore({
        gameId: 'duel',
        level: levelNum,
        score: points,
        stars,
        detail: `${result.playerHp}/${opponent.playerMaxHp} HP · ${turn} turns`,
      });
      setProgress(nextProg);
      onProgressUpdated?.();
    } else if (result.playerHp <= 0) {
      playErrorTone();
    } else {
      playTone(spellId === 'shield' ? 520 : spellId === 'focus' ? 660 : 390, 120, 'triangle', 0.05);
    }
  }

  const playerPct = Math.round((playerHp / opponent.playerMaxHp) * 100);
  const enemyPct = Math.round((enemyHp / opponent.maxHp) * 100);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-purple-300/20 pb-4">
        <LevelBar
          totalLevels={DUEL_LEVELS.length}
          currentLevel={levelNum}
          progress={progress}
          onSelectLevel={startLevel}
          levelLabel="Duel"
        />
        <button
          type="button"
          onClick={() => startLevel(levelNum)}
          className="inline-flex min-h-[38px] items-center gap-2 rounded-lg border border-purple-300/30 bg-white/5 px-3.5 py-1.5 text-xs font-medium text-[#fff4d7] hover:bg-white/10"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          <span>Restart Duel</span>
        </button>
      </div>

      {/* Combatants HUD */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-purple-300/30 bg-[#1c0f33] p-4">
          <div className="flex items-center justify-between">
            <strong className="font-magic-display text-[#f4d27a]">You · Challenger</strong>
            <span className="font-tech-mono text-xs text-emerald-300">
              HP {playerHp}/{opponent.playerMaxHp}
            </span>
          </div>
          <div className="mt-2.5 h-2.5 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full bg-emerald-400 transition-all duration-300"
              style={{ width: `${playerPct}%` }}
            />
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-purple-200/85">
            <span>Focus Charges</span>
            <span className="font-tech-mono text-[#f4d27a]">
              {'◆'.repeat(playerFocus)}
              {'◇'.repeat(Math.max(0, 4 - playerFocus))} ({playerFocus}/4)
            </span>
          </div>
        </div>

        <div className="rounded-2xl border border-rose-300/30 bg-[#241030] p-4">
          <div className="flex items-center justify-between">
            <div>
              <strong className="font-magic-display block text-[#fff4d7]">{opponent.name}</strong>
              <span className="text-xs text-purple-200/75">{opponent.title}</span>
            </div>
            <span className="font-tech-mono text-xs text-rose-300">
              HP {enemyHp}/{opponent.maxHp}
            </span>
          </div>
          <div className="mt-2.5 h-2.5 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full bg-rose-400 transition-all duration-300"
              style={{ width: `${enemyPct}%` }}
            />
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-purple-200/85">
            <span>Opponent Focus</span>
            <span className="font-tech-mono text-rose-200">{enemyFocus}/4</span>
          </div>
        </div>
      </div>

      {/* Spells */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {DUEL_SPELLS.map((spell) => {
          const disabled = outcome !== 'playing' || playerFocus < spell.cost;
          const Icon =
            spell.id === 'strike'
              ? Zap
              : spell.id === 'shield'
                ? Shield
                : spell.id === 'disarm'
                  ? Swords
                  : Sparkles;
          return (
            <button
              key={spell.id}
              type="button"
              disabled={disabled}
              onClick={() => castSpell(spell.id)}
              className="flex flex-col items-start justify-between rounded-xl border border-purple-300/40 bg-[#271444] p-4 text-left transition hover:-translate-y-0.5 hover:border-[#f4d27a] disabled:opacity-45 disabled:hover:translate-y-0"
            >
              <div className="flex w-full items-center justify-between">
                <Icon className="h-5 w-5 text-[#f4d27a]" />
                <span className="font-tech-mono text-xs text-purple-200/80">
                  {spell.cost === 0 ? '0 Focus' : `${spell.cost} Focus`}
                </span>
              </div>
              <div className="mt-3">
                <strong className="font-magic-display block text-base text-[#fff4d7]">
                  {spell.name}
                </strong>
                <span className="block text-xs font-medium text-[#f4d27a]">
                  {spell.incantation}
                </span>
                <span className="mt-1.5 block text-xs leading-relaxed text-purple-200/80">
                  {spell.summary}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Combat log */}
      <div className="space-y-1.5 rounded-xl border border-purple-300/20 bg-black/25 p-4 text-xs text-purple-100/85">
        {log.map((entry, idx) => (
          <p key={idx} className={idx === 0 ? 'font-semibold text-[#f4d27a]' : 'opacity-75'}>
            {entry}
          </p>
        ))}
      </div>

      {outcome !== 'playing' && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#f4d27a]/40 bg-[#2d1649] p-4">
          <p className="text-sm font-semibold text-[#f4d27a]" aria-live="polite">
            {outcome === 'won'
              ? `Victory! You defeated ${opponent.name} in ${turn - 1} turns.`
              : `${opponent.name} overwhelmed you. Adjust your shield & focus timing and retry!`}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => startLevel(levelNum)}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-purple-300/35 bg-white/5 px-4 py-2 text-xs font-semibold text-[#fff4d7]"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Rematch</span>
            </button>
            {outcome === 'won' && levelNum < DUEL_LEVELS.length && (
              <button
                type="button"
                onClick={() => startLevel(levelNum + 1)}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-[#f4d27a] bg-gradient-to-r from-[#68418b] to-[#341a53] px-4 py-2 text-xs font-semibold text-[#fff4d7]"
              >
                <span>Next Challenger</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
