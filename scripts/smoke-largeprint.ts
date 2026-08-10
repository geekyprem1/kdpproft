export {}; // module marker

import { closeBrowser } from "../lib/pdf";
import { buildWordSearchBook } from "../lib/generators/word-search";
import { buildSudokuBook } from "../lib/generators/sudoku";

async function check(name: string, p: Promise<{ pageCount: number; interior: { pdf: Uint8Array } }>) {
  const b = await p;
  const ok = b.interior.pdf.byteLength > 3000;
  console.log(`  ${ok ? "✓" : "✗"} ${name}: ${b.pageCount}pg interior=${(b.interior.pdf.byteLength / 1024).toFixed(0)}KB`);
  if (!ok) throw new Error(`${name} PDF too small`);
}

async function main() {
  console.log("── Large-print smoke test ──────────────────────");
  await check("word_search normal", buildWordSearchBook({ theme: "Dinosaurs", puzzleCount: 12 }));
  await check("word_search LARGE", buildWordSearchBook({ theme: "Dinosaurs", puzzleCount: 12, largePrint: true }));
  await check("sudoku normal", buildSudokuBook({ puzzleCount: 12 }));
  await check("sudoku LARGE", buildSudokuBook({ puzzleCount: 12, largePrint: true }));
  console.log("\nLarge-print + normal editions both produced valid PDFs.");
  await closeBrowser();
}

main().catch(async (e) => {
  await closeBrowser().catch(() => {});
  console.error("smoke failed:", e);
  process.exit(1);
});
