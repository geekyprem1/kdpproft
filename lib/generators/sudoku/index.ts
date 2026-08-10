export * from "./types";
export { generateSudoku, type GenerateSudokuOptions } from "./generate";
export {
  countSolutions,
  hasUniqueSolution,
  isValidComplete,
  puzzleMatchesSolution,
} from "./solver";
export { renderSudokuPuzzleBody, renderSudokuSolutionBody } from "./render";
export {
  resolveSudokuConfig,
  generateSudokuPuzzles,
  buildSudokuInteriorPages,
  buildSudokuBook,
  MIN_SUDOKU_PUZZLES,
  type SudokuBookOptions,
  type ResolvedSudokuConfig,
  type SudokuBookResult,
} from "./book";
