export * from "./types";
export { generateMaze, solveMaze, type GenerateMazeOptions } from "./generate";
export { renderMazePageBody, renderMazeSolutionBody } from "./render";
export {
  resolveMazeConfig,
  generateMazes,
  buildMazeInteriorPages,
  buildMazeBook,
  MIN_MAZES,
  type MazeBookOptions,
  type ResolvedMazeConfig,
  type MazeBookResult,
} from "./book";
