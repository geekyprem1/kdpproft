export type ColoringAgeGroup = "toddlers" | "kids" | "adults";
export type ColoringStyle = "simple" | "cute" | "detailed" | "mandala" | "floral" | "geometric";

export const COLORING_AGE_GROUPS: ColoringAgeGroup[] = ["toddlers", "kids", "adults"];
export const COLORING_STYLES: ColoringStyle[] = ["simple", "cute", "detailed", "mandala", "floral", "geometric"];

/** Coloring book = title + N coloring pages + end page (N + 2 pages). */
export const MIN_COLORING_PAGES = 22; // N + 2 ≥ 24 (KDP minimum)

export interface ColoringPageResult {
  subject: string;
  /** PNG bytes of the line art. */
  bytes: Uint8Array;
  /** Whether the image passed the line-art validation. */
  valid: boolean;
  reasons: string[];
}
