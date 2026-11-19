// ---------------------------------------------------------------------------
// 1. Rune Cipher (6 Progressive Word & Incantation Decoding Levels)
// ---------------------------------------------------------------------------

export interface RuneCipherLevel {
  level: number;
  name: string;
  word: string;
  clue: string;
  parMistakes: number;
}

export const RUNE_CIPHER_LEVELS: RuneCipherLevel[] = [
  {
    level: 1,
    name: 'Spark Rune',
    word: 'LUMOS',
    clue: '5-letter charm that ignites a warm glow at the wand tip.',
    parMistakes: 1,
  },
  {
    level: 2,
    name: 'Summoning Seal',
    word: 'ACCIO',
    clue: '5-letter charm used to pull distant objects across a room.',
    parMistakes: 1,
  },
  {
    level: 3,
    name: 'Vault Key',
    word: 'ALOHOMORA',
    clue: '9-letter incantation known as the Thief’s Friend for unlocking doors.',
    parMistakes: 2,
  },
  {
    level: 4,
    name: 'Mirror Shield',
    word: 'PROTEGO',
    clue: '7-letter defensive spell that raises a shimmering barrier.',
    parMistakes: 2,
  },
  {
    level: 5,
    name: 'Time Relic',
    word: 'TIMETURNER',
    clue: '10-letter golden hourglass device worn on a fine chain (no spaces).',
    parMistakes: 2,
  },
  {
    level: 6,
    name: 'Silver Guardian',
    word: 'PATRONUS',
    clue: '8-letter silver guardian conjured from your happiest memory.',
    parMistakes: 2,
  },
];

export function scrambleWord(
  word: string,
  randomFn: () => number = Math.random
): { index: number; letter: string }[] {
  const letters = word.split('').map((letter, index) => ({ index, letter }));
  for (let i = letters.length - 1; i > 0; i--) {
    const j = Math.floor(randomFn() * (i + 1));
    [letters[i], letters[j]] = [letters[j], letters[i]];
  }
  // Ensure scrambled order differs if possible
  if (letters.map((l) => l.letter).join('') === word && letters.length > 1) {
    [letters[0], letters[letters.length - 1]] = [letters[letters.length - 1], letters[0]];
  }
  return letters;
}

// ---------------------------------------------------------------------------
// 2. Wand Duel (5 Escalating Tactical Duelists)
// ---------------------------------------------------------------------------

export type DuelSpellId = 'strike' | 'shield' | 'disarm' | 'focus';

export interface DuelSpell {
  id: DuelSpellId;
  name: string;
  incantation: string;
  cost: number;
  summary: string;
}

export const DUEL_SPELLS: DuelSpell[] = [
  {
    id: 'strike',
    name: 'Stupefy',
    incantation: 'Strike · 22 DMG',
    cost: 0,
    summary: 'Direct stun bolt. Hits Focusers hard; reflected by Protego.',
  },
  {
    id: 'shield',
    name: 'Protego',
    incantation: 'Shield · Reflects Strike',
    cost: 1,
    summary: 'Blocks Stupefy and reflects 14 DMG back; broken by Expelliarmus.',
  },
  {
    id: 'disarm',
    name: 'Expelliarmus',
    incantation: 'Breaker · 28 DMG',
    cost: 2,
    summary: 'Shatters Protego shields for 28 DMG; trades evenly into Strike.',
  },
  {
    id: 'focus',
    name: 'Episkey',
    incantation: 'Restore +16 HP & +2 Focus',
    cost: 0,
    summary: 'Mends wounds and restores Focus for high-tier spells.',
  },
];

export interface DuelOpponent {
  level: number;
  name: string;
  title: string;
  maxHp: number;
  playerMaxHp: number;
  tendency: 'balanced' | 'aggressive' | 'defensive' | 'tactical' | 'master';
}

export const DUEL_LEVELS: DuelOpponent[] = [
  {
    level: 1,
    name: 'Alden Finch',
    title: 'House Prefect',
    maxHp: 60,
    playerMaxHp: 80,
    tendency: 'balanced',
  },
  {
    level: 2,
    name: 'Cassia Vane',
    title: 'Dueling Club Champion',
    maxHp: 80,
    playerMaxHp: 85,
    tendency: 'aggressive',
  },
  {
    level: 3,
    name: 'Corvus Rook',
    title: 'Iron Shield Adept',
    maxHp: 95,
    playerMaxHp: 90,
    tendency: 'defensive',
  },
  {
    level: 4,
    name: 'Vespera Noctis',
    title: 'Shadow Auror',
    maxHp: 115,
    playerMaxHp: 95,
    tendency: 'tactical',
  },
  {
    level: 5,
    name: 'Archmage Aurelius',
    title: 'Grand Sorcerer',
    maxHp: 135,
    playerMaxHp: 100,
    tendency: 'master',
  },
];

export function chooseEnemyDuelSpell(
  opponent: DuelOpponent,
  enemyHp: number,
  enemyFocus: number,
  turn: number,
  randomFn: () => number = Math.random
): DuelSpellId {
  const roll = randomFn();
  if (enemyHp < opponent.maxHp * 0.35 && roll < 0.45) {
    return 'focus';
  }
  if (opponent.tendency === 'aggressive') {
    if (enemyFocus >= 2 && roll < 0.45) return 'disarm';
    return roll < 0.78 ? 'strike' : 'shield';
  }
  if (opponent.tendency === 'defensive') {
    if (enemyFocus >= 1 && roll < 0.48) return 'shield';
    if (enemyFocus >= 2 && roll < 0.72) return 'disarm';
    return 'strike';
  }
  if (opponent.tendency === 'tactical' || opponent.tendency === 'master') {
    if (turn % 3 === 0 && enemyFocus >= 2) return 'disarm';
    if (enemyFocus >= 1 && roll < 0.35) return 'shield';
    if (roll < 0.75) return 'strike';
    return 'focus';
  }
  if (enemyFocus >= 1 && roll < 0.25) return 'shield';
  if (roll < 0.7) return 'strike';
  return 'focus';
}

export interface DuelTurnResolution {
  playerHp: number;
  enemyHp: number;
  playerFocus: number;
  enemyFocus: number;
  playerSpell: DuelSpellId;
  enemySpell: DuelSpellId;
  summary: string;
}

export function resolveDuelTurn(
  playerHp: number,
  enemyHp: number,
  playerFocus: number,
  enemyFocus: number,
  playerSpell: DuelSpellId,
  enemySpell: DuelSpellId,
  playerMaxHp: number,
  enemyMaxHp: number
): DuelTurnResolution {
  let pHp = playerHp;
  let eHp = enemyHp;
  let pFocus = Math.max(0, playerFocus - DUEL_SPELLS.find((s) => s.id === playerSpell)!.cost);
  let eFocus = Math.max(0, enemyFocus - DUEL_SPELLS.find((s) => s.id === enemySpell)!.cost);

  const notes: string[] = [];

  if (playerSpell === 'focus') {
    pHp = Math.min(playerMaxHp, pHp + 16);
    pFocus = Math.min(4, pFocus + 2);
    notes.push('You cast Episkey (+16 HP, +2 Focus)');
  }
  if (enemySpell === 'focus') {
    eHp = Math.min(enemyMaxHp, eHp + 14);
    eFocus = Math.min(4, eFocus + 2);
    notes.push('Opponent restores (+14 HP)');
  }

  if (playerSpell === 'strike') {
    if (enemySpell === 'shield') {
      pHp -= 14;
      notes.push('Your Stupefy bounced off Protego (-14 HP to you)');
    } else {
      const dmg = enemySpell === 'focus' ? 28 : 22;
      eHp -= dmg;
      pFocus = Math.min(4, pFocus + 1);
      notes.push(`Stupefy landed for ${dmg} DMG`);
    }
  }

  if (playerSpell === 'disarm') {
    const dmg = enemySpell === 'shield' ? 32 : 26;
    eHp -= dmg;
    notes.push(
      enemySpell === 'shield'
        ? `Expelliarmus shattered their Protego for ${dmg} DMG`
        : `Expelliarmus struck for ${dmg} DMG`
    );
  }

  if (enemySpell === 'strike') {
    if (playerSpell === 'shield') {
      eHp -= 14;
      notes.push('Your Protego reflected their bolt (-14 HP to foe)');
    } else {
      const dmg = playerSpell === 'focus' ? 25 : 20;
      pHp -= dmg;
      eFocus = Math.min(4, eFocus + 1);
      notes.push(`Foe’s Stupefy hit you for ${dmg} DMG`);
    }
  }

  if (enemySpell === 'disarm') {
    const dmg = playerSpell === 'shield' ? 30 : 24;
    pHp -= dmg;
    notes.push(
      playerSpell === 'shield'
        ? `Foe’s Expelliarmus broke your Protego (-${dmg} HP)`
        : `Foe’s Expelliarmus hit for ${dmg} DMG`
    );
  }

  if (playerSpell === 'shield' && enemySpell !== 'strike' && enemySpell !== 'disarm') {
    notes.push('You raised Protego defensively');
  }

  return {
    playerHp: Math.max(0, pHp),
    enemyHp: Math.max(0, eHp),
    playerFocus: pFocus,
    enemyFocus: eFocus,
    playerSpell,
    enemySpell,
    summary: notes.join(' · '),
  };
}

// ---------------------------------------------------------------------------
// 3. Arcane Conduits (5 Progressive Rotating Pipe Levels)
// ---------------------------------------------------------------------------

export type PipeShape = 'straight' | 'corner' | 'tee' | 'source' | 'target' | 'empty';

export interface ConduitTile {
  shape: PipeShape;
  rotation: 0 | 90 | 180 | 270;
  fixed?: boolean;
}

export interface ConduitLevel {
  level: number;
  name: string;
  size: number;
  parMoves: number;
  tiles: ConduitTile[][];
}

// Directions: 0 = North, 1 = East, 2 = South, 3 = West
const BASE_PORTS: Record<PipeShape, number[]> = {
  straight: [0, 2],
  corner: [0, 1],
  tee: [0, 1, 2],
  source: [1], // points East at rotation 0
  target: [3], // receives from West at rotation 0
  empty: [],
};

export function getTileOpenings(tile: ConduitTile): number[] {
  const step = (tile.rotation / 90) % 4;
  return BASE_PORTS[tile.shape].map((d) => (d + step) % 4);
}

const DIR_DELTAS: Record<number, { dr: number; dc: number; opposite: number }> = {
  0: { dr: -1, dc: 0, opposite: 2 },
  1: { dr: 0, dc: 1, opposite: 3 },
  2: { dr: 1, dc: 0, opposite: 0 },
  3: { dr: 0, dc: -1, opposite: 1 },
};

export function computeConduitFlow(grid: ConduitTile[][]): {
  powered: Set<string>;
  solved: boolean;
} {
  const size = grid.length;
  const powered = new Set<string>();
  const queue: { r: number; c: number }[] = [];
  let targetKey = '';

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (grid[r][c].shape === 'source') {
        const key = `${r},${c}`;
        powered.add(key);
        queue.push({ r, c });
      }
      if (grid[r][c].shape === 'target') {
        targetKey = `${r},${c}`;
      }
    }
  }

  while (queue.length > 0) {
    const curr = queue.shift()!;
    const openings = getTileOpenings(grid[curr.r][curr.c]);
    for (const dir of openings) {
      const { dr, dc, opposite } = DIR_DELTAS[dir];
      const nr = curr.r + dr;
      const nc = curr.c + dc;
      if (nr < 0 || nr >= size || nc < 0 || nc >= size) continue;
      const neighbor = grid[nr][nc];
      const nKey = `${nr},${nc}`;
      if (powered.has(nKey)) continue;
      if (getTileOpenings(neighbor).includes(opposite)) {
        powered.add(nKey);
        queue.push({ r: nr, c: nc });
      }
    }
  }

  return { powered, solved: targetKey !== '' && powered.has(targetKey) };
}

export const CONDUIT_LEVELS: ConduitLevel[] = [
  {
    level: 1,
    name: 'Sunbeam Channel',
    size: 4,
    parMoves: 5,
    tiles: [
      [
        { shape: 'source', rotation: 0, fixed: true },
        { shape: 'straight', rotation: 0 },
        { shape: 'corner', rotation: 90 },
        { shape: 'empty', rotation: 0, fixed: true },
      ],
      [
        { shape: 'empty', rotation: 0, fixed: true },
        { shape: 'empty', rotation: 0, fixed: true },
        { shape: 'straight', rotation: 90 },
        { shape: 'empty', rotation: 0, fixed: true },
      ],
      [
        { shape: 'empty', rotation: 0, fixed: true },
        { shape: 'empty', rotation: 0, fixed: true },
        { shape: 'corner', rotation: 180 },
        { shape: 'target', rotation: 0, fixed: true },
      ],
      [
        { shape: 'empty', rotation: 0, fixed: true },
        { shape: 'empty', rotation: 0, fixed: true },
        { shape: 'empty', rotation: 0, fixed: true },
        { shape: 'empty', rotation: 0, fixed: true },
      ],
    ],
  },
  {
    level: 2,
    name: 'Astral Elbow',
    size: 4,
    parMoves: 8,
    tiles: [
      [
        { shape: 'source', rotation: 90, fixed: true },
        { shape: 'corner', rotation: 0 },
        { shape: 'straight', rotation: 90 },
        { shape: 'corner', rotation: 0 },
      ],
      [
        { shape: 'corner', rotation: 180 },
        { shape: 'corner', rotation: 270 },
        { shape: 'empty', rotation: 0, fixed: true },
        { shape: 'straight', rotation: 90 },
      ],
      [
        { shape: 'empty', rotation: 0, fixed: true },
        { shape: 'empty', rotation: 0, fixed: true },
        { shape: 'corner', rotation: 0 },
        { shape: 'corner', rotation: 90 },
      ],
      [
        { shape: 'empty', rotation: 0, fixed: true },
        { shape: 'empty', rotation: 0, fixed: true },
        { shape: 'corner', rotation: 180 },
        { shape: 'target', rotation: 0, fixed: true },
      ],
    ],
  },
  {
    level: 3,
    name: 'Bell Tower Junction',
    size: 5,
    parMoves: 11,
    tiles: [
      [
        { shape: 'source', rotation: 0, fixed: true },
        { shape: 'tee', rotation: 180 },
        { shape: 'straight', rotation: 0 },
        { shape: 'corner', rotation: 0 },
        { shape: 'empty', rotation: 0, fixed: true },
      ],
      [
        { shape: 'empty', rotation: 0, fixed: true },
        { shape: 'straight', rotation: 90 },
        { shape: 'empty', rotation: 0, fixed: true },
        { shape: 'straight', rotation: 90 },
        { shape: 'empty', rotation: 0, fixed: true },
      ],
      [
        { shape: 'empty', rotation: 0, fixed: true },
        { shape: 'corner', rotation: 90 },
        { shape: 'straight', rotation: 0 },
        { shape: 'tee', rotation: 270 },
        { shape: 'corner', rotation: 0 },
      ],
      [
        { shape: 'empty', rotation: 0, fixed: true },
        { shape: 'empty', rotation: 0, fixed: true },
        { shape: 'empty', rotation: 0, fixed: true },
        { shape: 'empty', rotation: 0, fixed: true },
        { shape: 'straight', rotation: 90 },
      ],
      [
        { shape: 'empty', rotation: 0, fixed: true },
        { shape: 'empty', rotation: 0, fixed: true },
        { shape: 'empty', rotation: 0, fixed: true },
        { shape: 'empty', rotation: 0, fixed: true },
        { shape: 'target', rotation: 90, fixed: true },
      ],
    ],
  },
  {
    level: 4,
    name: 'Observatory Relay',
    size: 5,
    parMoves: 13,
    tiles: [
      [
        { shape: 'source', rotation: 90, fixed: true },
        { shape: 'empty', rotation: 0, fixed: true },
        { shape: 'corner', rotation: 0 },
        { shape: 'straight', rotation: 0 },
        { shape: 'corner', rotation: 90 },
      ],
      [
        { shape: 'straight', rotation: 90 },
        { shape: 'empty', rotation: 0, fixed: true },
        { shape: 'straight', rotation: 90 },
        { shape: 'empty', rotation: 0, fixed: true },
        { shape: 'straight', rotation: 90 },
      ],
      [
        { shape: 'corner', rotation: 90 },
        { shape: 'straight', rotation: 0 },
        { shape: 'tee', rotation: 0 },
        { shape: 'empty', rotation: 0, fixed: true },
        { shape: 'straight', rotation: 90 },
      ],
      [
        { shape: 'empty', rotation: 0, fixed: true },
        { shape: 'empty', rotation: 0, fixed: true },
        { shape: 'empty', rotation: 0, fixed: true },
        { shape: 'empty', rotation: 0, fixed: true },
        { shape: 'straight', rotation: 90 },
      ],
      [
        { shape: 'empty', rotation: 0, fixed: true },
        { shape: 'empty', rotation: 0, fixed: true },
        { shape: 'empty', rotation: 0, fixed: true },
        { shape: 'empty', rotation: 0, fixed: true },
        { shape: 'target', rotation: 90, fixed: true },
      ],
    ],
  },
  {
    level: 5,
    name: 'Grand Leyline Nexus',
    size: 6,
    parMoves: 16,
    tiles: [
      [
        { shape: 'source', rotation: 0, fixed: true },
        { shape: 'straight', rotation: 0 },
        { shape: 'corner', rotation: 90 },
        { shape: 'empty', rotation: 0, fixed: true },
        { shape: 'empty', rotation: 0, fixed: true },
        { shape: 'empty', rotation: 0, fixed: true },
      ],
      [
        { shape: 'empty', rotation: 0, fixed: true },
        { shape: 'empty', rotation: 0, fixed: true },
        { shape: 'straight', rotation: 90 },
        { shape: 'empty', rotation: 0, fixed: true },
        { shape: 'corner', rotation: 0 },
        { shape: 'corner', rotation: 90 },
      ],
      [
        { shape: 'empty', rotation: 0, fixed: true },
        { shape: 'empty', rotation: 0, fixed: true },
        { shape: 'corner', rotation: 90 },
        { shape: 'straight', rotation: 0 },
        { shape: 'corner', rotation: 180 },
        { shape: 'straight', rotation: 90 },
      ],
      [
        { shape: 'empty', rotation: 0, fixed: true },
        { shape: 'empty', rotation: 0, fixed: true },
        { shape: 'empty', rotation: 0, fixed: true },
        { shape: 'empty', rotation: 0, fixed: true },
        { shape: 'empty', rotation: 0, fixed: true },
        { shape: 'straight', rotation: 90 },
      ],
      [
        { shape: 'empty', rotation: 0, fixed: true },
        { shape: 'empty', rotation: 0, fixed: true },
        { shape: 'empty', rotation: 0, fixed: true },
        { shape: 'empty', rotation: 0, fixed: true },
        { shape: 'empty', rotation: 0, fixed: true },
        { shape: 'straight', rotation: 90 },
      ],
      [
        { shape: 'empty', rotation: 0, fixed: true },
        { shape: 'empty', rotation: 0, fixed: true },
        { shape: 'empty', rotation: 0, fixed: true },
        { shape: 'empty', rotation: 0, fixed: true },
        { shape: 'empty', rotation: 0, fixed: true },
        { shape: 'target', rotation: 90, fixed: true },
      ],
    ],
  },
];

//Wait: verify Conduit Level 1-5 solvability cleanly with a helper or fix Level 4/5 paths!
export function cloneConduitGrid(tiles: ConduitTile[][]): ConduitTile[][] {
  return tiles.map((row) => row.map((t) => ({ ...t })));
}
