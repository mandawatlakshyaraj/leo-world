

export interface MatchSymbol {
  key: string;
  glyph: string;
  label: string;
}

export const MATCH_SYMBOLS: MatchSymbol[] = [
  { key: 'wand', glyph: '🪄', label: 'Elder Wand' },
  { key: 'owl', glyph: '🦉', label: 'Snowy Owl' },
  { key: 'bolt', glyph: '⚡', label: 'Lightning Crest' },
  { key: 'potion', glyph: '🧪', label: 'Felix Vial' },
  { key: 'lion', glyph: '🦁', label: 'Gryphon Crest' },
  { key: 'scroll', glyph: '📜', label: 'Ancient Scroll' },
  { key: 'crystal', glyph: '🔮', label: 'Crystal Orb' },
  { key: 'key', glyph: '🗝️', label: 'Winged Key' },
  { key: 'candle', glyph: '🕯️', label: 'Floating Candle' },
  { key: 'crown', glyph: '👑', label: 'Lost Diadem' },
  { key: 'broom', glyph: '🧹', label: 'Nimbus Broom' },
  { key: 'moon', glyph: '🌙', label: 'Astral Crescent' },
];

export interface MatchLevelConfig {
  level: number;
  name: string;
  pairs: number;
  columns: number;
  parMoves: number;
  maxMoves: number | null;
}

export const MATCH_LEVELS: MatchLevelConfig[] = [
  { level: 1, name: 'Novice Chamber', pairs: 6, columns: 4, parMoves: 10, maxMoves: null },
  { level: 2, name: 'Candlelit Hall', pairs: 8, columns: 4, parMoves: 14, maxMoves: null },
  { level: 3, name: 'Restricted Section', pairs: 10, columns: 5, parMoves: 18, maxMoves: 28 },
  { level: 4, name: 'Vault of Echoes', pairs: 12, columns: 6, parMoves: 22, maxMoves: 32 },
  { level: 5, name: 'Grand Astral Deck', pairs: 12, columns: 6, parMoves: 19, maxMoves: 25 },
];

export interface MatchCard {
  index: number;
  key: string;
  glyph: string;
  label: string;
  flipped: boolean;
  matched: boolean;
}

export function createMatchDeck(
  pairs = 6,
  randomFn: () => number = Math.random
): MatchCard[] {
  const chosen = MATCH_SYMBOLS.slice(0, Math.min(pairs, MATCH_SYMBOLS.length));
  const doubled = [...chosen, ...chosen];
  for (let i = doubled.length - 1; i > 0; i--) {
    const j = Math.floor(randomFn() * (i + 1));
    [doubled[i], doubled[j]] = [doubled[j], doubled[i]];
  }
  return doubled.map((sym, index) => ({
    index,
    key: sym.key,
    glyph: sym.glyph,
    label: sym.label,
    flipped: false,
    matched: false,
  }));
}

export function calculateMatchStars(moves: number, parMoves: number): number {
  if (moves <= parMoves) return 3;
  if (moves <= Math.ceil(parMoves * 1.4)) return 2;
  return 1;
}

export interface SpellQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  note: string;
}

export interface SpellTier {
  level: number;
  name: string;
  subtitle: string;
  passScore: number;
  questions: SpellQuestion[];
}

export const SPELL_TIERS: SpellTier[] = [
  {
    level: 1,
    name: 'First-Year Charms',
    subtitle: 'Foundational Wizarding Lore',
    passScore: 4,
    questions: [
      {
        id: 'house-lion',
        question: 'Which Hogwarts house is represented by a lion?',
        options: ['Gryffindor', 'Ravenclaw', 'Slytherin'],
        correctIndex: 0,
        note: 'Founded by Godric Gryffindor for courage and daring.',
      },
      {
        id: 'harrys-owl',
        question: 'What is the name of Harry’s snowy owl?',
        options: ['Crookshanks', 'Hedwig', 'Fawkes'],
        correctIndex: 1,
        note: 'Hedwig was an eleventh-birthday gift from Hagrid.',
      },
      {
        id: 'platform-express',
        question: 'Which platform does the Hogwarts Express depart from?',
        options: ['Platform 8¾', 'Platform 9¾', 'Platform 10¾'],
        correctIndex: 1,
        note: 'Hidden behind the enchanted barrier between platforms 9 and 10.',
      },
      {
        id: 'broom-sport',
        question: 'What wizarding sport is played high above the pitch on broomsticks?',
        options: ['Gobstones', 'Quidditch', 'Exploding Snap'],
        correctIndex: 1,
        note: 'Played with Chasers, Beaters, a Keeper, and a Seeker.',
      },
      {
        id: 'hermione-surname',
        question: 'What is Hermione’s surname?',
        options: ['Weasley', 'Lovegood', 'Granger'],
        correctIndex: 2,
        note: 'Hermione Jean Granger.',
      },
      {
        id: 'lumos-charm',
        question: 'Which incantation illuminates the tip of a wizard’s wand?',
        options: ['Nox', 'Lumos', 'Alohomora'],
        correctIndex: 1,
        note: 'Nox extinguishes the light created by Lumos.',
      },
    ],
  },
  {
    level: 2,
    name: 'O.W.L. Examination',
    subtitle: 'Intermediate Spells & Artifacts',
    passScore: 4,
    questions: [
      {
        id: 'felix-felicis',
        question: 'What nickname is given to the golden potion Felix Felicis?',
        options: ['Liquid Luck', 'Draught of Peace', 'Veritaserum'],
        correctIndex: 0,
        note: 'It grants extraordinary luck to the drinker for a limited span.',
      },
      {
        id: 'alohomora-charm',
        question: 'What does the charm “Alohomora” accomplish?',
        options: ['Summons distant objects', 'Unlocks sealed doors', 'Erases recent memory'],
        correctIndex: 1,
        note: 'Known as the Thief’s Friend in wizarding texts.',
      },
      {
        id: 'marauders-map',
        question: 'Which phrase activates the Marauder’s Map?',
        options: ['Mischief Managed', 'I solemnly swear that I am up to no good', 'Reveal your secrets'],
        correctIndex: 1,
        note: '“Mischief Managed” wipes the parchment blank again.',
      },
      {
        id: 'patronus-silver',
        question: 'Which creature forms Harry Potter’s corporeal Patronus?',
        options: ['Phoenix', 'Stag', 'Otter'],
        correctIndex: 1,
        note: 'A silver stag, mirroring his father James’s Animagus form.',
      },
      {
        id: 'three-broomsticks',
        question: 'Which village sits directly beside Hogwarts and hosts The Three Broomsticks?',
        options: ['Godric’s Hollow', 'Hogsmeade', 'Little Hangleton'],
        correctIndex: 1,
        note: 'Hogsmeade is the only all-wizarding village in Britain.',
      },
      {
        id: 'fawkes-species',
        question: 'What magical creature is Dumbledore’s companion Fawkes?',
        options: ['Hippogriff', 'Phoenix', 'Thestral'],
        correctIndex: 1,
        note: 'Phoenix tears possess remarkable restorative properties.',
      },
    ],
  },
  {
    level: 3,
    name: 'N.E.W.T. Mastery',
    subtitle: 'Deep Archive Trials',
    passScore: 5,
    questions: [
      {
        id: 'ravenclaw-diadem',
        question: 'What words are inscribed upon Rowena Ravenclaw’s lost diadem?',
        options: [
          'Courage beyond measure',
          'Wit beyond measure is man’s greatest treasure',
          'Wisdom lights the darkest tower',
        ],
        correctIndex: 1,
        note: 'Engraved along the silver band of the diadem.',
      },
      {
        id: 'bezoar-antidote',
        question: 'Where is a bezoar—an antidote to most poisons—taken from?',
        options: ['A dragon’s scale', 'A goat’s stomach', 'A mandrake root'],
        correctIndex: 1,
        note: 'Mentioned during the very first Potions lesson.',
      },
      {
        id: 'triwizard-lakes',
        question: 'Which plant grants temporary gills for underwater breathing?',
        options: ['Bubotuber', 'Gillyweed', 'Devil’s Snare'],
        correctIndex: 1,
        note: 'Used during the second task of the Triwizard Tournament.',
      },
      {
        id: 'ollivander-core',
        question: 'Which of these is NOT one of Ollivander’s three Supreme Cores?',
        options: ['Phoenix feather', 'Dragon heartstring', 'Veela hair'],
        correctIndex: 2,
        note: 'Ollivander relies on unicorn hair, dragon heartstring, and phoenix feather.',
      },
      {
        id: 'room-requirement',
        question: 'By what other name do the Hogwarts house-elves know the Room of Requirement?',
        options: ['The Come and Go Room', 'The Mirror Hall', 'The Shifting Gallery'],
        correctIndex: 0,
        note: 'Dobby introduces it as the Come and Go Room.',
      },
      {
        id: 'animagus-beetle',
        question: 'Which unregistered Animagus could transform into a beetle?',
        options: ['Minerva McGonagall', 'Rita Skeeter', 'Peter Pettigrew'],
        correctIndex: 1,
        note: 'Used to eavesdrop unnoticed for the Daily Prophet.',
      },
    ],
  },
];

export type MazeCell = 'start' | 'open' | 'wall' | 'goal' | 'key' | 'gate';

export interface MazeLevel {
  id: number;
  name: string;
  size: number;
  parSteps: number;
  fogRadius: number | null;
  grid: MazeCell[][];
  start: { r: number; c: number };
  goal: { r: number; c: number };
}

export const MAZE_LEVELS: MazeLevel[] = [
  {
    id: 1,
    name: 'Courtyard Hedge',
    size: 5,
    parSteps: 10,
    fogRadius: null,
    start: { r: 0, c: 0 },
    goal: { r: 4, c: 4 },
    grid: [
      ['start', 'open', 'wall', 'open', 'open'],
      ['wall', 'open', 'wall', 'open', 'wall'],
      ['open', 'open', 'open', 'open', 'wall'],
      ['open', 'wall', 'wall', 'open', 'open'],
      ['open', 'open', 'wall', 'wall', 'goal'],
    ],
  },
  {
    id: 2,
    name: 'Owlery Spiral',
    size: 6,
    parSteps: 14,
    fogRadius: null,
    start: { r: 0, c: 0 },
    goal: { r: 5, c: 5 },
    grid: [
      ['start', 'open', 'open', 'open', 'wall', 'open'],
      ['wall', 'wall', 'open', 'wall', 'open', 'open'],
      ['open', 'open', 'open', 'open', 'open', 'wall'],
      ['open', 'wall', 'wall', 'open', 'wall', 'open'],
      ['open', 'open', 'open', 'open', 'open', 'open'],
      ['wall', 'wall', 'open', 'wall', 'wall', 'goal'],
    ],
  },
  {
    id: 3,
    name: 'Dungeon Key Vault',
    size: 7,
    parSteps: 20,
    fogRadius: null,
    start: { r: 0, c: 0 },
    goal: { r: 6, c: 6 },
    grid: [
      ['start', 'open', 'open', 'wall', 'open', 'open', 'key'],
      ['wall', 'wall', 'open', 'wall', 'open', 'wall', 'open'],
      ['open', 'open', 'open', 'open', 'open', 'wall', 'open'],
      ['open', 'wall', 'wall', 'wall', 'open', 'wall', 'wall'],
      ['open', 'open', 'open', 'wall', 'open', 'open', 'open'],
      ['wall', 'wall', 'open', 'wall', 'wall', 'gate', 'open'],
      ['open', 'open', 'open', 'open', 'open', 'open', 'goal'],
    ],
  },
  {
    id: 4,
    name: 'Clocktower Wing',
    size: 8,
    parSteps: 26,
    fogRadius: null,
    start: { r: 0, c: 0 },
    goal: { r: 7, c: 7 },
    grid: [
      ['start', 'open', 'wall', 'open', 'open', 'open', 'wall', 'open'],
      ['open', 'open', 'wall', 'open', 'wall', 'open', 'wall', 'open'],
      ['open', 'wall', 'open', 'open', 'wall', 'open', 'open', 'open'],
      ['open', 'wall', 'open', 'wall', 'wall', 'wall', 'open', 'wall'],
      ['open', 'open', 'open', 'open', 'key', 'wall', 'open', 'open'],
      ['wall', 'wall', 'wall', 'open', 'wall', 'wall', 'wall', 'open'],
      ['open', 'open', 'open', 'open', 'open', 'gate', 'open', 'open'],
      ['open', 'wall', 'wall', 'wall', 'open', 'wall', 'wall', 'goal'],
    ],
  },
  {
    id: 5,
    name: 'Whispering Catacombs',
    size: 9,
    parSteps: 30,
    fogRadius: 2,
    start: { r: 0, c: 0 },
    goal: { r: 8, c: 8 },
    grid: [
      ['start', 'open', 'open', 'wall', 'open', 'open', 'open', 'wall', 'open'],
      ['wall', 'wall', 'open', 'wall', 'open', 'wall', 'open', 'wall', 'open'],
      ['open', 'open', 'open', 'open', 'open', 'wall', 'open', 'open', 'open'],
      ['open', 'wall', 'wall', 'wall', 'open', 'wall', 'wall', 'wall', 'open'],
      ['open', 'open', 'key', 'wall', 'open', 'open', 'open', 'wall', 'open'],
      ['wall', 'wall', 'open', 'wall', 'wall', 'wall', 'open', 'wall', 'open'],
      ['open', 'open', 'open', 'open', 'open', 'open', 'open', 'gate', 'open'],
      ['open', 'wall', 'wall', 'wall', 'wall', 'wall', 'open', 'wall', 'open'],
      ['open', 'open', 'open', 'open', 'open', 'open', 'open', 'wall', 'goal'],
    ],
  },
  {
    id: 6,
    name: 'Chamber of Stars',
    size: 10,
    parSteps: 36,
    fogRadius: 2,
    start: { r: 0, c: 0 },
    goal: { r: 9, c: 9 },
    grid: [
      ['start', 'open', 'open', 'open', 'wall', 'open', 'open', 'open', 'wall', 'open'],
      ['wall', 'wall', 'wall', 'open', 'wall', 'open', 'wall', 'open', 'wall', 'open'],
      ['open', 'open', 'open', 'open', 'open', 'open', 'wall', 'open', 'open', 'open'],
      ['open', 'wall', 'wall', 'wall', 'wall', 'open', 'wall', 'wall', 'wall', 'open'],
      ['open', 'open', 'open', 'key', 'wall', 'open', 'open', 'open', 'wall', 'open'],
      ['wall', 'wall', 'open', 'wall', 'wall', 'wall', 'wall', 'open', 'wall', 'open'],
      ['open', 'open', 'open', 'open', 'open', 'open', 'open', 'open', 'wall', 'open'],
      ['open', 'wall', 'wall', 'wall', 'wall', 'wall', 'open', 'wall', 'wall', 'open'],
      ['open', 'open', 'open', 'open', 'open', 'open', 'open', 'gate', 'open', 'open'],
      ['wall', 'wall', 'wall', 'open', 'wall', 'wall', 'open', 'wall', 'wall', 'goal'],
    ],
  },
];

export function countKeysInMaze(level: MazeLevel): number {
  let keys = 0;
  for (const row of level.grid) {
    for (const cell of row) {
      if (cell === 'key') keys++;
    }
  }
  return keys;
}

export interface MazeMoveResult {
  pos: { r: number; c: number };
  moved: boolean;
  blocked: boolean;
  blockedReason?: 'wall' | 'gate';
  collectedKey: boolean;
  won: boolean;
}

export function moveMazePlayer(
  level: MazeLevel,
  pos: { r: number; c: number },
  dr: number,
  dc: number,
  collectedKeys: string[] = []
): MazeMoveResult {
  const nr = pos.r + dr;
  const nc = pos.c + dc;
  if (nr < 0 || nr >= level.size || nc < 0 || nc >= level.size) {
    return { pos, moved: false, blocked: true, blockedReason: 'wall', collectedKey: false, won: false };
  }
  const targetCell = level.grid[nr][nc];
  if (targetCell === 'wall') {
    return { pos, moved: false, blocked: true, blockedReason: 'wall', collectedKey: false, won: false };
  }
  const totalKeys = countKeysInMaze(level);
  if (targetCell === 'gate' && collectedKeys.length < totalKeys) {
    return { pos, moved: false, blocked: true, blockedReason: 'gate', collectedKey: false, won: false };
  }

  const next = { r: nr, c: nc };
  const coordId = `${nr},${nc}`;
  const collectedKey = targetCell === 'key' && !collectedKeys.includes(coordId);
  const won = nr === level.goal.r && nc === level.goal.c;
  return { pos: next, moved: true, blocked: false, collectedKey, won };
}

export interface PotionVial {
  id: number;
  name: string;
  color: string;
  glow: string;
  freq: number;
}

export const POTION_VIALS: PotionVial[] = [
  { id: 0, name: 'Amethyst Draught', color: '#9d4edd', glow: 'rgba(157, 78, 221, 0.55)', freq: 392 },
  { id: 1, name: 'Moonstone Tonic', color: '#38bdf8', glow: 'rgba(56, 189, 248, 0.55)', freq: 440 },
  { id: 2, name: 'Verdant Elixir', color: '#34d399', glow: 'rgba(52, 211, 153, 0.55)', freq: 523.25 },
  { id: 3, name: 'Sunfire Brew', color: '#f4d27a', glow: 'rgba(244, 210, 122, 0.55)', freq: 587.33 },
  { id: 4, name: 'Phoenix Crimson', color: '#f43f5e', glow: 'rgba(244, 63, 94, 0.55)', freq: 659.25 },
  { id: 5, name: 'Obsidian Mist', color: '#c084fc', glow: 'rgba(192, 132, 252, 0.55)', freq: 783.99 },
];

export interface PotionLevelConfig {
  level: number;
  name: string;
  vialCount: number;
  sequenceLength: number;
  stepMs: number;
}

export const POTION_LEVELS: PotionLevelConfig[] = [
  { level: 1, name: 'Apprentice Tonic', vialCount: 4, sequenceLength: 3, stepMs: 620 },
  { level: 2, name: 'Moondew Draught', vialCount: 4, sequenceLength: 4, stepMs: 560 },
  { level: 3, name: 'Starlight Elixir', vialCount: 5, sequenceLength: 5, stepMs: 520 },
  { level: 4, name: 'Living Night', vialCount: 5, sequenceLength: 6, stepMs: 470 },
  { level: 5, name: 'Aether Distillate', vialCount: 6, sequenceLength: 7, stepMs: 430 },
  { level: 6, name: 'Philosopher’s Brew', vialCount: 6, sequenceLength: 8, stepMs: 390 },
];

export function generatePotionSequence(
  length: number,
  vialCount = 4,
  randomFn: () => number = Math.random
): number[] {
  return Array.from({ length }, () => Math.floor(randomFn() * vialCount));
}

export function evaluatePotionAttempt(
  sequence: number[],
  input: number[]
): 'incomplete' | 'correct' | 'wrong' {
  for (let i = 0; i < input.length; i++) {
    if (input[i] !== sequence[i]) {
      return 'wrong';
    }
  }
  if (input.length < sequence.length) {
    return 'incomplete';
  }
  return 'correct';
}

export interface CharacterBirthday {
  id: string;
  chapter: number;
  name: string;
  date: string;
  hintExample: string;
  image?: string;
  houseTone: string;
  monogram: string;
  title: string;
}

export const CHARACTER_BIRTHDAYS: CharacterBirthday[] = [
  {
    id: 'harry',
    chapter: 1,
    name: 'Harry Potter',
    date: 'July 31',
    hintExample: 'July 31',
    image: '/src/assets/images/wizard_harry_portrait_1795014459928.jpg',
    houseTone: 'from-rose-950/80 via-amber-950/60 to-slate-950',
    monogram: 'HP',
    title: 'Boy Who Lived',
  },
  {
    id: 'hermione',
    chapter: 1,
    name: 'Hermione Granger',
    date: 'September 19',
    hintExample: 'September 19',
    image: '/src/assets/images/wizard_hermione_portrait_1795014459970.jpg',
    houseTone: 'from-amber-950/80 via-purple-950/60 to-slate-950',
    monogram: 'HG',
    title: 'Brightest Witch of Her Age',
  },
  {
    id: 'ron',
    chapter: 1,
    name: 'Ron Weasley',
    date: 'March 1',
    hintExample: 'March 1',
    image: '/src/assets/images/wizard_ron_portrait_1795014461421.jpg',
    houseTone: 'from-orange-950/80 via-rose-950/60 to-slate-950',
    monogram: 'RW',
    title: 'Master of Wizard Chess',
  },
  {
    id: 'draco',
    chapter: 1,
    name: 'Draco Malfoy',
    date: 'June 5',
    hintExample: 'June 5',
    image: '/src/assets/images/wizard_draco_portrait_1795014461454.jpg',
    houseTone: 'from-emerald-950/80 via-slate-900/70 to-slate-950',
    monogram: 'DM',
    title: 'Slytherin Seeker',
  },
  {
    id: 'neville',
    chapter: 1,
    name: 'Neville Longbottom',
    date: 'July 30',
    hintExample: 'July 30',
    image: '/src/assets/images/wizard_neville_portrait_1795014461616.jpg',
    houseTone: 'from-teal-950/80 via-emerald-950/60 to-slate-950',
    monogram: 'NL',
    title: 'Herbology Scholar',
  },
  {
    id: 'mcgonagall',
    chapter: 2,
    name: 'Minerva McGonagall',
    date: 'October 4',
    hintExample: 'October 4',
    houseTone: 'from-amber-950/80 via-rose-950/70 to-slate-950',
    monogram: 'MM',
    title: 'Head of Transfiguration',
  },
  {
    id: 'snape',
    chapter: 2,
    name: 'Severus Snape',
    date: 'January 9',
    hintExample: 'January 9',
    houseTone: 'from-slate-900 via-emerald-950/60 to-black',
    monogram: 'SS',
    title: 'Potions Master',
  },
  {
    id: 'hagrid',
    chapter: 2,
    name: 'Rubeus Hagrid',
    date: 'December 6',
    hintExample: 'December 6',
    houseTone: 'from-amber-950/80 via-stone-900 to-slate-950',
    monogram: 'RH',
    title: 'Keeper of Keys & Grounds',
  },
  {
    id: 'sirius',
    chapter: 2,
    name: 'Sirius Black',
    date: 'November 3',
    hintExample: 'November 3',
    houseTone: 'from-indigo-950/80 via-slate-900 to-black',
    monogram: 'SB',
    title: 'Padfoot of the Order',
  },
  {
    id: 'luna',
    chapter: 2,
    name: 'Luna Lovegood',
    date: 'February 13',
    hintExample: 'February 13',
    houseTone: 'from-sky-950/80 via-indigo-950/60 to-slate-950',
    monogram: 'LL',
    title: 'Magizoologist & Dreamer',
  },
];

export function normalizeBirthdayDate(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[.,]/g, '')
    .replace(/(\d+)(st|nd|rd|th)\b/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

export function checkBirthdaySubmission(
  input: string,
  expectedDate: string
): 'empty' | 'correct' | 'wrong' {
  const trimmed = input.trim();
  if (!trimmed) {
    return 'empty';
  }
  const normalizedInput = normalizeBirthdayDate(trimmed);
  const normalizedExpected = normalizeBirthdayDate(expectedDate);
  if (normalizedInput === normalizedExpected) {
    return 'correct';
  }
  const parts = normalizedExpected.split(' ');
  if (parts.length === 2 && normalizedInput === `${parts[1]} ${parts[0]}`) {
    return 'correct';
  }
  return 'wrong';
}
