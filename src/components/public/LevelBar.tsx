import { Lock, Star } from 'lucide-react';
import type { GameProgressEntry } from '../../utils/gameProgress';

interface LevelBarProps {
  totalLevels: number;
  currentLevel: number;
  progress: GameProgressEntry;
  onSelectLevel: (level: number) => void;
  levelLabel?: string;
}

export function LevelBar({
  totalLevels,
  currentLevel,
  progress,
  onSelectLevel,
  levelLabel = 'Level',
}: LevelBarProps) {
  const levels = Array.from({ length: totalLevels }, (_, idx) => idx + 1);

  return (
    <div
      className="flex flex-wrap items-center gap-2"
      role="group"
      aria-label={`${levelLabel} selector`}
    >
      {levels.map((lvl) => {
        const unlocked = lvl <= progress.highestUnlockedLevel;
        const stars = progress.starsByLevel[lvl] || 0;
        const active = lvl === currentLevel;

        return (
          <button
            key={lvl}
            type="button"
            disabled={!unlocked}
            onClick={() => onSelectLevel(lvl)}
            aria-label={
              unlocked
                ? `${levelLabel} ${lvl}${stars > 0 ? `, ${stars} of 3 stars` : ''}`
                : `${levelLabel} ${lvl} locked`
            }
            className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
              active
                ? 'border-[#f4d27a] bg-[#4c2b73] text-[#fff4d7]'
                : unlocked
                  ? 'border-purple-300/30 bg-white/5 text-purple-100 hover:border-purple-200/60 hover:bg-white/10'
                  : 'cursor-not-allowed border-purple-300/15 bg-black/20 text-purple-200/40'
            }`}
          >
            {!unlocked && <Lock className="h-3 w-3" />}
            <span className="font-tech-mono">
              {levelLabel === 'Level' ? `L${lvl}` : `${levelLabel} ${lvl}`}
            </span>
            {stars > 0 && (
              <span className="inline-flex items-center gap-0.5 text-[#f4d27a]">
                <Star className="h-3 w-3 fill-[#f4d27a]" />
                <span className="font-tech-mono">{stars}</span>
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
