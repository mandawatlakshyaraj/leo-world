import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateChallengeScore,
  clearLeaderboard,
  countTotalBestScore,
  getBestScoresByGame,
  loadChallengerName,
  loadLeaderboard,
  recordLeaderboardScore,
  saveChallengerName,
  type StorageLike,
} from './leaderboard';

function createMemoryStorage(): StorageLike {
  const store = new Map<string, string>();
  return {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => {
      store.set(key, value);
    },
    removeItem: (key) => {
      store.delete(key);
    },
  };
}

test('calculateChallengeScore rewards higher levels, stars, and efficiency bonuses', () => {
  const l1 = calculateChallengeScore({
    gameId: 'match',
    level: 1,
    stars: 3,
    movesOrSteps: 7,
    parValue: 9,
  });
  const l2 = calculateChallengeScore({
    gameId: 'match',
    level: 2,
    stars: 3,
    movesOrSteps: 10,
    parValue: 12,
  });
  assert.equal(l1, 500 + 450 + 70);
  assert.ok(l2 > l1);

  const duelScore = calculateChallengeScore({
    gameId: 'duel',
    level: 3,
    stars: 3,
    hpRemaining: 75,
    hpMax: 100,
  });
  assert.equal(duelScore, 1650 + 450 + 188);
});

test('leaderboard persists sorted scores, tracks challenger alias, aggregates bests, and clears cleanly', () => {
  const storage = createMemoryStorage();
  assert.equal(loadChallengerName(storage), 'Wizard');

  saveChallengerName('  Hermione   Granger  ', storage);
  assert.equal(loadChallengerName(storage), 'Hermione Granger');

  recordLeaderboardScore(
    {
      gameId: 'conduits',
      level: 1,
      score: 930,
      stars: 3,
      detail: '5 rotations',
      achievedAt: 1000,
    },
    storage
  );
  recordLeaderboardScore(
    {
      gameId: 'duel',
      level: 2,
      score: 1700,
      stars: 3,
      detail: '68/90 HP',
      playerName: 'Harry',
      achievedAt: 2000,
    },
    storage
  );
  recordLeaderboardScore(
    {
      gameId: 'conduits',
      level: 2,
      score: 1200,
      stars: 2,
      detail: '9 rotations',
      achievedAt: 3000,
    },
    storage
  );

  const loaded = loadLeaderboard(storage);
  assert.equal(loaded.length, 3);
  assert.equal(loaded[0].gameId, 'duel');
  assert.equal(loaded[0].playerName, 'Harry');
  assert.equal(loaded[1].score, 1200);
  assert.equal(loaded[2].score, 930);

  const bestMap = getBestScoresByGame(loaded);
  assert.equal(bestMap.conduits?.score, 1200);
  assert.equal(bestMap.duel?.score, 1700);
  assert.equal(countTotalBestScore(loaded), 2900);

  clearLeaderboard(storage);
  assert.deepEqual(loadLeaderboard(storage), []);
});
