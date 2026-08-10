/**
 * Maze validation suite.
 *
 *   npm run test:maze
 *
 * Covers: deterministic generation, solvability, path correctness (contiguous +
 * through open passages, start→finish), minimum KDP page count, PDF generation.
 */

import assert from "node:assert/strict";
import { PDFDocument } from "pdf-lib";
import {
  generateMaze,
  WALL,
  MAZE_DIFFICULTIES,
  resolveMazeConfig,
  generateMazes,
  buildMazeInteriorPages,
  buildMazeBook,
  MIN_MAZES,
  type Maze,
} from "../lib/generators/maze";
import { inToPt, PT_PER_INCH, closeBrowser } from "../lib/pdf";

let passed = 0;
async function test(name: string, fn: () => void | Promise<void>) {
  await fn();
  passed++;
  console.log(`  ✓ ${name}`);
}

/** Verify the solution is contiguous, passes through open walls, start→finish. */
function pathIsValid(m: Maze): boolean {
  const { width, cells, solution, start, finish } = m;
  if (solution.length < 2) return false;
  if (solution[0][0] !== start[0] || solution[0][1] !== start[1]) return false;
  const end = solution[solution.length - 1];
  if (end[0] !== finish[0] || end[1] !== finish[1]) return false;

  for (let i = 1; i < solution.length; i++) {
    const [pr, pc] = solution[i - 1];
    const [r, c] = solution[i];
    const dr = r - pr;
    const dc = c - pc;
    if (Math.abs(dr) + Math.abs(dc) !== 1) return false; // must be adjacent
    const prevIdx = pr * width + pc;
    // wall that must be open when moving from prev → cur
    const bit =
      dr === -1 ? WALL.N : dr === 1 ? WALL.S : dc === 1 ? WALL.E : WALL.W;
    if (cells[prevIdx] & bit) return false; // wall blocks the move
  }
  return true;
}

async function main() {
  console.log("── Maze validation suite ───────────────────────");

  await test("deterministic: same seed → identical maze & solution", () => {
    const a = generateMaze({ difficulty: "medium", seed: 777 });
    const b = generateMaze({ difficulty: "medium", seed: 777 });
    assert.deepEqual(a.cells, b.cells);
    assert.deepEqual(a.solution, b.solution);
    const c = generateMaze({ difficulty: "medium", seed: 778 });
    assert.notDeepEqual(a.cells, c.cells);
  });

  await test("solvability: a path exists for every difficulty", () => {
    for (const difficulty of MAZE_DIFFICULTIES) {
      for (let s = 0; s < 5; s++) {
        const m = generateMaze({ difficulty, seed: 100 * (s + 1) });
        assert.ok(m.solution.length >= 2, `${difficulty} seed ${s} unsolved`);
      }
    }
  });

  await test("path correctness: contiguous, through passages, start→finish", () => {
    for (const difficulty of MAZE_DIFFICULTIES) {
      const m = generateMaze({ difficulty, seed: 555 });
      assert.ok(pathIsValid(m), `${difficulty} path invalid`);
    }
  });

  await test(`min KDP page count: ${MIN_MAZES} mazes → ≥ 24 pages`, () => {
    const cfg = resolveMazeConfig({ mazeCount: MIN_MAZES, difficulty: "easy" });
    const mazes = generateMazes(cfg);
    const pages = buildMazeInteriorPages(cfg, mazes);
    assert.ok(pages.length >= 24, `only ${pages.length} pages`);
  });

  await test("PDF generation: interior is valid 8.5×11 with ≥ 24 pages", async () => {
    const book = await buildMazeBook({ mazeCount: MIN_MAZES, difficulty: "medium" });
    const doc = await PDFDocument.load(book.interior.pdf);
    assert.ok(doc.getPageCount() >= 24, `interior has ${doc.getPageCount()} pages`);
    const { width, height } = doc.getPage(0).getSize();
    assert.ok(Math.abs(width - inToPt(8.5)) <= 1.5, `width ${(width / PT_PER_INCH).toFixed(3)}in`);
    assert.ok(Math.abs(height - inToPt(11)) <= 1.5, `height ${(height / PT_PER_INCH).toFixed(3)}in`);
    const cover = await PDFDocument.load(book.cover.pdf);
    assert.equal(cover.getPageCount(), 1);
  });

  await closeBrowser();
  console.log("────────────────────────────────────────────────");
  console.log(`✓ ALL ${passed} MAZE TESTS PASSED`);
}

main().catch(async (err) => {
  await closeBrowser().catch(() => {});
  console.error("✗ MAZE TEST FAILED:", err.message);
  process.exit(1);
});
