import { useMemo, useState } from 'react';
import { ArrowRight, RotateCcw } from 'lucide-react';
import {
  getGameProgress,
  recordLevelCompletion,
  type GameProgressEntry,
} from '../../utils/gameProgress';
import {
  cloneConduitGrid,
  computeConduitFlow,
  CONDUIT_LEVELS,
  type ConduitTile,
} from '../../utils/newGames';
import { calculateChallengeScore, recordLeaderboardScore } from '../../utils/leaderboard';
import { playTone, playVictoryChime } from '../../utils/sound';
import { LevelBar } from './LevelBar';

interface ArcaneConduitsGameProps {
  onProgressUpdated?: () => void;
}

function PipeSvg({ tile, isPowered }: { tile: ConduitTile; isPowered: boolean }) {
  const stroke = isPowered ? '#f4d27a' : '#8b6bb5';
  const core = isPowered ? '#fff4d7' : '#a88cd1';

  return (
    <svg
      viewBox="0 0 100 100"
      className="h-full w-full transition-transform duration-150"
      style={{ transform: `rotate(${tile.rotation}deg)` }}
      aria-hidden="true"
    >
      {tile.shape === 'straight' && (
        <>
          <line x1="50" y1="0" x2="50" y2="100" stroke={stroke} strokeWidth="18" strokeLinecap="round" />
          <line x1="50" y1="0" x2="50" y2="100" stroke={core} strokeWidth="6" />
        </>
      )}
      {tile.shape === 'corner' && (
        <>
          <path d="M50 0 L50 50 L100 50" fill="none" stroke={stroke} strokeWidth="18" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M50 0 L50 50 L100 50" fill="none" stroke={core} strokeWidth="6" strokeLinejoin="round" />
        </>
      )}
      {tile.shape === 'tee' && (
        <>
          <path d="M50 0 L50 100 M50 50 L100 50" fill="none" stroke={stroke} strokeWidth="18" strokeLinecap="round" />
          <path d="M50 0 L50 100 M50 50 L100 50" fill="none" stroke={core} strokeWidth="6" />
        </>
      )}
      {tile.shape === 'source' && (
        <>
          <line x1="50" y1="50" x2="100" y2="50" stroke="#f4d27a" strokeWidth="18" strokeLinecap="round" />
          <circle cx="50" cy="50" r="26" fill="#f4d27a" stroke="#fff4d7" strokeWidth="5" />
          <text x="50" y="56" textAnchor="middle" fontSize="22" fontWeight="bold" fill="#1b0d30">
            ✦
          </text>
        </>
      )}
      {tile.shape === 'target' && (
        <>
          <line x1="0" y1="50" x2="50" y2="50" stroke={stroke} strokeWidth="18" strokeLinecap="round" />
          <circle
            cx="50"
            cy="50"
            r="26"
            fill={isPowered ? '#34d399' : '#2a1647'}
            stroke={isPowered ? '#ecfdf5' : '#b599dd'}
            strokeWidth="5"
          />
          <text
            x="50"
            y="57"
            textAnchor="middle"
            fontSize="22"
            fontWeight="bold"
            fill={isPowered ? '#052e16' : '#fff4d7'}
          >
            ◈
          </text>
        </>
      )}
    </svg>
  );
}

export function ArcaneConduitsGame({ onProgressUpdated }: ArcaneConduitsGameProps) {
  const [progress, setProgress] = useState<GameProgressEntry>(() => getGameProgress('conduits'));
  const [levelNum, setLevelNum] = useState(1);
  const config = CONDUIT_LEVELS[levelNum - 1];

  const [grid, setGrid] = useState<ConduitTile[][]>(() => cloneConduitGrid(config.tiles));
  const [moves, setMoves] = useState(0);
  const [message, setMessage] = useState(
    'Tap any conduit tile to rotate it 90° and link the starlight crystal (✦) to the pedestal (◈).'
  );

  const flow = useMemo(() => computeConduitFlow(grid), [grid]);

  function startLevel(targetLevel: number) {
    const cfg = CONDUIT_LEVELS[targetLevel - 1];
    setLevelNum(targetLevel);
    setGrid(cloneConduitGrid(cfg.tiles));
    setMoves(0);
    setMessage(`Level ${targetLevel} (${cfg.name}): channel starlight from ✦ to ◈.`);
  }

  function rotateTile(r: number, c: number) {
    if (flow.solved) return;
    const cell = grid[r][c];
    if (cell.fixed || cell.shape === 'empty') return;

    const nextGrid = cloneConduitGrid(grid);
    nextGrid[r][c].rotation = ((cell.rotation + 90) % 360) as 0 | 90 | 180 | 270;
    const nextMoves = moves + 1;
    setGrid(nextGrid);
    setMoves(nextMoves);

    const nextFlow = computeConduitFlow(nextGrid);
    if (nextFlow.solved) {
      playVictoryChime();
      const stars = nextMoves <= config.parMoves ? 3 : nextMoves <= config.parMoves + 5 ? 2 : 1;
      const nextProg = recordLevelCompletion('conduits', levelNum, stars, CONDUIT_LEVELS.length);
      const points = calculateChallengeScore({
        gameId: 'conduits',
        level: levelNum,
        stars,
        movesOrSteps: nextMoves,
        parValue: config.parMoves,
      });
      recordLeaderboardScore({
        gameId: 'conduits',
        level: levelNum,
        score: points,
        stars,
        detail: `${nextMoves} rotations`,
      });
      setProgress(nextProg);
      onProgressUpdated?.();
      setMessage(
        `Conduit connected in ${nextMoves} rotations — ${stars} star${stars > 1 ? 's' : ''} · ${points} pts!`
      );
    } else {
      playTone(430 + nextFlow.powered.size * 22, 80, 'sine', 0.035);
    }
  }

  const tilePx = config.size >= 6 ? 52 : config.size === 5 ? 60 : 68;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-purple-300/20 pb-4">
        <LevelBar
          totalLevels={CONDUIT_LEVELS.length}
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
          <span>Reset</span>
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-purple-100/90">
        <div>
          <strong className="font-magic-display text-[#f4d27a]">{config.name}</strong>
          <span className="ml-2 text-xs text-purple-200/75">
            {config.size}×{config.size} · Par {config.parMoves} rotations
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span>
            Rotations: <strong className="font-tech-mono text-[#f4d27a]">{moves}</strong>
          </span>
          <span aria-hidden="true" className="text-purple-300/40">
            ·
          </span>
          <span>
            Energized:{' '}
            <strong className="font-tech-mono text-emerald-300">{flow.powered.size}</strong>
          </span>
        </div>
      </div>

      <div
        className="mx-auto grid gap-1.5"
        data-testid="conduit-grid"
        style={{
          gridTemplateColumns: `repeat(${config.size}, minmax(44px, ${tilePx}px))`,
          width: 'fit-content',
        }}
      >
        {grid.map((row, r) =>
          row.map((tile, c) => {
            const key = `${r},${c}`;
            const isPowered = flow.powered.has(key);
            const interactive = !tile.fixed && tile.shape !== 'empty' && !flow.solved;

            return (
              <button
                key={key}
                type="button"
                disabled={!interactive}
                onClick={() => rotateTile(r, c)}
                aria-label={
                  tile.shape === 'empty'
                    ? `Empty stone ${r + 1},${c + 1}`
                    : `${tile.shape} conduit at row ${r + 1} column ${c + 1}, ${tile.rotation} degrees`
                }
                className={`aspect-square rounded-xl border p-1 transition ${
                  tile.shape === 'empty'
                    ? 'border-purple-950/50 bg-[#0d0618] opacity-55'
                    : isPowered
                      ? 'border-[#f4d27a] bg-[#361c5a] shadow-[0_0_16px_rgba(244,210,122,0.28)]'
                      : 'border-purple-300/30 bg-[#23123c] hover:border-purple-200/70'
                }`}
              >
                {tile.shape !== 'empty' && <PipeSvg tile={tile} isPowered={isPowered} />}
              </button>
            );
          })
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <p className="text-sm text-[#f4d27a]" aria-live="polite">
          {message}
        </p>
        {flow.solved && levelNum < CONDUIT_LEVELS.length && (
          <button
            type="button"
            onClick={() => startLevel(levelNum + 1)}
            className="inline-flex min-h-[42px] items-center gap-2 rounded-lg border border-[#f4d27a] bg-gradient-to-r from-[#68418b] to-[#341a53] px-5 py-2 text-sm font-semibold text-[#fff4d7] transition hover:brightness-110"
          >
            <span>Next Nexus</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
