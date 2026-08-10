/**
 * Cover Generator V2 — 3 genuinely different layout concepts.
 *
 * Concept A: fullImage       — cinematic full-bleed, floating text in safe zones
 * Concept B: typographyFirst — strong title block dominant, bestseller style
 * Concept C: modernCommercial— image lower half, design band upper half
 *
 * Safe zones: text is NEVER placed over the main subject area.
 * Genre-aware typography: each genre gets distinct font stack, weight, and color rules.
 */

import { COVER_GENRE_LABELS, isArtworkDominant, type CoverGenre, type ConceptLayout } from "./types";

const esc = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Greedy wrap into at most `maxLines`, targeting an even character count per line. */
function wrapToLines(title: string, maxLines: number): string[] {
  const words = title.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [""];
  const target = Math.ceil(title.length / maxLines);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if (cur && (cur + " " + w).length > target && lines.length < maxLines - 1) {
      lines.push(cur);
      cur = w;
    } else {
      cur = cur ? cur + " " + w : w;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

/**
 * Average glyph advance as a fraction of font size, per genre title font. Used to
 * size the title so it always fits its panel: the renderer runs with JavaScript
 * disabled, so no in-page measurement is possible and the fit must be computed here.
 * Values are deliberately slightly generous — overflow clips the title, which is
 * far worse than a title that is a point or two smaller than it could be.
 */
const TITLE_ADVANCE: Record<CoverGenre, number> = {
  business: 0.78,   // Montserrat 900, uppercase
  self_help: 0.60,  // Inter 800, mixed case
  puzzle: 0.66,     // Luckiest Guy, uppercase
  kids: 0.58,       // Baloo 2 800, mixed case
  coloring: 0.50,   // Pacifico script
  fiction: 0.74,    // Cinzel 800, uppercase
};

interface TitleFit {
  html: string;
  fontPt: number;
  lines: number;
}

/**
 * Choose the wrap + font size that fills the panel without ever overflowing it.
 * Tries 1–4 lines and keeps whichever renders largest inside both the available
 * width and height.
 */
function fitTitle(opts: {
  title: string;
  genre: CoverGenre;
  /** Usable text width in inches (panel width minus horizontal padding). */
  widthIn: number;
  /** Usable text height in inches. */
  heightIn: number;
  maxPt: number;
  minPt?: number;
  trackingEm: number;
  lineHeight: number;
}): TitleFit {
  const { title, genre, widthIn, heightIn, maxPt, trackingEm, lineHeight } = opts;
  const minPt = opts.minPt ?? 16;
  const advance = TITLE_ADVANCE[genre] + Math.max(0, trackingEm);
  const widthPt = widthIn * 72;
  const heightPt = heightIn * 72;

  let best: TitleFit | null = null;
  for (let maxLines = 1; maxLines <= 4; maxLines++) {
    const lines = wrapToLines(title, maxLines);
    if (lines.length > maxLines) continue;
    const longest = Math.max(...lines.map((l) => l.length), 1);
    const byWidth = widthPt / (longest * advance);
    const byHeight = heightPt / (lines.length * lineHeight);
    const fontPt = Math.floor(Math.min(maxPt, byWidth, byHeight));
    if (!best || fontPt > best.fontPt) {
      best = { html: lines.map(esc).join("<br>"), fontPt, lines: lines.length };
    }
  }

  const chosen = best ?? { html: esc(title), fontPt: minPt, lines: 1 };
  return { ...chosen, fontPt: Math.max(minPt, chosen.fontPt) };
}

/** Parse a `0.08em` style tracking value into a number for width estimation. */
function trackingEmOf(tracking: string): number {
  const m = /^(-?[\d.]+)em$/.exec(tracking.trim());
  return m ? Number(m[1]) : 0;
}

/**
 * Genre Typography Engine — each genre gets a dedicated identity: font family, weight,
 * title + subtitle treatment, a color system, and decoration rules. Fonts are loaded as
 * web fonts (see FONT_LINKS) so they render identically on every platform, including the
 * Linux Chromium used in production (system fonts like Arial Black / Trebuchet don't exist
 * there and would collapse every genre to the same fallback).
 */
interface GenreTypography {
  titleFont: string;
  titleWeight: number;
  titleTransform: string;
  titleTracking: string;
  titleColor: string;    // title fill color
  titleStroke: string;   // -webkit-text-stroke value (e.g. "2px #5b21b6" or "0px transparent")
  titleShadow: string;   // text-shadow value — part of the decoration system
  subtitleFont: string;
  subtitleWeight: number;
  subtitleStyle: string; // "normal" | "italic"
  subtitleColor: string;
  authorFont: string;
  accentBar: string;     // CSS color for the decorative bar/accent
  overlayStrong: string; // strong scrim for text areas
  overlayLight: string;  // lighter scrim for image areas
}

/**
 * Single combined Google Fonts request, injected into every cover's <head>. display=swap
 * keeps text visible while loading; renderPng additionally awaits document.fonts.ready so
 * the final screenshot always uses the real font, not the fallback.
 */
const FONT_LINKS =
  '<link rel="preconnect" href="https://fonts.googleapis.com">' +
  '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' +
  '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?' +
  "family=Baloo+2:wght@600;700;800&family=Cinzel:wght@600;700;800&" +
  "family=EB+Garamond:ital@0;1&family=Inter:wght@400;600;800;900&" +
  "family=Luckiest+Guy&family=Montserrat:wght@400;600;800;900&" +
  "family=Nunito:wght@400;700;800&family=Pacifico&family=Patrick+Hand&" +
  'family=Quicksand:wght@500;600;700&display=swap">';

const GENRE_TYPO: Record<CoverGenre, GenreTypography> = {
  // Premium · professional · minimalist — wide geometric caps, gold, max whitespace.
  business: {
    titleFont: "'Montserrat', 'Arial Black', Arial, sans-serif",
    titleWeight: 900,
    titleTransform: "uppercase",
    titleTracking: "0.08em",
    titleColor: "#ffffff",
    titleStroke: "0px transparent",
    titleShadow: "0 1px 8px rgba(0,0,0,0.35)",
    subtitleFont: "'Montserrat', Arial, sans-serif",
    subtitleWeight: 400,
    subtitleStyle: "normal",
    subtitleColor: "rgba(255,255,255,0.9)",
    authorFont: "'Montserrat', Arial, sans-serif",
    accentBar: "#c9a84c",
    overlayStrong: "rgba(10,20,40,0.82)",
    overlayLight: "rgba(10,20,40,0.35)",
  },
  // Ebook · modern · clean — neutral humanist sans, tight tracking, minimal.
  self_help: {
    titleFont: "'Inter', 'Helvetica Neue', Arial, sans-serif",
    titleWeight: 800,
    titleTransform: "none",
    titleTracking: "-0.01em",
    titleColor: "#ffffff",
    titleStroke: "0px transparent",
    titleShadow: "0 1px 10px rgba(0,0,0,0.4)",
    subtitleFont: "'Inter', Arial, sans-serif",
    subtitleWeight: 400,
    subtitleStyle: "normal",
    subtitleColor: "rgba(255,255,255,0.9)",
    authorFont: "'Inter', Arial, sans-serif",
    accentBar: "#e67e22",
    overlayStrong: "rgba(20,10,5,0.78)",
    overlayLight: "rgba(20,10,5,0.28)",
  },
  // Bold · energetic — comic display, yellow fill + navy outline, hard shadow.
  puzzle: {
    titleFont: "'Luckiest Guy', Impact, 'Arial Black', sans-serif",
    titleWeight: 400,
    titleTransform: "uppercase",
    titleTracking: "0.02em",
    titleColor: "#ffe14d",
    titleStroke: "3px #0b1457",
    titleShadow: "0 4px 0 rgba(0,0,0,0.45), 0 8px 16px rgba(0,0,0,0.4)",
    subtitleFont: "'Nunito', Arial, sans-serif",
    subtitleWeight: 800,
    subtitleStyle: "normal",
    subtitleColor: "rgba(255,255,255,0.95)",
    authorFont: "'Nunito', Arial, sans-serif",
    accentBar: "#f39c12",
    overlayStrong: "rgba(0,30,80,0.85)",
    overlayLight: "rgba(0,30,80,0.40)",
  },
  // Playful · rounded · colorful — soft rounded display, white fill + purple outline.
  kids: {
    titleFont: "'Baloo 2', 'Trebuchet MS', sans-serif",
    titleWeight: 800,
    titleTransform: "none",
    titleTracking: "0.01em",
    titleColor: "#ffffff",
    titleStroke: "2px #5b21b6",
    titleShadow: "0 3px 0 rgba(0,0,0,0.18), 0 6px 14px rgba(0,0,0,0.35)",
    subtitleFont: "'Quicksand', 'Trebuchet MS', sans-serif",
    subtitleWeight: 600,
    subtitleStyle: "normal",
    subtitleColor: "rgba(255,255,255,0.95)",
    authorFont: "'Quicksand', 'Trebuchet MS', sans-serif",
    accentBar: "#9b59b6",
    overlayStrong: "rgba(30,0,60,0.75)",
    overlayLight: "rgba(30,0,60,0.28)",
  },
  // Hand-drawn · artistic — brush script, cream ink, soft shadow, airy.
  coloring: {
    titleFont: "'Pacifico', 'Brush Script MT', cursive",
    titleWeight: 400,
    titleTransform: "none",
    titleTracking: "0.01em",
    titleColor: "#fff7ed",
    titleStroke: "0px transparent",
    titleShadow: "0 2px 10px rgba(0,0,0,0.4)",
    subtitleFont: "'Patrick Hand', 'Comic Sans MS', cursive",
    subtitleWeight: 400,
    subtitleStyle: "normal",
    subtitleColor: "rgba(255,247,237,0.92)",
    authorFont: "'Patrick Hand', 'Comic Sans MS', cursive",
    accentBar: "#14b8a6",
    overlayStrong: "rgba(0,50,60,0.72)",
    overlayLight: "rgba(0,50,60,0.22)",
  },
  // Cinematic · elegant — engraved Roman caps, epic tracking, italic serif subtitle.
  fiction: {
    titleFont: "'Cinzel', Georgia, 'Times New Roman', serif",
    titleWeight: 800,
    titleTransform: "uppercase",
    titleTracking: "0.12em",
    titleColor: "#f5efe0",
    titleStroke: "0px transparent",
    titleShadow: "0 2px 18px rgba(0,0,0,0.7), 0 1px 3px rgba(0,0,0,0.85)",
    subtitleFont: "'EB Garamond', Georgia, serif",
    subtitleWeight: 400,
    subtitleStyle: "italic",
    subtitleColor: "rgba(245,239,224,0.88)",
    authorFont: "'EB Garamond', Georgia, serif",
    accentBar: "#c0392b",
    overlayStrong: "rgba(5,0,15,0.88)",
    overlayLight: "rgba(5,0,15,0.42)",
  },
};

export type CoverBg = { kind: "image"; dataUri: string } | { kind: "gradient"; c1: string; c2: string };

const GENRE_GRADIENTS: Record<CoverGenre, [string, string]> = {
  business: ["#0f172a", "#1e3a5f"],
  self_help: ["#7c3a00", "#c05a00"],
  puzzle:    ["#1a237e", "#0d47a1"],
  kids:      ["#2d8fd5", "#1769aa"],
  coloring:  ["#004d40", "#00796b"],
  fiction:   ["#1a0a2e", "#6a1a3a"],
};

/**
 * Solid band colors for the two band-based layouts. Giving typographyFirst and
 * modernCommercial different shades means the 3 concepts no longer all share one
 * flat color (e.g. kids is no longer "always purple").
 */
const GENRE_BANDS: Record<CoverGenre, { typo: string; modern: string }> = {
  business:  { typo: "#0f172a", modern: "#13386b" },
  self_help: { typo: "#7c3a00", modern: "#a85000" },
  puzzle:    { typo: "#1a237e", modern: "#0d47a1" },
  kids:      { typo: "#2d8fd5", modern: "#e8743b" }, // sky blue + warm orange — kid-friendly, no purple
  coloring:  { typo: "#00695c", modern: "#00897b" },
  fiction:   { typo: "#1a0a2e", modern: "#5a1130" },
};

/** Title banner height (% of cover) for typographyFirst. Artwork-dominant genres get a
 *  slim top banner so ≥~76% of the cover stays artwork (the hero is never covered);
 *  typography-dominant genres (business, self-help) keep a large title-led banner. */
function typoBandPct(genre: CoverGenre): number {
  return isArtworkDominant(genre) ? 24 : 44;
}

/** Y-range (fraction of height) where the title text sits — used by the scorer to
 *  sample legibility. Genre-aware so it tracks the real band heights below. */
export function titleBandFor(layout: ConceptLayout, genre: CoverGenre): [number, number] {
  if (isArtworkDominant(genre)) {
    // Slim title zones pinned to the very top — artwork keeps the majority of the cover.
    if (layout === "typographyFirst") return [0.03, 0.24];
    if (layout === "modernCommercial") return [0.05, 0.26];
    return [0.03, 0.22]; // fullImage: title floats in a tight top safe-zone
  }
  // Typography-dominant: the title leads with a large block.
  if (layout === "fullImage") return [0.05, 0.24];
  if (layout === "typographyFirst") return [0.06, 0.36];
  return [0.05, 0.36];                                      // modernCommercial: upper band
}

// ─── Concept A: Full Image Premium ───────────────────────────────────────────
// Cinematic full-bleed image, safe zones top + bottom, subject in middle 50%
function layoutFullImage(opts: {
  g: GenreTypography;
  genre: CoverGenre;
  title: string;
  subtitle?: string;
  author?: string;
  bg: CoverBg;
  accentColor: string;
}): string {
  const { g, genre, title, subtitle, author, bg, accentColor } = opts;
  const [gc1, gc2] = GENRE_GRADIENTS[genre];
  const bgLayer = bg.kind === "image"
    ? `<img src="${bg.dataUri}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center">`
    : `<div style="position:absolute;inset:0;background:linear-gradient(160deg,${gc1},${gc2})"></div>`;

  // Top safe zone: 6in panel minus 0.5in padding each side; title keeps ~2.2in of height.
  const fit = fitTitle({
    title, genre, widthIn: 5.0, heightIn: 2.2, maxPt: 54,
    trackingEm: trackingEmOf(g.titleTracking), lineHeight: 1.05,
  });
  const titleFx = `color:${g.titleColor};-webkit-text-stroke:${g.titleStroke};paint-order:stroke fill;text-shadow:${g.titleShadow}`;

  return `<!doctype html><html><head><meta charset="utf-8">${FONT_LINKS}<style>
    *{margin:0;padding:0;box-sizing:border-box}
    html,body{width:100%;height:100%;overflow:hidden}
    .cover{position:relative;width:100vw;height:100vh;overflow:hidden;font-family:${g.titleFont}}

    /* Safe zone scrims: top 30% and bottom 25% darken for legibility */
    .scrim-top{position:absolute;left:0;right:0;top:0;height:35%;background:linear-gradient(180deg,${g.overlayStrong} 0%,rgba(0,0,0,0) 100%)}
    .scrim-bottom{position:absolute;left:0;right:0;bottom:0;height:30%;background:linear-gradient(0deg,${g.overlayStrong} 0%,rgba(0,0,0,0) 100%)}

    /* Title block sits in the TOP safe zone */
    .title-block{position:absolute;left:0;right:0;top:0;padding:0.55in 0.5in 0.3in}
    .accent-bar{width:2.2in;height:4px;background:${accentColor};margin-bottom:0.16in;border-radius:2px}
    .title{font-size:${fit.fontPt}pt;font-weight:${g.titleWeight};line-height:1.05;letter-spacing:${g.titleTracking};text-transform:${g.titleTransform};${titleFx};overflow-wrap:break-word}
    .subtitle{margin-top:0.13in;font-size:14pt;font-weight:${g.subtitleWeight};font-style:${g.subtitleStyle};font-family:${g.subtitleFont};color:${g.subtitleColor};text-shadow:0 1px 8px rgba(0,0,0,0.8);letter-spacing:0.02em}

    /* Author block in the BOTTOM safe zone */
    .author-block{position:absolute;left:0;right:0;bottom:0;padding:0 0.5in 0.55in}
    .author-line{width:1.5in;height:2px;background:${accentColor};opacity:0.8;margin-bottom:0.12in;border-radius:1px}
    .author{font-size:13pt;font-weight:600;font-family:${g.authorFont};color:rgba(255,255,255,0.95);text-shadow:0 1px 8px rgba(0,0,0,0.8);letter-spacing:0.08em;text-transform:uppercase}
  </style></head><body>
    <div class="cover">
      ${bgLayer}
      <div class="scrim-top"></div>
      <div class="scrim-bottom"></div>
      <div class="title-block">
        <div class="accent-bar"></div>
        <h1 class="title">${fit.html}</h1>
        ${subtitle ? `<p class="subtitle">${esc(subtitle)}</p>` : ""}
      </div>
      ${author ? `<div class="author-block"><div class="author-line"></div><div class="author">${esc(author)}</div></div>` : ""}
    </div>
  </body></html>`;
}

// ─── Concept B: Typography-First Bestseller ───────────────────────────────────
// Strong title block upper 55%, image pushes to lower 45%, high thumbnail readability
function layoutTypographyFirst(opts: {
  g: GenreTypography;
  genre: CoverGenre;
  title: string;
  subtitle?: string;
  author?: string;
  bg: CoverBg;
  accentColor: string;
}): string {
  const { g, genre, title, subtitle, author, bg, accentColor } = opts;
  const [gc1, gc2] = GENRE_GRADIENTS[genre];
  const band = GENRE_BANDS[genre].typo;
  const artwork = isArtworkDominant(genre);
  const bandPct = typoBandPct(genre);     // 24% (artwork-dominant) or 44% (typography-dominant)
  const gradTop = bandPct - 3;
  const authorTop = bandPct - 2;
  // object-position center keeps the large centered subject visible below the slim banner.
  const bgLayer = bg.kind === "image"
    ? `<img src="${bg.dataUri}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center">`
    : `<div style="position:absolute;inset:0;background:linear-gradient(160deg,${gc1},${gc2})"></div>`;

  // The slim artwork banner has no room for a second text line, so the subtitle is
  // shown once there — as the category label — and once as a subtitle otherwise.
  const showSubtitle = Boolean(subtitle) && !artwork;
  // Height left for the title inside the banner, after the label, rule, subtitle and author.
  const bandIn = (bandPct / 100) * 9;
  const reservedIn = 0.42 + 0.25 + 0.3 + (showSubtitle ? 0.34 : 0) + 0.34;
  const titleHeightIn = Math.max(0.6, bandIn - reservedIn);
  const fit = fitTitle({
    title, genre, widthIn: 5.0, heightIn: titleHeightIn,
    maxPt: artwork ? 44 : 64,
    trackingEm: trackingEmOf(g.titleTracking), lineHeight: 1.02,
  });
  const titleFx = `color:${g.titleColor};-webkit-text-stroke:${g.titleStroke};paint-order:stroke fill;text-shadow:${g.titleShadow}`;

  return `<!doctype html><html><head><meta charset="utf-8">${FONT_LINKS}<style>
    *{margin:0;padding:0;box-sizing:border-box}
    html,body{width:100%;height:100%;overflow:hidden}
    .cover{position:relative;width:100vw;height:100vh;overflow:hidden;font-family:${g.titleFont}}

    /* Title banner — opaque so the title is 100% legible at thumbnail size. Slim for
       artwork-dominant genres (${bandPct}%) so the hero below is never covered. */
    .upper-band{position:absolute;left:0;right:0;top:0;height:${bandPct}%;background:${band};z-index:1}
    .upper-band-gradient{position:absolute;left:0;right:0;top:${gradTop}%;height:9%;background:linear-gradient(180deg,${band},transparent);z-index:2}

    /* Image bleeds behind the lower portion */
    .image-layer{position:absolute;left:0;right:0;top:0;bottom:0}

    /* Text block inside the banner */
    .title-block{position:absolute;left:0;right:0;top:0;padding:0.42in 0.5in 0;z-index:3}
    .genre-label{font-size:9pt;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:${accentColor};margin-bottom:0.12in;font-family:${g.authorFont}}
    .title{font-size:${fit.fontPt}pt;font-weight:${g.titleWeight};line-height:1.02;letter-spacing:${g.titleTracking};text-transform:${g.titleTransform};${titleFx};overflow-wrap:break-word}
    .accent-rule{width:100%;height:3px;background:linear-gradient(90deg,${accentColor},transparent);margin:0.16in 0 0.12in;border-radius:2px}
    .subtitle{font-size:13pt;font-weight:${g.subtitleWeight};font-style:${g.subtitleStyle};font-family:${g.subtitleFont};color:${g.subtitleColor};letter-spacing:0.01em;line-height:1.35;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}

    /* Author at the bottom of the banner */
    .author-block{position:absolute;left:0.5in;right:0.5in;top:${authorTop}%;transform:translateY(-100%);z-index:3;padding-bottom:0.16in}
    .author{font-size:11pt;font-weight:700;font-family:${g.authorFont};color:${accentColor};letter-spacing:0.12em;text-transform:uppercase}

    /* Gentle fade at the very bottom for depth */
    .image-fade{position:absolute;left:0;right:0;bottom:0;height:32%;background:linear-gradient(0deg,rgba(0,0,0,0.45),transparent);z-index:2}
  </style></head><body>
    <div class="cover">
      <div class="image-layer">${bgLayer}</div>
      <div class="upper-band"></div>
      <div class="upper-band-gradient"></div>
      <div class="image-fade"></div>
      <div class="title-block">
        <div class="genre-label">${esc(artwork && subtitle ? subtitle : COVER_GENRE_LABELS[genre])}</div>
        <h1 class="title">${fit.html}</h1>
        <div class="accent-rule"></div>
        ${showSubtitle && subtitle ? `<p class="subtitle">${esc(subtitle)}</p>` : ""}
      </div>
      ${author ? `<div class="author-block"><div class="author">${esc(author)}</div></div>` : ""}
    </div>
  </body></html>`;
}

// ─── Concept C: Modern Commercial KDP ────────────────────────────────────────
// Clean design band top, full image lower, bestseller border/badge elements
function layoutModernCommercial(opts: {
  g: GenreTypography;
  genre: CoverGenre;
  title: string;
  subtitle?: string;
  author?: string;
  bg: CoverBg;
  accentColor: string;
}): string {
  const { g, genre, title, subtitle, author, bg, accentColor } = opts;
  const [gc1, gc2] = GENRE_GRADIENTS[genre];
  const band = GENRE_BANDS[genre].modern;
  const artwork = isArtworkDominant(genre);
  const titleFx = `color:${g.titleColor};-webkit-text-stroke:${g.titleStroke};paint-order:stroke fill;text-shadow:${g.titleShadow}`;
  const bgLayer = bg.kind === "image"
    ? `<img src="${bg.dataUri}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center ${artwork ? "55%" : "60%"}">`
    : `<div style="position:absolute;inset:0;background:linear-gradient(160deg,${gc1},${gc2})"></div>`;

  if (artwork) {
    // Artwork-dominant: full-bleed art with a compact floating title CARD near the top
    // and a slim author bar at the bottom. The hero keeps ~70% of the cover.
    // Floating card: 6in cover minus 0.32in offsets and 0.3in padding each side.
    const fit = fitTitle({
      title, genre, widthIn: 4.76, heightIn: 1.9, maxPt: 46,
      trackingEm: trackingEmOf(g.titleTracking), lineHeight: 1.04,
    });
    return `<!doctype html><html><head><meta charset="utf-8">${FONT_LINKS}<style>
    *{margin:0;padding:0;box-sizing:border-box}
    html,body{width:100%;height:100%;overflow:hidden}
    .cover{position:relative;width:100vw;height:100vh;overflow:hidden;font-family:${g.titleFont}}
    .image-layer{position:absolute;inset:0}

    /* Floating title card — solid for full thumbnail legibility, with an accent base rule */
    .title-card{position:absolute;left:0.32in;right:0.32in;top:0.34in;background:${band};border-radius:14px;
      border-bottom:5px solid ${accentColor};padding:0.26in 0.3in;z-index:3;box-shadow:0 6px 22px rgba(0,0,0,0.35)}
    .title{font-size:${fit.fontPt}pt;font-weight:${g.titleWeight};line-height:1.04;letter-spacing:${g.titleTracking};text-transform:${g.titleTransform};${titleFx};text-align:center;overflow-wrap:break-word}
    .subtitle{margin-top:0.08in;font-size:11pt;font-weight:${g.subtitleWeight};font-style:${g.subtitleStyle};font-family:${g.subtitleFont};color:${g.subtitleColor};letter-spacing:0.01em;text-align:center;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}

    /* Slim author bar at the very bottom */
    .bottom-band{position:absolute;left:0;right:0;bottom:0;height:10%;background:${band};z-index:2}
    .bottom-band-fade{position:absolute;left:0;right:0;bottom:10%;height:6%;background:linear-gradient(0deg,${band},transparent);z-index:2}
    .author-block{position:absolute;left:0;right:0;bottom:0;height:10%;display:flex;align-items:center;justify-content:center;padding:0 0.45in;z-index:4}
    .author-dot{width:6px;height:6px;border-radius:50%;background:${accentColor};margin-right:0.12in;flex-shrink:0}
    .author{font-size:12pt;font-weight:700;font-family:${g.authorFont};color:rgba(255,255,255,0.95);letter-spacing:0.1em;text-transform:uppercase}
  </style></head><body>
    <div class="cover">
      <div class="image-layer">${bgLayer}</div>
      <div class="bottom-band"></div>
      <div class="bottom-band-fade"></div>
      <div class="title-card">
        <h1 class="title">${fit.html}</h1>
        ${subtitle ? `<p class="subtitle">${esc(subtitle)}</p>` : ""}
      </div>
      ${author ? `<div class="author-block"><div class="author-dot"></div><div class="author">${esc(author)}</div></div>` : ""}
    </div>
  </body></html>`;
  }

  // Typography-dominant: the title leads via a thick top band; artwork supports below.
  // Band is 38% of 9in; 0.45in padding each side leaves 5.1in of text width.
  const fit = fitTitle({
    title, genre, widthIn: 5.1, heightIn: subtitle ? 2.2 : 2.6, maxPt: 54,
    trackingEm: trackingEmOf(g.titleTracking), lineHeight: 1.04,
  });
  return `<!doctype html><html><head><meta charset="utf-8">${FONT_LINKS}<style>
    *{margin:0;padding:0;box-sizing:border-box}
    html,body{width:100%;height:100%;overflow:hidden}
    .cover{position:relative;width:100vw;height:100vh;overflow:hidden;font-family:${g.titleFont}}

    /* Full bleed image */
    .image-layer{position:absolute;inset:0}

    /* Thick top band for title */
    .top-band{position:absolute;left:0;right:0;top:0;height:38%;background:${band};z-index:2}
    .top-band-fade{position:absolute;left:0;right:0;top:35%;height:12%;background:linear-gradient(180deg,${band},transparent);z-index:2}

    /* Thick bottom band for author */
    .bottom-band{position:absolute;left:0;right:0;bottom:0;height:14%;background:${band};z-index:2}
    .bottom-band-fade{position:absolute;left:0;right:0;bottom:13%;height:8%;background:linear-gradient(0deg,${band},transparent);z-index:2}

    /* Accent stripe — bold color line between band and image */
    .accent-stripe{position:absolute;left:0;right:0;top:37%;height:5px;background:${accentColor};z-index:3}
    .accent-stripe-bottom{position:absolute;left:0;right:0;bottom:13.5%;height:3px;background:${accentColor};z-index:3}

    /* Title inside top band */
    .title-block{position:absolute;left:0;right:0;top:0;height:38%;display:flex;flex-direction:column;justify-content:center;padding:0.2in 0.45in;z-index:4}
    .title{font-size:${fit.fontPt}pt;font-weight:${g.titleWeight};line-height:1.04;letter-spacing:${g.titleTracking};text-transform:${g.titleTransform};${titleFx};overflow-wrap:break-word}
    .subtitle{margin-top:0.1in;font-size:12pt;font-weight:${g.subtitleWeight};font-style:${g.subtitleStyle};font-family:${g.subtitleFont};color:${g.subtitleColor};letter-spacing:0.01em;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}

    /* Author inside bottom band */
    .author-block{position:absolute;left:0;right:0;bottom:0;height:14%;display:flex;align-items:center;padding:0 0.45in;z-index:4}
    .author-dot{width:6px;height:6px;border-radius:50%;background:${accentColor};margin-right:0.12in;flex-shrink:0}
    .author{font-size:12pt;font-weight:700;font-family:${g.authorFont};color:rgba(255,255,255,0.95);letter-spacing:0.1em;text-transform:uppercase}

    /* Middle image fade for depth */
    .mid-fade{position:absolute;left:0;right:0;top:38%;height:20%;background:linear-gradient(180deg,rgba(0,0,0,0.3),transparent);z-index:1}
  </style></head><body>
    <div class="cover">
      <div class="image-layer">${bgLayer}</div>
      <div class="top-band"></div>
      <div class="top-band-fade"></div>
      <div class="bottom-band"></div>
      <div class="bottom-band-fade"></div>
      <div class="accent-stripe"></div>
      <div class="accent-stripe-bottom"></div>
      <div class="mid-fade"></div>
      <div class="title-block">
        <h1 class="title">${fit.html}</h1>
        ${subtitle ? `<p class="subtitle">${esc(subtitle)}</p>` : ""}
      </div>
      ${author ? `<div class="author-block"><div class="author-dot"></div><div class="author">${esc(author)}</div></div>` : ""}
    </div>
  </body></html>`;
}

export function coverHtml(opts: {
  genre: CoverGenre;
  layout: ConceptLayout;
  title: string;
  subtitle?: string;
  author?: string;
  bg: CoverBg;
  accentColor?: string;
}): string {
  const g = GENRE_TYPO[opts.genre];
  const accentColor = opts.accentColor ?? g.accentBar;
  const shared = { g, genre: opts.genre, title: opts.title, subtitle: opts.subtitle, author: opts.author, bg: opts.bg, accentColor };

  switch (opts.layout) {
    case "typographyFirst":  return layoutTypographyFirst(shared);
    case "modernCommercial": return layoutModernCommercial(shared);
    default:                 return layoutFullImage(shared);
  }
}
