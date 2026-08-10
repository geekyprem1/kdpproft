/**
 * Cover Studio layout check (offline — no Replicate, no credits).
 *
 *   npm run test:cover
 *
 * Renders every genre x concept with a deliberately long title and verifies:
 *   - the title never overflows its panel (no clipped text)
 *   - the web fonts actually load (the genre typography engine is not silently
 *     falling back to one generic sans)
 *   - the subtitle is not duplicated in the same cover
 *   - the render is not an almost-black empty frame
 *
 * PNGs are written to output/cover-checks/ for eyeballing.
 */

import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { PNG } from "pngjs";
import { coverHtml } from "../lib/cover/templates";
import { COVER_GENRES, CONCEPT_LAYOUTS, type CoverGenre, type ConceptLayout } from "../lib/cover/types";
import { renderPng, closeBrowser } from "../lib/pdf/render";

const OUT_DIR = "output/cover-checks";

// Long, worst-case title: a 13-character word that used to overflow and clip.
const TITLE = "Atomic Habits For Entrepreneurs";
const SUBTITLE = "Build Better Systems for Lasting Success";
const AUTHOR = "Prem Sharma";

const WIDTH_IN = 6;
const HEIGHT_IN = 9;
const DPI = 150;

let passed = 0;
let failed = 0;

function check(name: string, condition: boolean, detail: string) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.log(`  ✗ ${name} — ${detail}`);
  }
}

/** Fraction of pixels in a vertical slice that are near-black. */
function darkFraction(png: PNG, y0: number, y1: number, x0: number, x1: number): number {
  let dark = 0;
  let total = 0;
  for (let y = Math.floor(y0); y < Math.floor(y1); y++) {
    for (let x = Math.floor(x0); x < Math.floor(x1); x++) {
      const i = (png.width * y + x) << 2;
      const lum = 0.299 * png.data[i] + 0.587 * png.data[i + 1] + 0.114 * png.data[i + 2];
      if (lum < 24) dark++;
      total++;
    }
  }
  return total === 0 ? 0 : dark / total;
}

/** Count non-background pixels touching a vertical edge strip — a clipped-text signal. */
function edgeInkFraction(png: PNG, side: "left" | "right"): number {
  const strip = Math.max(2, Math.round(png.width * 0.006));
  const x0 = side === "left" ? 0 : png.width - strip;
  const x1 = side === "left" ? strip : png.width;
  // Only the upper 45% matters: that is where every layout puts its title.
  const y0 = Math.round(png.height * 0.02);
  const y1 = Math.round(png.height * 0.45);

  let ink = 0;
  let total = 0;
  for (let y = y0; y < y1; y++) {
    // Compare each edge pixel to a reference pixel further inside the same row.
    const refIdx = (png.width * y + (side === "left" ? strip + 6 : png.width - strip - 7)) << 2;
    const refLum = 0.299 * png.data[refIdx] + 0.587 * png.data[refIdx + 1] + 0.114 * png.data[refIdx + 2];
    for (let x = x0; x < x1; x++) {
      const i = (png.width * y + x) << 2;
      const lum = 0.299 * png.data[i] + 0.587 * png.data[i + 1] + 0.114 * png.data[i + 2];
      // A glyph cut by the panel edge shows as a sharp local contrast against its row.
      if (Math.abs(lum - refLum) > 70) ink++;
      total++;
    }
  }
  return total === 0 ? 0 : ink / total;
}

async function renderOne(genre: CoverGenre, layout: ConceptLayout): Promise<PNG> {
  const html = coverHtml({
    genre,
    layout,
    title: TITLE,
    subtitle: SUBTITLE,
    author: AUTHOR,
    // Gradient background keeps the test offline and deterministic (no Replicate).
    bg: { kind: "gradient", c1: "#12233f", c2: "#2b4a7a" },
  });
  const bytes = await renderPng(html, {
    widthIn: WIDTH_IN,
    heightIn: HEIGHT_IN,
    dpi: DPI,
    allowFontCdn: true,
  });
  await writeFile(`${OUT_DIR}/${genre}-${layout}.png`, bytes);
  return PNG.sync.read(Buffer.from(bytes));
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  console.log("── Cover Studio layout checks ──────────────────");

  // 1. The subtitle must appear at most once per cover's markup.
  for (const genre of COVER_GENRES) {
    for (const layout of CONCEPT_LAYOUTS) {
      const html = coverHtml({ genre, layout, title: TITLE, subtitle: SUBTITLE, author: AUTHOR, bg: { kind: "gradient", c1: "#111", c2: "#222" } });
      const occurrences = html.split(SUBTITLE).length - 1;
      check(
        `${genre}/${layout}: subtitle rendered once`,
        occurrences <= 1,
        `subtitle appears ${occurrences}x (duplicate/overlapping text)`
      );
    }
  }

  // 2. Rendered output: no clipped title, real fonts, not an empty black frame.
  for (const genre of COVER_GENRES) {
    for (const layout of CONCEPT_LAYOUTS) {
      const png = await renderOne(genre, layout);

      const leftInk = edgeInkFraction(png, "left");
      const rightInk = edgeInkFraction(png, "right");
      check(
        `${genre}/${layout}: title not clipped at panel edges`,
        leftInk < 0.06 && rightInk < 0.06,
        `edge ink left=${leftInk.toFixed(3)} right=${rightInk.toFixed(3)}`
      );

      const dark = darkFraction(png, png.height * 0.3, png.height * 0.95, 0, png.width);
      check(
        `${genre}/${layout}: artwork area is not an empty black frame`,
        dark < 0.9,
        `${(dark * 100).toFixed(1)}% of the lower cover is near-black`
      );
    }
  }

  // 3. Font loading: the same title in two different genres must not render identically.
  //    If the web fonts were blocked, every genre would collapse to one fallback sans.
  const businessPng = await renderOne("business", "typographyFirst");
  const kidsPng = await renderOne("kids", "typographyFirst");
  let differing = 0;
  const sample = Math.min(businessPng.data.length, kidsPng.data.length);
  for (let i = 0; i < sample; i += 4) {
    if (businessPng.data[i] !== kidsPng.data[i]) differing++;
  }
  check(
    "web fonts load: genres render distinctly",
    differing > sample / 4 / 20,
    "business and kids covers are nearly pixel-identical — fonts likely blocked"
  );

  await closeBrowser();
  console.log("────────────────────────────────────────────────");
  console.log(`${failed === 0 ? "✓" : "✗"} ${passed} passed, ${failed} failed`);
  console.log(`PNGs: ${OUT_DIR}/`);
  assert.equal(failed, 0, `${failed} cover layout check(s) failed`);
}

main().catch(async (err) => {
  await closeBrowser().catch(() => {});
  console.error("✗ COVER LAYOUT TEST FAILED:", err.message);
  process.exit(1);
});
