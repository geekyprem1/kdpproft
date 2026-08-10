export {}; // module marker

import { closeBrowser } from "../lib/pdf";
import { buildLowContentBook } from "../lib/generators/lowcontent/book";
import { LOW_CONTENT_LAYOUTS } from "../lib/generators/lowcontent/types";

async function main() {
  console.log("── Low-content smoke test ──────────────────────");
  // Test a representative subset (fast) + assert PDFs are non-trivial.
  const sample = ["lined", "planner_weekly", "habit_tracker", "recipe"] as const;
  for (const layout of sample) {
    const t0 = Date.now();
    const book = await buildLowContentBook({ layout, pageCount: 24, title: `Test ${layout}` });
    const kb = (book.interior.pdf.byteLength / 1024).toFixed(0);
    const ck = (book.cover.pdf.byteLength / 1024).toFixed(0);
    const ok = book.interior.pdf.byteLength > 3000 && book.cover.pdf.byteLength > 1000;
    console.log(`  ${ok ? "✓" : "✗"} ${layout}: ${book.pageCount}pg interior=${kb}KB cover=${ck}KB (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
    if (!ok) throw new Error(`${layout} produced an empty/too-small PDF`);
  }
  console.log(`\nAll ${sample.length} sampled layouts produced valid PDFs. (${LOW_CONTENT_LAYOUTS.length} layouts total)`);
  await closeBrowser();
}

main().catch(async (e) => {
  await closeBrowser().catch(() => {});
  console.error("smoke failed:", e);
  process.exit(1);
});
