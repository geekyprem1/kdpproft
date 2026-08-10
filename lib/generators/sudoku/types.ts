export type SudokuDifficulty = "easy" | "medium" | "hard" | "expert";

export const SUDOKU_DIFFICULTIES: SudokuDifficulty[] = [
  "easy",
  "medium",
  "hard",
  "expert",
];

/** Target number of givens (clues) per difficulty. Lower = harder. */
export const TARGET_GIVENS: Record<SudokuDifficulty, number> = {
  easy: 40,
  medium: 34,
  hard: 30,
  expert: 26,
};

export interface SudokuPuzzle {
  difficulty: SudokuDifficulty;
  /** 81 cells, row-major. 0 = blank. */
  puzzle: number[];
  /** 81 cells, the unique solution. */
  solution: number[];
  /** Number of given clues in the puzzle. */
  givens: number;
  seed: number;
}
