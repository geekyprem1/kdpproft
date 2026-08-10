/**
 * Coloring-book validation suite.
 *
 *   npm run test:coloring
 *
 * Covers: prompt builder constraints, image validation (rejects gray bg, filled
 * black, color, shading; accepts clean line art), offline placeholder validity,
 * minimum KDP page count, and end-to-end PDF generation (offline placeholders —
 * no Replicate token needed).
 */

import assert from "node:assert/strict";
import { PNG } from "pngjs";
import { PDFDocument } from "pdf-lib";
import {
  buildColoringPrompt,
  buildSubjects,
  validateColoringImage,
  placeholderLineArt,
  buildColoringBook,
  MIN_COLORING_PAGES,
} from "../lib/generators/coloring";
import { inToPt, PT_PER_INCH, closeBrowser } from "../lib/pdf";

let passed = 0;
async function test(name: string, fn: () => void | Promise<void>) {
  await fn();
  passed++;
  console.log(`  ✓ ${name}`);
}

function makePng(w: number, h: number, px: (x: number, y: number) => [number, number, number]): Uint8Array {
  const png = new PNG({ width: w, height: h });
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (w * y + x) << 2;
      const [r, g, b] = px(x, y);
      png.data[i] = r;
      png.data[i + 1] = g;
      png.data[i + 2] = b;
      png.data[i + 3] = 255;
    }
  }
  return PNG.sync.write(png);
}

async function main() {
  console.log("── Coloring validation suite ───────────────────");

  await test("prompt builder bakes in line-art constraints", () => {
    const p = buildColoringPrompt({ subject: "a friendly T-Rex", ageGroup: "kids", style: "cute" }).toLowerCase();
    for (const phrase of ["line art", "white background", "no shading", "no color", "outline"]) {
      assert.ok(p.includes(phrase), `prompt missing "${phrase}"`);
    }
  });

  await test("image validation: clean line art passes", () => {
    const img = makePng(120, 160, (x) => (x % 12 === 0 ? [0, 0, 0] : [255, 255, 255]));
    const c = validateColoringImage(img);
    assert.ok(c.ok, `should pass: ${c.reasons.join(", ")}`);
  });

  await test("image validation: gray background rejected", () => {
    const img = makePng(120, 160, () => [200, 200, 200]);
    const c = validateColoringImage(img);
    assert.ok(!c.ok && c.reasons.some((r) => r.includes("shading") || r.includes("white")));
  });

  await test("image validation: filled black rejected", () => {
    const img = makePng(120, 160, () => [0, 0, 0]);
    const c = validateColoringImage(img);
    assert.ok(!c.ok && c.reasons.some((r) => r.includes("black")));
  });

  await test("image validation: color rejected", () => {
    const img = makePng(120, 160, (x) => (x % 3 === 0 ? [220, 20, 20] : [255, 255, 255]));
    const c = validateColoringImage(img);
    assert.ok(!c.ok && c.reasons.some((r) => r.includes("color")));
  });

  await test("offline placeholder is valid line art", async () => {
    const bytes = await placeholderLineArt({ prompt: "coloring book line art of a cat", seed: 7 });
    const c = validateColoringImage(bytes);
    assert.ok(c.ok, `placeholder should pass: ${c.reasons.join(", ")}`);
  });

  await test("subjects: fallback returns exactly the requested count", async () => {
    const subjects = await buildSubjects({ theme: "Dinosaurs", ageGroup: "kids", count: 24 });
    assert.equal(subjects.length, 24);
  });

  await test("PDF generation (offline): bleed 8.625×11.25, ≥ 24 pages", async () => {
    const book = await buildColoringBook({ theme: "Dinosaurs", pageCount: MIN_COLORING_PAGES, ageGroup: "kids", style: "cute" });
    const doc = await PDFDocument.load(book.interior.pdf);
    assert.ok(doc.getPageCount() >= 24, `interior has ${doc.getPageCount()} pages`);
    const { width, height } = doc.getPage(1).getSize(); // page 2 = a full-bleed art page
    assert.ok(Math.abs(width - inToPt(8.625)) <= 1.5, `width ${(width / PT_PER_INCH).toFixed(3)}in`);
    assert.ok(Math.abs(height - inToPt(11.25)) <= 1.5, `height ${(height / PT_PER_INCH).toFixed(3)}in`);
  });

  await closeBrowser();
  console.log("────────────────────────────────────────────────");
  console.log(`✓ ALL ${passed} COLORING TESTS PASSED`);
}

main().catch(async (err) => {
  await closeBrowser().catch(() => {});
  console.error("✗ COLORING TEST FAILED:", err.message);
  process.exit(1);
});
