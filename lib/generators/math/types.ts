/**
 * Math practice workbook — types.
 *
 * Generates arithmetic drills (addition/subtraction/multiplication/mixed) by
 * difficulty, with an answer-key section. Pure algorithm, no AI.
 */

export type MathOperation = "addition" | "subtraction" | "multiplication" | "mixed";
export const MATH_OPERATIONS: MathOperation[] = ["addition", "subtraction", "multiplication", "mixed"];

export function isMathOperation(v: unknown): v is MathOperation {
  return typeof v === "string" && (MATH_OPERATIONS as string[]).includes(v);
}

export type MathDifficulty = "easy" | "medium" | "hard";
export const MATH_DIFFICULTIES: MathDifficulty[] = ["easy", "medium", "hard"];

/** Number of practice pages (an answer-key section is added on top). */
export const MIN_MATH_PAGES = 20;
export const MAX_MATH_PAGES = 60;
export const DEFAULT_MATH_PAGES = 30;

export const PROBLEMS_PER_PAGE = 20;

export interface MathOptions {
  operation: MathOperation;
  difficulty?: MathDifficulty;
  /** Number of practice pages (24-page KDP minimum is met via practice + answer key). */
  pageCount?: number;
  seed?: number;
  title?: string;
  subtitle?: string;
  author?: string;
}

export interface MathProblem {
  a: number;
  b: number;
  op: "+" | "-" | "×";
  answer: number;
}
