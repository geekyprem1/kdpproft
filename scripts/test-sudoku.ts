/**
 * Sudoku validation suite.
 *
 *   npm run test:sudoku
 *
 * Covers: deterministic generation, puzzle uniqueness, solution correctness,
 * minimum KDP page count, and end-to-end PDF generation.
 */

import assert from "node:assert/strict";
import { PDFDocument } from "pdf-lib";
import {
  generateSudoku,
  countSolutions,
  isValidComplete,
  puzzleMatchesSolution,
  resolveSudokuConfig,
  buildSudokuInteriorPages,
  generateSudokuPuzzles,
  buildSudokuBook,
  MIN_SUDOKU_PUZZLES,
  SUDOKU_DIFFICULTIES,
} from "../lib/generators/sudoku";
import { inToPt, PT_PER_INCH, closeBrowser } from "../lib/pdf";

let passed = 0;
async function test(name: string, fn: () => void | Promise<void>) {
  await fn();
  passed++;
  console.log(`  ✓ ${name}`);
}

async function main() {
  console.log("── Sudoku validation suite ─────────────────────");

  await test("deterministic: same seed → identical puzzle & solution", () => {
    const a = generateSudoku({ difficulty: "medium", seed: 12345 });
    const b = generateSudoku({ difficulty: "medium", seed: 12345 });
    assert.deepEqual(a.puzzle, b.puzzle);
    assert.deepEqual(a.solution, b.solution);
    const c = generateSudoku({ difficulty: "medium", seed: 99999 });
    assert.notDeepEqual(a.puzzle, c.puzzle);
  });

  await test("uniqueness: every puzzle has exactly one solution", () => {
    for (const difficulty of SUDOKU_DIFFICULTIES) {
      for (let s = 0; s < 5; s++) {
        const p = generateSudoku({ difficulty, seed: 1000 * (s + 1) + difficulty.length });
        assert.equal(countSolutions(p.puzzle, 2), 1, `${difficulty} seed ${s} not unique`);
      }
    }
  });

  await test("solution correctness: valid complete grid; givens match", () => {
    for (const difficulty of SUDOKU_DIFFICULTIES) {
      const p = generateSudoku({ difficulty, seed: 42 });
      assert.ok(isValidComplete(p.solution), `${difficulty} solution invalid`);
      assert.ok(puzzleMatchesSolution(p.puzzle, p.solution), `${difficulty} givens mismatch`);
      // the unique solution must equal the stated solution
      const work = p.puzzle.slice();
      assert.equal(countSolutions(work, 2), 1);
    }
  });

  await test("givens within expected range per difficulty", () => {
    const easy = generateSudoku({ difficulty: "easy", seed: 7 });
    const expert = generateSudoku({ difficulty: "expert", seed: 7 });
    assert.ok(easy.givens >= expert.givens, "easy should have ≥ givens than expert");
    assert.ok(expert.givens >= 17, "below the 17-clue minimum for a unique sudoku");
  });

  await test(`min KDP page count: ${MIN_SUDOKU_PUZZLES} puzzles → ≥ 24 pages`, () => {
    const cfg = resolveSudokuConfig({ puzzleCount: MIN_SUDOKU_PUZZLES, difficulty: "easy" });
    const puzzles = generateSudokuPuzzles(cfg);
    const pages = buildSudokuInteriorPages(cfg, puzzles);
    assert.ok(pages.length >= 24, `only ${pages.length} pages`);
  });

  await test("PDF generation: interior is valid 8.5×11 with ≥ 24 pages", async () => {
    const book = await buildSudokuBook({ puzzleCount: MIN_SUDOKU_PUZZLES, difficulty: "medium" });
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
  console.log(`✓ ALL ${passed} SUDOKU TESTS PASSED`);
}

main().catch(async (err) => {
  await closeBrowser().catch(() => {});
  console.error("✗ SUDOKU TEST FAILED:", err.message);
  process.exit(1);
});
