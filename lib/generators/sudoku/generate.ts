/**
 * Deterministic Sudoku generator.
 *
 * Same seed → identical puzzle and solution. A full solved grid is built first
 * (seeded backtracking), then clues are removed one at a time, keeping the
 * uniqueness invariant: a clue is only removed if the puzzle still has exactly
 * one solution. The result is therefore guaranteed valid and uniquely solvable.
 */

import { createRng, hashSeed, type Rng } from "../../util/prng";
import { countSolutions, hasUniqueSolution } from "./solver";
import { TARGET_GIVENS, type SudokuDifficulty, type SudokuPuzzle } from "./types";

const boxOf = (r: number, c: number): number => Math.floor(r / 3) * 3 + Math.floor(c / 3);

/** Build a complete, valid, random (seeded) solved grid. */
function fillFull(rng: Rng): number[] {
  const g = new Array(81).fill(0);
  const rows = new Array(9).fill(0);
  const cols = new Array(9).fill(0);
  const boxes = new Array(9).fill(0);
  const digits = [1, 2, 3, 4, 5, 6, 7, 8, 9];

  const fill = (pos: number): boolean => {
    if (pos === 81) return true;
    const r = (pos / 9) | 0;
    const c = pos % 9;
    const b = boxOf(r, c);
    const used = rows[r] | cols[c] | boxes[b];
    for (const v of rng.shuffle(digits)) {
      const bit = 1 << v;
      if (used & bit) continue;
      g[pos] = v;
      rows[r] |= bit;
      cols[c] |= bit;
      boxes[b] |= bit;
      if (fill(pos + 1)) return true;
      g[pos] = 0;
      rows[r] &= ~bit;
      cols[c] &= ~bit;
      boxes[b] &= ~bit;
    }
    return false;
  };

  fill(0);
  return g;
}

/** Remove clues while keeping a unique solution, aiming for `targetGivens`. */
function digHoles(
  solution: number[],
  rng: Rng,
  targetGivens: number
): { puzzle: number[]; givens: number } {
  const puzzle = solution.slice();
  let givens = 81;
  for (const pos of rng.shuffle([...Array(81).keys()])) {
    if (givens <= targetGivens) break;
    const backup = puzzle[pos];
    if (backup === 0) continue;
    puzzle[pos] = 0;
    if (countSolutions(puzzle, 2) === 1) {
      givens--;
    } else {
      puzzle[pos] = backup; // removal broke uniqueness — keep the clue
    }
  }
  return { puzzle, givens };
}

export interface GenerateSudokuOptions {
  difficulty: SudokuDifficulty;
  seed: number;
}

/** Generate one deterministic, uniquely-solvable Sudoku puzzle. */
export function generateSudoku(opts: GenerateSudokuOptions): SudokuPuzzle {
  const rng = createRng(opts.seed);
  const solution = fillFull(rng);
  const { puzzle, givens } = digHoles(solution, rng, TARGET_GIVENS[opts.difficulty]);

  // Safety: never emit a puzzle that isn't uniquely solvable.
  if (!hasUniqueSolution(puzzle)) {
    throw new Error(`Generated puzzle is not unique (seed ${opts.seed})`);
  }

  return { difficulty: opts.difficulty, puzzle, solution, givens, seed: opts.seed };
}

export { hashSeed };
