/**
 * Word Search vertical-slice validation.
 *
 * Generates a complete word search book (interior + cover) through the KDP PDF
 * engine, writes both PDFs to /output, and asserts the generator is
 * deterministic (same config → identical grids).
 *
 *   npm run ws:generate -- [theme] [puzzleCount] [difficulty]
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { closeBrowser } from "../lib/pdf";
import {
  buildWordSearchBook,
  resolveConfig,
  generatePuzzles,
} from "../lib/generators/word-search";
import type { Difficulty } from "../lib/generators/word-search";

const theme = process.argv[2] ?? "Dinosaurs";
const puzzleCount = Number(process.argv[3] ?? 20);
const difficulty = (process.argv[4] as Difficulty) ?? "medium";

function assertDeterministic() {
  const cfg = resolveConfig({ theme, puzzleCount, difficulty });
  const a = generatePuzzles(cfg);
  const b = generatePuzzles(cfg);
  const ser = (p: typeof a) => JSON.stringify(p.map((x) => x.grid));
  if (ser(a) !== ser(b)) {
    throw new Error("Determinism check FAILED: same config produced different grids.");
  }
  return cfg;
}

async function main() {
  console.log("── Word Search vertical slice ──────────────────");
  console.log(`Theme "${theme}" · ${puzzleCount} puzzles · ${difficulty}`);

  assertDeterministic();
  console.log("✓ Determinism: identical grids across two runs");

  const outDir = path.resolve(process.cwd(), "output");
  await mkdir(outDir, { recursive: true });

  const book = await buildWordSearchBook({ theme, puzzleCount, difficulty });

  const totalSkipped = book.puzzles.reduce((n, p) => n + p.skipped.length, 0);
  console.log(`Pages: ${book.pageCount} (KDP min 24: ${book.pageCount >= 24 ? "ok" : "TOO FEW"})`);
  console.log(`Cover: spine ${book.cover.spec.spineWidthIn.toFixed(3)}in, spine text: ${book.cover.spec.allowsSpineText}`);
  if (totalSkipped > 0) console.log(`⚠ ${totalSkipped} word placement(s) skipped across all puzzles`);

  const interiorPath = path.join(outDir, "word-search-interior.pdf");
  const coverPath = path.join(outDir, "word-search-cover.pdf");
  await writeFile(interiorPath, book.interior.pdf);
  await writeFile(coverPath, book.cover.pdf);

  console.log("\n✓ Wrote:");
  console.log(`  ${interiorPath}`);
  console.log(`  ${coverPath}`);

  await closeBrowser();
}

main().catch((err) => {
  console.error("Word search generation failed:", err);
  process.exitCode = 1;
});
