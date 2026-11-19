import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateMatchStars,
  CHARACTER_BIRTHDAYS,
  checkBirthdaySubmission,
  countKeysInMaze,
  createMatchDeck,
  evaluatePotionAttempt,
  generatePotionSequence,
  MATCH_LEVELS,
  MAZE_LEVELS,
  moveMazePlayer,
  normalizeBirthdayDate,
  POTION_LEVELS,
  SECRET_CODE,
  SPELL_TIERS,
} from './games';

test('createMatchDeck creates matched pairs for every Match level', () => {
  for (const cfg of MATCH_LEVELS) {
    const deck = createMatchDeck(cfg.pairs, () => 0.42);
    assert.equal(deck.length, cfg.pairs * 2);
  }
  assert.equal(calculateMatchStars(10, 10), 3);
  assert.equal(calculateMatchStars(14, 10), 2);
  assert.equal(calculateMatchStars(20, 10), 1);
});

test('all 6 Enchanted Maze levels are solvable via BFS including key & gate mechanics', () => {
  const dirs = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ];

  for (const level of MAZE_LEVELS) {
    const totalKeys = countKeysInMaze(level);
    const startState = `${level.start.r},${level.start.c}|`;
    const visited = new Set<string>([startState]);
    const queue: { r: number; c: number; keys: string[] }[] = [
      { r: level.start.r, c: level.start.c, keys: [] },
    ];
    let solved = false;

    while (queue.length > 0) {
      const curr = queue.shift()!;
      if (curr.r === level.goal.r && curr.c === level.goal.c) {
        solved = true;
        break;
      }
      for (const [dr, dc] of dirs) {
        const res = moveMazePlayer(level, { r: curr.r, c: curr.c }, dr, dc, curr.keys);
        if (!res.moved) continue;
        const nextKeys = res.collectedKey
          ? [...curr.keys, `${res.pos.r},${res.pos.c}`].sort()
          : curr.keys;
        const stateKey = `${res.pos.r},${res.pos.c}|${nextKeys.join(';')}`;
        if (!visited.has(stateKey)) {
          visited.add(stateKey);
          queue.push({ r: res.pos.r, c: res.pos.c, keys: nextKeys });
        }
      }
    }

    assert.equal(
      solved,
      true,
      `Maze level ${level.id} (${level.name}, keys=${totalKeys}) must be solvable`
    );
  }
});

test('Spell Challenge has 3 tiers and Potion Puzzle supports 6 levels', () => {
  assert.equal(SPELL_TIERS.length, 3);
  assert.equal(POTION_LEVELS.length, 6);
  const seq = generatePotionSequence(7, 6, () => 0.8);
  assert.equal(seq.length, 7);
  assert.equal(evaluatePotionAttempt(seq, seq), 'correct');
});

test('Character Birthday Challenge has 2 chapters (10 characters) and secret code detection', () => {
  assert.equal(CHARACTER_BIRTHDAYS.length, 10);
  assert.equal(normalizeBirthdayDate('  July 31st, '), 'july 31');
  assert.equal(checkBirthdaySubmission(SECRET_CODE, 'October 4'), 'secret');
  assert.equal(checkBirthdaySubmission('4th October', 'October 4'), 'correct');
});
