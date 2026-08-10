/**
 * Amazon category recommender — 3–5 categories. OpenRouter with a per-type
 * fallback list.
 */

import { generateJson } from "../ai/provider";
import { isAiConfigured } from "../ai/models";

export interface CategoryInput {
  bookType: string;
  theme?: string;
  audience?: string;
}

const FALLBACK: Record<string, string[]> = {
  word_search: ["Humor & Entertainment > Puzzles & Games > Word Search", "Crafts, Hobbies & Home > Crafts & Hobbies", "Children's Books > Activity Books"],
  sudoku: ["Humor & Entertainment > Puzzles & Games > Sudoku", "Humor & Entertainment > Puzzles & Games > Logic & Brain Teasers", "Self-Help > Memory Improvement"],
  maze: ["Humor & Entertainment > Puzzles & Games > Mazes", "Children's Books > Activity Books", "Crafts, Hobbies & Home > Crafts & Hobbies"],
  coloring: ["Crafts, Hobbies & Home > Crafts & Hobbies > Coloring Books for Grown-Ups", "Children's Books > Activity Books > Coloring Books", "Arts & Photography > Drawing"],
  ebook: ["Self-Help", "Education & Teaching", "Business & Money"],
};

function fallback(input: CategoryInput): string[] {
  return FALLBACK[input.bookType] ?? FALLBACK.ebook;
}

export async function recommendCategories(input: CategoryInput): Promise<string[]> {
  if (!isAiConfigured()) return fallback(input);
  try {
    const { data } = await generateJson<{ categories: unknown }>({
      system: "You are an Amazon KDP categorization expert. Reply with JSON only.",
      prompt: `Recommend 3–5 specific Amazon book browse categories (full path with ">") for a ${input.bookType} book. Theme: ${input.theme ?? "n/a"}. Audience: ${input.audience ?? "general"}.
Return JSON: {"categories": ["Path > Sub > Leaf", ...]}`,
      temperature: 0.4,
      maxTokens: 400,
      validate: (raw) => {
        const o = raw as { categories?: unknown };
        if (!Array.isArray(o.categories) || o.categories.length === 0) throw new Error("categories");
        return o as { categories: unknown };
      },
    });
    const cats = (data.categories as unknown[]).filter((c) => typeof c === "string").map((c) => (c as string).trim());
    return cats.length ? cats.slice(0, 5) : fallback(input);
  } catch {
    return fallback(input);
  }
}
