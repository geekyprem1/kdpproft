/**
 * Sudoku solver + validators.
 *
 * Uses bitmask candidate tracking and the MRV (minimum-remaining-values)
 * heuristic. `countSolutions` stops early once it finds `limit` solutions, which
 * makes the uniqueness check (exactly one solution) cheap.
 */

const boxOf = (r: number, c: number): number => Math.floor(r / 3) * 3 + Math.floor(c / 3);

/**
 * Count solutions of a puzzle, up to `limit`. Returns 0 (unsolvable),
 * 1 (unique), or `limit` (≥ limit). Does not mutate the input.
 */
export function countSolutions(grid: number[], limit = 2): number {
  const g = grid.slice();
  const rows = new Array(9).fill(0);
  const cols = new Array(9).fill(0);
  const boxes = new Array(9).fill(0);

  for (let i = 0; i < 81; i++) {
    const v = g[i];
    if (v) {
      const r = (i / 9) | 0;
      const c = i % 9;
      const bit = 1 << v;
      rows[r] |= bit;
      cols[c] |= bit;
      boxes[boxOf(r, c)] |= bit;
    }
  }

  let count = 0;

  const solve = (): void => {
    if (count >= limit) return;

    // Pick the empty cell with the fewest candidates.
    let best = -1;
    let bestUsed = 0;
    let bestCount = 10;
    for (let i = 0; i < 81; i++) {
      if (g[i] !== 0) continue;
      const r = (i / 9) | 0;
      const c = i % 9;
      const used = rows[r] | cols[c] | boxes[boxOf(r, c)];
      let cnt = 0;
      for (let v = 1; v <= 9; v++) if (!(used & (1 << v))) cnt++;
      if (cnt === 0) return; // dead end
      if (cnt < bestCount) {
        bestCount = cnt;
        best = i;
        bestUsed = used;
        if (cnt === 1) break;
      }
    }

    if (best === -1) {
      count++; // no empty cells → a complete solution
      return;
    }

    const r = (best / 9) | 0;
    const c = best % 9;
    const b = boxOf(r, c);
    for (let v = 1; v <= 9; v++) {
      const bit = 1 << v;
      if (bestUsed & bit) continue;
      g[best] = v;
      rows[r] |= bit;
      cols[c] |= bit;
      boxes[b] |= bit;
      solve();
      g[best] = 0;
      rows[r] &= ~bit;
      cols[c] &= ~bit;
      boxes[b] &= ~bit;
      if (count >= limit) return;
    }
  };

  solve();
  return count;
}

/** True if the puzzle has exactly one solution. */
export function hasUniqueSolution(grid: number[]): boolean {
  return countSolutions(grid, 2) === 1;
}

/** True if a fully-filled grid is a valid sudoku (rows/cols/boxes all 1–9). */
export function isValidComplete(grid: number[]): boolean {
  if (grid.length !== 81 || grid.some((v) => v < 1 || v > 9)) return false;
  const seen = (idx: (k: number) => number): boolean => {
    const mask = new Set<number>();
    for (let k = 0; k < 9; k++) mask.add(grid[idx(k)]);
    return mask.size === 9;
  };
  for (let i = 0; i < 9; i++) {
    if (!seen((k) => i * 9 + k)) return false; // row
    if (!seen((k) => k * 9 + i)) return false; // col
    const br = Math.floor(i / 3) * 3;
    const bc = (i % 3) * 3;
    if (!seen((k) => (br + Math.floor(k / 3)) * 9 + (bc + (k % 3)))) return false; // box
  }
  return true;
}

/** True if every given in `puzzle` matches `solution`. */
export function puzzleMatchesSolution(puzzle: number[], solution: number[]): boolean {
  for (let i = 0; i < 81; i++) {
    if (puzzle[i] !== 0 && puzzle[i] !== solution[i]) return false;
  }
  return true;
}
