/**
 * KDP compliance validation for generated book PDFs.
 *
 * Checks dimensions, page counts, uniform page sizing, font embedding, and cover
 * geometry (bleed + spine for the actual page count) against the KDP spec.
 * Geometry is authoritative-enough for automated CI; the final word is still the
 * KDP previewer.
 */

import { readFile } from "node:fs/promises";
import { PDFDocument } from "pdf-lib";
import {
  computeCover,
  inToPt,
  PT_PER_INCH,
  TRIM_SIZES,
  BLEED_IN,
  MIN_PAGE_COUNT,
  type TrimSize,
  type PaperStock,
} from "./kdp-specs";

export interface Check {
  name: string;
  pass: boolean;
  detail: string;
}

const TOL_PT = 1.5; // ~0.02in

const approx = (a: number, b: number): boolean => Math.abs(a - b) <= TOL_PT;
const inFmt = (pt: number): string => (pt / PT_PER_INCH).toFixed(3);

export interface ValidateBookInput {
  interiorPath: string;
  coverPath: string;
  trim: TrimSize;
  paper?: PaperStock;
  bleed?: boolean;
}

export async function validateBook(opts: ValidateBookInput): Promise<Check[]> {
  const { interiorPath, coverPath, trim } = opts;
  const paper = opts.paper ?? "white";
  const bleed = opts.bleed ?? false;
  const checks: Check[] = [];

  // ── interior ──
  const interiorBytes = await readFile(interiorPath);
  const interior = await PDFDocument.load(interiorBytes);
  const n = interior.getPageCount();

  checks.push({
    name: `interior ≥ ${MIN_PAGE_COUNT} pages (KDP minimum)`,
    pass: n >= MIN_PAGE_COUNT,
    detail: `${n} pages`,
  });

  const t = TRIM_SIZES[trim];
  const expW = inToPt(bleed ? t.widthIn + BLEED_IN : t.widthIn);
  const expH = inToPt(bleed ? t.heightIn + 2 * BLEED_IN : t.heightIn);
  const ip = interior.getPage(0).getSize();
  checks.push({
    name: `interior trim ${trim}${bleed ? " +bleed" : " (no bleed)"}`,
    pass: approx(ip.width, expW) && approx(ip.height, expH),
    detail: `${inFmt(ip.width)}×${inFmt(ip.height)}in (expected ${inFmt(expW)}×${inFmt(expH)})`,
  });

  let uniform = true;
  for (let i = 0; i < n; i++) {
    const s = interior.getPage(i).getSize();
    if (!approx(s.width, expW) || !approx(s.height, expH)) {
      uniform = false;
      break;
    }
  }
  checks.push({
    name: "interior pages uniform size",
    pass: uniform,
    detail: uniform ? "all pages match trim" : "non-uniform page size found",
  });

  checks.push({
    name: "interior fonts embedded",
    pass: interiorBytes.includes(Buffer.from("FontFile")),
    detail: interiorBytes.includes(Buffer.from("FontFile"))
      ? "FontFile present"
      : "NO embedded font found",
  });

  // ── cover ──
  const coverBytes = await readFile(coverPath);
  const cover = await PDFDocument.load(coverBytes);
  checks.push({
    name: "cover single page",
    pass: cover.getPageCount() === 1,
    detail: `${cover.getPageCount()} page`,
  });

  const cspec = computeCover({ trim, pageCount: n, paper });
  const cp = cover.getPage(0).getSize();
  checks.push({
    name: `cover size incl. bleed + spine (${n}pp, ${paper})`,
    pass:
      approx(cp.width, inToPt(cspec.fullWidthIn)) &&
      approx(cp.height, inToPt(cspec.fullHeightIn)),
    detail: `${inFmt(cp.width)}×${inFmt(cp.height)}in (expected ${cspec.fullWidthIn.toFixed(3)}×${cspec.fullHeightIn.toFixed(3)}, spine ${cspec.spineWidthIn.toFixed(3)}in)`,
  });

  checks.push({
    name: "cover fonts embedded",
    pass: coverBytes.includes(Buffer.from("FontFile")),
    detail: coverBytes.includes(Buffer.from("FontFile"))
      ? "FontFile present"
      : "NO embedded font found",
  });

  return checks;
}

export const allPass = (checks: Check[]): boolean => checks.every((c) => c.pass);
