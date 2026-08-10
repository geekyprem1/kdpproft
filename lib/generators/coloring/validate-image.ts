/**
 * Coloring-image validation.
 *
 * Decodes the PNG and analyzes pixels to reject art that isn't clean black-and-
 * white line work: gray backgrounds, large filled-black regions, color, and
 * grayscale shading. (Watermark / stray-text detection is best-effort: faint
 * watermarks read as mid-gray and are caught by the shading check.)
 */

import { PNG } from "pngjs";

export interface ColoringImageCheck {
  ok: boolean;
  reasons: string[];
  stats: { white: number; black: number; mid: number; colored: number };
}

// Thresholds (fractions of sampled pixels).
const MIN_WHITE = 0.6; // background should be mostly white
const MAX_BLACK = 0.22; // not large filled-black regions
const MAX_MID = 0.12; // little grayscale → no shading
const MAX_COLORED = 0.03; // essentially no color

export function validateColoringImage(pngBytes: Uint8Array): ColoringImageCheck {
  const png = PNG.sync.read(Buffer.from(pngBytes));
  const data = png.data; // RGBA
  const stride = 1; // sample every pixel (avoids aliasing with periodic art)
  let white = 0;
  let black = 0;
  let mid = 0;
  let colored = 0;
  let total = 0;

  for (let p = 0; p < data.length; p += 4 * stride) {
    const r = data[p];
    const g = data[p + 1];
    const b = data[p + 2];
    const a = data[p + 3];
    total++;
    if (a < 16) {
      white++; // transparent prints as white
      continue;
    }
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    const sat = Math.max(r, g, b) - Math.min(r, g, b);
    if (sat > 40) colored++;
    if (lum >= 230) white++;
    else if (lum <= 45) black++;
    else mid++;
  }

  const f = {
    white: white / total,
    black: black / total,
    mid: mid / total,
    colored: colored / total,
  };

  const reasons: string[] = [];
  if (f.white < MIN_WHITE) reasons.push(`background not white enough (${(f.white * 100).toFixed(0)}%)`);
  if (f.black > MAX_BLACK) reasons.push(`too much filled black (${(f.black * 100).toFixed(0)}%)`);
  if (f.mid > MAX_MID) reasons.push(`grayscale/shading detected (${(f.mid * 100).toFixed(0)}%)`);
  if (f.colored > MAX_COLORED) reasons.push(`color detected (${(f.colored * 100).toFixed(0)}%)`);

  return { ok: reasons.length === 0, reasons, stats: f };
}
