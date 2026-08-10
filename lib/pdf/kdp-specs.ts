/**
 * KDP print specifications.
 *
 * Encodes Amazon KDP's official paperback requirements so every PDF we emit is
 * compliant by construction. All math is sourced from KDP's published spec
 * tables (trim sizes, interior margins, bleed, spine width).
 *
 * Units: everything is computed in INCHES internally, with helpers to convert
 * to PDF points (1in = 72pt) and to pixels at a target DPI for raster assets.
 *
 * References (KDP Help):
 *  - Print options / trim sizes
 *  - Margins (gutter scales with page count)
 *  - Bleed = 0.125"
 *  - Spine width = pageCount * per-page thickness (paper-stock dependent)
 */

export const PT_PER_INCH = 72;

/** KDP bleed allowance applied to top, bottom, and outer edges. */
export const BLEED_IN = 0.125;

/** Minimum interior page count for a KDP paperback. */
export const MIN_PAGE_COUNT = 24;

export type TrimSize =
  | "5x8"
  | "5.25x8"
  | "5.5x8.5"
  | "6x9"
  | "7x10"
  | "8x10"
  | "8.5x11";

export interface TrimDimensions {
  widthIn: number;
  heightIn: number;
}

export const TRIM_SIZES: Record<TrimSize, TrimDimensions> = {
  "5x8": { widthIn: 5, heightIn: 8 },
  "5.25x8": { widthIn: 5.25, heightIn: 8 },
  "5.5x8.5": { widthIn: 5.5, heightIn: 8.5 },
  "6x9": { widthIn: 6, heightIn: 9 },
  "7x10": { widthIn: 7, heightIn: 10 },
  "8x10": { widthIn: 8, heightIn: 10 },
  "8.5x11": { widthIn: 8.5, heightIn: 11 },
};

/**
 * Trim sizes offered in book-creation UIs, in KDP's presentation order, with a
 * human label. `8x10` is intentionally omitted from the picker (rarely used for
 * text books) but stays valid in TRIM_SIZES for existing data.
 */
export const KDP_TRIM_OPTIONS: ReadonlyArray<{ value: TrimSize; label: string; recommended?: boolean }> = [
  { value: "5x8", label: '5" × 8"' },
  { value: "5.25x8", label: '5.25" × 8"' },
  { value: "5.5x8.5", label: '5.5" × 8.5"' },
  { value: "6x9", label: '6" × 9"', recommended: true },
  { value: "7x10", label: '7" × 10"' },
  { value: "8.5x11", label: '8.5" × 11"' },
];

/**
 * Per-page thickness in inches, by paper stock. Used for spine width.
 * (KDP published values.)
 */
export type PaperStock = "white" | "cream" | "color-standard" | "color-premium";

export const PAGE_THICKNESS_IN: Record<PaperStock, number> = {
  white: 0.002252,
  cream: 0.0025,
  "color-standard": 0.002252,
  "color-premium": 0.002347,
};

/**
 * Minimum INSIDE (gutter) margin by page count. KDP requires more binding
 * margin as the book gets thicker.
 */
export function minGutterIn(pageCount: number): number {
  if (pageCount <= 150) return 0.375;
  if (pageCount <= 300) return 0.5;
  if (pageCount <= 500) return 0.625;
  if (pageCount <= 700) return 0.75;
  return 0.875; // 701–828
}

/**
 * Minimum OUTSIDE margin (top/bottom/outer edge). KDP requires 0.25" without
 * bleed, and 0.375" of clearance from the trim when bleed is used.
 */
export function minOutsideMarginIn(bleed: boolean): number {
  return bleed ? 0.375 : 0.25;
}

export interface InteriorSpecInput {
  trim: TrimSize;
  pageCount: number;
  /** Whether content bleeds to the edge (coloring pages). Text books: false. */
  bleed?: boolean;
  /** Extra safety added on top of KDP minimums, in inches. Default 0.125". */
  safetyIn?: number;
  /**
   * Skip the KDP minimum-page-count guard. For fast dev/test previews ONLY — a
   * real KDP upload still needs >= MIN_PAGE_COUNT pages. Default false.
   */
  allowUnderMinimum?: boolean;
}

export interface InteriorSpec {
  trim: TrimSize;
  pageCount: number;
  bleed: boolean;
  /** Full PDF page size including any bleed. */
  pageWidthIn: number;
  pageHeightIn: number;
  /** Recommended content margins (>= KDP minimums + safety). */
  marginInsideIn: number;
  marginOutsideIn: number;
  marginTopIn: number;
  marginBottomIn: number;
}

/**
 * Compute the interior page geometry for a given trim + page count.
 *
 * With bleed, the PDF page is larger than the trim (KDP trims it back down):
 *   width  += BLEED            (outer edge only; the inner/binding edge is not trimmed)
 *   height += 2 * BLEED        (top + bottom)
 */
export function computeInterior(input: InteriorSpecInput): InteriorSpec {
  const { trim, pageCount } = input;
  const bleed = input.bleed ?? false;
  const safety = input.safetyIn ?? 0.125;

  if (!input.allowUnderMinimum && pageCount < MIN_PAGE_COUNT) {
    throw new Error(
      `KDP requires at least ${MIN_PAGE_COUNT} interior pages (got ${pageCount}).`
    );
  }

  const { widthIn, heightIn } = TRIM_SIZES[trim];

  const pageWidthIn = bleed ? widthIn + BLEED_IN : widthIn;
  const pageHeightIn = bleed ? heightIn + 2 * BLEED_IN : heightIn;

  const inside = minGutterIn(pageCount) + safety;
  const outside = minOutsideMarginIn(bleed) + safety;

  return {
    trim,
    pageCount,
    bleed,
    pageWidthIn,
    pageHeightIn,
    marginInsideIn: inside,
    marginOutsideIn: outside,
    marginTopIn: outside,
    marginBottomIn: outside,
  };
}

export interface CoverSpecInput {
  trim: TrimSize;
  pageCount: number;
  paper?: PaperStock;
}

export interface CoverSpec {
  trim: TrimSize;
  pageCount: number;
  paper: PaperStock;
  /** Full wraparound cover size, including bleed on all four sides. */
  fullWidthIn: number;
  fullHeightIn: number;
  spineWidthIn: number;
  /** Whether KDP allows printed text on the spine (needs >= 79 pages). */
  allowsSpineText: boolean;
  /** Offsets from the left edge of the full cover. */
  backStartIn: number; // = bleed
  spineStartIn: number; // back panel ends here
  frontStartIn: number; // spine ends here
  /** Panel widths (front/back equal the trim width). */
  panelWidthIn: number;
  bleedIn: number;
}

/**
 * Compute the wraparound paperback cover geometry.
 *
 *   spine        = pageCount * perPageThickness
 *   fullWidth    = bleed + backPanel + spine + frontPanel + bleed
 *   fullHeight   = bleed + trimHeight + bleed
 */
export function computeCover(input: CoverSpecInput): CoverSpec {
  const { trim, pageCount } = input;
  const paper = input.paper ?? "white";

  const { widthIn, heightIn } = TRIM_SIZES[trim];
  const spineWidthIn = pageCount * PAGE_THICKNESS_IN[paper];

  const fullWidthIn = 2 * BLEED_IN + 2 * widthIn + spineWidthIn;
  const fullHeightIn = 2 * BLEED_IN + heightIn;

  return {
    trim,
    pageCount,
    paper,
    fullWidthIn,
    fullHeightIn,
    spineWidthIn,
    allowsSpineText: pageCount >= 79,
    backStartIn: BLEED_IN,
    spineStartIn: BLEED_IN + widthIn,
    frontStartIn: BLEED_IN + widthIn + spineWidthIn,
    panelWidthIn: widthIn,
    bleedIn: BLEED_IN,
  };
}

// ── unit helpers ──────────────────────────────────────────────────────────

export const inToPt = (inches: number): number => inches * PT_PER_INCH;
export const inToPx = (inches: number, dpi: number): number =>
  Math.round(inches * dpi);

/** KDP requires raster assets at >= 300 DPI. */
export const KDP_MIN_DPI = 300;
