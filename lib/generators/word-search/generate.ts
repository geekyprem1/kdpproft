/**
 * Deterministic word-search puzzle generator.
 *
 * Same input (theme, size, difficulty, word count, seed) → identical puzzle,
 * every time. No randomness escapes the seeded RNG.
 */

import { createRng, type Rng } from "../../util/prng";
import { resolveBank } from "./word-banks";
import {
  DIFFICULTY_DIRECTIONS,
  DIRECTION_VECTORS,
  type Difficulty,
  type Direction,
  type PlacedWord,
  type WordSearchPuzzle,
} from "./types";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const PLACEMENT_ATTEMPTS = 400;

function emptyGrid(size: number): string[][] {
  return Array.from({ length: size }, () => Array<string>(size).fill(""));
}

/** Choose the words for one puzzle from a pool: eligible, deduped, shuffled. */
function selectWords(
  pool: string[],
  size: number,
  count: number,
  rng: Rng
): string[] {
  const eligible = Array.from(new Set(pool.map((w) => w.toUpperCase())))
    .filter((w) => /^[A-Z]+$/.test(w) && w.length <= size);
  return rng.shuffle(eligible).slice(0, count);
}

/** Can `word` be placed at (row,col) heading `dir` without conflict? */
function fits(
  grid: string[][],
  size: number,
  word: string,
  row: number,
  col: number,
  dir: Direction
): boolean {
  const [dr, dc] = DIRECTION_VECTORS[dir];
  for (let i = 0; i < word.length; i++) {
    const r = row + dr * i;
    const c = col + dc * i;
    if (r < 0 || r >= size || c < 0 || c >= size) return false;
    const cell = grid[r][c];
    if (cell !== "" && cell !== word[i]) return false; // overlap only on same letter
  }
  return true;
}

function place(
  grid: string[][],
  word: string,
  row: number,
  col: number,
  dir: Direction
): void {
  const [dr, dc] = DIRECTION_VECTORS[dir];
  for (let i = 0; i < word.length; i++) {
    grid[row + dr * i][col + dc * i] = word[i];
  }
}

/** Generate a single deterministic puzzle. */
export function generatePuzzle(opts: {
  theme: string;
  size: number;
  difficulty: Difficulty;
  wordCount: number;
  seed: number;
  /** Optional word pool (e.g. AI-generated). Defaults to the theme's bank. */
  words?: string[];
}): WordSearchPuzzle {
  const { theme, size, difficulty, wordCount, seed } = opts;
  if (size < 5) throw new Error("Grid size must be at least 5.");

  const rng = createRng(seed);
  const dirs = DIFFICULTY_DIRECTIONS[difficulty];
  const grid = emptyGrid(size);
  const placed: PlacedWord[] = [];
  const skipped: string[] = [];

  // Pick the word set deterministically, then place longest-first: long words
  // are hardest to fit and have the best odds on an empty grid.
  const pool = opts.words && opts.words.length ? opts.words : resolveBank(theme).words;
  const words = selectWords(pool, size, wordCount, rng).sort(
    (a, b) => b.length - a.length
  );

  for (const word of words) {
    let done = false;
    for (let attempt = 0; attempt < PLACEMENT_ATTEMPTS && !done; attempt++) {
      const dir = rng.pick(dirs);
      const row = rng.int(size);
      const col = rng.int(size);
      if (fits(grid, size, word, row, col, dir)) {
        place(grid, word, row, col, dir);
        placed.push({ word, row, col, dir });
        done = true;
      }
    }
    if (!done) skipped.push(word);
  }

  // Fill blanks with deterministic random letters.
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (grid[r][c] === "") grid[r][c] = ALPHABET[rng.int(26)];
    }
  }

  return { theme: resolveBank(theme).theme, difficulty, size, grid, words: placed, skipped, seed };
}

/** All grid cells (as "r,c" keys) covered by a placed word — for solutions. */
export function solutionCells(word: PlacedWord): Set<string> {
  const cells = new Set<string>();
  const [dr, dc] = DIRECTION_VECTORS[word.dir];
  for (let i = 0; i < word.word.length; i++) {
    cells.add(`${word.row + dr * i},${word.col + dc * i}`);
  }
  return cells;
}
