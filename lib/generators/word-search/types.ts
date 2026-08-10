export type Difficulty = "easy" | "medium" | "hard";

/** 8 compass directions. */
export type Direction = "E" | "S" | "SE" | "NE" | "W" | "N" | "NW" | "SW";

export const DIRECTION_VECTORS: Record<Direction, [number, number]> = {
  E: [0, 1],
  W: [0, -1],
  S: [1, 0],
  N: [-1, 0],
  SE: [1, 1],
  SW: [1, -1],
  NE: [-1, 1],
  NW: [-1, -1],
};

/** Allowed directions per difficulty (harder = more directions + reversals). */
export const DIFFICULTY_DIRECTIONS: Record<Difficulty, Direction[]> = {
  easy: ["E", "S"],
  medium: ["E", "S", "SE", "NE"],
  hard: ["E", "S", "SE", "NE", "W", "N", "NW", "SW"],
};

export interface PlacedWord {
  word: string;
  row: number; // start row
  col: number; // start col
  dir: Direction;
}

export interface WordSearchPuzzle {
  theme: string;
  difficulty: Difficulty;
  size: number;
  /** size×size grid of uppercase letters. */
  grid: string[][];
  /** words actually placed (with coordinates for the solution). */
  words: PlacedWord[];
  /** words requested but that could not be placed (diagnostics). */
  skipped: string[];
  seed: number;
}

export interface WordSearchInput {
  theme: string;
  /** number of puzzles in the book. */
  puzzleCount: number;
  /** grid dimension (size×size). */
  gridSize: number;
  difficulty: Difficulty;
  /** words to place per puzzle. */
  wordsPerPuzzle: number;
  /** base seed; each puzzle uses baseSeed + index for reproducible variety. */
  seed?: number;
}
