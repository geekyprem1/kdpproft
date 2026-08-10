/**
 * Deterministic maze generator (recursive backtracking).
 *
 * Recursive backtracking carves a "perfect maze" — a spanning tree where exactly
 * one path connects any two cells. That guarantees every maze is solvable with a
 * single valid path from start to finish. Same seed → identical maze.
 */

import { createRng, hashSeed, type Rng } from "../../util/prng";
import { MAZE_SIZE, WALL, type MazeDifficulty, type Maze } from "./types";

interface Dir {
  bit: number;
  opp: number;
  dr: number;
  dc: number;
}
const DIRS: Dir[] = [
  { bit: WALL.N, opp: WALL.S, dr: -1, dc: 0 },
  { bit: WALL.E, opp: WALL.W, dr: 0, dc: 1 },
  { bit: WALL.S, opp: WALL.N, dr: 1, dc: 0 },
  { bit: WALL.W, opp: WALL.E, dr: 0, dc: -1 },
];

const ALL_WALLS = WALL.N | WALL.E | WALL.S | WALL.W;

/** Carve a perfect maze with an iterative DFS (safe for large grids). */
function carve(width: number, height: number, rng: Rng): number[] {
  const cells = new Array(width * height).fill(ALL_WALLS);
  const visited = new Array(width * height).fill(false);
  const idx = (r: number, c: number) => r * width + c;

  const stack: Array<[number, number]> = [[0, 0]];
  visited[idx(0, 0)] = true;

  while (stack.length) {
    const [r, c] = stack[stack.length - 1];
    const options = rng
      .shuffle(DIRS)
      .filter((d) => {
        const nr = r + d.dr;
        const nc = c + d.dc;
        return nr >= 0 && nr < height && nc >= 0 && nc < width && !visited[idx(nr, nc)];
      });

    if (options.length === 0) {
      stack.pop();
      continue;
    }
    const d = options[0];
    const nr = r + d.dr;
    const nc = c + d.dc;
    cells[idx(r, c)] &= ~d.bit; // open wall on this cell
    cells[idx(nr, nc)] &= ~d.opp; // and the matching wall on the neighbor
    visited[idx(nr, nc)] = true;
    stack.push([nr, nc]);
  }

  return cells;
}

/** BFS the unique path between two cells through open passages. */
export function solveMaze(
  cells: number[],
  width: number,
  height: number,
  start: [number, number],
  finish: [number, number]
): Array<[number, number]> {
  const idx = (r: number, c: number) => r * width + c;
  const prev = new Array(width * height).fill(-1);
  const seen = new Array(width * height).fill(false);
  const queue: number[] = [idx(start[0], start[1])];
  seen[queue[0]] = true;
  const target = idx(finish[0], finish[1]);

  while (queue.length) {
    const cur = queue.shift()!;
    if (cur === target) break;
    const r = Math.floor(cur / width);
    const c = cur % width;
    for (const d of DIRS) {
      if (cells[cur] & d.bit) continue; // wall blocks this direction
      const nr = r + d.dr;
      const nc = c + d.dc;
      if (nr < 0 || nr >= height || nc < 0 || nc >= width) continue;
      const ni = idx(nr, nc);
      if (seen[ni]) continue;
      seen[ni] = true;
      prev[ni] = cur;
      queue.push(ni);
    }
  }

  const path: Array<[number, number]> = [];
  let cur = target;
  if (!seen[cur]) return path; // unreachable (shouldn't happen for a perfect maze)
  while (cur !== -1) {
    path.push([Math.floor(cur / width), cur % width]);
    cur = prev[cur];
  }
  return path.reverse();
}

export interface GenerateMazeOptions {
  difficulty: MazeDifficulty;
  seed: number;
}

export function generateMaze(opts: GenerateMazeOptions): Maze {
  const size = MAZE_SIZE[opts.difficulty];
  const rng = createRng(opts.seed);
  const cells = carve(size, size, rng);
  const start: [number, number] = [0, 0];
  const finish: [number, number] = [size - 1, size - 1];
  const solution = solveMaze(cells, size, size, start, finish);
  if (solution.length === 0) {
    throw new Error(`Maze has no solution (seed ${opts.seed})`);
  }
  return {
    difficulty: opts.difficulty,
    width: size,
    height: size,
    cells,
    start,
    finish,
    solution,
    seed: opts.seed,
  };
}

export { hashSeed };
