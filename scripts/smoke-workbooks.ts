export {}; // module marker

import { closeBrowser } from "../lib/pdf";
import { buildTracingBook } from "../lib/generators/tracing/book";
import { buildMathBook } from "../lib/generators/math/book";

async function main() {
  console.log("── Kids workbooks smoke test ───────────────────");

  for (const set of ["uppercase", "numbers", "words"] as const) {
    const t0 = Date.now();
    const b = await buildTracingBook({ set, pageCount: 24 });
    const ok = b.interior.pdf.byteLength > 3000 && b.cover.pdf.byteLength > 1000;
    console.log(`  ${ok ? "✓" : "✗"} tracing/${set}: ${b.pageCount}pg interior=${(b.interior.pdf.byteLength / 1024).toFixed(0)}KB (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
    if (!ok) throw new Error(`tracing/${set} PDF too small`);
  }

  for (const operation of ["addition", "subtraction", "multiplication", "mixed"] as const) {
    const t0 = Date.now();
    const b = await buildMathBook({ operation, difficulty: "medium", pageCount: 24 });
    const ok = b.interior.pdf.byteLength > 3000 && b.cover.pdf.byteLength > 1000;
    console.log(`  ${ok ? "✓" : "✗"} math/${operation}: ${b.pageCount}pg interior=${(b.interior.pdf.byteLength / 1024).toFixed(0)}KB (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
    if (!ok) throw new Error(`math/${operation} PDF too small`);
  }

  console.log("\nAll workbook layouts produced valid PDFs.");
  await closeBrowser();
}

main().catch(async (e) => {
  await closeBrowser().catch(() => {});
  console.error("smoke failed:", e);
  process.exit(1);
});
