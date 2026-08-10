/**
 * AI title lab via OpenRouter (Gemini → DeepSeek). Given a working title
 * and book context, returns 10+ conversion-optimized title variations. Each
 * variation gets sub-factor estimates (clarity, keyword, emotion, click appeal)
 * from the model; the overall SCORE (0–100) and band are computed here so the
 * ranking stays deterministic and consistent across models.
 */

import { generateJson } from "./provider";
import { isAiConfigured } from "./models";

export interface TitleOptimizerInput {
  title: string;
  subtitle?: string;
  niche?: string;
  audience?: string;
  genre?: string;
}

export interface TitleFactors {
  /** Instantly communicates what the book is about. */
  clarity: number;
  /** Contains terms shoppers actually search for. */
  keyword: number;
  /** Emotional pull / promise of transformation. */
  emotion: number;
  /** Curiosity + urge to click through. */
  click: number;
}

export type TitleBand = "excellent" | "strong" | "average" | "weak";

export interface TitleVariation {
  title: string;
  subtitle: string | null;
  factors: TitleFactors;
  score: number;
  band: TitleBand;
  rationale: string;
}

export interface TitleOptimizerResult {
  variations: TitleVariation[];
  model: string;
}

const clamp = (n: unknown): number => {
  const v = Number(n);
  if (!Number.isFinite(v)) return 50;
  return Math.max(0, Math.min(100, Math.round(v)));
};

const str = (s: unknown, max = 200): string =>
  typeof s === "string" ? s.trim().slice(0, max) : "";

/** Weighted blend of the four sub-factors → single 0–100 title score. */
export function computeTitleScore(f: TitleFactors): number {
  const score = f.clarity * 0.3 + f.keyword * 0.3 + f.emotion * 0.2 + f.click * 0.2;
  return Math.round(Math.max(0, Math.min(100, score)));
}

export function titleBand(score: number): TitleBand {
  if (score >= 85) return "excellent";
  if (score >= 70) return "strong";
  if (score >= 50) return "average";
  return "weak";
}

interface RawVariation {
  title?: unknown;
  subtitle?: unknown;
  clarity?: unknown;
  keyword?: unknown;
  emotion?: unknown;
  click?: unknown;
  rationale?: unknown;
}

function toVariation(r: RawVariation): TitleVariation | null {
  const title = str(r.title, 160);
  if (!title) return null;
  const factors: TitleFactors = {
    clarity: clamp(r.clarity),
    keyword: clamp(r.keyword),
    emotion: clamp(r.emotion),
    click: clamp(r.click),
  };
  const score = computeTitleScore(factors);
  return {
    title,
    subtitle: str(r.subtitle, 200) || null,
    factors,
    score,
    band: titleBand(score),
    rationale: str(r.rationale, 200) || "—",
  };
}

export async function generateTitleVariations(
  input: TitleOptimizerInput
): Promise<TitleOptimizerResult> {
  if (!isAiConfigured()) {
    throw new Error("Title Lab requires OpenRouter (set OPENROUTER_API_KEY).");
  }

  const subtitle = input.subtitle?.trim() || "none provided";
  const niche = input.niche?.trim() || "general non-fiction";
  const audience = input.audience?.trim() || "a broad audience";
  const genre = input.genre?.trim() || "unspecified";

  const { data, model } = await generateJson<RawVariation[]>({
    system:
      "You are an Amazon KDP title strategist and direct-response copywriter. You craft " +
      "book titles that rank in search AND convert browsers into buyers. Give realistic, " +
      "differentiated estimates. Reply with JSON only.",
    prompt: `Generate exactly 12 distinct, conversion-optimized Amazon KDP title variations.

Working title: "${input.title}"
Current subtitle: ${subtitle}
Niche / topic: ${niche}
Target audience: ${audience}
Genre: ${genre}

Rules:
- Keep each main title punchy (ideally under 60 characters).
- Provide a complementary subtitle that adds keywords + the core benefit/promise.
- Vary the angles: benefit-driven, curiosity, keyword-first, numbered/listicle,
  transformation, authority, and one bold contrarian option.

For EACH variation, estimate these integers 0–100 (be realistic and differentiate them):
- clarity: instantly communicates what the book delivers
- keyword: contains terms shoppers actually search for on Amazon
- emotion: emotional pull / promise of transformation
- click: curiosity + urge to click and buy

Also give:
- rationale: ≤160 char note on why this title works and who it's for

Return JSON of EXACTLY this shape:
{"variations":[{"title":"...","subtitle":"...","clarity":0,"keyword":0,"emotion":0,"click":0,"rationale":"..."}]}`,
    temperature: 0.85,
    maxTokens: 3000,
    validate: (raw) => {
      const obj = raw as { variations?: unknown };
      const list = Array.isArray(obj?.variations)
        ? obj.variations
        : Array.isArray(raw)
          ? raw
          : null;
      if (!list || list.length === 0) throw new Error("no variations returned");
      return list as RawVariation[];
    },
  });

  const variations = data
    .map(toVariation)
    .filter((v): v is TitleVariation => v !== null)
    .sort((a, b) => b.score - a.score);

  if (variations.length === 0) throw new Error("no usable title variations");
  return { variations, model };
}
