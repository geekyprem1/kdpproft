export {}; // module marker

import { closeBrowser } from "../lib/pdf";
import { buildActivityBook } from "../lib/generators/activity";

async function main() {
  console.log("── Activity Book smoke test ────────────────────");
  for (const difficulty of ["easy", "medium"] as const) {
    const t0 = Date.now();
    const b = await buildActivityBook({ theme: "Animals", difficulty, pageCount: 24 });
    const ok = b.interior.pdf.byteLength > 5000 && b.cover.pdf.byteLength > 1000;
    console.log(`  ${ok ? "✓" : "✗"} activity/${difficulty}: ${b.pageCount}pg interior=${(b.interior.pdf.byteLength / 1024).toFixed(0)}KB sections=${b.sections.join("+")} (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
    if (!ok) throw new Error(`activity/${difficulty} PDF too small`);
  }
  console.log("\nActivity Book produced valid PDFs.");
  await closeBrowser();
}

main().catch(async (e) => {
  await closeBrowser().catch(() => {});
  console.error("smoke failed:", e);
  process.exit(1);
});
