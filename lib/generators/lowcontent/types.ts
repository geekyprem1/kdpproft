/**
 * Low-Content book generator — shared types.
 *
 * "Low-content" books (journals, planners, trackers, log books) are the highest-
 * margin KDP category: no AI, no algorithm — a single page layout repeated N times
 * plus a title page. One generator ships a whole catalog via the `layout` param.
 */

import type { TrimSize } from "../../pdf/kdp-specs";

export type LowContentLayout =
  | "lined"
  | "dotgrid"
  | "grid"
  | "blank"
  | "planner_daily"
  | "planner_weekly"
  | "planner_monthly"
  | "habit_tracker"
  | "gratitude"
  | "budget"
  | "password"
  | "fitness_log"
  | "health_log"
  | "recipe";

export const LOW_CONTENT_LAYOUTS: LowContentLayout[] = [
  "lined",
  "dotgrid",
  "grid",
  "blank",
  "planner_daily",
  "planner_weekly",
  "planner_monthly",
  "habit_tracker",
  "gratitude",
  "budget",
  "password",
  "fitness_log",
  "health_log",
  "recipe",
];

export function isLowContentLayout(v: unknown): v is LowContentLayout {
  return typeof v === "string" && (LOW_CONTENT_LAYOUTS as string[]).includes(v);
}

/** total interior pages incl. the title page. KDP paperback minimum is 24. */
export const MIN_LOW_CONTENT_PAGES = 24;
export const MAX_LOW_CONTENT_PAGES = 300;
export const DEFAULT_LOW_CONTENT_PAGES = 120;

export interface LowContentOptions {
  layout: LowContentLayout;
  /** Total interior pages including the title page. Clamped 24–300. */
  pageCount?: number;
  trim?: TrimSize;
  title?: string;
  subtitle?: string;
  author?: string;
  backText?: string;
  /** Print folio page numbers. Off by default — cleaner for journals/planners. */
  hasPageNumbers?: boolean;
}
