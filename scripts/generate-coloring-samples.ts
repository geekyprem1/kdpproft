/**
 * Generate coloring-book sample books (Dinosaur, Unicorn, Halloween).
 *
 *   REPLICATE_API_TOKEN=...  npm run coloring:samples
 *
 * Requires a Replicate token for real FLUX line art. Without it, the pipeline
 * falls back to offline placeholder art (useful only for verifying structure).
 * Writes interior + cover PDFs and a few page previews to examples/coloring/.
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildColoringBook, isReplicateConfigured } from "../lib/generators/coloring";
import { closeBrowser } from "../lib/pdf";

const PAGES = 22; // N + 2 = 24 (KDP minimum); raise for fuller books
const BOOKS = [
  { slug: "dinosaur-coloring", theme: "Dinosaurs", ageGroup: "kids" as const, style: "cute" as const },
  { slug: "unicorn-coloring", theme: "Unicorns", ageGroup: "kids" as const, style: "cute" as const },
  { slug: "halloween-coloring", theme: "Halloween", ageGroup: "kids" as const, style: "cute" as const },
];

async function main() {
  if (!isReplicateConfigured()) {
    console.warn("⚠ REPLICATE_API_TOKEN not set — using OFFLINE PLACEHOLDER art (structure only).");
  }

  const root = path.resolve(process.cwd(), "examples", "coloring");
  await mkdir(root, { recursive: true });

  for (const b of BOOKS) {
    console.log(`\nGenerating ${b.slug} (${PAGES} pages)…`);
    const t0 = Date.now();
    const book = await buildColoringBook({
      theme: b.theme,
      ageGroup: b.ageGroup,
      style: b.style,
      pageCount: PAGES,
    });

    const dir = path.join(root, b.slug);
    const previews = path.join(dir, "previews");
    await mkdir(previews, { recursive: true });
    await writeFile(path.join(dir, `${b.slug}-interior.pdf`), book.interior.pdf);
    await writeFile(path.join(dir, `${b.slug}-cover.pdf`), book.cover.pdf);
    // first 3 page images as previews
    for (let i = 0; i < Math.min(3, book.pages.length); i++) {
      await writeFile(path.join(previews, `page-${i + 1}.png`), Buffer.from(book.pages[i].bytes));
    }

    console.log(
      `✓ ${b.slug}: ${book.pageCount} pages, ${book.invalidCount} flagged image(s), ${((Date.now() - t0) / 1000).toFixed(0)}s`
    );
  }

  console.log("\n✓ Wrote examples/coloring/. Upload the interior + cover PDFs to KDP.");
  await closeBrowser();
}

main().catch((err) => {
  console.error("Coloring sample generation failed:", err);
  process.exitCode = 1;
});
