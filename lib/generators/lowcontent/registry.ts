/**
 * Low-content product registry — the sellable catalog exposed by one generator.
 * Label/blurb feed the picker UI; defaultTrim seeds the trim selector.
 */

import type { TrimSize } from "../../pdf/kdp-specs";
import type { LowContentLayout } from "./types";

export interface LowContentProduct {
  key: LowContentLayout;
  label: string;
  blurb: string;
  category: "Notebook" | "Planner" | "Tracker" | "Log Book";
  defaultTrim: TrimSize;
}

export const LOW_CONTENT_PRODUCTS: Record<LowContentLayout, LowContentProduct> = {
  lined: { key: "lined", label: "Lined Notebook", blurb: "Ruled journal / notebook", category: "Notebook", defaultTrim: "6x9" },
  dotgrid: { key: "dotgrid", label: "Dot-Grid Journal", blurb: "Bullet-journal dot matrix", category: "Notebook", defaultTrim: "6x9" },
  grid: { key: "grid", label: "Graph Notebook", blurb: "Square-grid / composition", category: "Notebook", defaultTrim: "8.5x11" },
  blank: { key: "blank", label: "Sketchbook", blurb: "Blank drawing pages", category: "Notebook", defaultTrim: "8.5x11" },
  planner_daily: { key: "planner_daily", label: "Daily Planner", blurb: "Schedule + priorities + to-do", category: "Planner", defaultTrim: "6x9" },
  planner_weekly: { key: "planner_weekly", label: "Weekly Planner", blurb: "7-day week spread", category: "Planner", defaultTrim: "8.5x11" },
  planner_monthly: { key: "planner_monthly", label: "Monthly Planner", blurb: "Month calendar grid", category: "Planner", defaultTrim: "8.5x11" },
  habit_tracker: { key: "habit_tracker", label: "Habit Tracker", blurb: "Habits × 31 days grid", category: "Tracker", defaultTrim: "8.5x11" },
  gratitude: { key: "gratitude", label: "Gratitude Journal", blurb: "Daily gratitude prompts", category: "Tracker", defaultTrim: "6x9" },
  budget: { key: "budget", label: "Budget Planner", blurb: "Income + expense tracking", category: "Tracker", defaultTrim: "8.5x11" },
  password: { key: "password", label: "Password Log Book", blurb: "Credential keeper", category: "Log Book", defaultTrim: "6x9" },
  fitness_log: { key: "fitness_log", label: "Workout Log", blurb: "Exercise & progress log", category: "Log Book", defaultTrim: "6x9" },
  health_log: { key: "health_log", label: "Health Log", blurb: "Blood pressure / readings log", category: "Log Book", defaultTrim: "6x9" },
  recipe: { key: "recipe", label: "Blank Recipe Book", blurb: "Ingredients + directions", category: "Log Book", defaultTrim: "8.5x11" },
};

/** Options for the picker UI — no internals leaked. */
export function lowContentPickerOptions(): Array<{ key: LowContentLayout; label: string; blurb: string; category: string }> {
  return (Object.keys(LOW_CONTENT_PRODUCTS) as LowContentLayout[]).map((k) => {
    const p = LOW_CONTENT_PRODUCTS[k];
    return { key: k, label: p.label, blurb: p.blurb, category: p.category };
  });
}
