/**
 * Letter / number tracing workbook — types.
 *
 * A kids' handwriting-practice book: one big example glyph per page plus rows of
 * light-grey glyphs on handwriting guide lines to trace over. Pure CSS, no AI.
 */

export type TracingSet = "uppercase" | "lowercase" | "numbers" | "words";
export const TRACING_SETS: TracingSet[] = ["uppercase", "lowercase", "numbers", "words"];

export function isTracingSet(v: unknown): v is TracingSet {
  return typeof v === "string" && (TRACING_SETS as string[]).includes(v);
}

export const MIN_TRACING_PAGES = 24; // KDP paperback minimum (incl. title page)
export const MAX_TRACING_PAGES = 60;
export const DEFAULT_TRACING_PAGES = 30;

/** Default simple sight words used by the "words" set. */
export const TRACING_WORDS = [
  "cat", "dog", "sun", "ball", "fish", "bird", "tree", "star",
  "book", "cake", "milk", "frog", "duck", "moon", "rain", "leaf",
  "home", "love", "play", "jump", "read", "sing", "hello", "smile",
];

export interface TracingOptions {
  set: TracingSet;
  /** Total interior pages including the title page. Clamped 24–60. */
  pageCount?: number;
  title?: string;
  subtitle?: string;
  author?: string;
  /** Override the word list for the "words" set. */
  words?: string[];
}
