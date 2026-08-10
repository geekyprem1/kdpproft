/**
 * Cover V2 hybrid fallback.
 *
 * When the image model cannot spell the title, we stop asking it to. Instead it
 * produces wordless artwork and the V1 HTML typography engine sets the type over it —
 * which is exactly how the stable Cover Studio has always worked, so the text is
 * correct by construction rather than by verification.
 *
 * This is what lets V2 use a fast-but-imperfect model as its default: the worst case
 * is not a misspelled cover, it is a V1-quality cover.
 */

import { coverHtml } from "../cover/templates";
import { isArtworkDominant, type ConceptLayout, type CoverGenre } from "../cover/types";
import { renderPng } from "../pdf/render";
import { PRINT_DPI } from "./config";
import { CoverV2GeometryError } from "./errors";
import { pngSize, type Pixels } from "./geometry";
import type { CoverV2TextSpec } from "./types";

/**
 * Which V1 layout to set the type in. Artwork-dominant genres get the full-bleed
 * layout so the illustration stays the hero; typography-led genres get the banner
 * layout, which is what V1 already does for them.
 */
function layoutFor(genre: CoverGenre): ConceptLayout {
  return isArtworkDominant(genre) ? "fullImage" : "typographyFirst";
}

export interface HybridOptions {
  artwork: Uint8Array;
  /** Detected from the bytes when omitted — vendors return JPEG or PNG. */
  artworkMime?: string;
  text: CoverV2TextSpec;
  genre: CoverGenre;
  target: Pixels;
  accentColor?: string;
}

/**
 * Compose wordless artwork + V1 typography into a print-ready PNG at exactly the
 * KDP pixel size.
 */
export async function composeHybridCover(opts: HybridOptions): Promise<Uint8Array> {
  // Sniff rather than assume: klein/dev return JPEG, the Leonardo models can return PNG.
  const isPng = opts.artwork[0] === 0x89 && opts.artwork[1] === 0x50;
  const mime = opts.artworkMime ?? (isPng ? "image/png" : "image/jpeg");
  const dataUri = `data:${mime};base64,${Buffer.from(opts.artwork).toString("base64")}`;

  const html = coverHtml({
    genre: opts.genre,
    layout: layoutFor(opts.genre),
    title: opts.text.title,
    subtitle: opts.text.subtitle,
    author: opts.text.author,
    bg: { kind: "image", dataUri },
    accentColor: opts.accentColor,
  });

  // allowFontCdn: V1's genre typography is built on web fonts. Without them every
  // genre collapses to one fallback sans, which is the regression this codebase
  // already had to fix once.
  const png = await renderPng(html, {
    widthIn: opts.target.width / PRINT_DPI,
    heightIn: opts.target.height / PRINT_DPI,
    dpi: PRINT_DPI,
    allowFontCdn: true,
  });

  const actual = pngSize(png);
  if (!actual || actual.width !== opts.target.width || actual.height !== opts.target.height) {
    throw new CoverV2GeometryError(opts.target, actual ?? { width: 0, height: 0 });
  }
  return png;
}
