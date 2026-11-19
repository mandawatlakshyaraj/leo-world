import type { PublicGameId } from '../types/leo';

const LEADERBOARD_KEY = 'leoWorldLeaderboard_v1';
const CHALLENGER_KEY = 'leoWorldChallengerName_v1';
const MAX_ENTRIES = 60;

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface LeaderboardEntry {
  id: string;
  playerName: string;
  gameId: PublicGameId;
  level: number;
  score: number;
  stars: number;
  detail: string;
  achievedAt: number;
}

export interface ScoreCalculationInput {
  gameId: PublicGameId;
  level: number;
  stars: number;
  movesOrSteps?: number;
  parValue?: number;
  correctCount?: number;
  replaysOrMistakes?: number;
  hpRemaining?: number;
  hpMax?: number;
}

function resolveStorage(customStorage?: StorageLike): StorageLike | null {
  if (customStorage) return customStorage;
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  return null;
}

export function sanitizeChallengerName(name: string): string {
  const cleaned = name.trim().replace(/\s+/g, ' ').slice(0, 24);
  return cleaned || 'Wizard';
}

export function loadChallengerName(customStorage?: StorageLike): string {
  const storage = resolveStorage(customStorage);
  if (!storage) return 'Wizard';
  try {
    const raw = storage.getItem(CHALLENGER_KEY);
    return raw ? sanitizeChallengerName(raw) : 'Wizard';
  } catch {
    return 'Wizard';
  }
}

export function saveChallengerName(name: string, customStorage?: StorageLike): string {
  const sanitized = sanitizeChallengerName(name);
  const storage = resolveStorage(customStorage);
  if (storage) {
    try {
      storage.setItem(CHALLENGER_KEY, sanitized);
    } catch {
      // Ignore storage quota errors
    }
  }
  return sanitized;
}

export function calculateChallengeScore(input: ScoreCalculationInput): number {
  const level = Math.max(1, input.level);
  const stars = Math.max(1, Math.min(3, input.stars));

  switch (input.gameId) {
    case 'match': {
      const bonus = Math.max(0, (input.parValue ?? 0) - (input.movesOrSteps ?? 0)) * 35;
      return level * 500 + stars * 150 + bonus;
    }
    case 'birthday': {
      const correct = Math.max(0, input.correctCount ?? 0);
      return level * 400 + correct * 120 + stars * 100;
    }
    case 'spell': {
      const correct = Math.max(0, input.correctCount ?? 0);
      return level * 500 + correct * 100 + stars * 120;
    }
    case 'maze': {
      const bonus = Math.max(0, (input.parValue ?? 0) - (input.movesOrSteps ?? 0)) * 25;
      return level * 450 + stars * 150 + bonus;
    }
    case 'potion': {
      const penalty = Math.max(0, input.replaysOrMistakes ?? 0) * 75;
      return Math.max(100, level * 450 + stars * 180 - penalty);
    }
    case 'rune': {
      const penalty = Math.max(0, input.replaysOrMistakes ?? 0) * 40;
      return Math.max(100, level * 450 + stars * 160 - penalty);
    }
    case 'duel': {
      const ratio =
        input.hpMax && input.hpMax > 0 ? Math.max(0, (input.hpRemaining ?? 0) / input.hpMax) : 0;
      return level * 550 + stars * 150 + Math.round(ratio * 250);
    }
    case 'conduits': {
      const bonus = Math.max(0, (input.parValue ?? 0) - (input.movesOrSteps ?? 0)) * 30;
      return level * 450 + stars * 160 + bonus;
    }
  }
}

export function sortLeaderboardEntries(entries: LeaderboardEntry[]): LeaderboardEntry[] {
  return [...entries].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.stars !== a.stars) return b.stars - a.stars;
    if (b.level !== a.level) return b.level - a.level;
    return b.achievedAt - a.achievedAt;
  });
}

export function loadLeaderboard(customStorage?: StorageLike): LeaderboardEntry[] {
  const storage = resolveStorage(customStorage);
  if (!storage) return [];
  try {
    const raw = storage.getItem(LEADERBOARD_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return sortLeaderboardEntries(
      parsed.filter(
        (item): item is LeaderboardEntry =>
          Boolean(item) &&
          typeof item.id === 'string' &&
          typeof item.gameId === 'string' &&
          typeof item.score === 'number'
      )
    );
  } catch {
    return [];
  }
}

export function recordLeaderboardScore(
  params: {
    gameId: PublicGameId;
    level: number;
    score: number;
    stars: number;
    detail: string;
    playerName?: string;
    achievedAt?: number;
  },
  customStorage?: StorageLike
): LeaderboardEntry[] {
  const storage = resolveStorage(customStorage);
  const existing = loadLeaderboard(storage ?? undefined);
  const entry: LeaderboardEntry = {
    id: `${params.gameId}-${params.level}-${params.achievedAt ?? Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 7)}`,
    playerName: sanitizeChallengerName(
      params.playerName ?? loadChallengerName(storage ?? undefined)
    ),
    gameId: params.gameId,
    level: Math.max(1, params.level),
    score: Math.max(0, Math.round(params.score)),
    stars: Math.max(1, Math.min(3, params.stars)),
    detail: params.detail,
    achievedAt: params.achievedAt ?? Date.now(),
  };

  const next = sortLeaderboardEntries([entry, ...existing]).slice(0, MAX_ENTRIES);
  if (storage) {
    try {
      storage.setItem(LEADERBOARD_KEY, JSON.stringify(next));
    } catch {
      // Ignore storage quota errors
    }
  }
  return next;
}

export function clearLeaderboard(customStorage?: StorageLike): LeaderboardEntry[] {
  const storage = resolveStorage(customStorage);
  if (storage) {
    try {
      storage.removeItem(LEADERBOARD_KEY);
    } catch {
      // Ignore storage errors
    }
  }
  return [];
}

export function getBestScoresByGame(
  entries: LeaderboardEntry[]
): Partial<Record<PublicGameId, LeaderboardEntry>> {
  const map: Partial<Record<PublicGameId, LeaderboardEntry>> = {};
  for (const entry of sortLeaderboardEntries(entries)) {
    if (!map[entry.gameId]) {
      map[entry.gameId] = entry;
    }
  }
  return map;
}

export function countTotalBestScore(entries: LeaderboardEntry[]): number {
  const bestMap = getBestScoresByGame(entries);
  return Object.values(bestMap).reduce((sum, item) => sum + (item?.score ?? 0), 0);
}
