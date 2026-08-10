export {}; // module marker

import { closeBrowser } from "../lib/pdf";
import { buildScrambleBook } from "../lib/generators/scramble";
import { buildCryptogramBook } from "../lib/generators/cryptogram";
import { buildDotDotBook } from "../lib/generators/dotdot";
import { buildCrosswordBook } from "../lib/generators/crossword";

async function check(name: string, p: Promise<{ pageCount: number; interior: { pdf: Uint8Array }; cover: { pdf: Uint8Array } }>) {
  const t0 = Date.now();
  const b = await p;
  const ok = b.interior.pdf.byteLength > 3000 && b.cover.pdf.byteLength > 1000;
  console.log(`  ${ok ? "✓" : "✗"} ${name}: ${b.pageCount}pg interior=${(b.interior.pdf.byteLength / 1024).toFixed(0)}KB (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  if (!ok) throw new Error(`${name} PDF too small`);
}

async function main() {
  console.log("── Tier 2 puzzle books smoke test ──────────────");
  // Offline (no OPENROUTER key): scramble/crossword fall back to the bank/generic clues.
  await check("scramble/Dinosaurs", buildScrambleBook({ theme: "Dinosaurs", puzzleCount: 12 }));
  await check("cryptogram", buildCryptogramBook({ puzzleCount: 22 }));
  await check("dot_to_dot/medium", buildDotDotBook({ difficulty: "medium", pageCount: 22 }));
  await check("crossword/Space", buildCrosswordBook({ theme: "Space", puzzleCount: 11 }));
  console.log("\nAll Tier 2 puzzle books produced valid PDFs.");
  await closeBrowser();
}

main().catch(async (e) => {
  await closeBrowser().catch(() => {});
  console.error("smoke failed:", e);
  process.exit(1);
});
