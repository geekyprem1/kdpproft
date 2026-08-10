/**
 * V2 cover scoring — detailed 6-dimension breakdown.
 * genreMatch is now pixel-based for colorful genres (kids, puzzle, coloring).
 * Returns ScoreBreakdown with individual scores and an overall 0–100.
 */

import { PNG } from "pngjs";
import { isArtworkDominant, type ConceptLayout, type CoverGenre, type ScoreBreakdown, type VisualQuality } from "./types";

const pct = (n: number): number => Math.max(0, Math.min(100, Math.round(n)));

interface ScoreOpts {
  titleBand: [number, number];
  hasSubtitle: boolean;
  hasAuthor: boolean;
  titleLen: number;
  layout: ConceptLayout;
  genre?: string;
}

function sampleBand(
  data: Buffer, width: number, height: number,
  y0frac: number, y1frac: number, step = 3
): { mean: number; contrast: number } {
  const y0 = Math.floor(y0frac * height);
  const y1 = Math.floor(y1frac * height);
  let sum = 0; let sqSum = 0; let n = 0;
  for (let y = Math.max(0, y0); y < Math.min(height, y1); y += step) {
    for (let x = 0; x < width; x += step) {
      const i = (width * y + x) << 2;
      const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      sum += lum; sqSum += lum * lum; n++;
    }
  }
  if (n === 0) return { mean: 128, contrast: 0 };
  const mean = sum / n;
  const contrast = Math.sqrt(Math.max(0, sqSum / n - mean * mean));
  return { mean, contrast };
}

/**
 * Count distinct hue buckets (out of 12) that are well-represented in the zone.
 * High count = many colors = likely a real character scene.
 * Low count (0-3) = monochromatic / gradient / abstract background.
 */
function sampleHueVariety(
  data: Buffer, width: number, height: number,
  y0frac: number, y1frac: number, step = 5
): number {
  const y0 = Math.floor(y0frac * height);
  const y1 = Math.floor(y1frac * height);
  const buckets = new Array(12).fill(0);
  let chromatic = 0;
  for (let y = y0; y < Math.min(height, y1); y += step) {
    for (let x = 0; x < width; x += step) {
      const i = (width * y + x) << 2;
      const r = data[i] / 255, g = data[i + 1] / 255, b = data[i + 2] / 255;
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      if (max - min < 0.12) continue; // near-achromatic — skip
      let h = 0;
      if (max === r) h = ((g - b) / (max - min) + 6) % 6;
      else if (max === g) h = (b - r) / (max - min) + 2;
      else h = (r - g) / (max - min) + 4;
      buckets[Math.floor((h / 6) * 12)]++;
      chromatic++;
    }
  }
  if (chromatic === 0) return 0;
  const threshold = chromatic * 0.05; // bucket must hold ≥ 5% of chromatic pixels
  return buckets.filter((b) => b > threshold).length; // 0–12
}

/** Image zone by layout + genre — area where the character/artwork is visible.
 *  Artwork-dominant genres now render full-bleed art with only a slim title zone, so the
 *  visible artwork stretches almost the whole cover below the title. */
function imageZone(layout: ConceptLayout, genre: CoverGenre): [number, number] {
  if (isArtworkDominant(genre)) {
    if (layout === "typographyFirst")  return [0.26, 0.96]; // below the slim (24%) title plate
    if (layout === "modernCommercial") return [0.28, 0.92]; // around the floating title card
    return [0.20, 0.98];                                    // fullImage: full-bleed hero
  }
  // Typography-dominant: artwork occupies a smaller supporting strip.
  if (layout === "typographyFirst")  return [0.40, 1.00];
  if (layout === "modernCommercial") return [0.42, 0.82];
  return [0.28, 0.92];
}

/**
 * Estimate the fraction of a zone occupied by a subject vs flat background, using a
 * coarse color histogram: the most common quantized color is treated as the background,
 * and pixels far from it count as subject. A flat sky/gradient scores low; a large
 * character or busy scene scores high. Returns 0–1 (no ML, pure pixel heuristic).
 */
function subjectCoverage(
  data: Buffer, width: number, height: number,
  y0frac: number, y1frac: number, step = 4
): number {
  const y0 = Math.max(0, Math.floor(y0frac * height));
  const y1 = Math.min(height, Math.floor(y1frac * height));
  const hist = new Array(512).fill(0); // 3 bits per channel → 8×8×8 buckets
  let total = 0;
  for (let y = y0; y < y1; y += step) {
    for (let x = 0; x < width; x += step) {
      const i = (width * y + x) << 2;
      const key = ((data[i] >> 5) << 6) | ((data[i + 1] >> 5) << 3) | (data[i + 2] >> 5);
      hist[key]++; total++;
    }
  }
  if (total === 0) return 0;
  let bgKey = 0, bgCount = 0;
  for (let k = 0; k < 512; k++) { if (hist[k] > bgCount) { bgCount = hist[k]; bgKey = k; } }
  const br = ((bgKey >> 6) & 7) * 32 + 16;
  const bgVal = ((bgKey >> 3) & 7) * 32 + 16;
  const bb = (bgKey & 7) * 32 + 16;
  let subject = 0;
  for (let y = y0; y < y1; y += step) {
    for (let x = 0; x < width; x += step) {
      const i = (width * y + x) << 2;
      const d = Math.abs(data[i] - br) + Math.abs(data[i + 1] - bgVal) + Math.abs(data[i + 2] - bb);
      if (d > 96) subject++;
    }
  }
  return subject / total;
}

export function scoreCoverDetailed(pngBytes: Uint8Array, opts: ScoreOpts): ScoreBreakdown {
  try {
    const png = PNG.sync.read(Buffer.from(pngBytes));
    const { width, height, data } = png;

    // ── Title readability (0–25) ─────────────────────────────────────────────
    const titleBand = sampleBand(data, width, height, opts.titleBand[0], opts.titleBand[1]);
    const darkness = Math.max(0, (200 - titleBand.mean) / 200);
    const titleSharpness = opts.titleLen <= 20 ? 1 : opts.titleLen <= 32 ? 0.8 : 0.6;
    const titleReadability = Math.round(darkness * 20 * titleSharpness + 5);

    // ── Subtitle readability (0–20) ──────────────────────────────────────────
    let subtitleReadability = 0;
    if (opts.hasSubtitle) {
      const subBand = sampleBand(data, width, height, opts.titleBand[1], Math.min(1, opts.titleBand[1] + 0.15));
      const subDark = Math.max(0, (210 - subBand.mean) / 210);
      subtitleReadability = Math.round(subDark * 15 + 5);
    } else {
      subtitleReadability = 8;
    }

    // ── Author visibility (0–15) ─────────────────────────────────────────────
    let authorVisibility = 0;
    if (opts.hasAuthor) {
      const authorBand = sampleBand(data, width, height, 0.82, 1.0);
      const authorDark = Math.max(0, (200 - authorBand.mean) / 200);
      authorVisibility = Math.round(authorDark * 10 + 5);
    } else {
      authorVisibility = 6;
    }

    // ── Visual balance (0–20) ────────────────────────────────────────────────
    const fullImg = sampleBand(data, width, height, 0, 1);
    const topThird = sampleBand(data, width, height, 0, 0.33);
    const midThird = sampleBand(data, width, height, 0.33, 0.66);
    const botThird = sampleBand(data, width, height, 0.66, 1);
    const variance = Math.abs(topThird.mean - midThird.mean) + Math.abs(midThird.mean - botThird.mean);
    const interest = Math.min(1, fullImg.contrast / 55);
    const balance = Math.min(1, variance / 100);
    const visualBalance = Math.round(interest * 12 + balance * 8);

    // ── Genre match (0–10) ───────────────────────────────────────────────────
    // For colorful genres: hue variety in the image zone detects character presence.
    // A flat gradient scores 1-3; a cartoon character scene scores 7-10.
    // For other genres: layout-based heuristic (layout quality proxy).
    let genreMatch: number;
    const genre = opts.genre ?? "";
    if (genre === "kids" || genre === "puzzle" || genre === "coloring") {
      const [z0, z1] = imageZone(opts.layout, genre as CoverGenre);
      const variety = sampleHueVariety(data, width, height, z0, z1);
      // 0 hue buckets → 1pt, 5 buckets → 9pt, 6+ → 10pt
      genreMatch = Math.min(10, Math.max(1, variety * 2 - 1));
    } else {
      genreMatch = opts.layout === "typographyFirst" ? 10
        : opts.layout === "modernCommercial" ? 9 : 8;
    }

    // ── Commercial potential (0–10) ──────────────────────────────────────────
    const hasContent = opts.hasSubtitle && opts.hasAuthor;
    const commercialPotential = hasContent ? 10 : opts.hasSubtitle || opts.hasAuthor ? 7 : 5;

    const overall = Math.min(100, Math.max(0,
      titleReadability + subtitleReadability + authorVisibility + visualBalance + genreMatch + commercialPotential
    ));

    return {
      titleReadability: Math.min(25, titleReadability),
      subtitleReadability: Math.min(20, subtitleReadability),
      authorVisibility: Math.min(15, authorVisibility),
      visualBalance: Math.min(20, visualBalance),
      genreMatch,
      commercialPotential,
      overall,
    };
  } catch {
    return {
      titleReadability: 16,
      subtitleReadability: 12,
      authorVisibility: 9,
      visualBalance: 12,
      genreMatch: 8,
      commercialPotential: 7,
      overall: 64,
    };
  }
}

/**
 * V4 commercial-composition score — models what makes top-100 Amazon KDP covers sell,
 * weighted by the genre's LayoutPriority. Pixel heuristics only (no ML):
 *   • subject coverage in the artwork zone ≈ how much the character/theme dominates
 *   • title-band darkness/contrast + title length ≈ thumbnail legibility
 *   • whether the dominant element matches the genre's ideal order ≈ visual hierarchy
 * All dimensions 0–100. `overall` is a genre-weighted blend.
 */
export function scoreVisualQuality(pngBytes: Uint8Array, opts: ScoreOpts): VisualQuality {
  try {
    const png = PNG.sync.read(Buffer.from(pngBytes));
    const { width, height, data } = png;

    const genre = (opts.genre ?? "business") as CoverGenre;
    const artwork = isArtworkDominant(genre);

    const [iz0, iz1] = imageZone(opts.layout, genre);
    const coverage = subjectCoverage(data, width, height, iz0, iz1);             // 0–1
    const artVariety = sampleHueVariety(data, width, height, iz0, iz1);          // 0–12
    const titleVariety = sampleHueVariety(data, width, height, opts.titleBand[0], opts.titleBand[1]);
    const titleBand = sampleBand(data, width, height, opts.titleBand[0], opts.titleBand[1]);
    const full = sampleBand(data, width, height, 0, 1);
    const fullVariety = sampleHueVariety(data, width, height, 0, 1);

    // 1. Character / subject dominance — how much of the cover the subject occupies.
    //    Target 60–80%: coverage·150 maps 0.67→100, 0.50→75, 0.40→60, 0.20→30.
    const characterDominance = pct(coverage * 150);

    // 2. Thumbnail visibility — title legible AND subject recognizable at ~120px.
    const darkness = Math.max(0, (200 - titleBand.mean) / 200);
    const lenFactor = opts.titleLen <= 18 ? 1 : opts.titleLen <= 30 ? 0.82 : 0.62;
    const titleLegible = (darkness * 0.6 + Math.min(1, titleBand.contrast / 60) * 0.4) * lenFactor;
    const subjectPresence = Math.min(1, coverage * 1.6);
    const thumbnailVisibility = pct((titleLegible * 0.55 + subjectPresence * 0.45) * 100);

    // 3. Typography balance — title fits its length AND sits over a clean (low-variety) zone.
    const cleanBand = Math.max(0, 1 - titleVariety / 6);
    const typographyBalance = pct((lenFactor * 0.5 + cleanBand * 0.5) * 100);

    // 4. Commercial appeal — color richness + tonal interest across the whole cover.
    const interest = Math.min(1, full.contrast / 55);
    const commercialAppeal = pct((Math.min(1, fullVariety / 8) * 0.6 + interest * 0.4) * 100);

    // 5. Visual hierarchy — does the dominant element match the genre's ideal order?
    //    Artwork genres: the artwork zone (coverage + variety) should clearly lead.
    //    Typography genres: the title block should clearly lead.
    const visualHierarchy = artwork
      ? pct(Math.min(1, coverage * 1.3 * 0.6 + (artVariety / 8) * 0.4) * 100)
      : pct((darkness * 0.6 + lenFactor * 0.4) * 100);

    // 6. Bestseller similarity — resemblance to top KDP layouts for this genre.
    const bestsellerSimilarity = artwork
      ? pct(0.50 * characterDominance + 0.30 * thumbnailVisibility + 0.20 * commercialAppeal)
      : pct(0.50 * thumbnailVisibility + 0.30 * typographyBalance + 0.20 * commercialAppeal);

    // Genre-weighted overall.
    const overall = artwork
      ? Math.round(
          0.34 * characterDominance + 0.24 * thumbnailVisibility + 0.18 * bestsellerSimilarity +
          0.14 * visualHierarchy + 0.05 * commercialAppeal + 0.05 * typographyBalance
        )
      : Math.round(
          0.30 * thumbnailVisibility + 0.24 * visualHierarchy + 0.18 * bestsellerSimilarity +
          0.13 * typographyBalance + 0.10 * commercialAppeal + 0.05 * characterDominance
        );

    return { characterDominance, thumbnailVisibility, visualHierarchy, bestsellerSimilarity, typographyBalance, commercialAppeal, overall };
  } catch {
    return {
      characterDominance: 60, thumbnailVisibility: 64, visualHierarchy: 62,
      bestsellerSimilarity: 62, typographyBalance: 60, commercialAppeal: 60, overall: 61,
    };
  }
}

/** Legacy single-number score for backward compat. */
export function scoreCover(
  pngBytes: Uint8Array,
  opts: { titleBand: [number, number]; hasSubtitle: boolean; hasAuthor: boolean; titleLen: number }
): number {
  return scoreCoverDetailed(pngBytes, { ...opts, layout: "fullImage" }).overall;
}
