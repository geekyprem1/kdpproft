/**
 * Single-topic opportunity analysis for the Create wizard. Returns the four
 * factors + computed Opportunity score/band + a per-book-type fit ranking, so
 * the wizard can show scores and "Recommended / Good / Not Recommended" badges.
 */

import { generateJson } from "./provider";
import { isAiConfigured } from "./models";
import { computeOpportunity, opportunityBand } from "../opportunity/score";
import {
  ALL_BOOK_TYPES,
  type BookType,
  type OpportunityFactors,
  type OpportunityBand,
  type RecommendedType,
} from "../opportunity/types";

export interface TopicAnalysis {
  factors: OpportunityFactors;
  opportunity: number;
  band: OpportunityBand;
  summary: string;
  types: RecommendedType[]; // all types, sorted by fit desc
  model: string;
}

const clamp = (n: unknown): number => {
  const v = Number(n);
  if (!Number.isFinite(v)) return 50;
  return Math.max(0, Math.min(100, Math.round(v)));
};

const SYN: Record<string, BookType> = {
  word_search: "word_search",
  wordsearch: "word_search",
  sudoku: "sudoku",
  maze: "maze",
  coloring: "coloring",
  coloring_book: "coloring",
  ebook: "ebook",
  e_book: "ebook",
  story: "story",
  storybook: "story",
  story_book: "story",
};
const coerce = (v: unknown): BookType | null =>
  typeof v === "string" ? SYN[v.toLowerCase().replace(/[\s-]+/g, "_")] ?? null : null;

export interface AnalyzeInput {
  topic: string;
  audience?: string;
  category?: string;
  country?: string;
}

function fallback(): TopicAnalysis {
  const factors = { demand: 50, competition: 50, evergreen: 50, monetization: 50 };
  return {
    factors,
    opportunity: computeOpportunity(factors),
    band: opportunityBand(computeOpportunity(factors)),
    summary: "Estimate unavailable — using neutral defaults.",
    types: ALL_BOOK_TYPES.map((type) => ({ type, fit: 50, why: "Neutral default." })),
    model: "fallback",
  };
}

export async function analyzeTopic(input: AnalyzeInput): Promise<TopicAnalysis> {
  if (!isAiConfigured()) return fallback();

  const audience = input.audience?.trim() || "any audience";
  const category = input.category?.trim() || "low-content books, puzzles, and how-to ebooks";
  const country = input.country?.trim() || "the United States";

  try {
    const { data, model } = await generateJson<{
      demand: unknown;
      competition: unknown;
      evergreen: unknown;
      monetization: unknown;
      summary: unknown;
      types: Array<{ type: unknown; fit: unknown; why: unknown }>;
    }>({
      system:
        "You are an Amazon KDP market analyst. Estimate the opportunity for ONE topic " +
        "and how well it fits each book format. Reply with JSON only.",
      prompt: `Analyze this KDP topic:
Topic: "${input.topic}"
Audience: ${audience}
Category: ${category}
Market: ${country}

Estimate (integers 0–100): demand, competition (higher = more saturated), evergreen, monetization.
Give a ≤160-char summary.
Then rate FIT (0–100) of this topic for EACH book format with a ≤80-char reason:
  word_search, sudoku, maze, coloring, ebook, story
Return JSON:
{"demand":0,"competition":0,"evergreen":0,"monetization":0,"summary":"...","types":[{"type":"ebook","fit":0,"why":"..."}]}`,
      temperature: 0.5,
      maxTokens: 900,
      validate: (raw) => {
        const o = raw as Record<string, unknown>;
        if (!Array.isArray(o.types)) throw new Error("missing types[]");
        return o as never;
      },
    });

    const factors: OpportunityFactors = {
      demand: clamp(data.demand),
      competition: clamp(data.competition),
      evergreen: clamp(data.evergreen),
      monetization: clamp(data.monetization),
    };

    const byType = new Map<BookType, RecommendedType>();
    for (const t of data.types) {
      const type = coerce(t.type);
      if (!type || byType.has(type)) continue;
      byType.set(type, {
        type,
        fit: clamp(t.fit),
        why: typeof t.why === "string" ? t.why.trim().slice(0, 120) : "",
      });
    }
    // ensure every buildable type is present
    const types = ALL_BOOK_TYPES.map(
      (type) => byType.get(type) ?? { type, fit: 40, why: "" }
    ).sort((a, b) => b.fit - a.fit);

    const opportunity = computeOpportunity(factors);
    return {
      factors,
      opportunity,
      band: opportunityBand(opportunity),
      summary: typeof data.summary === "string" ? data.summary.trim().slice(0, 200) : "",
      types,
      model,
    };
  } catch {
    return fallback();
  }
}
