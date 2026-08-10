/**
 * Shared Book Opportunity Engine — types.
 *
 * Used by both standalone Niche Research and (later) the inline Create-Book
 * recommendation. The AI supplies raw 0–100 factor estimates; the Opportunity
 * SCORE is computed deterministically (see score.ts).
 */

/** Book formats the engine can recommend (matches the unified Create types). */
export type BookType =
  | "word_search" | "sudoku" | "maze" | "coloring" | "ebook" | "story"
  | "lowcontent" | "tracing" | "math"
  | "scramble" | "cryptogram" | "dot_to_dot" | "crossword" | "activity";

export const BOOK_TYPE_LABELS: Record<BookType, string> = {
  word_search: "Word Search",
  sudoku: "Sudoku",
  maze: "Maze",
  coloring: "Coloring Book",
  ebook: "Ebook",
  story: "Story Book",
  lowcontent: "Journals & Planners",
  tracing: "Tracing Workbook",
  math: "Math Workbook",
  scramble: "Word Scramble",
  cryptogram: "Cryptogram",
  dot_to_dot: "Connect the Dots",
  crossword: "Crossword",
  activity: "Activity Book",
};

export const ALL_BOOK_TYPES: BookType[] = [
  "word_search",
  "sudoku",
  "maze",
  "coloring",
  "ebook",
  "story",
];

/** The four raw factors (0–100) the AI estimates. */
export interface OpportunityFactors {
  demand: number; // shopper search demand
  competition: number; // market saturation (higher = worse)
  evergreen: number; // year-round vs one-off
  monetization: number; // price ceiling × series/upsell potential
}

export type OpportunityBand = "Low" | "Medium" | "High" | "Excellent";

/** A recommended format for a niche, with fit and rationale. */
export interface RecommendedType {
  type: BookType;
  fit: number; // 0–100
  why: string;
}

/** The full engine output for one niche. */
export interface OpportunityResult {
  factors: OpportunityFactors;
  opportunity: number; // 0–100 composite (computed)
  band: OpportunityBand;
}
