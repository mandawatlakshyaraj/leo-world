import type { PublicGameId } from '../types/leo';

const PROGRESS_KEY = 'leoWorldGameProgress_v1';

export interface GameProgressEntry {
  highestUnlockedLevel: number; // 1-indexed
  starsByLevel: Record<number, number>; // level -> 1..3 stars
}

export type GameProgressMap = Partial<Record<PublicGameId, GameProgressEntry>>;

export function loadAllGameProgress(): GameProgressMap {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    return raw ? (JSON.parse(raw) as GameProgressMap) : {};
  } catch {
    return {};
  }
}

export function getGameProgress(gameId: PublicGameId): GameProgressEntry {
  const all = loadAllGameProgress();
  return (
    all[gameId] || {
      highestUnlockedLevel: 1,
      starsByLevel: {},
    }
  );
}

export function recordLevelCompletion(
  gameId: PublicGameId,
  completedLevel: number,
  stars: number,
  maxLevel: number
): GameProgressEntry {
  const all = loadAllGameProgress();
  const current = all[gameId] || { highestUnlockedLevel: 1, starsByLevel: {} };
  const clampedStars = Math.max(1, Math.min(3, stars));
  const prevStars = current.starsByLevel[completedLevel] || 0;

  const updated: GameProgressEntry = {
    highestUnlockedLevel: Math.min(
      maxLevel,
      Math.max(current.highestUnlockedLevel, completedLevel + 1)
    ),
    starsByLevel: {
      ...current.starsByLevel,
      [completedLevel]: Math.max(prevStars, clampedStars),
    },
  };

  all[gameId] = updated;
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(PROGRESS_KEY, JSON.stringify(all));
    } catch {
      // Ignore storage quota errors
    }
  }
  return updated;
}

export function countTotalStars(progress: GameProgressMap): number {
  let total = 0;
  for (const entry of Object.values(progress)) {
    if (!entry) continue;
    for (const s of Object.values(entry.starsByLevel)) {
      total += s;
    }
  }
  return total;
}
