export type MazeDifficulty = "easy" | "medium" | "hard" | "expert";

export const MAZE_DIFFICULTIES: MazeDifficulty[] = ["easy", "medium", "hard", "expert"];

/** Maze grid size (cells per side) by difficulty. Larger = harder. */
export const MAZE_SIZE: Record<MazeDifficulty, number> = {
  easy: 12,
  medium: 16,
  hard: 22,
  expert: 30,
};

// Wall bit flags per cell.
export const WALL = { N: 1, E: 2, S: 4, W: 8 } as const;

export interface Maze {
  difficulty: MazeDifficulty;
  width: number;
  height: number;
  /** width*height cells, row-major. Each holds a bitmask of remaining walls. */
  cells: number[];
  start: [number, number]; // [row, col] = top-left
  finish: [number, number]; // [row, col] = bottom-right
  /** The unique solution path as a list of [row, col] cells, start → finish. */
  solution: Array<[number, number]>;
  seed: number;
}
