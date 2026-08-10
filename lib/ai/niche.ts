/**
 * AI niche research via OpenRouter (Gemini → DeepSeek). The model returns niche
 * ideas with raw 0–100 factor estimates + qualitative notes; the opportunity
 * SCORE and band are computed by the shared Opportunity Engine.
 */

import { generateJson } from "./provider";
import { isAiConfigured } from "./models";
import { computeOpportunity, opportunityBand } from "../opportunity/score";
import type { BookType, NicheIdea, NicheReportInput } from "../niche/types";

const clamp = (n: unknown): number => {
  const v = Number(n);
  if (!Number.isFinite(v)) return 50;
  return Math.max(0, Math.min(100, Math.round(v)));
};

const str = (s: unknown, max = 200): string =>
  typeof s === "string" ? s.trim().slice(0, max) : "";

const TYPE_SYNONYMS: Record<string, BookType> = {
  word_search: "word_search",
  wordsearch: "word_search",
  sudoku: "sudoku",
  maze: "maze",
  mazes: "maze",
  coloring: "coloring",
  coloring_book: "coloring",
  colouring: "coloring",
  ebook: "ebook",
  e_book: "ebook",
  book: "ebook",
  story: "story",
  story_book: "story",
  storybook: "story",
};

function coerceBookType(v: unknown): BookType | null {
  if (typeof v !== "string") return null;
  const key = v.toLowerCase().replace(/[\s-]+/g, "_");
  return TYPE_SYNONYMS[key] ?? null;
}

interface RawIdea {
  niche?: unknown;
  demand?: unknown;
  competition?: unknown;
  evergreen?: unknown;
  monetization?: unknown;
  seasonal?: unknown;
  monetizationNote?: unknown;
  recommendedBookType?: unknown;
  bookTypes?: unknown;
}

export interface NicheResearchResult {
  ideas: NicheIdea[];
  model: string;
}

export async function generateNicheResearch(
  input: NicheReportInput
): Promise<NicheResearchResult> {
  if (!isAiConfigured()) {
    throw new Error("Niche research requires OpenRouter (set OPENROUTER_API_KEY).");
  }

  const audience = input.audience?.trim() || "any audience";
  const category = input.category?.trim() || "low-content books, puzzles, and how-to ebooks";
  const country = input.country?.trim() || "the United States";

  const { data, model } = await generateJson<RawIdea[]>({
    system:
      "You are an Amazon KDP market research analyst covering low-content books, " +
      "puzzle/activity books, and how-to/non-fiction ebooks. Give realistic, " +
      "grounded estimates. Reply with JSON only.",
    prompt: `Generate exactly 20 distinct, profitable Amazon KDP niche ideas.

Seed topic/keyword: "${input.keyword}"
Target audience: ${audience}
Category focus: ${category}
Market/country: ${country}

For EACH niche, estimate these as integers 0–100 (be realistic and differentiate them):
- demand: how many shoppers search for this
- competition: how saturated it is (higher = more competition)
- evergreen: year-round vs. one-off demand
- monetization: price ceiling × series/expansion × upsell potential

Also give:
- seasonal: ≤120 char note on seasonality/trend timing
- monetizationNote: ≤120 char note on how to make money from it
- recommendedBookType: the single best fit, one of:
  word_search | sudoku | maze | coloring | ebook | story
- bookTypes: array of ALL suitable types from that same list (2–4 items)

Return JSON of EXACTLY this shape:
{"ideas":[{"niche":"...","demand":0,"competition":0,"evergreen":0,"monetization":0,"seasonal":"...","monetizationNote":"...","recommendedBookType":"ebook","bookTypes":["ebook","word_search"]}]}`,
    temperature: 0.8,
    maxTokens: 4000,
    validate: (raw) => {
      const obj = raw as { ideas?: unknown };
      const list = Array.isArray(obj?.ideas) ? obj.ideas : Array.isArray(raw) ? raw : null;
      if (!list || list.length === 0) throw new Error("no ideas returned");
      return list as RawIdea[];
    },
  });

  const ideas: NicheIdea[] = data
    .map((r): NicheIdea | null => {
      const niche = str(r.niche, 120);
      if (!niche) return null;
      const factors = {
        demand: clamp(r.demand),
        competition: clamp(r.competition),
        evergreen: clamp(r.evergreen),
        monetization: clamp(r.monetization),
      };
      const recommended = coerceBookType(r.recommendedBookType) ?? "ebook";
      const bookTypes = Array.isArray(r.bookTypes)
        ? Array.from(
            new Set(
              r.bookTypes.map(coerceBookType).filter((t): t is BookType => t !== null)
            )
          )
        : [];
      if (!bookTypes.includes(recommended)) bookTypes.unshift(recommended);

      const opportunity = computeOpportunity(factors);
      return {
        niche,
        factors,
        opportunity,
        band: opportunityBand(opportunity),
        seasonal: str(r.seasonal, 160) || "—",
        monetizationNote: str(r.monetizationNote, 160) || "—",
        recommendedBookType: recommended,
        bookTypes,
      };
    })
    .filter((x): x is NicheIdea => x !== null)
    .sort((a, b) => b.opportunity - a.opportunity);

  if (ideas.length === 0) throw new Error("no usable niche ideas");
  return { ideas, model };
}
