import test from 'node:test';
import assert from 'node:assert/strict';
import {
  chooseEnemyDuelSpell,
  cloneConduitGrid,
  computeConduitFlow,
  CONDUIT_LEVELS,
  DUEL_LEVELS,
  resolveDuelTurn,
  RUNE_CIPHER_LEVELS,
  scrambleWord,
  type ConduitTile,
} from './newGames';

test('Rune Cipher scrambles words without losing characters', () => {
  assert.equal(RUNE_CIPHER_LEVELS.length, 6);
  for (const lvl of RUNE_CIPHER_LEVELS) {
    const tiles = scrambleWord(lvl.word, () => 0.37);
    assert.equal(tiles.length, lvl.word.length);
    assert.equal(
      tiles.map((t) => t.letter).sort().join(''),
      lvl.word.split('').sort().join('')
    );
  }
});

test('Wand Duel combat rules resolve strike, shield reflection, disarm, and heal', () => {
  assert.equal(DUEL_LEVELS.length, 5);
  const opp = DUEL_LEVELS[0];
  const spell = chooseEnemyDuelSpell(opp, opp.maxHp, 2, 1, () => 0.5);
  assert.ok(['strike', 'shield', 'disarm', 'focus'].includes(spell));

  const reflected = resolveDuelTurn(80, 60, 2, 2, 'strike', 'shield', 80, 60);
  assert.equal(reflected.playerHp, 66);
  assert.equal(reflected.enemyHp, 60);

  const shattered = resolveDuelTurn(80, 60, 2, 2, 'disarm', 'shield', 80, 60);
  assert.equal(shattered.enemyHp, 28);
});

test('All 5 Arcane Conduit levels start unsolved and can be solved by rotating non-fixed tiles', () => {
  assert.equal(CONDUIT_LEVELS.length, 5);
  const rotations: (0 | 90 | 180 | 270)[] = [0, 90, 180, 270];

  function canSolve(grid: ConduitTile[][]): boolean {
    const mutable: { r: number; c: number }[] = [];
    for (let r = 0; r < grid.length; r++) {
      for (let c = 0; c < grid[r].length; c++) {
        if (!grid[r][c].fixed && grid[r][c].shape !== 'empty') {
          mutable.push({ r, c });
        }
      }
    }

    function dfs(idx: number): boolean {
      if (idx === mutable.length) {
        return computeConduitFlow(grid).solved;
      }
      const { r, c } = mutable[idx];
      const orig = grid[r][c].rotation;
      // Straight pipes only have 2 distinct orientations
      const opts = grid[r][c].shape === 'straight' ? ([0, 90] as const) : rotations;
      for (const rot of opts) {
        grid[r][c].rotation = rot;
        if (dfs(idx + 1)) return true;
      }
      grid[r][c].rotation = orig;
      return false;
    }

    return dfs(0);
  }

  for (const level of CONDUIT_LEVELS) {
    const initial = computeConduitFlow(level.tiles);
    assert.equal(
      initial.solved,
      false,
      `Conduit level ${level.level} (${level.name}) should start unsolved`
    );
    const copy = cloneConduitGrid(level.tiles);
    assert.equal(
      canSolve(copy),
      true,
      `Conduit level ${level.level} (${level.name}) must have a valid rotation solution`
    );
  }
});
