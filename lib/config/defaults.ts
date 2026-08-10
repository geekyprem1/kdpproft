/**
 * Production defaults.
 *
 * These are the defaults used by the product going forward. Bleed support
 * remains fully implemented in the PDF engine but is OFF by default until the
 * Coloring Books phase (which needs edge-to-edge art). The current algorithmic
 * book types (Word Search / Sudoku / Maze) are text/line based and use no bleed.
 */

import type { TrimSize, PaperStock } from "../pdf/kdp-specs";

export type ProductionBookType = "word_search" | "sudoku" | "maze";

export const PRODUCTION_DEFAULTS = {
  /** No bleed for text/puzzle interiors. Flip per-book only for coloring (later). */
  bleed: false,
  /** Large-format default, ideal for puzzle books. */
  trim: "8.5x11" as TrimSize,
  paper: "white" as PaperStock,
  /** Book types available in the current phase. */
  bookTypes: ["word_search", "sudoku", "maze"] as ProductionBookType[],
  /** Default active type for the current vertical slice. */
  defaultBookType: "word_search" as ProductionBookType,
} as const;
