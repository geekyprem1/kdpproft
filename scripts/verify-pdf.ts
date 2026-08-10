/**
 * PDF Engine Gate — automated geometry verification.
 *
 * Opens the generated PDFs and asserts their physical dimensions and page count
 * match the KDP spec exactly. This catches geometry regressions before a human
 * spends time on the KDP previewer. It does NOT replace the manual KDP upload —
 * that is the final, authoritative gate check.
 *
 *   npm run gate:verify
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument } from "pdf-lib";
import {
  computeInterior,
  computeCover,
  inToPt,
  PT_PER_INCH,
} from "../lib/pdf";

const TRIM = "6x9" as const;
const PAGE_COUNT = 100;
const PAPER = "white" as const;
const TOL_PT = 1; // ~1/72 inch tolerance

type Check = { name: string; pass: boolean; detail: string };

function approx(actual: number, expected: number): boolean {
  return Math.abs(actual - expected) <= TOL_PT;
}

async function verifyInterior(): Promise<Check[]> {
  const spec = computeInterior({ trim: TRIM, pageCount: PAGE_COUNT });
  const bytes = await readFile(path.resolve("output", `interior-${TRIM}.pdf`));
  const doc = await PDFDocument.load(bytes);
  const checks: Check[] = [];

  const count = doc.getPageCount();
  checks.push({
    name: "interior page count",
    pass: count === PAGE_COUNT,
    detail: `${count} pages (expected ${PAGE_COUNT})`,
  });

  const first = doc.getPage(0);
  const { width, height } = first.getSize();
  const expW = inToPt(spec.pageWidthIn);
  const expH = inToPt(spec.pageHeightIn);
  checks.push({
    name: "interior page size",
    pass: approx(width, expW) && approx(height, expH),
    detail: `${(width / PT_PER_INCH).toFixed(3)}in x ${(height / PT_PER_INCH).toFixed(3)}in (expected ${spec.pageWidthIn}in x ${spec.pageHeightIn}in)`,
  });

  return checks;
}

async function verifyCover(): Promise<Check[]> {
  const spec = computeCover({ trim: TRIM, pageCount: PAGE_COUNT, paper: PAPER });
  const bytes = await readFile(path.resolve("output", `cover-${TRIM}.pdf`));
  const doc = await PDFDocument.load(bytes);
  const checks: Check[] = [];

  checks.push({
    name: "cover page count",
    pass: doc.getPageCount() === 1,
    detail: `${doc.getPageCount()} page (expected 1)`,
  });

  const { width, height } = doc.getPage(0).getSize();
  const expW = inToPt(spec.fullWidthIn);
  const expH = inToPt(spec.fullHeightIn);
  checks.push({
    name: "cover size (incl. bleed + spine)",
    pass: approx(width, expW) && approx(height, expH),
    detail: `${(width / PT_PER_INCH).toFixed(3)}in x ${(height / PT_PER_INCH).toFixed(3)}in (expected ${spec.fullWidthIn.toFixed(3)}in x ${spec.fullHeightIn.toFixed(3)}in)`,
  });

  return checks;
}

async function main() {
  const checks = [
    ...(await verifyInterior()),
    ...(await verifyCover()),
  ];

  console.log("── Gate geometry verification ──────────────────");
  let allPass = true;
  for (const c of checks) {
    const mark = c.pass ? "✓" : "✗";
    if (!c.pass) allPass = false;
    console.log(`  ${mark} ${c.name}: ${c.detail}`);
  }
  console.log("────────────────────────────────────────────────");

  if (allPass) {
    console.log("✓ Geometry PASS. Now upload both PDFs to KDP for final validation.");
  } else {
    console.log("✗ Geometry FAIL. Fix the engine before the KDP upload step.");
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error("Verification failed:", err);
  process.exitCode = 1;
});
