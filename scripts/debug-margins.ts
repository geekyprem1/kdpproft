/**
 * Debug: render a puzzle page with the KDP safe-margin box overlaid so we can
 * see exactly what (if anything) crosses the margin. Not part of the product.
 */
import { writeFile } from "node:fs/promises";
import { computeInterior, renderPng, closeBrowser } from "../lib/pdf";
import { renderInteriorHtml } from "../lib/pdf/templates/interior";
import { resolveConfig, generatePuzzles, buildInteriorPages } from "../lib/generators/word-search";

async function main() {
  const cfg = resolveConfig({ theme: "Dinosaurs", puzzleCount: 40, difficulty: "medium" });
  const puzzles = generatePuzzles(cfg);
  const pages = buildInteriorPages(cfg, puzzles);
  const spec = computeInterior({ trim: "8.5x11", pageCount: pages.length, bleed: false });

  // page index 2 = first puzzle = printed page 3 (recto/odd → inside margin on left)
  const idx = 2;
  let html = renderInteriorHtml(spec, [pages[idx]]);

  const overlay = `<div style="position:absolute;top:${spec.marginTopIn}in;left:${spec.marginInsideIn}in;right:${spec.marginOutsideIn}in;bottom:${spec.marginBottomIn}in;border:2px solid red;box-sizing:border-box;pointer-events:none;z-index:9999"></div>`;
  html = html.replace("</body>", `${overlay}</body>`);

  const png = await renderPng(html, { widthIn: spec.pageWidthIn, heightIn: spec.pageHeightIn });
  await writeFile("output/debug-margins.png", png);
  console.log("wrote output/debug-margins.png");
  console.log(`margins: inside ${spec.marginInsideIn} outside ${spec.marginOutsideIn} top ${spec.marginTopIn} bottom ${spec.marginBottomIn}`);
  await closeBrowser();
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
